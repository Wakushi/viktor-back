import {
  Controller,
  Post,
  Body,
  HttpCode,
  BadRequestException,
  Get,
  Param,
} from '@nestjs/common';
import { AgentService } from './agent.service';
import { MakeDecisionDto } from './dto/make-decision.dto';
import { LockService } from 'src/shared/services/lock.service';
import { TokenAnalysisResult } from './entities/analysis-result.type';

@Controller('agent')
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly lockService: LockService,
  ) {}

  @Post()
  @HttpCode(200)
  async makeDecision(@Body() makeDecisionDto: MakeDecisionDto) {
    const { uuid, wallet, owner } = makeDecisionDto;

    if (!uuid || !wallet || !owner) {
      throw new BadRequestException(
        'Missing one or more arguments (required: uuid, wallet, owner)',
      );
    }

    if (this.lockService.acquireLock(uuid)) {
      const analysisResults: TokenAnalysisResult[] =
        await this.agentService.seekMarketBuyingTargets();

      console.log('[Analysis result]: ', analysisResults);
    }

    return { message: 'Ok' };
  }

  @Get('token/:tokenId')
  @HttpCode(200)
  async checkTokenMetadata(@Param('tokenId') tokenId: string) {
    const COINGECKO_API = 'https://api.coingecko.com/api/v3';

    const response = await fetch(
      `${COINGECKO_API}/coins/${tokenId}?localization=false`,
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();

    return data;
  }
}
