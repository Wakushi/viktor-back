import { Controller, Post } from '@nestjs/common';
import { TrainingService } from './training.service';

@Controller('training')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Post()
  async trainAgent() {
    return this.trainingService.processHistoricalData('link');
  }
}
