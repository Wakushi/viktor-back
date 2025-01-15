import { TokenMarketObservation } from 'src/modules/tokens/entities/token.type';

function calculateDecisionTypeStats(
  decisions: Array<{
    decision: TradingDecision;
    profitabilityScore: number;
  }>,
  profitableThreshold: number,
): {
  buyCount: number;
  sellCount: number;
  profitableBuyCount: number;
  profitableSellCount: number;
} {
  return decisions.reduce(
    (acc, { decision, profitabilityScore }) => {
      const isProfitable = profitabilityScore >= profitableThreshold;

      if (decision.decision_type === 'BUY') {
        acc.buyCount++;
        if (isProfitable) acc.profitableBuyCount++;
      } else {
        acc.sellCount++;
        if (isProfitable) acc.profitableSellCount++;
      }

      return acc;
    },
    {
      buyCount: 0,
      sellCount: 0,
      profitableBuyCount: 0,
      profitableSellCount: 0,
    },
  );
}

function calculateProfitabilityScore(decision: TradingDecision): number {
  if (decision.status !== 'COMPLETED') return 0;

  const calculateNonLinearPerformance = (percentChange: number) => {
    // More nuanced performance normalization
    if (percentChange > 0) {
      // Exponential growth reward
      return Math.min(1, Math.pow(percentChange / 10, 0.5));
    } else {
      // Steeper penalty for negative performance
      return Math.max(0, 1 + Math.tanh(percentChange / 10));
    }
  };

  if (decision.decision_type === 'BUY') {
    const shortTermScore =
      decision.price_change_24h_pct !== undefined
        ? calculateNonLinearPerformance(decision.price_change_24h_pct)
        : 0;

    const longTermScore =
      decision.price_change_7d_pct !== undefined
        ? calculateNonLinearPerformance(decision.price_change_7d_pct)
        : 0;

    // More dynamic weighting based on market volatility
    const shortTermWeight = 0.6;
    const longTermWeight = 0.4;

    return shortTermScore * shortTermWeight + longTermScore * longTermWeight;
  }

  if (decision.previous_buy_price_usd) {
    const sellProfitPercentage =
      ((decision.decision_price_usd - decision.previous_buy_price_usd) /
        decision.previous_buy_price_usd) *
      100;

    return calculateNonLinearPerformance(sellProfitPercentage);
  }

  return 0;
}

// Utility function to normalize similarity from [0.4, 1.0] to [0, 1.0]
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
  stats: {
    buyCount: number;
    sellCount: number;
    profitableBuyCount: number;
    profitableSellCount: number;
  },
  weights: {
    decisionTypeRatio: number;
    similarity: number;
    profitability: number;
    confidence: number;
  },
): number {
  const totalDecisions = stats.buyCount + stats.sellCount;
  if (totalDecisions === 0) return 0;

  // Decision type scoring remains the same
  const calculateDecisionTypeScore = () => {
    const profitableBuyRatio =
      stats.buyCount > 0 ? stats.profitableBuyCount / stats.buyCount : 0;
    const profitableSellRatio =
      stats.sellCount > 0 ? stats.profitableSellCount / stats.sellCount : 0;

    return Math.pow(
      profitableBuyRatio / (profitableBuyRatio + profitableSellRatio || 1),
      1.5,
    );
  };

  // Modified weighted score calculation with normalized similarities
  const calculateWeightedScore = (values: number[], similarities: number[]) => {
    if (values.length === 0) return 0;

    // Sort by normalized similarity
    const normalizedSimilarities = similarities.map(
      normalizeEmbeddingSimilarity,
    );
    const pairs = values.map((value, index) => ({
      value,
      similarity: normalizedSimilarities[index],
    }));
    const sortedPairs = [...pairs].sort((a, b) => b.similarity - a.similarity);

    // Apply exponential decay weighted by normalized similarity
    const weights = sortedPairs.map(
      (_, index) =>
        Math.pow(0.9, index) * (sortedPairs[index].similarity + 0.1), // Add small constant to prevent zero weights
    );

    const weightedSum = sortedPairs.reduce(
      (sum, pair, index) => sum + pair.value * weights[index],
      0,
    );

    return weightedSum / weights.reduce((a, b) => a + b, 0);
  };

  const decisionTypeScore = calculateDecisionTypeScore();
  const similarityScore = calculateWeightedScore(
    decisions.map((d) => d.similarity),
    decisions.map((d) => d.similarity), // Pass similarities twice since we're using them for both value and weight
  );
  const profitabilityScore = calculateWeightedScore(
    decisions.map((d) => d.profitabilityScore),
    decisions.map((d) => d.similarity),
  );
  const confidenceScore = calculateWeightedScore(
    decisions.map((d) => d.decision.confidence_score),
    decisions.map((d) => d.similarity),
  );

  return (
    decisionTypeScore * weights.decisionTypeRatio +
    similarityScore * weights.similarity +
    profitabilityScore * weights.profitability +
    confidenceScore * weights.confidence
  );
}

export {
  calculateProfitabilityScore,
  calculateDecisionTypeStats,
  calculateBuyingConfidence,
};
