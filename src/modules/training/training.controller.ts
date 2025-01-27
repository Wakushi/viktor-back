import { Controller, Get, Param, Post } from '@nestjs/common';
import { TrainingService } from './training.service';
import { PuppeteerService } from 'src/shared/services/puppeteer.service';

@Controller('training')
export class TrainingController {
  constructor(
    private readonly trainingService: TrainingService,
    private readonly puppeteerService: PuppeteerService,
  ) {}

  @Post('/:tokenName')
  async trainAgent(@Param('tokenName') tokenName: string) {
    const tokenSymbols = [tokenName];
    await this.trainingService.processTokensHistoricalData(tokenSymbols);
  }

  @Get('fear')
  async getFearAndGreed() {
    const fearAndGreedIndex =
      await this.puppeteerService.getFearAndGreedIndex();

    return { fearAndGreedIndex };
  }
}
