import { Controller, HttpCode, Post, Body } from '@nestjs/common';
import { CronService } from './cron.service';

@Controller('cron')
export class CronController {
  constructor(private readonly cronService: CronService) {}

  @Post()
  @HttpCode(200)
  async runWeekAnalysisCron(@Body() body: { mode: 'test' | 'live' }) {
    await this.cronService.handleWeekBasedAnalysisJob(body.mode);
  }

  @Post('test')
  @HttpCode(200)
  async test() {
    await this.cronService.test();
  }
}
