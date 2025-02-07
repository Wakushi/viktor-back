import { TokenMarketObservation } from 'src/modules/tokens/entities/token.type';
import { TradingDecision } from '../entities/trading-decision.type';
import {
  BASE_WEIGHT,
  BuyingConfidenceResult,
  MIN_SAMPLE_SIZE,
  OPTIMAL_SAMPLE_SIZE,
  TIME_DECAY_DAYS,
  VOLATILITY_WEIGHT,
} from '../entities/analysis-result.type';

export type DecisionStats = {
  buyCount: number;
  sellCount: number;
  profitableBuyCount: number;
  profitableSellCount: number;
  averageProfitPercent: number;
};

function calculateDecisionTypeStats(
  decisions: Array<{
    decision: TradingDecision;
    profitabilityScore: number;
  }>,
  profitableThreshold: number,
): DecisionStats {
  return decisions.reduce(
    (acc, { decision }) => {
      const priceChange = decision.price_change_24h_pct || 0;

      if (decision.decision_type === 'BUY') {
        acc.buyCount++;

        if (priceChange >= profitableThreshold) {
          acc.profitableBuyCount++;
          acc.averageProfitPercent += priceChange;
        }
      } else {
        acc.sellCount++;

        if (priceChange <= -profitableThreshold) {
          acc.profitableSellCount++;
          acc.averageProfitPercent += Math.abs(priceChange);
        }
      }

      return acc;
    },
    {
      buyCount: 0,
      sellCount: 0,
      profitableBuyCount: 0,
      profitableSellCount: 0,
      averageProfitPercent: 0,
    },
  );
}
function calculateProfitabilityScore(decision: TradingDecision): number {
  if (decision.status !== 'COMPLETED') return 0;

  const calculatePerformanceScore = (percentChange: number) => {
    if (percentChange > 0) {
      return Math.min(1, Math.pow(percentChange / 10, 0.7));
    } else {
      return Math.max(0, 1 + Math.tanh(percentChange / 5));
    }
  };

  if (decision.decision_type === 'BUY') {
    return decision.price_change_24h_pct !== undefined
      ? calculatePerformanceScore(decision.price_change_24h_pct)
      : 0;
  }

  if (decision.previous_buy_price_usd) {
    const sellProfitPercentage =
      ((decision.decision_price_usd - decision.previous_buy_price_usd) /
        decision.previous_buy_price_usd) *
      100;

    return calculatePerformanceScore(sellProfitPercentage);
  }

  return 0;
}

function normalizeEmbeddingSimilarity(similarity: number): number {
  const MIN_BASELINE = 0.4;
  return Math.max(
    0,
    Math.min(1, (similarity - MIN_BASELINE) / (1 - MIN_BASELINE)),
  );
}

