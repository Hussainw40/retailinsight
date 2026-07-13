import { Injectable, Logger } from '@nestjs/common';
import { config } from '../config';

/**
 * Voyage AI embeddings client.
 *
 * Anthropic has no first-party embeddings API — Voyage is its recommended
 * partner. We use it to vectorize both the documents (at ingest) and the
 * user's query (at search time), so the two live in the same vector space.
 */
@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly endpoint = 'https://api.voyageai.com/v1/embeddings';

  /** Embed a batch of texts. `inputType` improves retrieval quality. */
  async embed(texts: string[], inputType: 'document' | 'query' = 'document'): Promise<number[][]> {
    if (!config.voyage.apiKey) {
      throw new Error('VOYAGE_API_KEY is not set — cannot generate embeddings');
    }
    if (texts.length === 0) return [];

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.voyage.apiKey}`,
      },
      body: JSON.stringify({
        model: config.voyage.model,
        input: texts,
        input_type: inputType,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Voyage embeddings failed (${res.status}): ${body}`);
    }

    const json = (await res.json()) as { data: { embedding: number[] }[] };
    return json.data.map((d) => d.embedding);
  }

  /** Format a JS number[] as a pgvector literal, e.g. "[0.1,0.2,...]". */
  toVectorLiteral(vec: number[]): string {
    return `[${vec.join(',')}]`;
  }
}
