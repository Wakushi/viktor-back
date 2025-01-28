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

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleAnalysisJob() {
    const start = Date.now();
    this.logger.log('Starting analysis task...');

    const analysisResults: TokenAnalysisResult[] =
      await this.agentService.seekMarketBuyingTargets();

    this.logger.log('Saving results..');

    this.saveAnalysisResults(analysisResults);

    const duration = Date.now() - start;
    this.logger.log(`Analysis task completed in ${duration}ms`);
  }

  private async saveAnalysisResults(
    results: TokenAnalysisResult[],
  ): Promise<void> {
    const formattedResults: any[] = [];

    results.forEach((res) => {
      formattedResults.push({
        token: res.token.metadata.name,
        price: `$${res.token.market.price_usd}`,
        buyingConfidence: `${(res.buyingConfidence.score * 100).toFixed(2)}%`,
      });
    });

    await this.supabaseService.insertAnalysisResult({
      analysis: JSON.stringify(
        {
          formattedResults,
          analysis: results,
        },
        null,
        2,
      ),
      created_at: new Date(),
    });
  }
}
