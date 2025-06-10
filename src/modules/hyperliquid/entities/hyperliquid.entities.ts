import { Address } from 'viem';

export interface AllMidsResponse {
  [symbol: string]: string; // e.g. "@1", "BTC", "APE", "ZRO", etc.
}

export interface Order {
  coin: string; // e.g. "BTC"
  limitPx: string; // limit price as a string
  oid: number; // order ID
  side: 'A' | 'B'; // "A" = Ask (sell), "B" = Bid (buy)
  sz: string; // size (e.g., "0.0")
  timestamp: number; // Unix timestamp in ms
}

export interface DexMetadata {
  name: string; // Short name of the DEX (e.g. "test")
  full_name: string; // Full name (e.g. "test dex")
  deployer: string; // Ethereum address of the deployer
  oracle_updater: string | null; // Address of the oracle updater or null if none
}

export type InfoRequestType =
  | 'allMids'
  | 'openOrders'
  | 'perpDexs'
  | 'meta'
  | 'metaAndAssetCtxs'
  | 'clearinghouseState'
  | 'userFunding'
  | 'userNonFundingLedgerUpdates';

export interface InfoRequestPayload {
  type: InfoRequestType;
  dex?: string;
}

export interface UserInfoRequestPayload extends InfoRequestPayload {
  type: InfoRequestType;
  user: Address;
}

export interface UserFundingRequestPayload extends UserInfoRequestPayload {
  startTime: number;
}

export interface MarketInfo {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated?: boolean;
  isDelisted?: boolean;
}

export interface MarginTier {
  lowerBound: string;
  maxLeverage: number;
}

export interface MarginTable {
  description: string;
  marginTiers: MarginTier[];
}

export type MarginTablesEntry = [number, MarginTable];

export interface PerpUniverse {
  universe: MarketInfo[];
  marginTables: MarginTablesEntry[];
}

export interface MarketInfo {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated?: boolean;
}

export interface MarketMetrics {
  dayNtlVlm: string; // Daily notional volume
  funding: string; // Funding rate
  impactPxs: [string, string]; // Best bid/ask prices with impact
  markPx: string; // Mark price
  midPx: string; // Mid-market price
  openInterest: string; // Open interest
  oraclePx: string; // Oracle-reported price
  premium: string; // Premium over oracle
  prevDayPx: string; // Previous day's closing price
}

export type UniverseAndMetrics = {
  universe: MarketInfo[];
  metrics: MarketMetrics[];
};

export type UniverseAndMetricsReponse = [
  { universe: MarketInfo[] },
  MarketMetrics[],
];

export interface MarginSummary {
  accountValue: string;
  totalNtlPos: string;
  totalRawUsd: string;
  totalMarginUsed: string;
}

export interface MarginSummary {
  accountValue: string;
  totalNtlPos: string;
  totalRawUsd: string;
  totalMarginUsed: string;
}

export interface LeverageInfo {
  type: 'cross' | 'isolated';
  value: number;
}

export interface CumFunding {
  allTime: string;
  sinceOpen: string;
  sinceChange: string;
}

export interface TraderPosition {
  coin: string; // Token symbol (e.g. "BTC")
  szi: string; // Position size (positive for long, negative for short)
  leverage: LeverageInfo; // Leverage type and value
  entryPx: string; // Entry price
  positionValue: string; // Current notional value of the position
  unrealizedPnl: string; // Unrealized PnL in USDC
  returnOnEquity: string; // % ROE as a stringified float
  liquidationPx: string; // Price at which you'd be liquidated
  marginUsed: string; // Margin allocated to this position
  maxLeverage: number; // Max leverage allowed for this market
  cumFunding: CumFunding; // Cumulative funding values
}

export interface AssetPosition {
  type: 'oneWay'; // Position mode, likely always "oneWay" on Hyperliquid
  position: TraderPosition;
}

export interface AccountMarginState {
  marginSummary: MarginSummary;
  crossMarginSummary: MarginSummary;
  crossMaintenanceMarginUsed: string;
  withdrawable: string;
  assetPositions: AssetPosition[];
  time: number;
}

export interface TransferDelta {
  type: string;
  token: string; // Token being transferred (e.g., "USDC")
  amount: string; // Amount of the token transferred
  usdcValue: string;
  user: string; // Sender address
  destination: string; // Receiver address
  fee: string; // Fee charged (in token)
  nativeTokenFee: string; // Fee in native token (e.g., ETH for gas)
  nonce: string | null; // Nonce or null if not used
}

export interface TransferEvent {
  time: number; // Timestamp in ms
  hash: string; // Transaction hash
  delta: TransferDelta; // Transfer details
}
