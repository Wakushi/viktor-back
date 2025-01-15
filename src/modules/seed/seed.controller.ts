import { Controller, Post, Query, ParseIntPipe } from '@nestjs/common';
import { SeedService } from './seed.service';

@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post()
  async seedDatabase(@Query('days', ParseIntPipe) days: number = 30) {
    return this.seedService.seedDatabase(days);
  }

  @Post('test-analysis')
  async testAnalysis(
    @Query('tokenCount', ParseIntPipe) tokenCount: number = 5,
    @Query('minTokens', ParseIntPipe) minTokens: number = 5,
    @Query('maxTokens', ParseIntPipe) maxTokens: number = 10,
  ) {
    const finalTokenCount = Math.min(
      Math.max(tokenCount, minTokens),
      maxTokens,
    );

    const results = await this.seedService.testAgentAnalysis(finalTokenCount);
    return results;
  }

  @Post('wipe')
  async wipeTestData() {
    await this.seedService.wipeTestData();
    return { message: 'Test data successfully wiped' };
  }
}
