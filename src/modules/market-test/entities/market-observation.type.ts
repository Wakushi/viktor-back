/**
 * Represents a comprehensive snapshot of a token's market state at a specific time
 */
export interface MarketObservation {
  // Basic Token Information
  /** Unique identifier for this observation */
  id: number;
  /** Blockchain contract address of the token */
  token_address: string;
  /** Trading symbol (e.g. 'ETH', 'BTC') */
  token_symbol: string;
  /** Unix timestamp of when observation was taken */
  timestamp: number;
  /** Datetime when this record was created */
  created_at: Date;

  // Price & Volume Metrics
  /** Current token price in USD */
  price_usd: number;
  /**
   * Total trading volume in USD over last 24 hours.
   * This represents how much of the token was bought and sold in the past day.
   * High volume often indicates high trading activity and market interest.
   * Example: If volume_24h_usd is $1,000,000, it means $1M worth of tokens
   * were traded (both buying and selling) in the last 24 hours.
   */
  volume_24h_usd: number;
  /**
   * Total available liquidity in USD across trading pools/exchanges.
   * Represents how much money is available in trading pools to facilitate trades.
   * Higher liquidity means trades can be executed with less price impact.
   * Example: If liquidity_usd is $10,000,000, you could potentially:
   * - Buy or sell larger amounts without significantly moving the price
   * - Execute trades more easily as there's more tokens/money available
   * - Experience less slippage (difference between expected and actual trade price)
   */
  liquidity_usd: number;

  // 24h Change Metrics
  /** Percentage price change over last 24h (e.g. -5.2 = 5.2% drop, +3.1 = 3.1% rise) */
  price_change_24h_pct: number;
  /** Percentage volume change over last 24h (e.g. -20 = 20% less trading, +50 = 50% more trading) */
  volume_change_24h_pct: number;

  // On-Chain Activity
  /** Total number of wallet addresses holding this token */
  holder_count: number;
  /** Number of unique addresses that traded this token in last 24h */
  active_addresses_24h: number;
  /** Number of "whale" transactions (large amounts) in last 24h */
  large_transactions_24h: number;

  // Market Sentiment & Social Metrics
  /** Overall market sentiment score (-1 = very negative, 0 = neutral, +1 = very positive) */
  sentiment_score: number;
  /** Amount of social media mentions/discussions in last 24h */
  social_volume_24h: number;
  /** News article sentiment score (-1 = very negative, 0 = neutral, +1 = very positive) */
  news_sentiment_24h: number;
}
