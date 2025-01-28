import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TokenAnalysisResult } from '../agent/entities/analysis-result.type';
import { SupabaseService } from '../supabase/supabase.service';
import { AgentService } from '../agent/agent.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly agentService: AgentService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleAnalysisJob() {
    const start = Date.now();
    this.logger.log('Starting analysis task...');

    const analysisResults: TokenAnalysisResult[] =
      await this.agentService.seekMarketBuyingTargets();

    this.logger.log('Saving results..');

    this.supabaseService.saveAnalysisResults(analysisResults);

    const duration = Date.now() - start;
    this.logger.log(`Analysis task completed in ${duration}ms`);
  }
}
