import { MarketObservation, MarketStats } from './market-data-formatting';

export interface SignalCorrelationTest {
  baseCase: MarketObservation;
  variations: MarketObservation[];
  marketStats: MarketStats;
  results?: {
    similarities: number[];
    correlations: {
      priceVolume: number[];
      priceSentiment: number[];
      volumeSentiment: number[];
    };
  };
}

export function createSignalCorrelationTest(): SignalCorrelationTest {
  const baseCase: MarketObservation = {
    id: 1,
    token_address: '0x1234...',
    token_symbol: 'TEST',
    timestamp: Date.now(),
    created_at: new Date(),
    price_usd: 2500,
    price_change_24h_pct: 8.5, // Strong positive price movement
    volume_24h_usd: 5000000,
    volume_change_24h_pct: 45.2, // Strong volume increase
    liquidity_usd: 25000000,
    active_addresses_24h: 5000,
    holder_count: 50000,
    social_volume_24h: 15000,
    sentiment_score: 0.72, // Strong positive sentiment
    large_transactions_24h: 50,
    news_sentiment_24h: 0.65,
  };

  // Create variations with more diverse signal relationships
  const variations: MarketObservation[] = [
    // Perfect alignment (strong bullish)
    {
      ...baseCase,
      price_change_24h_pct: 9.2,
      volume_change_24h_pct: 52.5,
      sentiment_score: 0.78,
      active_addresses_24h: 5500,
      social_volume_24h: 17000,
      large_transactions_24h: 55,
    },

    // Weak signals but aligned
    {
      ...baseCase,
      price_change_24h_pct: 2.8,
      volume_change_24h_pct: 12.4,
      sentiment_score: 0.25,
      active_addresses_24h: 4200,
      social_volume_24h: 12000,
      large_transactions_24h: 35,
    },

    // Strong price/volume, opposing sentiment
    {
      ...baseCase,
      price_change_24h_pct: 7.5,
      volume_change_24h_pct: 38.6,
      sentiment_score: -0.45, // Negative sentiment despite positive price
      active_addresses_24h: 4800,
      social_volume_24h: 18000, // High social volume
      large_transactions_24h: 65, // Increased large transactions
    },

    // Bearish reversal pattern
    {
      ...baseCase,
      price_change_24h_pct: -5.2, // Price turned negative
      volume_change_24h_pct: 125.0, // Volume spike
      sentiment_score: -0.62, // Sentiment turned negative
      active_addresses_24h: 7500, // Increased activity
      social_volume_24h: 25000, // Social volume spike
      large_transactions_24h: 85, // Many large transactions
    },

    // Distribution pattern
    {
      ...baseCase,
      price_change_24h_pct: 0.5, // Small price change
      volume_change_24h_pct: 85.5, // Very high volume
      sentiment_score: -0.35, // Negative sentiment
      active_addresses_24h: 6500, // High activity
      social_volume_24h: 20000,
      large_transactions_24h: 95, // Extremely high large transactions
    },

    // Dead cat bounce
    {
      ...baseCase,
      price_change_24h_pct: 4.2, // Moderate price increase
      volume_change_24h_pct: -25.5, // Declining volume
      sentiment_score: -0.58, // Still negative sentiment
      active_addresses_24h: 3500, // Reduced activity
      social_volume_24h: 16000,
      large_transactions_24h: 25,
    },

    // Accumulation pattern
    {
      ...baseCase,
      price_change_24h_pct: -0.8, // Small price decline
      volume_change_24h_pct: 65.2, // High volume
      sentiment_score: 0.45, // Positive sentiment
      active_addresses_24h: 5200,
      social_volume_24h: 13000,
      large_transactions_24h: 75, // Many large transactions
    },
  ];

  // Calculate market stats using all observations
  const allObservations = [baseCase, ...variations];

  // Adjust price ranges for more realistic stats
  const priceValues = allObservations.map((obs) => ({
    ...obs,
    price_usd: obs.price_usd * (1 + obs.price_change_24h_pct / 100),
  }));

  // Adjust volume ranges for more realistic stats
  const volumeValues = allObservations.map((obs) => ({
    ...obs,
    volume_24h_usd: obs.volume_24h_usd * (1 + obs.volume_change_24h_pct / 100),
  }));

  const marketStats: MarketStats = {
    price: calculateStats(priceValues.map((obs) => obs.price_usd)),
    volume: calculateStats(volumeValues.map((obs) => obs.volume_24h_usd)),
    liquidity: calculateStats(allObservations.map((obs) => obs.liquidity_usd)),
  };

  return {
    baseCase,
    variations,
    marketStats,
  };
}

function calculateStats(values: number[]): {
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