function calculateBuyingConfidence(
  decisions: Array<{
    marketCondition: TokenMarketObservation;
    decision: TradingDecision;
    similarity: number;
    profitabilityScore: number;
  }>,
  stats: DecisionStats,
  weights: {
    decisionTypeRatio: number;
    similarity: number;
    profitability: number;
    confidence: number;
  },
): BuyingConfidenceResult {
  const totalDecisions = stats.buyCount + stats.sellCount;

  if (totalDecisions === 0 || decisions.length === 0) {
    return {
      score: 0,
      sampleSizeConfidence: 0,
      metrics: {
        decisionTypeScore: 0,
        similarityScore: 0,
        profitabilityScore: 0,
        volatilityAdjustment: 0,
        sampleSizeConfidence: 0,
      },
    };
  }

  const calculateDecisionTypeScore = (): number => {
    if (stats.buyCount === 0 && stats.sellCount > 0) {
      return 1 - stats.profitableSellCount / stats.sellCount;
    }

    if (stats.sellCount === 0 && stats.buyCount > 0) {
      return stats.profitableBuyCount / stats.buyCount;
    }

    const profitableBuyRatio =
      stats.buyCount > 0 ? stats.profitableBuyCount / stats.buyCount : 0;
    const profitableSellRatio =
      stats.sellCount > 0 ? stats.profitableSellCount / stats.sellCount : 0;

    const buyWeight = stats.buyCount / totalDecisions;
    const sellWeight = stats.sellCount / totalDecisions;

    return profitableBuyRatio * buyWeight - profitableSellRatio * sellWeight;
  };

  const calculateVolatilityScore = (
    marketCondition: TokenMarketObservation,
    decision: TradingDecision,
  ): number => {
    if (!marketCondition.low_24h || marketCondition.low_24h <= 0) return 0;

    const priceRange =
      (marketCondition.high_24h - marketCondition.low_24h) /
      marketCondition.low_24h;

    const positionInRange =
      marketCondition.low_24h !== marketCondition.high_24h
        ? (decision.decision_price_usd - marketCondition.low_24h) /
          (marketCondition.high_24h - marketCondition.low_24h)
        : 0.5;

    const volatilityScore = Math.exp(-(Math.abs(priceRange - 0.1) / 0.1));
    const positionScore = Math.exp(-(positionInRange - 0.3) / 0.2);

    return Math.max(
      0,
      Math.min(1, volatilityScore * 0.6 + positionScore * 0.4),
    );
  };

  const calculateWeightedScore = (
    values: number[],
    similarities: number[],
    decisions: Array<{
      marketCondition: TokenMarketObservation;
      decision: TradingDecision;
    }>,
  ): number => {
    if (values.length === 0) return 0;

    const normalizedSimilarities = similarities.map(
      normalizeEmbeddingSimilarity,
    );

    const weights = decisions.map((d, i) => {
      const timeWeight = Math.exp(
        -(Date.now() - new Date(d.decision.created_at).getTime()) /
          (TIME_DECAY_DAYS * 24 * 60 * 60 * 1000),
      );

      const volatilityWeight = calculateVolatilityScore(
        d.marketCondition,
        d.decision,
      );

      return (
        normalizedSimilarities[i] * 0.5 +
        timeWeight * 0.3 +
        volatilityWeight * 0.2
      );
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    if (totalWeight === 0) return 0;

    return values.reduce(
      (sum, value, i) => sum + value * (weights[i] / totalWeight),
      0,
    );
  };

  const decisionTypeScore = calculateDecisionTypeScore();
  const similarityScore = calculateWeightedScore(
    decisions.map((d) => d.similarity),
    decisions.map((d) => d.similarity),
    decisions,
  );
  const profitabilityScore = calculateWeightedScore(
    decisions.map((d) => d.profitabilityScore),
    decisions.map((d) => d.similarity),
    decisions,
  );
  const volatilityAdjustment =
    decisions.reduce(
      (acc, d) => acc + calculateVolatilityScore(d.marketCondition, d.decision),
      0,
    ) / decisions.length;

  const sampleSizeConfidence = Math.min(
    1,
    Math.max(
      0,
      (decisions.length - MIN_SAMPLE_SIZE) /
        (OPTIMAL_SAMPLE_SIZE - MIN_SAMPLE_SIZE),
    ),
  );

  const baseScore =
    decisionTypeScore * weights.decisionTypeRatio +
    similarityScore * weights.similarity +
    profitabilityScore * weights.profitability;

  let finalScore =
    baseScore *
    (BASE_WEIGHT +
      volatilityAdjustment * VOLATILITY_WEIGHT +
      sampleSizeConfidence * 0.2);

  finalScore = Math.max(0, Math.min(1, finalScore));

  return {
    score: finalScore,
    sampleSizeConfidence: sampleSizeConfidence,
    metrics: {
      decisionTypeScore,
      similarityScore,
      profitabilityScore,
      volatilityAdjustment,
      sampleSizeConfidence,
    },
  };
}

export {
  calculateProfitabilityScore,
  calculateDecisionTypeStats,
  calculateBuyingConfidence,
};
