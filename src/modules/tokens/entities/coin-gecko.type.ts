import { Address } from 'viem';

export type CoinGeckoTokenChain = {
  decimal_place: number;
  contract_address: Address | string;
};

export interface CoinGeckoSimpleToken {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number | null;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  roi: null | {
    times: number;
    currency: string;
    percentage: number;
  };
  last_updated: string;
}

export interface CoinGeckoDetailedToken {
  // Basic Token Information
  id: string;
  symbol: string;
  name: string;
  contract_addresses: Record<
    string,
    { decimal_place: number; contract_address: string }
  >;
  platforms: Record<string, string>;
  categories: string[];
  genesis_date: Date | null;

  // Market Position
  market_cap_rank: number;

  // Price & Market Data
  market_data: {
    current_price: { [key: string]: number };
    high_24h: { [key: string]: number };
    low_24h: { [key: string]: number };
    price_change_24h: number;
    price_change_percentage_24h: number;
    price_change_percentage_7d: number;
    price_change_percentage_14d: number;
    price_change_percentage_30d: number;
    market_cap: { [key: string]: number };
    total_volume: { [key: string]: number };
    fully_diluted_valuation: { [key: string]: number };
    market_cap_change_24h: number;
    market_cap_change_percentage_24h: number;
    total_supply: number;
    max_supply: number | null;
    circulating_supply: number;
    ath: { [key: string]: number };
    ath_change_percentage: { [key: string]: number };
    atl: { [key: string]: number };
    atl_change_percentage: { [key: string]: number };
  };

  // DeFi Specific Metrics
  market_data_defi: {
    total_value_locked: { [key: string]: number } | null;
    mcap_to_tvl_ratio: number | null;
    fdv_to_tvl_ratio: number | null;
  };

  // Community & Social Data
  community_data: {
    twitter_followers: number;
    telegram_channel_user_count: number;
    reddit_subscribers: number;
    reddit_average_posts_48h: number;
    reddit_average_comments_48h: number;
    reddit_accounts_active_48h: number;
  };

  // Developer Activity
  developer_data: {
    forks: number;
    stars: number;
    subscribers: number;
    total_issues: number;
    closed_issues: number;
    pull_requests_merged: number;
    commit_count_4_weeks: number;
  };

  // Sentiment
  sentiment_votes_up_percentage: number;
  sentiment_votes_down_percentage: number;
  watchlist_portfolio_users: number;

  // Project Links
  links: {
    website: string[];
    twitter: string | null;
    telegram: string | null;
    github: string[];
    whitepaper: string | null;
  };

  // Trading Data
  tickers: Array<{
    market: {
      name: string;
      identifier: string;
      has_trading_incentive: boolean;
    };
    last: number;
    volume: number;
    trust_score: string | null;
    bid_ask_spread_percentage: number;
    timestamp: string;
    last_traded_at: string;
    is_anomaly: boolean;
    is_stale: boolean;
  }>;

  // Metadata
  last_updated: Date;
  created_at: Date;
}
