import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Pool, QueryResultRow } from 'pg';
import { config } from '../config';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  async onModuleInit() {
    this.pool = new Pool(config.db);
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
}
