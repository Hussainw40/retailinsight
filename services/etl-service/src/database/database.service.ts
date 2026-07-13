import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { config } from '../config';

/**
 * Thin wrapper around a shared pg connection pool.
 * Injected everywhere a service needs the database.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  async onModuleInit() {
    this.pool = new Pool(config.db);
    // Retry a few times: the DB may still be warming up on first boot.
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        await this.pool.query('SELECT 1');
        this.logger.log('Connected to Postgres');
        return;
      } catch (err) {
        this.logger.warn(`DB not ready (attempt ${attempt}/10): ${err.message}`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    throw new Error('Could not connect to Postgres after 10 attempts');
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  query<T extends QueryResultRow = any>(text: string, params?: any[]) {
    return this.pool.query<T>(text, params);
  }

  /** Run a set of statements inside a single transaction. */
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
