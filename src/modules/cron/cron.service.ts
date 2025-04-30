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
import { LogGateway } from 'src/shared/services/log-gateway';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly puppeteerService: PuppeteerService,
    private readonly analysisService: AnalysisService,
    private readonly logGateway: LogGateway,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleWeekBasedAnalysisJob(mode: 'test' | 'live' = 'live') {
    if (mode === 'test') {
      this.log('Running complete analysis in test mode');
    }

    try {
      const start = Date.now();

      const onAnalysisEnd = () => {
        const duration = Date.now() - start;
        this.log(`Analysis task completed in ${duration}ms`);
      };

      if (mode === 'live') {
        this.log('Evaluating past week-based analysis...');

        await this.analysisService.evaluatePastAnalysis();

        this.log(
          'Evaluated past analysis performances. Starting week-based analysis task...',
        );
      }

      const analysisResults: TokenWeekAnalysisResult[] =
        await this.analysisService.seekMarketBuyingTargets();

      if (!analysisResults.length) {
        this.log('Analysis produced no results !');
        onAnalysisEnd();
        return;
      }

      this.log('Fetching fear and greed index..');

      const fearAndGreedIndex = await this.puppeteerService.getFearAndGreed();

      this.log('Saving results..');

      this.saveWeekAnalysisRecords({
        analysisResults,
        fearAndGreedIndex,
        test: mode === 'test',
      });

      onAnalysisEnd();
    } catch (error) {
      this.log(`Error during week analysis CRON Job: ` + JSON.stringify(error));
    }
  }

  private async saveWeekAnalysisRecords({
    analysisResults,
    fearAndGreedIndex,
    test,
  }: {
    analysisResults: TokenWeekAnalysisResult[];
    fearAndGreedIndex: string;
    test: boolean;
  }): Promise<void> {
    if (!analysisResults.length) return;

    const formattedResults = formatWeekAnalysisResults(
      analysisResults,
      fearAndGreedIndex,
    );

    if (test) {
      formattedResults.test = true;
    }

    await this.supabaseService.insertSingle<DayAnalysisRecord>(
      Collection.WEEK_ANALYSIS_RESULTS,
      formattedResults,
    );
  }

  private log(message: string) {
    this.logger.log(message);
    this.logGateway.sendLog(message);
  }
}
