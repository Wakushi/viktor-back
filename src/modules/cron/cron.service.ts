import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { AnalysisService } from '../analysis/analysis.service';
import { TokenWeekAnalysisResult } from '../analysis/entities/analysis.type';
import { PuppeteerService } from 'src/shared/services/puppeteer.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly puppeteerService: PuppeteerService,
    private readonly analysisService: AnalysisService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleWeekBasedAnalysisJob() {
    try {
      const start = Date.now();

      this.logger.log('Evaluating past week-based analysis...');

      await this.analysisService.evaluatePastAnalysis();

      this.logger.log(
        'Evaluated past analysis performances. Starting week-based analysis task...',
      );

      const analysisResults: TokenWeekAnalysisResult[] =
        await this.analysisService.seekMarketBuyingTargets();

      this.logger.log('Fetching fear and greed index..');

      const fearAndGreedIndex = await this.puppeteerService.getFearAndGreed();

      this.logger.log('Saving results..');

      this.supabaseService.saveWeekAnalysisRecords(
        analysisResults,
        fearAndGreedIndex,
      );

      const duration = Date.now() - start;

      this.logger.log(`Analysis task completed in ${duration}ms`);
    } catch (error) {
      this.logger.error(`Error during week analysis CRON Job: `, error);
    }
  }
}
