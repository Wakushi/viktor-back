import { MarketObservation } from '../entities/market-observation.type';

interface NormalizedMetrics {
  price_normalized: number;
  volume_normalized: number;
  liquidity_normalized: number;
  wallet_activity_ratio: number;
  volume_to_liquidity_ratio: number;
  social_engagement_ratio: number;
}

interface MarketStats {
  price: { min: number; max: number; mean: number; stdDev: number };
  volume: { min: number; max: number; mean: number; stdDev: number };
  liquidity: { min: number; max: number; mean: number; stdDev: number };
}

interface MarketNarratives {
  priceAction: string[];
  volumeActivity: string[];
  sentiment: string[];
  marketDynamics: string[];
  tradingContext: string[];
}

export function calculateStats(values: number[]): {
  min: number;
  max: number;
  mean: number;
  stdDev: number;
} {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const stdDev = Math.sqrt(
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length,
  );
  return { min, max, mean, stdDev };
}

function minMaxNormalize(value: number, min: number, max: number): number {
  if (min === max) {
    return 1;
  }
  return (value - min) / (max - min);
}

function calculateZScore(value: number, mean: number, stdDev: number): number {
  return (value - mean) / stdDev;
}

export function calculateNormalizedMetrics(
  observation: MarketObservation,
  stats: MarketStats,
): NormalizedMetrics {
  return {
    price_normalized: minMaxNormalize(
      observation.price_usd,
      stats.price.min,
      stats.price.max,
    ),
    volume_normalized: minMaxNormalize(
      observation.volume_24h_usd,
      stats.volume.min,
      stats.volume.max,
    ),
    liquidity_normalized: minMaxNormalize(
      observation.liquidity_usd,
      stats.liquidity.min,
      stats.liquidity.max,
    ),
    wallet_activity_ratio:
      observation.active_addresses_24h / observation.holder_count,
    volume_to_liquidity_ratio:
      observation.volume_24h_usd / observation.liquidity_usd,
    social_engagement_ratio:
      observation.social_volume_24h / observation.holder_count,
  };
}

function generateMarketNarratives(
  obs: MarketObservation,
  normalized: NormalizedMetrics,
): MarketNarratives {
  return {
    priceAction: generatePriceNarratives(obs, normalized),
    volumeActivity: generateVolumeNarratives(obs, normalized),
    sentiment: generateSentimentNarratives(obs),
    marketDynamics: generateMarketDynamicsNarratives(obs, normalized),
    tradingContext: generateTradingContextNarratives(obs, normalized),
  };
}

function generatePriceNarratives(
  obs: MarketObservation,
  normalized: NormalizedMetrics,
): string[] {
  const change = obs.price_change_24h_pct;
  const narratives: string[] = [];

  if (change <= -5) {
    narratives.push(
      `Sharp ${Math.abs(change).toFixed(1)}% price decline signals aggressive selling`,
    );
    if (change <= -10) {
      narratives.push(
        `Severe market pressure driving ${Math.abs(change).toFixed(1)}% drop`,
      );
    }
  } else if (change <= -2) {
    narratives.push(
      `Price declining ${Math.abs(change).toFixed(1)}% under moderate selling`,
    );
  } else if (change < 0) {
    narratives.push(`Minor price weakness of ${Math.abs(change).toFixed(1)}%`);
  } else if (change < 2) {
    narratives.push(`Stable price action with ${change.toFixed(1)}% movement`);
  } else if (change < 5) {
    narratives.push(`Price strengthening with ${change.toFixed(1)}% gain`);
  } else {
    narratives.push(
      `Strong ${change.toFixed(1)}% price advance shows buyer control`,
    );
    if (change >= 10) {
      narratives.push(
        `Powerful ${change.toFixed(1)}% rally indicates strong momentum`,
      );
    }
  }

  return narratives;
}

