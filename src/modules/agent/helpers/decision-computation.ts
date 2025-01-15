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

function calculateWeightedAverage(values: number[]): number {
  if (values.length === 0) return 0;

  const sortedValues = [...values].sort((a, b) => b - a);
  let weightedSum = 0;
  let weightSum = 0;

  sortedValues.forEach((value, index) => {
    const weight = 1 / (index + 1);
    weightedSum += value * weight;
    weightSum += weight;
  });

  return weightedSum / weightSum;
}

function normalizePerformance(percentageChange: number): number {
  const MAX_PERCENTAGE = 20;
  return Math.max(
    0,
    Math.min(1, (percentageChange + MAX_PERCENTAGE) / (2 * MAX_PERCENTAGE)),
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

  // More sophisticated decision type scoring
  const calculateDecisionTypeScore = () => {
    const profitableBuyRatio =
      stats.buyCount > 0 ? stats.profitableBuyCount / stats.buyCount : 0;
    const profitableSellRatio =
      stats.sellCount > 0 ? stats.profitableSellCount / stats.sellCount : 0;

    // Introduce more non-linearity
    return Math.pow(
      profitableBuyRatio / (profitableBuyRatio + profitableSellRatio || 1),
      1.5,
    );
  };

  // More dynamic weighted average that favors top performers
  const calculateWeightedScore = (values: number[]) => {
    if (values.length === 0) return 0;

    // Sort and apply exponential decay to weights
    const sortedValues = [...values].sort((a, b) => b - a);
    const weights = sortedValues.map((_, index) => Math.pow(0.9, index));

    const weightedSum = sortedValues.reduce(
      (sum, value, index) => sum + value * weights[index],
      0,
    );

    return weightedSum / weights.reduce((a, b) => a + b, 0);
  };

  const decisionTypeScore = calculateDecisionTypeScore();
  const similarityScore = calculateWeightedScore(
    decisions.map((d) => d.similarity),
  );
  const profitabilityScore = calculateWeightedScore(
    decisions.map((d) => d.profitabilityScore),
  );
  const confidenceScore = calculateWeightedScore(
    decisions.map((d) => d.decision.confidence_score),
  );

  // More dynamic weighting and combination
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
