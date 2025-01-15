import { TokenMarketObservation } from 'src/modules/tokens/entities/token.type';
import { normalizeInRange, normalizePercentage } from './numerical-helpers';

interface NormalizedMetrics {
  // Price metrics
  price_strength: number; // Based on position between ATH and ATL
  price_momentum: number; // Based on 24h change

  // Volume metrics
  volume_to_mcap_ratio: number; // Volume relative to market cap
  price_volume_trend: number; // Combines price and volume changes

  // Supply metrics
  supply_distribution: number; // Based on circulating vs total supply
  market_maturity: number; // Based on ATH/ATL changes

  // Market metrics
  market_dominance: number; // Based on market cap rank
  market_momentum: number; // Based on market cap changes
}

interface MarketNarratives {
  priceAction: string[];
  volumeActivity: string[];
  sentiment: string[];
  marketDynamics: string[];
  tradingContext: string[];
}

interface SignalWeights {
  priceWeight: number;
  marketCapWeight: number;
  volumeWeight: number;
}

interface TrendWeights {
  priceWeight: number;
  marketCapWeight: number;
  volumeWeight: number;
}

function calculateNormalizedMetrics(
  observation: TokenMarketObservation,
): NormalizedMetrics {
  // Price strength: Where current price sits between ATH and ATL (0-1)
  const price_strength = normalizeInRange(
    observation.price_usd,
    observation.atl,
    observation.ath,
  );

  // Price momentum: Normalize 24h change to -1 to 1 range
  const price_momentum = normalizePercentage(
    observation.price_change_percentage_24h,
  );

  // Volume relative to market cap (higher ratio = more active trading)
  const volume_to_mcap_ratio =
    observation.total_volume / observation.market_cap;

  // Combine price and volume trends
  const price_volume_trend = normalizePercentage(
    observation.price_change_percentage_24h *
      Math.sign(observation.market_cap_change_percentage_24h),
  );

  // Supply distribution (0-1 where 1 means all supply is circulating)
  const supply_distribution = observation.supply_ratio;

  // Market maturity based on ATH/ATL changes
  const market_maturity =
    (Math.abs(observation.ath_change_percentage) +
      Math.abs(observation.atl_change_percentage)) /
    200; // Normalize to 0-1

  // Market dominance based on rank (inverse and normalized)
  const market_dominance = normalizeInRange(
    1 / Math.max(1, observation.market_cap_rank),
    0,
    1,
  );

  // Market momentum from market cap changes
  const market_momentum = normalizePercentage(
    observation.market_cap_change_percentage_24h,
  );

  return {
    price_strength,
    price_momentum,
    volume_to_mcap_ratio,
    price_volume_trend,
    supply_distribution,
    market_maturity,
    market_dominance,
    market_momentum,
  };
}

function generateMarketNarratives(
  obs: TokenMarketObservation,
  normalized: NormalizedMetrics,
): MarketNarratives {
  return {
    priceAction: generatePriceNarratives(obs),
    volumeActivity: generateVolumeNarratives(obs, normalized),
    sentiment: generateSentimentNarratives(obs),
    marketDynamics: generateMarketDynamicsNarratives(obs, normalized),
    tradingContext: generateTradingContextNarratives(obs, normalized),
  };
}

