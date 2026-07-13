import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { EmbeddingsService } from './embeddings/embeddings.service';
import { EtlService } from './etl/etl.service';
import { EtlController } from './etl/etl.controller';

@Module({
  imports: [ScheduleModule.forRoot(), DatabaseModule],
  controllers: [EtlController],
  providers: [EmbeddingsService, EtlService],
})
export class AppModule {}
