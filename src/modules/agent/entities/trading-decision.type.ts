interface TradingDecision {
  id: string;
  observation_id: string; // References market_observations table
  wallet_address: string; // Address that made the decision
  token_address: string; // Token being traded

  // Decision details
  decision_type: 'BUY' | 'SELL'
  decision_timestamp: number; // When decision was made
  decision_price_usd: number; // Price at decision time
  confidence_score: number; // 0-1 scale

  // Previous BUY reference (for SELL decisions)
  previous_buy_id?: string; // Reference to the last BUY decision for this token
  previous_buy_price_usd?: number; // Price from the last BUY decision

  // Status tracking
  status:
    | 'PENDING_EXECUTION' // Just created, waiting for tx
    | 'EXECUTION_FAILED' // Tx failed
    | 'AWAITING_24H_RESULT' // Waiting for 24h price data
    | 'AWAITING_7D_RESULT' // Waiting for 7d price data
    | 'COMPLETED'; // Final state
  next_update_due: number; // Timestamp when next check is needed

  // Execution details
  execution_successful: boolean; // Whether the action was executed
  execution_price_usd: number; // Actual execution price
  gas_cost_eth: number; // Gas spent on execution

  // Forward-looking performance metrics (for both BUY and SELL)
  price_24h_after_usd?: number; // Price 24h after decision
  price_7d_after_usd?: number; // Price 7d after decision
  price_change_24h_pct?: number; // Percentage change after 24h
  price_change_7d_pct?: number; // Percentage change after 7d

  // Metadata
  created_at: Date;
  updated_at: Date;
}
