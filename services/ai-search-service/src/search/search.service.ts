import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { DatabaseService } from '../database/database.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { config } from '../config';

interface RetrievedDoc {
  product_id: string;
  content: string;
  metadata: Record<string, any>;
  distance: number;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  // Use a placeholder when no key is set so the SDK constructor doesn't throw
  // at boot — actual calls are guarded in generate() and degrade gracefully.
  private readonly claude = new Anthropic({
    apiKey: config.anthropic.apiKey || 'not-configured',
  });

  constructor(
    private readonly db: DatabaseService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  /**
   * RAG pipeline:
   *   1. embed the query (Voyage)
   *   2. retrieve nearest documents (pgvector cosine distance)
   *   3. ground Claude on those documents and answer
   */
  async search(query: string) {
    if (!query?.trim()) {
      return { answer: 'Please enter a question.', sources: [] };
    }

    // 1 + 2 — retrieve
    const docs = await this.retrieve(query, config.topK);
    if (docs.length === 0) {
      return {
        answer:
          "I couldn't find anything in the catalog yet. Has the ETL run? " +
          'Try: curl -X POST http://localhost:3001/etl/run',
        sources: [],
      };
    }

    // 3 — generate a grounded answer
    const answer = await this.generate(query, docs);

    return {
      answer,
      sources: docs.map((d) => ({
        product_id: d.product_id,
        content: d.content,
        similarity: Number((1 - d.distance).toFixed(3)),
        ...d.metadata,
      })),
    };
  }

  /** Vector similarity search using the ivfflat cosine index. */
  private async retrieve(query: string, k: number): Promise<RetrievedDoc[]> {
    const vec = await this.embeddings.embedQuery(query);
    const literal = this.embeddings.toVectorLiteral(vec);

    const { rows } = await this.db.query<RetrievedDoc>(
      `SELECT product_id, content, metadata,
              embedding <=> $1::vector AS distance
       FROM documents
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [literal, k],
    );
    return rows;
  }

  /** Ask Claude to answer using ONLY the retrieved context. */
  private async generate(query: string, docs: RetrievedDoc[]): Promise<string> {
    if (!config.anthropic.apiKey) {
      // Degrade gracefully so the pipeline is still demoable without a key.
      return (
        'ANTHROPIC_API_KEY is not set, so here are the top matches instead:\n\n' +
        docs.map((d, i) => `${i + 1}. ${d.content}`).join('\n')
      );
    }

    const context = docs
      .map((d, i) => `[${i + 1}] ${d.content}`)
      .join('\n');

    const system =
      'You are a retail catalog assistant. Answer the user strictly from the ' +
      'CONTEXT below, which lists products, prices, and promotions. Cite the ' +
      'sources you used with their bracket numbers, e.g. [2]. If the context ' +
      "doesn't contain the answer, say so plainly — do not invent products or prices.";

    const response = await this.claude.messages.create({
      model: config.anthropic.model,
      max_tokens: 1024,
      system,
      messages: [
        {
          role: 'user',
          content: `CONTEXT:\n${context}\n\nQUESTION: ${query}`,
        },
      ],
    });

    return response.content
      .filter((b) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
      .trim();
  }
}