function generatePriceNarratives(obs: TokenMarketObservation): string[] {
  const change = obs.price_change_percentage_24h;
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
  obs: TokenMarketObservation,
  normalized: NormalizedMetrics,
): string[] {
  const narratives: string[] = [];

  // Calculate volume context based on volume to market cap ratio
  const volMcapContext = getVolumeToMarketCapContext(
    normalized.volume_to_mcap_ratio,
  );

  // Use price_volume_trend to determine if volume is supporting price action
  const volumeTrend = normalized.price_volume_trend;

  // Volume relative to market cap
  if (normalized.volume_to_mcap_ratio > 0.25) {
    narratives.push(`Exceptional trading volume with ${volMcapContext}`);
    narratives.push('Trading activity showing significant intensity');
  } else if (normalized.volume_to_mcap_ratio > 0.15) {
    narratives.push(`Strong trading activity with ${volMcapContext}`);
    narratives.push('Above average market participation');
  } else if (normalized.volume_to_mcap_ratio > 0.05) {
    narratives.push(`Moderate trading volume with ${volMcapContext}`);
  } else {
    narratives.push(`Low trading activity with ${volMcapContext}`);
    narratives.push('Below average market participation');
  }

  // Add volume trend context
  if (Math.abs(volumeTrend) > 0.7) {
    const direction = volumeTrend > 0 ? 'supporting' : 'contradicting';
    narratives.push(`Volume trend strongly ${direction} price action`);
  } else if (Math.abs(volumeTrend) > 0.3) {
    const direction = volumeTrend > 0 ? 'aligned with' : 'diverging from';
    narratives.push(`Volume trend ${direction} price movement`);
  }

  return narratives;
}

function getVolumeToMarketCapContext(ratio: number): string {
  if (ratio > 0.3) {
    return 'volume significantly above market cap expectations';
  } else if (ratio > 0.15) {
    return 'healthy volume relative to market cap';
  } else if (ratio > 0.05) {
    return 'reasonable volume to market cap ratio';
  } else {
    return 'volume below typical market cap ratio';
  }
}

function generateSentimentNarratives(obs: TokenMarketObservation): string[] {
  const narratives: string[] = [];

  // Calculate composite sentiment score from available metrics
  const sentimentScore = calculateCompositeSentiment(obs);

  // Determine market engagement level
  const marketEngagement = getMarketEngagement(obs);

  // Generate sentiment narrative
  if (sentimentScore <= -0.5) {
    narratives.push(
      `Strongly bearish market conditions with ${marketEngagement}`,
    );
    narratives.push('Price action indicates significant selling pressure');
  } else if (sentimentScore <= -0.2) {
    narratives.push(`Cautious market behavior with ${marketEngagement}`);
  } else if (sentimentScore < 0.2) {
    narratives.push(`Neutral market conditions with ${marketEngagement}`);
  } else if (sentimentScore < 0.5) {
    narratives.push(`Positive market momentum with ${marketEngagement}`);
  } else {
    narratives.push(
      `Strongly bullish market conditions with ${marketEngagement}`,
    );
    narratives.push('Multiple indicators showing market confidence');
  }

  return narratives;
}

function calculateCompositeSentiment(obs: TokenMarketObservation): number {
  // Combine multiple indicators to create a composite sentiment score (-1 to 1)
  const priceStrength = obs.price_change_percentage_24h / 20; // Normalize by assuming ±20% as typical range
  const marketCapStrength = obs.market_cap_change_percentage_24h / 20;
  const athDistance = obs.ath_change_percentage / 100;
  const atlDistance = obs.atl_change_percentage / 100;

  // Weight the components
  const weightedScore =
    priceStrength * 0.4 + // Recent price action (40% weight)
    marketCapStrength * 0.3 + // Market cap momentum (30% weight)
    athDistance * 0.15 + // Distance from ATH (15% weight)
    atlDistance * 0.15; // Distance from ATL (15% weight)

  // Use tanh to bound the result between -1 and 1
  return Math.tanh(weightedScore);
}

function getMarketEngagement(obs: TokenMarketObservation): string {
  // Calculate volume relative to market cap as engagement indicator
  const volumeToMarketCap = obs.total_volume / obs.market_cap;

  if (volumeToMarketCap > 0.3) {
    return 'very high market engagement';
  } else if (volumeToMarketCap > 0.15) {
    return 'strong market participation';
  } else if (volumeToMarketCap > 0.05) {
    return 'moderate trading activity';
  } else {
    return 'limited market activity';
  }
}

