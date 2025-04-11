import {
  BadRequestException,
  Controller,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { AnalysisService } from './analysis.service';

@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Post('/:tokenName')
  @HttpCode(200)
  async runAnalysis(@Param('tokenName') tokenName: string) {
    if (!tokenName) throw new BadRequestException('Missing token name');

    return await this.analysisService.analyzeToken(tokenName);
  }

  @Post('train/:tokenName')
  @HttpCode(200)
  async trainAnalysis(@Param('tokenName') tokenName: string) {
    if (!tokenName) throw new BadRequestException('Missing token name');

    return await this.analysisService.trainAnalysis(tokenName);
  }
}
