import { Controller, Post, HttpCode } from '@nestjs/common';
import { MarketTestService } from './market-test.service';

@Controller('market-test')
export class MarketTestController {
  constructor(private readonly marketTestService: MarketTestService) {}

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
}