function generateMarketDynamicsNarratives(
  obs: TokenMarketObservation,
  normalized: NormalizedMetrics,
): string[] {
  const narratives: string[] = [];

  // Use market cap changes as additional confirmation of price movements
  const price_change = obs.price_change_percentage_24h;
  const mcap_change = obs.market_cap_change_percentage_24h;
  const volume_strength = normalized.volume_to_mcap_ratio;
  const price_strength = normalized.price_strength;

  // Interpret market activity level
  const marketActivity = getMarketActivity(normalized);

  // Pattern recognition with quantitative context
  if (price_change <= -5 && volume_strength > 0.15) {
    narratives.push(
      `Market under pressure with ${Math.abs(price_change).toFixed(1)}% drop on strong volume`,
    );
    narratives.push(`Elevated selling pressure with ${marketActivity}`);
  } else if (price_change >= 5 && volume_strength > 0.15) {
    narratives.push(
      `Strong advance of ${price_change.toFixed(1)}% with high trading activity`,
    );
    narratives.push(`Buying momentum supported by ${marketActivity}`);
  } else if (price_change <= -2 && volume_strength < 0.05) {
    narratives.push(
      `Weak market showing ${Math.abs(price_change).toFixed(1)}% decline with low volume`,
    );
  } else if (Math.abs(price_change) < 2 && volume_strength > 0.15) {
    // Check price strength to determine accumulation vs distribution
    if (price_strength > 0.7) {
      narratives.push(
        `Possible distribution with high volume at price resistance`,
      );
    } else if (price_strength < 0.3) {
      narratives.push(
        `Potential accumulation with increased volume at support levels`,
      );
    }
  } else if (Math.sign(price_change) !== Math.sign(mcap_change)) {
    narratives.push('Price action and market cap showing divergence');
    narratives.push(`${marketActivity} amid mixed market signals`);
  }

  return narratives;
}

function getMarketActivity(normalized: NormalizedMetrics): string {
  // Combine volume and market momentum for activity assessment
  const activityLevel =
    normalized.volume_to_mcap_ratio * 0.7 +
    Math.abs(normalized.market_momentum) * 0.3;

  if (activityLevel > 0.7) {
    return 'exceptional market activity';
  } else if (activityLevel > 0.4) {
    return 'above-average trading activity';
  } else if (activityLevel > 0.2) {
    return 'moderate market participation';
  } else {
    return 'subdued trading activity';
  }
}

function generateTradingContextNarratives(
  obs: TokenMarketObservation,
  normalized: NormalizedMetrics,
): string[] {
  const narratives: string[] = [];

  // Calculate volatility risk using price range and recent changes
  const volatilityRisk = calculateVolatilityRisk(obs);

  // Calculate liquidity risk using volume and market cap
  const liquidityRisk = calculateLiquidityRisk(normalized.volume_to_mcap_ratio);

  // Add trading context
  narratives.push(
    `Trading conditions show ${volatilityRisk} volatility risk and ${liquidityRisk} liquidity risk`,
  );

  // Add market phase context
  const phase = detectMarketPhase(normalized, obs);
  narratives.push(`Market structure indicates ${phase} phase`);

  return narratives;
}

function calculateVolatilityRisk(obs: TokenMarketObservation): string {
  // Consider both 24h price range and recent price changes
  const priceRange = ((obs.high_24h - obs.low_24h) / obs.price_usd) * 100;
  const recentVolatility = Math.abs(obs.price_change_percentage_24h);

  // Combine both metrics for overall volatility assessment
  const volatilityScore = priceRange * 0.6 + recentVolatility * 0.4;

  if (volatilityScore > 15) {
    return 'high';
  } else if (volatilityScore > 8) {
    return 'moderate';
  } else {
    return 'low';
  }
}

function calculateLiquidityRisk(volumeToMcapRatio: number): string {
  if (volumeToMcapRatio < 0.05) {
    return 'high';
  } else if (volumeToMcapRatio < 0.15) {
    return 'moderate';
  } else {
    return 'low';
  }
}

