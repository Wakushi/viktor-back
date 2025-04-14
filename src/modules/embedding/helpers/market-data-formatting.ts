import { normalizeInRange, normalizePercentage } from './numerical-helpers';
import { MobulaExtendedToken } from 'src/modules/mobula/entities/mobula.entities';

interface NormalizedMetrics {
  // Existing metrics
  price_strength: number;
  price_momentum: number;
  volume_to_mcap_ratio: number;
  price_volume_trend: number;
  supply_distribution: number;
  market_maturity: number;
  market_momentum: number;

  // New 24h-specific metrics
  price_velocity_24h: number; // Rate of price change within 24h
  volume_intensity_24h: number; // Volume distribution over 24h range
  price_range_usage_24h: number; // How much of the 24h range is being used
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

function calculateNormalizedMetrics(
  token: MobulaExtendedToken,
): NormalizedMetrics {
  const price = token.price ?? 0;
  const volume = token.volume ?? 0;
  const marketCap = token.market_cap ?? 1; // avoid division by 0
  const priceChange = token.price_change_24h ?? 0;
  const ath = token.ath ?? price * 2;
  const atl = token.atl ?? price / 2;

  // 1. Position of price between ATL and ATH
  const price_strength = normalizeInRange(price, atl, ath);

  // 2. Momentum: normalize to [-1, 1]
  const price_momentum = normalizePercentage(priceChange);

  // 3. Volume to mcap
  const volume_to_mcap_ratio = volume / marketCap;

  // 4. Price-volume trend (we assume neutral market cap change: 0%)
  const price_volume_trend = normalizePercentage(priceChange);

  // 5. Supply distribution = circulating / total
  const supply_distribution =
    token.total_supply && token.total_supply > 0
      ? Math.min(1, (token.circulating_supply ?? 0) / token.total_supply)
      : 0;

  // 6. Market maturity based on ATH/ATL distance
  const ath_change_pct = Math.abs(1 - price / ath) * 100;
  const atl_change_pct = Math.abs(price / atl - 1) * 100;
  const market_maturity = (ath_change_pct + atl_change_pct) / 200;

  // 7. Market momentum → we estimate neutral (0) for now
  const market_momentum = 0;

  // 8. Price velocity approximation — can't calculate from range so fallback to scaled momentum
  const price_velocity_24h = priceChange / 100;

  // 9. Volume intensity relative to price movement
  const volume_intensity_24h =
    Math.abs(priceChange) > 0
      ? volume / (marketCap * Math.abs(priceChange / 100))
      : 0;

  // 10. Price position in imaginary 24h range
  const price_range_usage_24h = priceChange >= 0 ? 1 : 0;

  return {
    price_strength,
    price_momentum,
    volume_to_mcap_ratio,
    price_volume_trend,
    supply_distribution,
    market_maturity,
    market_momentum,
    price_velocity_24h,
    volume_intensity_24h,
    price_range_usage_24h,
  };
}

function generateMarketNarratives(
  token: MobulaExtendedToken,
  normalized: NormalizedMetrics,
): MarketNarratives {
  return {
    priceAction: generatePriceNarratives(token),
    volumeActivity: generateVolumeNarratives(normalized),
    sentiment: generateSentimentNarratives(token),
    marketDynamics: generateMarketDynamicsNarratives(token, normalized),
    tradingContext: generateTradingContextNarratives(token, normalized),
  };
}

function generatePriceNarratives(token: MobulaExtendedToken): string[] {
  const narratives: string[] = [];

  const change = token.price_change_24h ?? 0;
  const priceNow = token.price;

  // Estimate price 24h ago using reverse % change
  const price24hAgo = priceNow / (1 + change / 100);

  // Estimate a high-low range approximation (for volatility measure)
  const range = Math.abs(priceNow - price24hAgo);
  const rangePct = Math.abs((range / price24hAgo) * 100);

  // Position in range — approximated as always "close" price
  const currentRangePosition = priceNow >= price24hAgo ? 100 : 0;

  // Main movement narrative
  if (change <= -5) {
    narratives.push(
      `24h decline of ${Math.abs(change).toFixed(1)}% with ~${rangePct.toFixed(1)}% range, currently near bottom`,
    );
  } else if (change >= 5) {
    narratives.push(
      `24h advance of ${change.toFixed(1)}% with ~${rangePct.toFixed(1)}% range, currently near top`,
    );
  }

  // Volume-to-price movement intensity heuristic
  const volume = token.volume ?? 0;
  const marketCap = token.market_cap ?? 0;
  const volumeIntensity =
    marketCap > 0 && Math.abs(change) > 0
      ? volume / (marketCap * (Math.abs(change) / 100))
      : 0;

  if (volumeIntensity > 2) {
    narratives.push(
      `High volume relative to price movement suggesting strong 24h accumulation/distribution`,
    );
  }

  // Volatility range comment
  if (rangePct > 10) {
    narratives.push(
      `Wide 24h trading range of ~${rangePct.toFixed(1)}% indicating high volatility opportunity`,
    );
  }

  return narratives;
}

function generateVolumeNarratives(normalized: NormalizedMetrics): string[] {
  const narratives: string[] = [];

  const volMcapRatio = normalized.volume_to_mcap_ratio;
  const volumeTrend = normalized.price_volume_trend;
  const volMcapContext = getVolumeToMarketCapContext(volMcapRatio);

  if (volMcapRatio > 0.25) {
    narratives.push(`Exceptional trading volume with ${volMcapContext}`);
    narratives.push('Trading activity showing significant intensity');
  } else if (volMcapRatio > 0.15) {
    narratives.push(`Strong trading activity with ${volMcapContext}`);
    narratives.push('Above average market participation');
  } else if (volMcapRatio > 0.05) {
    narratives.push(`Moderate trading volume with ${volMcapContext}`);
  } else {
    narratives.push(`Low trading activity with ${volMcapContext}`);
    narratives.push('Below average market participation');
  }

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

function generateSentimentNarratives(token: MobulaExtendedToken): string[] {
  const narratives: string[] = [];

  const sentimentScore = calculateCompositeSentiment(token);
  const marketEngagement = getMarketEngagement(token);

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

function calculateCompositeSentiment(token: MobulaExtendedToken): number {
  const priceStrength = (token.price_change_24h ?? 0) / 20;

  // Substitute neutral value since we don’t have market_cap_change_24h
  const marketCapStrength = 0;

  const athDistance =
    token.ath && token.ath > 0 ? 1 - token.price / token.ath : 0;

  const atlDistance =
    token.atl && token.atl > 0 ? token.price / token.atl - 1 : 0;

  const weightedScore =
    priceStrength * 0.4 +
    marketCapStrength * 0.3 +
    athDistance * 0.15 +
    atlDistance * 0.15;

  return Math.tanh(weightedScore);
}

function getMarketEngagement(token: MobulaExtendedToken): string {
  const volume = token.volume ?? 0;
  const marketCap = token.market_cap ?? 0;

  if (marketCap === 0) return 'unknown market engagement';

  const ratio = volume / marketCap;

  if (ratio > 0.3) {
    return 'very high market engagement';
  } else if (ratio > 0.15) {
    return 'strong market participation';
  } else if (ratio > 0.05) {
    return 'moderate trading activity';
  } else {
    return 'limited market activity';
  }
}

function generateMarketDynamicsNarratives(
  token: MobulaExtendedToken,
  normalized: NormalizedMetrics,
): string[] {
  const narratives: string[] = [];

  const priceChange = token.price_change_24h ?? 0;
  const volumeStrength = normalized.volume_to_mcap_ratio;
  const priceStrength = normalized.price_strength;

  const marketActivity = getMarketActivity(normalized);

  // Scenario: Strong drop with volume
  if (priceChange <= -5 && volumeStrength > 0.15) {
    narratives.push(
      `Market under pressure with ${Math.abs(priceChange).toFixed(1)}% drop on strong volume`,
    );
    narratives.push(`Elevated selling pressure with ${marketActivity}`);
  }

  // Scenario: Strong rally with volume
  else if (priceChange >= 5 && volumeStrength > 0.15) {
    narratives.push(
      `Strong advance of ${priceChange.toFixed(1)}% with high trading activity`,
    );
    narratives.push(`Buying momentum supported by ${marketActivity}`);
  }

  // Scenario: Light sell-off with low interest
  else if (priceChange <= -2 && volumeStrength < 0.05) {
    narratives.push(
      `Weak market showing ${Math.abs(priceChange).toFixed(1)}% decline with low volume`,
    );
  }

  // Scenario: Low volatility but high activity (accumulation/distribution zone)
  else if (Math.abs(priceChange) < 2 && volumeStrength > 0.15) {
    if (priceStrength > 0.7) {
      narratives.push(
        `Possible distribution with high volume at price resistance`,
      );
    } else if (priceStrength < 0.3) {
      narratives.push(
        `Potential accumulation with increased volume at support levels`,
      );
    }
  }

  return narratives;
}

function getMarketActivity(normalized: NormalizedMetrics): string {
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
  token: MobulaExtendedToken,
  normalized: NormalizedMetrics,
): string[] {
  const narratives: string[] = [];

  const volatilityRisk = calculateVolatilityRisk(token);
  const liquidityRisk = calculateLiquidityRisk(normalized.volume_to_mcap_ratio);

  narratives.push(
    `Trading conditions show ${volatilityRisk} volatility risk and ${liquidityRisk} liquidity risk`,
  );

  const phase = detectMarketPhase(normalized, token);
  narratives.push(`Market structure indicates ${phase} phase`);

  return narratives;
}

function calculateVolatilityRisk(token: MobulaExtendedToken): string {
  const change24h = Math.abs(token.price_change_24h ?? 0);

  const volatilityScore = change24h;

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
  token: MobulaExtendedToken,
  normalized: NormalizedMetrics,
): string {
  const alignmentFactor = calculateAlignmentFactor(token);
  const weights = calculateSignalWeights(token, alignmentFactor);
  const signals: string[] = [];

  signals.push(
    generatePriceSignal(token, weights.priceWeight, alignmentFactor),
  );

  signals.push(
    generateVolumeSignal(
      token,
      normalized,
      weights.volumeWeight,
      alignmentFactor,
    ),
  );

  signals.push(generateMarketState(token, normalized, alignmentFactor));

  return signals.join(' ');
}

function calculateAlignmentFactor(token: MobulaExtendedToken): number {
  const priceChange = token.price_change_24h ?? 0;

  // Since Mobula doesn’t give % change in mcap, we estimate neutral
  const marketCapChange = 0;

  const athDistance =
    token.ath && token.ath > 0 ? (1 - token.price / token.ath) * 100 : 100;
  const atlDistance =
    token.atl && token.atl > 0 ? (token.price / token.atl - 1) * 100 : 100;

  const ath_vs_atl_trend = athDistance - atlDistance;

  const directions = [
    Math.sign(priceChange) * Math.min(1, Math.abs(priceChange) / 10),
    Math.sign(marketCapChange) * Math.min(1, Math.abs(marketCapChange) / 10),
    Math.sign(ath_vs_atl_trend) * Math.min(1, Math.abs(ath_vs_atl_trend) / 100),
  ];

  const conflicts =
    directions.reduce((acc, dir, i) => acc + Math.abs(dir - directions[0]), 0) /
    2;

  return Math.exp(-conflicts);
}

function calculateSignalWeights(
  token: MobulaExtendedToken,
  alignmentFactor: number,
): SignalWeights {
  const priceChange = token.price_change_24h ?? 0;
  const marketCapChange = 0; // Missing from Mobula
  const marketCap = token.market_cap ?? 1;
  const volume = token.volume ?? 0;

  const volumeRatio = volume / marketCap;

  const baseWeights = {
    priceWeight: Math.min(1.0, Math.abs(priceChange) / 10),
    marketCapWeight: Math.min(1.0, Math.abs(marketCapChange) / 15),
    volumeWeight: Math.min(1.0, volumeRatio),
  };

  const adjustedWeights = {
    priceWeight: baseWeights.priceWeight,
    marketCapWeight:
      baseWeights.marketCapWeight *
      (Math.sign(marketCapChange) === Math.sign(priceChange) ? 1 : 0.7),
    volumeWeight:
      baseWeights.volumeWeight *
      (volumeRatio > 0.15 && Math.abs(priceChange) > 5 ? 1.2 : 1),
  };

  const athDistance =
    token.ath && token.ath > 0
      ? Math.abs(1 - token.price / token.ath) * 100
      : 100;
  const atlDistance =
    token.atl && token.atl > 0
      ? Math.abs(token.price / token.atl - 1) * 100
      : 100;

  if (athDistance < 20) {
    adjustedWeights.marketCapWeight *= 1.2;
  } else if (atlDistance < 20) {
    adjustedWeights.volumeWeight *= 1.2;
  }

  const totalWeight = Object.values(adjustedWeights).reduce((a, b) => a + b, 0);

  return {
    priceWeight: adjustedWeights.priceWeight / totalWeight,
    marketCapWeight: adjustedWeights.marketCapWeight / totalWeight,
    volumeWeight: adjustedWeights.volumeWeight / totalWeight,
  };
}

function generatePriceSignal(
  token: MobulaExtendedToken,
  weight: number,
  alignmentFactor: number,
): string {
  const change = token.price_change_24h ?? 0;
  const strength = Math.min(1.0, Math.abs(change) / 10);

  // We don’t have high_24h / low_24h, so estimate:
  const rangeEstimate = Math.abs(token.price_change_24h ?? 0); // % change
  const rangeStrength = Math.min(1.0, rangeEstimate / 20);

  const rangePosition = change >= 0 ? 100 : 0; // Crude approximation

  const category = categorizePriceMovement(change);

  return `price=${category}(${change.toFixed(1)})[w=${weight.toFixed(2)}][s=${strength.toFixed(2)}][r=${rangeStrength.toFixed(2)}][p=${rangePosition.toFixed(2)}][a=${alignmentFactor.toFixed(2)}]`;
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
  token: MobulaExtendedToken,
  normalized: NormalizedMetrics,
  weight: number,
  alignmentFactor: number,
): string {
  const volume = token.volume ?? 0;
  const marketCap = token.market_cap ?? 1; // Avoid division by zero

  const volumeToMcap = volume / marketCap;
  const category = categorizeVolumeActivity(volumeToMcap);
  const strength = Math.min(1.0, volumeToMcap * 5);

  const priceChange = Math.abs(token.price_change_24h ?? 0) / 100;
  const impact = Math.min(1.0, priceChange * volumeToMcap * 10);

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

function generateMarketState(
  token: MobulaExtendedToken,
  normalized: NormalizedMetrics,
  alignmentFactor: number,
): string {
  const phase = detectMarketPhase(normalized, token);
  const riskAnalysis = analyzeRisk(token, normalized, alignmentFactor);

  return `phase=${phase} risk=${riskAnalysis.level}[s=${riskAnalysis.score.toFixed(2)}]`;
}

function analyzeRisk(
  token: MobulaExtendedToken,
  normalized: NormalizedMetrics,
  alignmentFactor: number,
): { level: string; score: number } {
  const priceChange = Math.abs(token.price_change_24h ?? 0);
  const volatilityRisk = Math.min(1.0, priceChange / 20);

  const volumeToMcap =
    token.market_cap && token.market_cap > 0
      ? (token.volume ?? 0) / token.market_cap
      : 0;
  const liquidityRisk = Math.min(1.0, 1 - Math.min(1, volumeToMcap * 5));

  const athChange =
    token.ath && token.ath > 0
      ? Math.abs(1 - token.price / token.ath) * 100
      : 100;

  const marketRisk = Math.min(
    1.0,
    (athChange / 100 + (1 - normalized.supply_distribution)) / 2,
  );

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
  token: MobulaExtendedToken,
): string {
  const selectedNarratives: string[] = [];

  const priceChange = Math.abs(token.price_change_24h ?? 0);
  const volumeToMcapRatio =
    token.market_cap && token.market_cap > 0
      ? (token.volume ?? 0) / token.market_cap
      : 0;

  const athChangePct =
    token.ath && token.ath > 0
      ? Math.abs(1 - token.price / token.ath) * 100
      : 100;

  const atlChangePct =
    token.atl && token.atl > 0
      ? Math.abs(token.price / token.atl - 1) * 100
      : 100;

  // Primary market conditions (always include)
  selectedNarratives.push(narratives.priceAction[0]);
  selectedNarratives.push(narratives.volumeActivity[0]);
  selectedNarratives.push(narratives.sentiment[0]);

  // Add additional context for significant price moves
  if (priceChange >= 5) {
    selectedNarratives.push(...narratives.priceAction.slice(1));
  }

  if (volumeToMcapRatio > 0.15) {
    selectedNarratives.push(...narratives.volumeActivity.slice(1));
  }

  // Market extremes (near ATH or ATL)
  if (athChangePct < 20 || atlChangePct < 20) {
    selectedNarratives.push(...narratives.marketDynamics);
  }

  // Always include trading context
  selectedNarratives.push(...narratives.tradingContext);

  // Reinforce narratives if both strong price move & strong volume
  if (priceChange >= 5 && volumeToMcapRatio > 0.15) {
    selectedNarratives.push(...narratives.marketDynamics);
  }

  return selectedNarratives.join('. ') + '.';
}

function detectMarketPhase(
  normalized: NormalizedMetrics,
  token: MobulaExtendedToken,
): string {
  const phaseScores = {
    accumulation: 0,
    markup: 0,
    distribution: 0,
    markdown: 0,
  };

  // Price range usage (e.g., close-to-high = distribution, close-to-low = accumulation)
  const rangePosition = normalized.price_range_usage_24h;
  if (rangePosition > 0.8) {
    phaseScores.distribution += 2;
  } else if (rangePosition < 0.2) {
    phaseScores.accumulation += 2;
  }

  // Volume intensity tied to price direction
  const volumeIntensity = normalized.volume_intensity_24h;
  const priceChange = token.price_change_24h ?? 0;

  if (volumeIntensity > 2) {
    if (priceChange > 0) {
      phaseScores.markup += 2;
    } else {
      phaseScores.markdown += 2;
    }
  }

  // Momentum scoring (velocity over 24h trendline)
  const velocity = normalized.price_velocity_24h;
  if (velocity > 0.7) {
    phaseScores.markup += 1;
  } else if (velocity < -0.7) {
    phaseScores.markdown += 1;
  }

  // Return the phase with the highest score
  return Object.entries(phaseScores).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

export {
  NormalizedMetrics,
  detectMarketPhase,
  generateMarketNarratives,
  combineNarratives,
  calculateNormalizedMetrics,
  generateEnhancedSignalDescription,
};
