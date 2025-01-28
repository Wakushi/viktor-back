import { Controller, Param, Post } from '@nestjs/common';
import { TrainingService } from './training.service';

@Controller('training')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Post('/:tokenName')
  async trainAgent(@Param('tokenName') tokenName: string) {
    const tokenSymbols = [tokenName];
    await this.trainingService.processTokensHistoricalData(tokenSymbols);
  }
}