function generateEnhancedSignalDescription(
  obs: TokenMarketObservation,
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
    generateMarketCapSignal(
      obs,
      normalized,
      weights.marketCapWeight,
      alignmentFactor,
    ),
  );

  // Add market state with conflict analysis
  signals.push(generateMarketState(obs, normalized, weights, alignmentFactor));

  return signals.join(' ');
}

function generateMarketCapSignal(
  obs: TokenMarketObservation,
  normalized: NormalizedMetrics,
  weight: number,
  alignmentFactor: number,
): string {
  const mcapChange = obs.market_cap_change_percentage_24h;
  const category = categorizeMarketCapMovement(mcapChange);
  const strength = Math.min(1.0, Math.abs(mcapChange) / 20);
  const impact = normalized.market_dominance;

  return `mcap=${category}(${mcapChange.toFixed(1)})[w=${weight.toFixed(2)}][s=${strength.toFixed(2)}][i=${impact.toFixed(2)}][a=${alignmentFactor.toFixed(2)}]`;
}

function categorizeMarketCapMovement(change: number): string {
  if (change > 20) return 'strong_growth';
  if (change > 5) return 'growth';
  if (change > -5) return 'stable';
  if (change > -20) return 'decline';
  return 'strong_decline';
}

function calculateAlignmentFactor(obs: TokenMarketObservation): number {
  // Normalize and get direction of key metrics
  const directions = [
    // Price momentum
    Math.sign(obs.price_change_percentage_24h) *
      Math.min(1, Math.abs(obs.price_change_percentage_24h) / 10),

    // Market cap momentum
    Math.sign(obs.market_cap_change_percentage_24h) *
      Math.min(1, Math.abs(obs.market_cap_change_percentage_24h) / 10),

    // ATH/ATL trend (positive if closer to ATH, negative if closer to ATL)
    Math.sign(obs.ath_change_percentage - Math.abs(obs.atl_change_percentage)) *
      Math.min(
        1,
        Math.abs(
          obs.ath_change_percentage - Math.abs(obs.atl_change_percentage),
        ) / 100,
      ),
  ];

  // Calculate conflicts between signals
  const conflicts =
    directions.reduce((acc, dir, i) => {
      // Compare each direction with the primary price movement direction
      return acc + Math.abs(dir - directions[0]);
    }, 0) / 2;

  // Return exponentially decaying alignment factor (1 = perfect alignment, approaches 0 with more conflicts)
  return Math.exp(-conflicts);
}

function calculateSignalWeights(
  obs: TokenMarketObservation,
  alignmentFactor: number,
): SignalWeights {
  // Base weights from signal strength
  const baseWeights = {
    priceWeight: Math.min(1.0, Math.abs(obs.price_change_percentage_24h) / 10),
    marketCapWeight: Math.min(
      1.0,
      Math.abs(obs.market_cap_change_percentage_24h) / 15,
    ),
    volumeWeight: Math.min(1.0, obs.total_volume / obs.market_cap),
  };

  // Adjust weights based on alignment with price movement
  const adjustedWeights = {
    priceWeight: baseWeights.priceWeight,
    marketCapWeight:
      baseWeights.marketCapWeight *
      (Math.sign(obs.market_cap_change_percentage_24h) ===
      Math.sign(obs.price_change_percentage_24h)
        ? 1
        : 0.7),
    volumeWeight:
      baseWeights.volumeWeight *
      // Increase volume weight if it's supporting the price movement
      (obs.total_volume / obs.market_cap > 0.15 &&
      Math.abs(obs.price_change_percentage_24h) > 5
        ? 1.2
        : 1),
  };

  // Apply overall market condition adjustments
  if (Math.abs(obs.ath_change_percentage) < 20) {
    // Near ATH - increase market cap weight
    adjustedWeights.marketCapWeight *= 1.2;
  } else if (Math.abs(obs.atl_change_percentage) < 20) {
    // Near ATL - increase volume weight
    adjustedWeights.volumeWeight *= 1.2;
  }

  // Normalize weights to sum to 1
  const totalWeight = Object.values(adjustedWeights).reduce((a, b) => a + b, 0);

  return {
    priceWeight: adjustedWeights.priceWeight / totalWeight,
    marketCapWeight: adjustedWeights.marketCapWeight / totalWeight,
    volumeWeight: adjustedWeights.volumeWeight / totalWeight,
  };
}

