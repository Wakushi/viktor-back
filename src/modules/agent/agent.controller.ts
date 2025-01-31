import {
  Controller,
  Post,
  Body,
  HttpCode,
  BadRequestException,
  Get,
} from '@nestjs/common';
import { AgentService } from './agent.service';
import { MakeDecisionDto } from './dto/make-decision.dto';
import { LockService } from 'src/shared/services/lock.service';
import { TokenAnalysisResult } from './entities/analysis-result.type';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('agent')
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly lockService: LockService,
    private readonly supabaseService: SupabaseService,
  ) {}

  // Actual implementation
  // @Post()
  // @HttpCode(200)
  // async makeDecision(@Body() makeDecisionDto: MakeDecisionDto) {
  //   const { uuid, wallet, owner } = makeDecisionDto;

  //   if (!uuid || !wallet || !owner) {
  //     throw new BadRequestException(
  //       'Missing one or more arguments (required: uuid, wallet, owner)',
  //     );
  //   }

  //   if (this.lockService.acquireLock(uuid)) {
  //     const analysisResults: TokenAnalysisResult[] =
  //       await this.agentService.seekMarketBuyingTargets();

  //     console.log('[Analysis result]: ', analysisResults);
  //   }

  //   return { message: 'Ok' };
  // }

  @Post()
  @HttpCode(200)
  async makeDecision(@Body() payload: { save: boolean }) {
    const analysisResults: TokenAnalysisResult[] =
      await this.agentService.seekMarketBuyingTargets();

    if (payload.save) {
      await this.supabaseService.saveAnalysisResults(analysisResults);
    }

    return analysisResults;
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

  @Post('evaluate')
  @HttpCode(200)
  async manualEvaluation() {
    await this.agentService.evaluatePastAnalysis();
  }
}
