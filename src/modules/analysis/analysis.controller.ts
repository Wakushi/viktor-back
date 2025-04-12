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
import { SupabaseService } from '../supabase/supabase.service';

@Controller('analysis')
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Get()
  @HttpCode(200)
  async getWeekObservationsTokens() {
    const observations = await this.supabaseService.getWeekObservations();

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