function generatePriceSignal(
  obs: TokenMarketObservation,
  weight: number,
  alignmentFactor: number,
): string {
  const change = obs.price_change_percentage_24h;
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
  obs: TokenMarketObservation,
  normalized: NormalizedMetrics,
  weight: number,
  alignmentFactor: number,
): string {
  // Calculate volume-based metrics
  const volumeToMcap = obs.total_volume / obs.market_cap;
  const category = categorizeVolumeActivity(volumeToMcap);

  // Calculate relative strength using volume to market cap ratio
  const strength = Math.min(1.0, volumeToMcap * 5); // Cap at 1.0 when volume is 20% of mcap

  // Calculate market impact using price volatility and volume
  const volatility = (obs.high_24h - obs.low_24h) / obs.price_usd;
  const impact = Math.min(1.0, volatility * volumeToMcap * 10);

  return `volume=${category}(${(volumeToMcap * 100).toFixed(1)}%)[w=${weight.toFixed(2)}][s=${strength.toFixed(2)}][i=${impact.toFixed(2)}][a=${alignmentFactor.toFixed(2)}]`;
}

function categorizeVolumeActivity(volumeToMcap: number): string {
  if (volumeToMcap > 0.25) {
    return 'extreme';
  } else if (volumeToMcap > 0.15) {
    return 'high';
  } else if (volumeToMcap > 0.05) {
    return 'moderate';
  } else if (volumeToMcap > 0.02) {
    return 'low';
  } else {
    return 'minimal';
  }
}

function generateSentimentSignal(
  obs: TokenMarketObservation,
  normalized: NormalizedMetrics,
  weight: number,
  alignmentFactor: number,
): string {
  // Calculate composite sentiment from multiple indicators
  const sentiment = calculateCompositeSentiment(obs);
  const category = categorizeSentiment(sentiment);

  // Calculate signal strength based on the conviction of indicators
  const strength = calculateSentimentStrength(obs, normalized);

  // Calculate market engagement using volume and market cap
  const engagement = Math.min(1.0, (obs.total_volume / obs.market_cap) * 5);

  return `sentiment=${category}(${sentiment.toFixed(2)})[w=${weight.toFixed(2)}][s=${strength.toFixed(2)}][e=${engagement.toFixed(2)}][a=${alignmentFactor.toFixed(2)}]`;
}

function calculateSentimentStrength(
  obs: TokenMarketObservation,
  normalized: NormalizedMetrics,
): number {
  // Combine strength of various indicators
  const priceStrength = Math.abs(obs.price_change_percentage_24h) / 20;
  const mcapStrength = Math.abs(obs.market_cap_change_percentage_24h) / 20;
  const volumeStrength = normalized.volume_to_mcap_ratio;

  return Math.min(
    1.0,
    priceStrength * 0.4 + mcapStrength * 0.3 + volumeStrength * 0.3,
  );
}

function categorizeSentiment(sentiment: number): string {
  if (sentiment > 0.5) return 'very_bullish';
  if (sentiment > 0.2) return 'bullish';
  if (sentiment > -0.2) return 'neutral';
  if (sentiment > -0.5) return 'bearish';
  return 'very_bearish';
}

