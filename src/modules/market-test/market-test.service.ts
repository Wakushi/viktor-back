import { Injectable } from '@nestjs/common';
import { EmbeddingService } from '../embedding/embedding.service';
import {
  MarketObservation,
  transformToEmbeddingText,
} from './helpers/market-data-formatting';
import { SupabaseService } from '../supabase/supabase.service';
import {
  createPhaseTransitionTest,
  PhaseTransitionTest,
} from './helpers/create-phase-transition-test';

@Injectable()
export class MarketTestService {
  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly supabaseService: SupabaseService,
  ) {}

  public async runPhaseTransitionTest(): Promise<PhaseTransitionTest> {
    await this.supabaseService.clearEmbeddingsTable();

    const test = createPhaseTransitionTest();

    await this.storeBaseCase(test);

    const similarities = await this.compareTransitionsToBase(test);

    const marketPhases = this.getMarketPhases(test);

    return {
      ...test,
      results: {
        similarities,
        marketPhases,
      },
    };
  }

  private async storeBaseCase(test: PhaseTransitionTest): Promise<void> {
    const baseText = transformToEmbeddingText(test.baseCase, test.marketStats);
    await this.embeddingService.createSaveEmbeddings([baseText]);
  }

  private async compareTransitionsToBase(
    test: PhaseTransitionTest,
  ): Promise<number[]> {
    const compareTransition = async (
      transition: MarketObservation,
    ): Promise<number> => {
      const transitionText = transformToEmbeddingText(
        transition,
        test.marketStats,
      );

      const matches = await this.embeddingService.findNearestMatch({
        query: transitionText,
        matchThreshold: 0.1,
        matchCount: 1,
      });

      return matches[0]?.similarity || 0;
    };

    return Promise.all(test.transitions.map(compareTransition));
  }

  private getMarketPhases(test: PhaseTransitionTest): string[] {
    const allObservations = [test.baseCase, ...test.transitions];

    return allObservations.map((observation) => {
      const text = transformToEmbeddingText(observation, test.marketStats);
      return text.split('phase=')[1].trim();
    });
  }
}
