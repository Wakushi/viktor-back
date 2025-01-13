import { Address } from 'viem';
import { CoinGeckoTokenMetadata } from './coin-gecko.type';

export type Token = {
  name: string;
  mainAddress: string;
  symbol: string;
};

export type TokenBalance = Token & {
  balance: string;
};

export interface TokenDiscoveryParams {
  minLiquidity?: number; // Minimum liquidity in USD
  minVolume?: number; // Minimum 24h volume in USD
  minHolderCount?: number; // Minimum number of holders
  maxAge?: number; // Maximum token age in days
  limit?: number; // Maximum number of tokens to return
}

export interface TokenMarketData {
  coinGeckoId: string;
  symbol: string;
  name: string;
  liquidity_usd: number;
  volume_24h: number;
  holder_count: number;
  created_at: Date | string;
  price_change_24h: number;
  market_cap: number;
  price_usd: number;
  metadata?: CoinGeckoTokenMetadata;
}