function generateMarketState(
  obs: TokenMarketObservation,
  normalized: NormalizedMetrics,
  weights: TrendWeights,
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
  obs: TokenMarketObservation,
  weights: TrendWeights,
  alignmentFactor: number,
): { type: string; strength: number } {
  // Calculate individual component strengths
  const priceStrength =
    (Math.abs(obs.price_change_percentage_24h) / 10) * weights.priceWeight;

  const marketCapStrength =
    (Math.abs(obs.market_cap_change_percentage_24h) / 15) *
    weights.marketCapWeight;

  const volumeStrength =
    Math.min(1, (obs.total_volume / obs.market_cap) * 5) * weights.volumeWeight;

  // Calculate base strength from components
  const baseStrength = priceStrength + marketCapStrength + volumeStrength;

  // Adjust strength based on alignment and market context
  const contextMultiplier = calculateContextMultiplier(obs);
  const adjustedStrength = baseStrength * alignmentFactor * contextMultiplier;

  return {
    type: determineTrendType(obs, adjustedStrength, alignmentFactor),
    strength: adjustedStrength,
  };
}

function calculateContextMultiplier(obs: TokenMarketObservation): number {
  let multiplier = 1;

  // Strengthen signals near market extremes
  if (Math.abs(obs.ath_change_percentage) < 20) {
    // Near ATH - strengthen trend
    multiplier *= 1.2;
  } else if (Math.abs(obs.atl_change_percentage) < 20) {
    // Near ATL - strengthen trend
    multiplier *= 1.2;
  }

  // Adjust for price volatility
  const volatility = (obs.high_24h - obs.low_24h) / obs.price_usd;
  if (volatility > 0.1) {
    // More than 10% range
    multiplier *= 1.1; // Strengthen trend in volatile conditions
  }

  return multiplier;
}

function determineTrendType(
  obs: TokenMarketObservation,
  strength: number,
  alignmentFactor: number,
): string {
  const priceChange = obs.price_change_percentage_24h;
  const mcapChange = obs.market_cap_change_percentage_24h;

  // Strong trend with high alignment
  if (strength > 0.7 && alignmentFactor > 0.8) {
    return priceChange > 0 ? 'strong_uptrend' : 'strong_downtrend';
  }

  // Moderate trend
  if (strength > 0.4 || (strength > 0.3 && alignmentFactor > 0.7)) {
    return priceChange > 0 ? 'uptrend' : 'downtrend';
  }

  // Price/MCap divergence check
  if (Math.sign(priceChange) !== Math.sign(mcapChange)) {
    return 'divergent';
  }

  // Weak or unclear trend
  if (Math.abs(priceChange) < 2 && strength < 0.3) {
    return 'sideways';
  }

  // Default weak trend
  return priceChange > 0 ? 'weak_uptrend' : 'weak_downtrend';
}

function analyzeRisk(
  obs: TokenMarketObservation,
  normalized: NormalizedMetrics,
  alignmentFactor: number,
): { level: string; score: number } {
  // Volatility risk based on price range and recent changes
  const volatilityRisk = Math.min(
    1.0,
    (((obs.high_24h - obs.low_24h) / obs.price_usd) * 100 +
      Math.abs(obs.price_change_percentage_24h)) /
      20,
  );

  // Liquidity risk based on volume to market cap ratio
  const liquidityRisk = Math.min(
    1.0,
    1 - Math.min(1, (obs.total_volume / obs.market_cap) * 5),
  );

  // Market structure risk based on ATH/ATL and supply metrics
  const marketRisk = Math.min(
    1.0,
    (Math.abs(obs.ath_change_percentage) / 100 +
      (1 - normalized.supply_distribution)) /
      2,
  );

  // Calculate composite risk score with weights
  const riskScore =
    volatilityRisk * 0.4 +
    liquidityRisk * 0.3 +
    marketRisk * 0.2 +
    (1 - alignmentFactor) * 0.1;

  return {
    level: categorizeRiskLevel(riskScore),
    score: riskScore,
  };
}