function generateVolumeNarratives(
  obs: MarketObservation,
  normalized: NormalizedMetrics,
): string[] {
  const change = obs.volume_change_24h_pct;
  const volLiqRatio = normalized.volume_to_liquidity_ratio;
  const narratives: string[] = [];

  const volLiqContext =
    volLiqRatio > 0.3
      ? 'volume exceeding typical liquidity levels'
      : volLiqRatio > 0.1
        ? 'reasonable volume to liquidity ratio'
        : 'low volume relative to available liquidity';

  if (change >= 50) {
    narratives.push(
      `Massive ${change.toFixed(1)}% volume surge with ${volLiqContext}`,
    );
    narratives.push('Trading activity showing exceptional intensity');
  } else if (change >= 15) {
    narratives.push(
      `Notable ${change.toFixed(1)}% increase in trading activity`,
    );
    narratives.push(`Elevated participation with ${volLiqContext}`);
  } else if (change >= 5) {
    narratives.push(`Volume up ${change.toFixed(1)}% with ${volLiqContext}`);
  } else if (change > -5) {
    narratives.push(`Standard trading volume with ${volLiqContext}`);
  } else if (change <= -15) {
    narratives.push(
      `Volume down ${Math.abs(change).toFixed(1)}% showing reduced interest`,
    );
    narratives.push(`Declining participation with ${volLiqContext}`);
  } else {
    narratives.push(
      `Slightly reduced volume at ${Math.abs(change).toFixed(1)}% below average`,
    );
  }

  return narratives;
}

function generateSentimentNarratives(obs: MarketObservation): string[] {
  const sentiment = obs.sentiment_score;
  const narratives: string[] = [];

  const socialContext =
    obs.social_volume_24h > 1000
      ? 'high social engagement'
      : obs.social_volume_24h > 100
        ? 'moderate social activity'
        : 'low social presence';

  if (sentiment <= -0.5) {
    narratives.push(
      `Strongly bearish sentiment at ${sentiment.toFixed(2)} with ${socialContext}`,
    );
    narratives.push('Market psychology shows significant fear');
  } else if (sentiment <= -0.2) {
    narratives.push(
      `Cautious sentiment reading ${sentiment.toFixed(2)} amid ${socialContext}`,
    );
  } else if (sentiment < 0.2) {
    narratives.push(
      `Neutral market mood at ${sentiment.toFixed(2)} with ${socialContext}`,
    );
  } else if (sentiment < 0.5) {
    narratives.push(
      `Positive sentiment at ${sentiment.toFixed(2)} with ${socialContext}`,
    );
  } else {
    narratives.push(
      `Highly bullish sentiment at ${sentiment.toFixed(2)} with ${socialContext}`,
    );
    narratives.push('Market psychology showing strong confidence');
  }

  return narratives;
}

function generateMarketDynamicsNarratives(
  obs: MarketObservation,
  normalized: NormalizedMetrics,
): string[] {
  const price = obs.price_change_24h_pct;
  const volume = obs.volume_change_24h_pct;
  const sentiment = obs.sentiment_score;
  const narratives: string[] = [];

  // Add wallet activity context
  const walletActivity =
    normalized.wallet_activity_ratio > 0.1
      ? 'high holder activity'
      : 'normal holder activity';

  // Pattern recognition with quantitative context
  if (price <= -5 && volume >= 15 && sentiment <= -0.2) {
    narratives.push(
      `Market under pressure with ${Math.abs(price).toFixed(1)}% drop on ${volume.toFixed(1)}% higher volume`,
    );
    narratives.push(`Selling intensity heightened with ${walletActivity}`);
  } else if (price >= 5 && volume >= 15 && sentiment >= 0.2) {
    narratives.push(
      `Strong advance of ${price.toFixed(1)}% supported by ${volume.toFixed(1)}% volume increase`,
    );
    narratives.push(`Buying momentum confirmed with ${walletActivity}`);
  } else if (price <= -2 && volume <= -15) {
    narratives.push(
      `Weak market showing ${Math.abs(price).toFixed(1)}% decline with ${Math.abs(volume).toFixed(1)}% lower volume`,
    );
  } else if (Math.abs(price) < 2 && volume >= 15 && sentiment >= 0.2) {
    narratives.push(
      `Potential accumulation with ${volume.toFixed(1)}% higher volume despite price stability`,
    );
  } else if (Math.abs(price) < 2 && volume >= 15 && sentiment <= -0.2) {
    narratives.push(
      `Possible distribution with ${volume.toFixed(1)}% volume increase at stable prices`,
    );
  } else if (Math.sign(price) !== Math.sign(sentiment)) {
    narratives.push('Price action and sentiment showing divergence');
    narratives.push(`${walletActivity} amid mixed market signals`);
  }

  return narratives;
}

