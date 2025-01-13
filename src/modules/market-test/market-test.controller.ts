import { Controller, Post, HttpCode, Get } from '@nestjs/common';
import { MarketTestService } from './market-test.service';
import { MOCKED_TOKENS, WETH } from 'mocks/tokens';
import { FeeAmount } from '@uniswap/v3-sdk';
import { UniswapV3Service } from '../uniswap-v3/uniswap-v3.service';
import { TokenMarketData } from 'src/shared/services/token-data/entities/token.type';

@Controller('market-test')
export class MarketTestController {
  constructor(
    private readonly marketTestService: MarketTestService,
    private uniswapv3Service: UniswapV3Service,
  ) {}

  @Post('phase-transition')
  @HttpCode(200)
  async testPhaseTransition() {
    const results = await this.marketTestService.runPhaseTransitionTest();

    return {
      test: 'Phase Transition Test',
      baseCase: {
        price_change: results.baseCase.price_change_24h_pct,
        volume_change: results.baseCase.volume_change_24h_pct,
      },
      transitions: results.transitions.map((t) => ({
        price_change: t.price_change_24h_pct,
        volume_change: t.volume_change_24h_pct,
      })),
      results: results.results,
    };
  }

  @Post('signal-correlation')
  @HttpCode(200)
  async testSignalCorrelation() {
    const results = await this.marketTestService.runSignalCorrelationTest();

    return {
      test: 'Signal Correlation Test',
      baseCase: {
        price_change: results.baseCase.price_change_24h_pct,
        volume_change: results.baseCase.volume_change_24h_pct,
        sentiment: results.baseCase.sentiment_score,
      },
      variations: results.variations.map((v) => ({
        price_change: v.price_change_24h_pct,
        volume_change: v.volume_change_24h_pct,
        sentiment: v.sentiment_score,
      })),
      results: results.results,
    };
  }

  @Get('pools')
  @HttpCode(200)
  async checkPools() {
    const tokenA: TokenMarketData = MOCKED_TOKENS[2];
    const tokenB: TokenMarketData = WETH;

    const fees = [
      FeeAmount.LOWEST, // 0.01%
      FeeAmount.LOW, // 0.05%
      FeeAmount.MEDIUM, // 0.3%
      FeeAmount.HIGH, // 1%
    ];

    for (let fee of fees) {
      const exists = await this.uniswapv3Service.doesPoolExists({
        tokenA,
        tokenB,
        poolFee: fee,
      });

      if (exists) {
        console.log(
          `Pool found for Token ${tokenA.name} and ${tokenB.name} (${fee / 10000}% fee)`,
        );
      }
    }
  }
}