function categorizeRiskLevel(score: number): string {
  if (score > 0.7) return 'high';
  if (score > 0.4) return 'moderate';
  return 'low';
}

function combineNarratives(
  narratives: MarketNarratives,
  obs: TokenMarketObservation,
): string {
  const selectedNarratives: string[] = [];

  // Primary market conditions (always include)
  selectedNarratives.push(narratives.priceAction[0]);
  selectedNarratives.push(narratives.volumeActivity[0]);
  selectedNarratives.push(narratives.sentiment[0]);

  // Add additional context for significant moves
  if (Math.abs(obs.price_change_percentage_24h) >= 5) {
    // Significant price movement
    selectedNarratives.push(...narratives.priceAction.slice(1));
  }

  if (obs.total_volume / obs.market_cap > 0.15) {
    // High volume relative to market cap
    selectedNarratives.push(...narratives.volumeActivity.slice(1));
  }

  // Market extremes context
  if (
    Math.abs(obs.ath_change_percentage) < 20 ||
    Math.abs(obs.atl_change_percentage) < 20
  ) {
    selectedNarratives.push(...narratives.marketDynamics);
  }

  // Always include trading context
  selectedNarratives.push(...narratives.tradingContext);

  // Repeat key narratives for emphasis on strong market moves
  if (
    Math.abs(obs.price_change_percentage_24h) >= 5 &&
    obs.total_volume / obs.market_cap > 0.15
  ) {
    selectedNarratives.push(...narratives.marketDynamics);
  }

  return selectedNarratives.join('. ') + '.';
}

function detectMarketPhase(
  normalized: NormalizedMetrics,
  observation: TokenMarketObservation,
): string {
  const phaseScores = {
    consolidation: 0,
    accumulation: 0,
    expansion: 0,
    distribution: 0,
  };

  // Volume Dynamics (using volume_to_mcap_ratio)
  if (normalized.volume_to_mcap_ratio > 0.15) {
    phaseScores.expansion += 2;
    phaseScores.distribution += 1;
  } else if (normalized.volume_to_mcap_ratio < 0.05) {
    phaseScores.consolidation += 2;
  }

  // Price Momentum and Strength
  if (observation.price_change_percentage_24h > 5) {
    phaseScores.expansion += 2;
    if (normalized.price_strength > 0.7) {
      phaseScores.distribution += 2; // Near ATH with strong momentum = distribution
    } else {
      phaseScores.accumulation += 1;
    }
  } else if (observation.price_change_percentage_24h < -2) {
    if (normalized.price_strength < 0.3) {
      phaseScores.accumulation += 2; // Near ATL with negative momentum = accumulation
    } else {
      phaseScores.distribution += 2;
    }
    phaseScores.consolidation += 1;
  }

  // Market Momentum (using market cap changes)
  if (Math.abs(observation.market_cap_change_percentage_24h) < 2) {
    phaseScores.consolidation += 2;
  } else if (observation.market_cap_change_percentage_24h > 5) {
    phaseScores.expansion += 1;
  }

  // Volume and Price Alignment
  if (normalized.price_volume_trend > 0.5) {
    phaseScores.expansion += 1;
  } else if (normalized.price_volume_trend < -0.5) {
    phaseScores.distribution += 1;
  }

  // Supply Distribution
  if (normalized.supply_distribution > 0.7) {
    phaseScores.distribution += 1;
  } else if (normalized.supply_distribution < 0.3) {
    phaseScores.accumulation += 1;
  }

  // Find the phase with highest score
  const topPhase = Object.entries(phaseScores).reduce((a, b) =>
    b[1] > a[1] ? b : a,
  )[0];

  return topPhase;
}

export {
  TokenMarketObservation,
  NormalizedMetrics,
  detectMarketPhase,
  generateMarketNarratives,
  combineNarratives,
  calculateNormalizedMetrics,
  generateEnhancedSignalDescription,
};
