import { Controller, Get, Post } from '@nestjs/common';
import { EtlService } from './etl.service';

@Controller('etl')
export class EtlController {
  constructor(private readonly etl: EtlService) {}

  /** Kick off an ingest run immediately (also runs on cron). */
  @Post('run')
  async run() {
    return this.etl.runAll();
  }

  /** Last few ETL runs, newest first. */
  @Get('status')
  status() {
    return this.etl.lastRun();
  }

  @Get('health')
  health() {
    return { status: 'ok', service: 'etl-service' };
  }
}
