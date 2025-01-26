import {
  Controller,
  Post,
  Body,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { AgentService } from './agent.service';
import { MakeDecisionDto } from './dto/make-decision.dto';
import { LockService } from 'src/shared/services/lock.service';
import { TokenAnalysisResult } from './entities/analysis-result.type';
import { logResults } from './helpers/utils';

@Controller('agent')
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly lockService: LockService,
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

  // Test method
  @Post()
  @HttpCode(200)
  async makeDecision() {
    const analysisResults: TokenAnalysisResult[] =
      await this.agentService.seekMarketBuyingTargets();

    logResults(analysisResults);

    return analysisResults;
  }
}