function generateTradingContextNarratives(
  obs: MarketObservation,
  normalized: NormalizedMetrics,
): string[] {
  const narratives: string[] = [];

  // Calculate risk metrics
  const volatilityRisk =
    Math.abs(obs.price_change_24h_pct) > 10
      ? 'high'
      : Math.abs(obs.price_change_24h_pct) > 5
        ? 'moderate'
        : 'low';

  const liquidityRisk =
    normalized.volume_to_liquidity_ratio < 0.1
      ? 'high'
      : normalized.volume_to_liquidity_ratio < 0.3
        ? 'moderate'
        : 'low';

  // Add trading context
  narratives.push(
    `Trading conditions show ${volatilityRisk} volatility risk and ${liquidityRisk} liquidity risk`,
  );

  // Add market phase context
  const phase = detectMarketPhase(normalized, obs);
  narratives.push(`Market structure indicates ${phase} phase`);

  return narratives;
}

function transformToEmbeddingText(
  observation: MarketObservation,
  stats: MarketStats,
): string {
  const normalized = calculateNormalizedMetrics(observation, stats);

  // Generate narrative component
  const narratives = generateMarketNarratives(observation, normalized);
  const narrativeText = combineNarratives(narratives, observation);

  // Generate enhanced signal component
  const signalText = generateEnhancedSignalDescription(observation, normalized);

  const result = `${narrativeText} [SIGNALS] ${signalText}`;

  return result;
}

function generateEnhancedSignalDescription(
  obs: MarketObservation,
  normalized: NormalizedMetrics,
): string {
  const alignmentFactor = calculateAlignmentFactor(obs);
  const weights = calculateSignalWeights(obs, alignmentFactor);
  const signals = [];

  // Generate granular signal descriptions
  signals.push(generatePriceSignal(obs, weights.priceWeight, alignmentFactor));
  signals.push(
    generateVolumeSignal(
      obs,
      normalized,
      weights.volumeWeight,
      alignmentFactor,
    ),
  );
  signals.push(
    generateSentimentSignal(obs, weights.sentimentWeight, alignmentFactor),
  );

  // Add market state with conflict analysis
  signals.push(generateMarketState(obs, normalized, weights, alignmentFactor));

  return signals.join(' ');
}

function calculateAlignmentFactor(obs: MarketObservation): number {
  // Add exponential penalty for stronger opposing signals
  const directions = [
    Math.sign(obs.price_change_24h_pct) *
      Math.min(1, Math.abs(obs.price_change_24h_pct) / 10),
    Math.sign(obs.volume_change_24h_pct) *
      Math.min(1, Math.abs(obs.volume_change_24h_pct) / 50),
    Math.sign(obs.sentiment_score) *
      Math.min(1, Math.abs(obs.sentiment_score) / 0.5),
  ];

  const conflicts =
    directions.reduce((acc, dir, i) => {
      return acc + Math.abs(dir - directions[0]);
    }, 0) / 2;

  return Math.exp(-conflicts);
}

function calculateSignalWeights(
  obs: MarketObservation,
  alignmentFactor: number,
): {
  priceWeight: number;
  volumeWeight: number;
  sentimentWeight: number;
} {
  // Base weights from signal strength
  const baseWeights = {
    priceWeight: Math.min(1.0, Math.abs(obs.price_change_24h_pct) / 10),
    volumeWeight: Math.min(1.0, Math.abs(obs.volume_change_24h_pct) / 50),
    sentimentWeight: Math.min(1.0, Math.abs(obs.sentiment_score) / 0.5),
  };

  // Adjust weights based on alignment
  const adjustedWeights = {
    priceWeight: baseWeights.priceWeight,
    volumeWeight:
      baseWeights.volumeWeight *
      (Math.sign(obs.volume_change_24h_pct) ===
      Math.sign(obs.price_change_24h_pct)
        ? 1
        : 0.7),
    sentimentWeight:
      baseWeights.sentimentWeight *
      (Math.sign(obs.sentiment_score) === Math.sign(obs.price_change_24h_pct)
        ? 1
        : 0.7),
  };

  // Normalize weights
  const totalWeight = Object.values(adjustedWeights).reduce((a, b) => a + b, 0);
  return {
    priceWeight: adjustedWeights.priceWeight / totalWeight,
    volumeWeight: adjustedWeights.volumeWeight / totalWeight,
    sentimentWeight: adjustedWeights.sentimentWeight / totalWeight,
  };
}

