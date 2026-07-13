import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

interface ProductQuery {
  category?: string;
  subcategory?: string;
  search?: string;
  limit?: number;
}

@Injectable()
export class CatalogService {
  constructor(private readonly db: DatabaseService) {}

  /** Products joined with price, merchant, and any active promotion. */
  async products(q: ProductQuery) {
    const where: string[] = [];
    const params: any[] = [];

    if (q.category) {
      params.push(q.category);
      where.push(`p.category = $${params.length}`);
    }
    if (q.subcategory) {
      params.push(q.subcategory);
      where.push(`p.subcategory = $${params.length}`);
    }
    if (q.search) {
      params.push(`%${q.search}%`);
      where.push(`(p.name ILIKE $${params.length} OR p.brand ILIKE $${params.length})`);
    }

    params.push(Math.min(q.limit ?? 100, 500));
    const limitClause = `$${params.length}`;

    const sql = `
      SELECT p.id, p.name, p.category, p.subcategory, p.brand, p.description,
             m.name AS merchant, m.type AS merchant_type, m.city,
             pr.amount AS price, pr.currency,
             promo.title AS promotion, promo.discount_pct
      FROM products p
      LEFT JOIN merchants m  ON m.id = p.merchant_id
      LEFT JOIN prices pr    ON pr.product_id = p.id
      LEFT JOIN promotions promo ON promo.product_id = p.id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY p.name
      LIMIT ${limitClause}
    `;
    const { rows } = await this.db.query(sql, params);
    return rows;
  }

  /** Active promotions (today between start and end). */
  async promotions() {
    const { rows } = await this.db.query(`
      SELECT promo.id, promo.title, promo.discount_pct, promo.starts_at, promo.ends_at,
             p.name AS product, p.category, m.name AS merchant,
             pr.amount AS price, pr.currency
      FROM promotions promo
      JOIN products p     ON p.id = promo.product_id
      LEFT JOIN merchants m ON m.id = p.merchant_id
      LEFT JOIN prices pr   ON pr.product_id = p.id
      WHERE (promo.starts_at IS NULL OR promo.starts_at <= CURRENT_DATE)
        AND (promo.ends_at   IS NULL OR promo.ends_at   >= CURRENT_DATE)
      ORDER BY promo.discount_pct DESC NULLS LAST
    `);
    return rows;
  }

  /** Headline counts for the dashboard. */
  async stats() {
    const { rows } = await this.db.query(`
      SELECT
        (SELECT count(*) FROM merchants)  AS merchants,
        (SELECT count(*) FROM products)   AS products,
        (SELECT count(*) FROM promotions) AS promotions,
        (SELECT count(*) FROM documents WHERE embedding IS NOT NULL) AS embedded,
        (SELECT count(*) FROM products WHERE category = 'grocery')    AS grocery,
        (SELECT count(*) FROM products WHERE category = 'restaurant') AS restaurant
    `);
    return rows[0];
  }
}
