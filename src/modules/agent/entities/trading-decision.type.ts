export type TradingDecision = {
  id: string;
  observation_id: string;
  wallet_address: string;
  token_address: string;

  decision_type: 'BUY' | 'SELL';
  decision_timestamp: number;
  decision_price_usd: number;

  previous_buy_id?: string;
  previous_buy_price_usd?: number;

  status:
    | 'PENDING_EXECUTION'
    | 'EXECUTION_FAILED'
    | 'AWAITING_24H_RESULT'
    | 'COMPLETED';

  execution_successful: boolean;
  execution_price_usd: number;

  price_24h_after_usd?: number;
  price_change_24h_pct?: number;

  created_at: Date;
  updated_at: Date;
};
