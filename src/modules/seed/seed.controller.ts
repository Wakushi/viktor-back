import { Controller, Post, Query, ParseIntPipe } from '@nestjs/common';
import { SeedService } from './seed.service';
import { MOCK_MARKET_DATA, testToken } from './mocks/token-market-mocks';

@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post()
  async seedDatabase() {
    return this.seedService.seedDatabase(MOCK_MARKET_DATA);
  }

  @Post('test')
  async hardcodedTestAnalysis() {
    const MOCK_DATA = testToken;

    return await this.seedService.testAgentAnalysis(MOCK_DATA);
  }

  @Post('wipe')
  async wipeTestData() {
    await this.seedService.wipeTestData();
    return { message: 'Test data successfully wiped' };
  }
}
