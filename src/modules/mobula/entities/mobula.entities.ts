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

export interface MobulaToken {
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
