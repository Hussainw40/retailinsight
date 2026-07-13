import { Injectable } from '@nestjs/common';
import { config } from '../config';

/** Voyage AI embeddings — mirrors the ETL service so query and document
 *  vectors share one space. Here we only ever embed the user's query. */
@Injectable()
export class EmbeddingsService {
  private readonly endpoint = 'https://api.voyageai.com/v1/embeddings';

  async embedQuery(text: string): Promise<number[]> {
    if (!config.voyage.apiKey) {
      throw new Error('VOYAGE_API_KEY is not set — cannot embed the query');
    }
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.voyage.apiKey}`,
      },
      body: JSON.stringify({
        model: config.voyage.model,
        input: [text],
        input_type: 'query',
      }),
    });
    if (!res.ok) {
      throw new Error(`Voyage embeddings failed (${res.status}): ${await res.text()}`);
    }
    const json = (await res.json()) as { data: { embedding: number[] }[] };
    return json.data[0].embedding;
  }

  toVectorLiteral(vec: number[]): string {
    return `[${vec.join(',')}]`;
  }
}
