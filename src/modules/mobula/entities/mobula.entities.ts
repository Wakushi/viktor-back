import { Address } from 'viem';

export enum MobulaChain {
  ETHEREUM = 'Ethereum',
  BASE = 'Base',
}

export type MobulaTokenPriceHistory = {
  price_history: number[][];
  name: string;
  symbol: string;
};

export type MobulaSimpleToken = {
  id: number;
  name: string;
  symbol: string;
};

export interface MobulaTokenQueryParams {
  sortField?: string;
  sortBy?: string;
  sortOrder?: 'desc' | 'asc';
  filters?: string;
  limit?: number;
  blockchain?: string;
  blockchains?: string;
  offset?: number;
}

// /all endpoint
export interface MobulaMultipleTokens {
  id: number;
  symbol?: string;
  name?: string;
  logo?: string;
  price?: number;
  price_change_1h?: number;
  price_change_24h?: number;
  price_change_7d?: number;
  price_change_30d?: number;
  price_change_1y?: number;
  market_cap?: number;
  liquidity?: number;
  contracts?: string[];
  blockchains?: MobulaChain[];
  chat?: string;
  twitter?: string;
  website?: string;
  rank?: number;
}

// /market/multi-data endpoint
export interface MobulaMultiDataToken {
  key: string;
  id: number;
  timestamp: number;
  name: string;
  symbol: string;
  decimals: number;
  logo: string;
  rank: number;
  price: number;
  market_cap: number;
  market_cap_diluted: number;
  volume: number;
  volume_change_24h: number;
  volume_7d: number;
  liquidity: number;
  ath: number;
  atl: number;
  off_chain_volume: number;
  is_listed: boolean;
  price_change_1h: number;
  price_change_24h: number;
  price_change_7d: number;
  price_change_1m: number;
  price_change_1y: number;
  total_supply: number;
  circulating_supply: number;
  contracts: TokenContract[];
}

export interface MobulaExtendedToken extends MobulaMultiDataToken {
  extra: MobulaTokenSocials;
}

export interface MobulaTokenSocials {
  twitter?: string;
  website?: string;
}

// /search?input=${token} endpoint
export interface MobulaSingleToken {
  id: number;
  name: string;
  symbol: string;
  contracts: string[];
  blockchains: string[];
  decimals: number[];
  twitter: string;
  website: string;
  logo: string;
  price: number;
  market_cap: number;
  liquidity: number;
  volume: number;
  pairs: TokenPair[];
  type: string;
}

interface TokenInfo {
  address: string;
  price: number;
  priceToken: number;
  priceTokenString: string;
  approximateReserveUSD: number;
  approximateReserveTokenRaw: string;
  approximateReserveToken: number;
  symbol: string;
  name: string;
  id: number;
  decimals: number;
  totalSupply: number;
  circulatingSupply: number;
  chainId: string;
}

interface Exchange {
  name: string;
  logo: string;
}

interface TokenPair {
  token0: TokenInfo;
  token1: TokenInfo;
  volume24h: number;
  liquidity: number;
  blockchain: string;
  address: string;
  createdAt: string;
  type: string;
  baseToken: string;
  exchange: Exchange;
  factory: string;
  quoteToken: string;
  price: number;
  priceToken: number;
  priceTokenString: string;
}

export interface TokenContract {
  address: Address;
  blockchainId: string;
  blockchain: MobulaChain;
  decimals: number;
}
