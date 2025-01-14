export interface TokenData {
  market: TokenMarketObservation;
  metadata: TokenMetadata;
}

export interface TokenMarketObservation {
  timestamp: number;
  created_at?: Date;
  coinGeckoId: string;

  market_cap_rank: number;
  price_usd: number;
  high_24h: number;
  low_24h: number;
  ath: number;
  ath_change_percentage: number;
  atl: number;
  atl_change_percentage: number;
  market_cap: number;
  fully_diluted_valuation: number;
  circulating_supply: number;
  total_supply: number;
  total_volume: number;
  max_supply: number | null;
  supply_ratio: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
}

interface ContractDetails {
  decimal_place: number;
  contract_address: string;
}

export interface TokenMetadata {
  id: string;
  symbol: string;
  name: string;
  contract_addresses: Record<string, ContractDetails> | null;
  market_cap_rank: number | null;
  genesis_date: Date | string | null;
  categories: string[];
  links: {
    website: string[];
    twitter: string | null;
    telegram: string | null;
    github: string[];
  };
  platforms: Record<string, string> | null;
  last_updated: Date | string;
  created_at: Date | string;
}

export type WalletToken = {
  name: string;
  mainAddress: string;
  symbol: string;
};

export type WalletTokenBalance = WalletToken & {
  balance: string;
};

export interface TokenDiscoveryParams {
  minLiquidity?: number; // Minimum liquidity in USD
  minVolume?: number; // Minimum 24h volume in USD
  minHolderCount?: number; // Minimum number of holders
  maxAge?: number; // Maximum token age in days
  limit?: number; // Maximum number of tokens to return
}
