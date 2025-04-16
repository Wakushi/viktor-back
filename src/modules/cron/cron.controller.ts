import { Controller, HttpCode, Post } from '@nestjs/common';
import { CronService } from './cron.service';

@Controller('cron')
export class CronController {
  constructor(private readonly cronService: CronService) {}

  @Post()
  @HttpCode(200)
  async runCron() {
    await this.cronService.handleAnalysisJob();
  }

  @Post('week')
  @HttpCode(200)
  async runWeekAnalysisCron() {
    await this.cronService.handleWeekBasedAnalysisJob();
  }
}
