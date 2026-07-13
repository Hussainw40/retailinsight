import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class AppModule {}
