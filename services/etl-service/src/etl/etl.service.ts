import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { promises as fs } from 'fs';
import * as path from 'path';
import { DatabaseService } from '../database/database.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { config } from '../config';

// ── Shape of the incoming daily feed ────────────────────────────────
interface FeedPromotion {
  id: string;
  title: string;
  discount_pct?: number;
  starts_at?: string;
  ends_at?: string;
}
interface FeedProduct {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  brand?: string;
  description?: string;
  price?: { amount: number; currency?: string };
  promotion?: FeedPromotion;
}
interface FeedMerchant {
  id: string;
  name: string;
  type: string;
  city?: string;
  products: FeedProduct[];
}
interface Feed {
  feed_date?: string;
  merchants: FeedMerchant[];
}

@Injectable()
export class EtlService {
  private readonly logger = new Logger(EtlService.name);
  private running = false;

  constructor(
    private readonly db: DatabaseService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  /** Scheduled daily ingest. Cron expression comes from ETL_CRON. */
  @Cron(process.env.ETL_CRON || '0 2 * * *')
  async scheduled() {
    this.logger.log('Cron trigger fired');
    await this.runAll().catch((e) => this.logger.error(e.message));
  }

  /** Ingest every *.json file in the data directory. */
  async runAll() {
    if (this.running) {
      this.logger.warn('ETL already running — skipping');
      return { skipped: true };
    }
    this.running = true;
    try {
      const dir = path.resolve(config.dataDir);
      const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
      const results = [];
      for (const file of files) {
        results.push(await this.ingestFile(path.join(dir, file)));
      }
      return { files: results };
    } finally {
      this.running = false;
    }
  }

  /** Ingest a single feed file: transform → load → embed. */
  async ingestFile(filePath: string) {
    const fileName = path.basename(filePath);
    const runId = await this.startRun(fileName);
    this.logger.log(`Ingesting ${fileName}`);

    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const feed = JSON.parse(raw) as Feed;

      let records = 0;
      const toEmbed: { productId: string; content: string; metadata: any }[] = [];

      // Load structured data inside one transaction per file.
      await this.db.transaction(async (client) => {
        for (const merchant of feed.merchants || []) {
          await client.query(
            `INSERT INTO merchants (id, name, type, city, updated_at)
             VALUES ($1,$2,$3,$4, now())
             ON CONFLICT (id) DO UPDATE
               SET name = EXCLUDED.name, type = EXCLUDED.type,
                   city = EXCLUDED.city, updated_at = now()`,
            [merchant.id, merchant.name, merchant.type, merchant.city ?? null],
          );

          for (const p of merchant.products || []) {
            await client.query(
              `INSERT INTO products (id, merchant_id, name, category, subcategory, brand, description, updated_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7, now())
               ON CONFLICT (id) DO UPDATE
                 SET name = EXCLUDED.name, category = EXCLUDED.category,
                     subcategory = EXCLUDED.subcategory, brand = EXCLUDED.brand,
                     description = EXCLUDED.description, updated_at = now()`,
              [
                p.id, merchant.id, p.name, p.category,
                p.subcategory ?? null, p.brand ?? null, p.description ?? null,
              ],
            );

            if (p.price) {
              await client.query(
                `INSERT INTO prices (product_id, amount, currency, updated_at)
                 VALUES ($1,$2,$3, now())
                 ON CONFLICT (product_id) DO UPDATE
                   SET amount = EXCLUDED.amount, currency = EXCLUDED.currency, updated_at = now()`,
                [p.id, p.price.amount, p.price.currency ?? 'USD'],
              );
            }

            if (p.promotion) {
              const promo = p.promotion;
              await client.query(
                `INSERT INTO promotions (id, product_id, title, discount_pct, starts_at, ends_at, updated_at)
                 VALUES ($1,$2,$3,$4,$5,$6, now())
                 ON CONFLICT (id) DO UPDATE
                   SET title = EXCLUDED.title, discount_pct = EXCLUDED.discount_pct,
                       starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, updated_at = now()`,
                [
                  promo.id, p.id, promo.title, promo.discount_pct ?? null,
                  promo.starts_at ?? null, promo.ends_at ?? null,
                ],
              );
            }

            records++;
            toEmbed.push({
              productId: p.id,
              content: this.buildContent(merchant, p),
              metadata: {
                merchant: merchant.name,
                merchant_type: merchant.type,
                category: p.category,
                subcategory: p.subcategory,
                brand: p.brand,
                price: p.price?.amount,
                promotion: p.promotion?.title,
              },
            });
          }
        }
      });

      // Embed + upsert vectors in batches (outside the write transaction).
      const embedded = await this.embedDocuments(toEmbed);

      await this.finishRun(runId, 'success', records, embedded);
      this.logger.log(`Done ${fileName}: ${records} records, ${embedded} embedded`);
      return { file: fileName, records, embedded };
    } catch (err) {
      await this.finishRun(runId, 'failed', 0, 0, err.message);
      this.logger.error(`Failed ${fileName}: ${err.message}`);
      throw err;
    }
  }

