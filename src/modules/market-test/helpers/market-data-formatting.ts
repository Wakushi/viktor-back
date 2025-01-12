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

function calculateNormalizedMetrics(
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

function transformToEmbeddingText(
  observation: MarketObservation,
  stats: MarketStats,
): string {
  const normalized = calculateNormalizedMetrics(observation, stats);
  const priceZScore = calculateZScore(
    observation.price_usd,
    stats.price.mean,
    stats.price.stdDev,
  );

  return `
    primary_metrics:
    price=${priceZScore.toFixed(3)}
    price=${priceZScore.toFixed(3)}
    price_change=${observation.price_change_24h_pct.toFixed(1)}
    price_change=${observation.price_change_24h_pct.toFixed(1)}
    volume=${normalized.volume_normalized.toFixed(3)}
    volume=${normalized.volume_normalized.toFixed(3)}
    volume_change=${observation.volume_change_24h_pct.toFixed(1)}
    volume_change=${observation.volume_change_24h_pct.toFixed(1)}

    secondary_metrics:
    wallet_ratio=${(normalized.wallet_activity_ratio * 100).toFixed(1)}
    vol_liq_ratio=${(normalized.volume_to_liquidity_ratio * 100).toFixed(1)}
    sentiment=${observation.sentiment_score.toFixed(2)}

    trend_signals:
    price_signal=${
      observation.price_change_24h_pct > 5
        ? 'bullish'
        : observation.price_change_24h_pct < -5
          ? 'bearish'
          : 'neutral'
    }
    volume_signal=${
      observation.volume_change_24h_pct > 15
        ? 'rising'
        : observation.volume_change_24h_pct < -15
          ? 'falling'
          : 'stable'
    }
    activity_signal=${normalized.wallet_activity_ratio > 0.1 ? 'high' : 'low'}

    market_characteristics:
    phase=${detectMarketPhase(normalized, observation)}
    phase=${detectMarketPhase(normalized, observation)}
    primary_trend=${
      Math.abs(observation.price_change_24h_pct) > 5
        ? observation.price_change_24h_pct > 0
          ? 'uptrend'
          : 'downtrend'
        : 'ranging'
    }
  `
    .replace(/\n\s+/g, ' ')
    .trim();
}

function detectMarketPhase(
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
