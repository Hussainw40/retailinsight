import { Controller, Get, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('products')
  products(
    @Query('category') category?: string,
    @Query('subcategory') subcategory?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.catalog.products({
      category,
      subcategory,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('promotions')
  promotions() {
    return this.catalog.promotions();
  }

  @Get('stats')
  stats() {
    return this.catalog.stats();
  }

  @Get('health')
  health() {
    return { status: 'ok', service: 'api-service' };
  }
}
