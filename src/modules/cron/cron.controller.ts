import { Controller, HttpCode, Post, Body } from '@nestjs/common';
import { CronService } from './cron.service';

@Controller('cron')
export class CronController {
  constructor(private readonly cronService: CronService) {}

  @Post()
  @HttpCode(200)
  async runWeekAnalysisCron(
    @Body() body: { mode: 'test' | 'live'; skipPastAnalysis: string },
  ) {
    await this.cronService.handleWeekBasedAnalysisJob(
      body.mode,
      body.skipPastAnalysis === 'true',
    );
  }

  @Post('test')
  @HttpCode(200)
  async test() {
    await this.cronService.test();
  }
}
