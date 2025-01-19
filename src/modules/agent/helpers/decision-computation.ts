import { TokenMarketObservation } from 'src/modules/tokens/entities/token.type';

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
    (acc, { decision, profitabilityScore }) => {
      const isProfitable = profitabilityScore >= profitableThreshold;

      if (decision.decision_type === 'BUY') {
        acc.buyCount++;
        if (isProfitable) {
          acc.profitableBuyCount++;
          acc.averageProfitPercent += decision.price_change_24h_pct || 0;
        }
      } else {
        acc.sellCount++;
        if (isProfitable) {
          acc.profitableSellCount++;
          acc.averageProfitPercent += Math.abs(
            decision.price_change_24h_pct || 0,
          );
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
): number {
  const totalDecisions = stats.buyCount + stats.sellCount;

  if (totalDecisions === 0) return 0;

  const calculateDecisionTypeScore = () => {
    if (stats.buyCount === 0 && stats.sellCount > 0) {
      return stats.profitableSellCount / stats.sellCount;
    }

    if (stats.sellCount === 0 && stats.buyCount > 0) {
      return stats.profitableBuyCount / stats.buyCount;
    }

    const profitableBuyRatio =
      stats.buyCount > 0 ? stats.profitableBuyCount / stats.buyCount : 0;
    const profitableSellRatio =
      stats.sellCount > 0 ? stats.profitableSellCount / stats.sellCount : 0;

    const recentProfitableRatio =
      stats.profitableBuyCount + stats.profitableSellCount > 0
        ? stats.averageProfitPercent /
          (stats.profitableBuyCount + stats.profitableSellCount)
        : 0;

    const profitabilityMultiplier =
      recentProfitableRatio !== 0
        ? Math.min(1.2, Math.max(0.8, recentProfitableRatio / 5))
        : 1.0;

    const decisionRatio =
      profitableBuyRatio + profitableSellRatio > 0
        ? profitableBuyRatio / (profitableBuyRatio + profitableSellRatio)
        : 0.5;

    return Math.pow(decisionRatio * profitabilityMultiplier, 1.5);
  };

  const calculateVolatilityScore = (
    marketCondition: TokenMarketObservation,
    decision: TradingDecision,
  ) => {
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

    return volatilityScore * 0.6 + positionScore * 0.4;
  };

  const calculateWeightedScore = (
    values: number[],
    similarities: number[],
    decisions: Array<{
      marketCondition: TokenMarketObservation;
      decision: TradingDecision;
    }>,
  ) => {
    if (values.length === 0) return 0;

    const normalizedSimilarities = similarities.map(
      normalizeEmbeddingSimilarity,
    );

    const weights = decisions.map((d, i) => {
      const timeWeight = Math.exp(
        -(Date.now() - new Date(d.decision.created_at).getTime()) /
          (30 * 24 * 60 * 60 * 1000),
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

    const total = weights.reduce((a, b) => a + b, 0);
    return values.reduce(
      (sum, value, i) => sum + value * (weights[i] / total),
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

  const confidenceScore = calculateWeightedScore(
    decisions.map((d) => d.decision.confidence_score),
    decisions.map((d) => d.similarity),
    decisions,
  );

  const volatilityAdjustment =
    decisions.reduce(
      (acc, d) => acc + calculateVolatilityScore(d.marketCondition, d.decision),
      0,
    ) / decisions.length;

  const baseScore =
    decisionTypeScore * weights.decisionTypeRatio +
    similarityScore * weights.similarity +
    profitabilityScore * weights.profitability +
    confidenceScore * weights.confidence;

  return baseScore * (0.85 + 0.15 * volatilityAdjustment);
}

export {
  calculateProfitabilityScore,
  calculateDecisionTypeStats,
  calculateBuyingConfidence,
};
