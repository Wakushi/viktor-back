import {
  calculateStats,
  MarketObservation,
  MarketStats,
} from './market-data-formatting';

export interface PhaseTransitionTest {
  baseCase: MarketObservation;
  transitions: MarketObservation[];
  marketStats: MarketStats;
  results?: {
    similarities: number[];
    marketPhases: string[];
  };
}

export function createPhaseTransitionTest(): PhaseTransitionTest {
  // Starting point: Deep consolidation phase
  const baseCase: MarketObservation = {
    id: 1,
    token_address: '0x1234...',
    token_symbol: 'TEST',
    timestamp: Date.now(),
    created_at: new Date(),
    price_usd: 100,
    volume_24h_usd: 800000, // Very low volume
    liquidity_usd: 10000000,
    price_change_24h_pct: -1.2, // Minimal price movement
    volume_change_24h_pct: -12.3, // Declining volume
    holder_count: 10000,
    active_addresses_24h: 600, // Low activity
    large_transactions_24h: 20,
    sentiment_score: -0.2, // Slightly negative sentiment
    social_volume_24h: 2000,
    news_sentiment_24h: -0.1,
  };

  // Create a full market cycle progression
  const transitions: MarketObservation[] = [
    // Early accumulation signs
    {
      ...baseCase,
      id: 2,
      price_usd: 98,
      volume_24h_usd: 1000000, // Volume starting to pick up
      price_change_24h_pct: -0.5, // Price still slightly negative
      volume_change_24h_pct: 15.2,
      active_addresses_24h: 900, // Activity increasing
      large_transactions_24h: 35, // Whales starting to move
      sentiment_score: 0.1,
      social_volume_24h: 3000,
    },
    // Strong accumulation
    {
      ...baseCase,
      id: 3,
      price_usd: 102,
      volume_24h_usd: 1500000,
      price_change_24h_pct: 2.8, // Price turning positive
      volume_change_24h_pct: 32.5,
      active_addresses_24h: 1400,
      large_transactions_24h: 55,
      sentiment_score: 0.4,
      social_volume_24h: 5000,
    },
    // Early expansion
    {
      ...baseCase,
      id: 4,
      price_usd: 110,
      volume_24h_usd: 2200000,
      price_change_24h_pct: 8.2,
      volume_change_24h_pct: 45.7,
      active_addresses_24h: 2100,
      large_transactions_24h: 85,
      sentiment_score: 0.7,
      social_volume_24h: 7500,
    },
    // Full expansion
    {
      ...baseCase,
      id: 5,
      price_usd: 125,
      volume_24h_usd: 3000000,
      price_change_24h_pct: 15.8,
      volume_change_24h_pct: 62.3,
      active_addresses_24h: 3000,
      large_transactions_24h: 120,
      sentiment_score: 0.9,
      social_volume_24h: 9500,
    },
    // Early distribution
    {
      ...baseCase,
      id: 6,
      price_usd: 122, // Price starting to wobble
      volume_24h_usd: 3500000, // Volume still high
      price_change_24h_pct: -2.1,
      volume_change_24h_pct: 58.4,
      active_addresses_24h: 2800,
      large_transactions_24h: 150, // Large holders starting to exit
      sentiment_score: 0.5, // Sentiment cooling off
      social_volume_24h: 8500,
    },
  ];

  const allObservations = [baseCase, ...transitions];
  const marketStats = {
    price: calculateStats(allObservations.map((o) => o.price_usd)),
    volume: calculateStats(allObservations.map((o) => o.volume_24h_usd)),
    liquidity: calculateStats(allObservations.map((o) => o.liquidity_usd)),
  };

  return { baseCase, transitions, marketStats };
}
