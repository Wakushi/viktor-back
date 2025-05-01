import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  InternalServerErrorException,
  Param,
  Post,
} from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { Collection } from '../supabase/entities/collections.type';

@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Get()
  @HttpCode(200)
  async getAnalysisHistory() {
    const results = await this.analysisService.getAnalysisRecords(
      Collection.WEEK_ANALYSIS_RESULTS,
    );

    if (!results) return;

    const formattedResults = results.map((res) => ({
      ...res,
      analysis: JSON.parse(res.analysis),
      performance: res.performance ? JSON.parse(res.performance) : '',
    }));

    return formattedResults;
  }

  @Get('tokens')
  @HttpCode(200)
  async getWeekObservationsTokens() {
    const observations = await this.analysisService.getWeekObservations();

    if (!observations) throw new InternalServerErrorException();

    const tokens: Set<string> = new Set();

    observations.forEach((obs) => tokens.add(obs.token_name));

    return Array.from(tokens);
  }

  @Post()
  @HttpCode(200)
  async runAnalysis() {
    return await this.analysisService.seekMarketBuyingTargets();
  }

  @Post('train/:tokenName')
  @HttpCode(200)
  async trainAnalysis(@Param('tokenName') tokenName: string) {
    if (!tokenName) throw new BadRequestException('Missing token name');

    return await this.analysisService.trainAnalysis(tokenName);
  }

}
