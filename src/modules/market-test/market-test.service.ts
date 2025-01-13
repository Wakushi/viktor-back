import { Injectable } from '@nestjs/common';
import { EmbeddingService } from '../embedding/embedding.service';
import {
  calculateNormalizedMetrics,
  detectMarketPhase,
  MarketObservation,
  transformToEmbeddingText,
} from './helpers/market-data-formatting';
import { SupabaseService } from '../supabase/supabase.service';
import {
  createPhaseTransitionTest,
  PhaseTransitionTest,
} from './helpers/create-phase-transition-test';
import {
  createSignalCorrelationTest,
  SignalCorrelationTest,
} from './helpers/create-signal-correlation-test';

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

  public async runSignalCorrelationTest(): Promise<SignalCorrelationTest> {
    await this.supabaseService.clearEmbeddingsTable();

    const test = createSignalCorrelationTest();

    await this.storeBaseCase(test);

    const similarities = await this.compareVariationsToBase(test);
    const correlations = this.calculateCorrelations(test);

    return {
      ...test,
      results: {
        similarities,
        correlations,
      },
    };
  }

  private async storeBaseCase(
    test: PhaseTransitionTest | SignalCorrelationTest,
  ): Promise<void> {
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

      const phaseMatch = text.match(/Market structure indicates (\w+) phase/);

      if (!phaseMatch) {
        const normalized = calculateNormalizedMetrics(
          observation,
          test.marketStats,
        );
        return detectMarketPhase(normalized, observation);
      }

      return phaseMatch[1];
    });
  }

  private async compareVariationsToBase(
    test: SignalCorrelationTest,
  ): Promise<number[]> {
    const compareVariation = async (
      variation: MarketObservation,
    ): Promise<number> => {
      const variationText = transformToEmbeddingText(
        variation,
        test.marketStats,
      );

      const matches = await this.embeddingService.findNearestMatch({
        query: variationText,
        matchThreshold: 0.1,
        matchCount: 1,
      });

      return matches[0]?.similarity || 0;
    };

    return Promise.all(test.variations.map(compareVariation));
  }

  private calculateCorrelations(test: SignalCorrelationTest): {
    priceVolume: number[];
    priceSentiment: number[];
    volumeSentiment: number[];
  } {
    const allObservations = [test.baseCase, ...test.variations];

    const calculateCorrelation = (data1: number[], data2: number[]): number => {
      const mean1 = data1.reduce((a, b) => a + b) / data1.length;
      const mean2 = data2.reduce((a, b) => a + b) / data2.length;

      const variance1 = data1.reduce((a, b) => a + Math.pow(b - mean1, 2), 0);
      const variance2 = data2.reduce((a, b) => a + Math.pow(b - mean2, 2), 0);

      const covariance = data1.reduce(
        (a, b, i) => a + (b - mean1) * (data2[i] - mean2),
        0,
      );

      return covariance / Math.sqrt(variance1 * variance2);
    };

    return {
      priceVolume: allObservations.map((_, i) =>
        calculateCorrelation(
          allObservations.slice(0, i + 1).map((o) => o.price_change_24h_pct),
          allObservations.slice(0, i + 1).map((o) => o.volume_change_24h_pct),
        ),
      ),
      priceSentiment: allObservations.map((_, i) =>
        calculateCorrelation(
          allObservations.slice(0, i + 1).map((o) => o.price_change_24h_pct),
          allObservations.slice(0, i + 1).map((o) => o.sentiment_score),
        ),
      ),
      volumeSentiment: allObservations.map((_, i) =>
        calculateCorrelation(
          allObservations.slice(0, i + 1).map((o) => o.volume_change_24h_pct),
          allObservations.slice(0, i + 1).map((o) => o.sentiment_score),
        ),
      ),
    };
  }
}
