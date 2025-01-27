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
import { promises as fs } from 'fs';
import { join } from 'path';

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

    this.recordAnalysisResults(analysisResults);

    return analysisResults;
  }

  private async recordAnalysisResults(
    results: TokenAnalysisResult[],
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `analysis-${timestamp}.json`;

    const analysisDir = join(process.cwd(), 'analysis');
    await fs.mkdir(analysisDir, { recursive: true });

    const formattedResults: any[] = [];

    results.forEach((res) => {
      formattedResults.push({
        token: res.token.metadata.name,
        price: `$${res.token.market.price_usd}`,
        buyingConfidence: `${(res.buyingConfidence.score * 100).toFixed(2)}%`,
      });
    });

    const content = JSON.stringify([...formattedResults, ...results], null, 2);

    const filepath = join(analysisDir, filename);
    await fs.writeFile(filepath, content, 'utf8');

    return filepath;
  }
}