function generatePriceSignal(
  obs: MarketObservation,
  weight: number,
  alignmentFactor: number,
): string {
  const change = obs.price_change_24h_pct;
  const category = categorizePriceMovement(change);
  const strength = Math.min(1.0, Math.abs(change) / 10);

  return `price=${category}(${change.toFixed(1)})[w=${weight.toFixed(2)}][s=${strength.toFixed(2)}][a=${alignmentFactor.toFixed(2)}]`;
}

function categorizePriceMovement(change: number): string {
  const magnitude = Math.abs(Math.floor(change / 5));
  if (change <= -5) return `negative_${magnitude}`;
  if (change <= -2) return 'weak_negative';
  if (change < 2) return 'neutral';
  if (change < 5) return 'weak_positive';
  return `positive_${magnitude}`;
}

function generateVolumeSignal(
  obs: MarketObservation,
  normalized: NormalizedMetrics,
  weight: number,
  alignmentFactor: number,
): string {
  const change = obs.volume_change_24h_pct;
  const category = categorizeVolumeMovement(change);
  const strength = Math.min(1.0, Math.abs(change) / 50);
  const impact = Math.min(1.0, normalized.volume_to_liquidity_ratio * 5);

  return `volume=${category}(${change.toFixed(1)})[w=${weight.toFixed(2)}][s=${strength.toFixed(2)}][i=${impact.toFixed(2)}][a=${alignmentFactor.toFixed(2)}]`;
}

function categorizeVolumeMovement(change: number): string {
  const magnitude = Math.abs(Math.floor(change / 25));
  if (change <= -25) return `negative_${magnitude}`;
  if (change <= -10) return 'weak_negative';
  if (change < 10) return 'neutral';
  if (change < 25) return 'weak_positive';
  return `positive_${magnitude}`;
}

function generateSentimentSignal(
  obs: MarketObservation,
  weight: number,
  alignmentFactor: number,
): string {
  const sentiment = obs.sentiment_score;
  const category = categorizeSentiment(sentiment);
  const strength = Math.min(1.0, Math.abs(sentiment) / 0.5);
  const engagement = Math.min(
    1.0,
    (obs.social_volume_24h / obs.holder_count) * 10,
  );

  return `sentiment=${category}(${sentiment.toFixed(2)})[w=${weight.toFixed(2)}][s=${strength.toFixed(2)}][e=${engagement.toFixed(2)}][a=${alignmentFactor.toFixed(2)}]`;
}

function categorizeSentiment(score: number): string {
  const magnitude = Math.abs(Math.floor(score * 2));
  if (score <= -0.5) return `negative_${magnitude}`;
  if (score <= -0.2) return 'weak_negative';
  if (score < 0.2) return 'neutral';
  if (score < 0.5) return 'weak_positive';
  return `positive_${magnitude}`;
}

function generateMarketState(
  obs: MarketObservation,
  normalized: NormalizedMetrics,
  weights: {
    priceWeight: number;
    volumeWeight: number;
    sentimentWeight: number;
  },
  alignmentFactor: number,
): string {
  const trend = analyzeTrend(obs, weights, alignmentFactor);
  const phase = detectMarketPhase(normalized, obs);
  const riskAnalysis = analyzeRisk(obs, normalized, alignmentFactor);

  return (
    `trend=${trend.type}[s=${trend.strength.toFixed(2)}][c=${(1 - alignmentFactor).toFixed(2)}] ` +
    `phase=${phase} ` +
    `risk=${riskAnalysis.level}[s=${riskAnalysis.score.toFixed(2)}]`
  );
}

function analyzeTrend(
  obs: MarketObservation,
  weights: {
    priceWeight: number;
    volumeWeight: number;
    sentimentWeight: number;
  },
  alignmentFactor: number,
): { type: string; strength: number } {
  const priceStrength =
    (Math.abs(obs.price_change_24h_pct) / 10) * weights.priceWeight;
  const volumeStrength =
    (Math.abs(obs.volume_change_24h_pct) / 50) * weights.volumeWeight;
  const sentimentStrength =
    (Math.abs(obs.sentiment_score) / 0.5) * weights.sentimentWeight;

  const baseStrength = priceStrength + volumeStrength + sentimentStrength;
  const adjustedStrength = baseStrength * alignmentFactor;

  return {
    type: determineTrendType(obs, adjustedStrength, alignmentFactor),
    strength: adjustedStrength,
  };
}

