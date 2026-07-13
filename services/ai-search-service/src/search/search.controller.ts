import { Body, Controller, Get, Post } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller()
export class SearchController {
  constructor(private readonly search: SearchService) {}

  /** Natural-language search over the catalog (RAG). */
  @Post('search')
  run(@Body('query') query: string) {
    return this.search.search(query);
  }

  @Get('health')
  health() {
    return { status: 'ok', service: 'ai-search-service' };
  }
}