  /** Natural-language string used for embedding + shown to Claude as context. */
  private buildContent(m: FeedMerchant, p: FeedProduct): string {
    const parts = [
      `${p.name}`,
      p.brand ? `by ${p.brand}` : '',
      `(${p.category}${p.subcategory ? ` / ${p.subcategory}` : ''})`,
      `sold at ${m.name}, a ${m.type}${m.city ? ` in ${m.city}` : ''}.`,
      p.description ? p.description : '',
      p.price ? `Price: ${p.price.amount} ${p.price.currency ?? 'USD'}.` : '',
      p.promotion
        ? `Promotion: ${p.promotion.title}${p.promotion.discount_pct ? ` (${p.promotion.discount_pct}% off)` : ''}.`
        : '',
    ];
    return parts.filter(Boolean).join(' ');
  }

  /** Embed in batches of 64 and upsert into the documents table. */
  private async embedDocuments(
    docs: { productId: string; content: string; metadata: any }[],
  ): Promise<number> {
    if (docs.length === 0) return 0;
    const BATCH = 64;
    let embedded = 0;

    for (let i = 0; i < docs.length; i += BATCH) {
      const batch = docs.slice(i, i + BATCH);
      const vectors = await this.embeddings.embed(batch.map((d) => d.content), 'document');

      for (let j = 0; j < batch.length; j++) {
        const doc = batch[j];
        const literal = this.embeddings.toVectorLiteral(vectors[j]);
        await this.db.query(
          `INSERT INTO documents (product_id, content, metadata, embedding, updated_at)
           VALUES ($1,$2,$3,$4::vector, now())
           ON CONFLICT (product_id) DO UPDATE
             SET content = EXCLUDED.content, metadata = EXCLUDED.metadata,
                 embedding = EXCLUDED.embedding, updated_at = now()`,
          [doc.productId, doc.content, JSON.stringify(doc.metadata), literal],
        );
        embedded++;
      }
      this.logger.log(`Embedded ${Math.min(i + BATCH, docs.length)}/${docs.length}`);
    }
    return embedded;
  }

  // ── etl_runs bookkeeping ──────────────────────────────────────────
  private async startRun(sourceFile: string): Promise<number> {
    const { rows } = await this.db.query<{ id: number }>(
      `INSERT INTO etl_runs (source_file, status) VALUES ($1,'running') RETURNING id`,
      [sourceFile],
    );
    return rows[0].id;
  }

  private async finishRun(
    id: number, status: string, records: number, embedded: number, error?: string,
  ) {
    await this.db.query(
      `UPDATE etl_runs
         SET finished_at = now(), status = $2, records = $3, embedded = $4, error = $5
       WHERE id = $1`,
      [id, status, records, embedded, error ?? null],
    );
  }

  async lastRun() {
    const { rows } = await this.db.query(
      `SELECT * FROM etl_runs ORDER BY started_at DESC LIMIT 5`,
    );
    return rows;
  }
}