function determineTrendType(
  obs: MarketObservation,
  strength: number,
  alignmentFactor: number,
): string {
  if (alignmentFactor < 0.3) {
    return strength > 0.7 ? 'strongly_conflicted' : 'weakly_conflicted';
  }
  if (Math.abs(obs.price_change_24h_pct) < 2) {
    return strength > 0.5 ? 'active_sideways' : 'quiet_sideways';
  }

  const direction = obs.price_change_24h_pct > 0 ? 'up' : 'down';
  const magnitude = Math.floor(strength * 3);
  return `${direction}_${magnitude}`;
}

function analyzeRisk(
  obs: MarketObservation,
  normalized: NormalizedMetrics,
  alignmentFactor: number,
): { level: string; score: number } {
  const volatilityRisk = Math.min(1.0, Math.abs(obs.price_change_24h_pct) / 10);
  const liquidityRisk = Math.min(1.0, 1 - normalized.volume_to_liquidity_ratio);
  const conflictRisk = 1 - alignmentFactor;

  const riskScore =
    volatilityRisk * 0.4 + liquidityRisk * 0.3 + conflictRisk * 0.3;

  return {
    level: riskScore > 0.7 ? 'high' : riskScore > 0.4 ? 'moderate' : 'low',
    score: riskScore,
  };
}

function combineNarratives(
  narratives: MarketNarratives,
  obs: MarketObservation,
): string {
  const selectedNarratives: string[] = [];

  // Primary market conditions (always include first narrative)
  selectedNarratives.push(narratives.priceAction[0]);
  selectedNarratives.push(narratives.volumeActivity[0]);
  selectedNarratives.push(narratives.sentiment[0]);

  // Add additional context for strong moves
  if (Math.abs(obs.price_change_24h_pct) >= 5) {
    selectedNarratives.push(...narratives.priceAction.slice(1));
  }

  if (Math.abs(obs.volume_change_24h_pct) >= 15) {
    selectedNarratives.push(...narratives.volumeActivity.slice(1));
  }

  if (Math.abs(obs.sentiment_score) >= 0.5) {
    selectedNarratives.push(...narratives.sentiment.slice(1));
  }

  // Always include market dynamics and trading context
  selectedNarratives.push(...narratives.marketDynamics);
  selectedNarratives.push(...narratives.tradingContext);

  // Repeat key narratives for emphasis on strong signals
  if (
    Math.abs(obs.price_change_24h_pct) >= 5 &&
    Math.abs(obs.volume_change_24h_pct) >= 15
  ) {
    selectedNarratives.push(...narratives.marketDynamics);
  }

  return selectedNarratives.join('. ') + '.';
}

export function detectMarketPhase(
  normalized: NormalizedMetrics,
  observation: MarketObservation,
): string {
  const phaseScores = {
    consolidation: 0,
    accumulation: 0,
    expansion: 0,
    distribution: 0,
  };

  // Volume Dynamics
  if (normalized.volume_normalized > 0.7) {
    phaseScores.expansion += 2;
    phaseScores.distribution += 1;
  }

  // Price Momentum
  if (observation.price_change_24h_pct > 5) {
    phaseScores.expansion += 2;
    phaseScores.accumulation += 1;
  } else if (observation.price_change_24h_pct < -2) {
    phaseScores.distribution += 2;
    phaseScores.consolidation += 1;
  }

  // Social and Activity Signals
  if (normalized.social_engagement_ratio > 0.1) {
    phaseScores.accumulation += 1;
    phaseScores.expansion += 1;
  }

  if (normalized.wallet_activity_ratio > 0.1) {
    phaseScores.accumulation += 1;
    phaseScores.expansion += 1;
  }

  const topPhase = Object.entries(phaseScores).reduce((a, b) =>
    b[1] > a[1] ? b : a,
  )[0];

  return topPhase;
}

export {
  MarketObservation,
  NormalizedMetrics,
  MarketStats,
  transformToEmbeddingText,
};
