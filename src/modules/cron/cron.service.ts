import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TokenAnalysisResult } from '../agent/entities/analysis-result.type';
import { SupabaseService } from '../supabase/supabase.service';
import { AgentService } from '../agent/agent.service';
import { AnalysisService } from '../analysis/analysis.service';
import { TokenWeekAnalysisResult } from '../analysis/entities/analysis.type';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly agentService: AgentService,
    private readonly analysisService: AnalysisService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async handleAnalysisJob() {
    const start = Date.now();

    this.logger.log('Evaluating past analysis...');

    await this.agentService.evaluatePastAnalysis();

    this.logger.log(
      'Evaluated past analysis performances. Starting analysis task...',
    );

    const analysisResults: TokenAnalysisResult[] =
      await this.agentService.seekMarketBuyingTargets();

    this.logger.log('Fetching fear and greed index..');

    const fearAndGreedIndex = await this.agentService.getFearAndGreed();

    this.logger.log('Saving results..');

    this.supabaseService.saveAnalysisResults(
      analysisResults,
      fearAndGreedIndex,
    );

    const duration = Date.now() - start;
    this.logger.log(`Analysis task completed in ${duration}ms`);
  }

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

      const fearAndGreedIndex = await this.agentService.getFearAndGreed();

      this.logger.log('Saving results..');

      this.supabaseService.saveWeekAnalysisResults(
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
