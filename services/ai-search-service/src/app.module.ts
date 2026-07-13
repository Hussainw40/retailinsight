import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { EmbeddingsService } from './embeddings/embeddings.service';
import { SearchController } from './search/search.controller';
import { SearchService } from './search/search.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SearchController],
  providers: [EmbeddingsService, SearchService],
})
export class AppModule {}
