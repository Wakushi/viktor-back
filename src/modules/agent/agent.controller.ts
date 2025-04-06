import { Controller, Post, HttpCode, Get } from '@nestjs/common';
import { AgentService } from './agent.service';
import { TokenAnalysisResult } from './entities/analysis-result.type';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('agent')
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Post('analysis')
  @HttpCode(200)
  async runManualAnalysis() {
    const analysisResults: TokenAnalysisResult[] =
      await this.agentService.seekMarketBuyingTargets();

    console.log('Fetching fear and greed index..');

    const fearAndGreedIndex = await this.agentService.getFearAndGreed();

    console.log('Saving results..');

    this.supabaseService.saveAnalysisResults(
      analysisResults,
      fearAndGreedIndex,
    );
  }

  @Get('analysis')
  @HttpCode(200)
  async getAnalysisHistory() {
    const results = await this.supabaseService.getAnalysisResults();

    if (!results) return;

    const formattedResults = results.map((res) => ({
      ...res,
      analysis: JSON.parse(res.analysis),
      performance: res.performance ? JSON.parse(res.performance) : '',
    }));

    return formattedResults;
  }

  @Get('ping')
  @HttpCode(200)
  async ping() {
    return {
      message: 'Ok',
    };
  }

  @Get('tokens')
  @HttpCode(200)
  async getTokensMetadata() {
    return await this.supabaseService.getTokensMetadata();
  }

  @Post('evaluate')
  @HttpCode(200)
  async manualEvaluation() {
    await this.agentService.evaluatePastAnalysis();
  }
}
