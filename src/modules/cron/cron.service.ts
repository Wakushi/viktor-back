import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { AnalysisService } from '../analysis/analysis.service';
import {
  DayAnalysisRecord,
  TokenWeekAnalysisResult,
} from '../analysis/entities/analysis.type';
import { PuppeteerService } from 'src/shared/services/puppeteer.service';
import { formatWeekAnalysisResults } from 'src/shared/utils/helpers';
import { Collection } from '../supabase/entities/collections.type';

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

      const onAnalysisEnd = () => {
        const duration = Date.now() - start;
        this.logger.log(`Analysis task completed in ${duration}ms`);
      };

      this.logger.log('Evaluating past week-based analysis...');

      await this.analysisService.evaluatePastAnalysis();

      this.logger.log(
        'Evaluated past analysis performances. Starting week-based analysis task...',
      );

      const analysisResults: TokenWeekAnalysisResult[] =
        await this.analysisService.seekMarketBuyingTargets();

      if (!analysisResults.length) {
        this.logger.log('Analysis produced no results !');
        onAnalysisEnd();
        return;
      }

      this.logger.log('Fetching fear and greed index..');

      const fearAndGreedIndex = await this.puppeteerService.getFearAndGreed();

      this.logger.log('Saving results..');

      this.saveWeekAnalysisRecords(analysisResults, fearAndGreedIndex);

      onAnalysisEnd();
    } catch (error) {
      this.logger.error(`Error during week analysis CRON Job: `, error);
    }
  }

  private async saveWeekAnalysisRecords(
    results: TokenWeekAnalysisResult[],
    fearAndGreedIndex: string,
  ): Promise<void> {
    if (!results.length) return;

    const formattedResults = formatWeekAnalysisResults(
      results,
      fearAndGreedIndex,
    );

    await this.supabaseService.insertSingle<DayAnalysisRecord>(
      Collection.WEEK_ANALYSIS_RESULTS,
      formattedResults,
    );
  }
}
