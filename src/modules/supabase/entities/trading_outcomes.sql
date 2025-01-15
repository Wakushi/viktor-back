CREATE TABLE trading_outcomes (
    -- Core identifiers
    id BIGSERIAL PRIMARY KEY,
    observation_id BIGINT REFERENCES market_observations(id),
    wallet_address TEXT NOT NULL CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$'),
    token_address TEXT NOT NULL CHECK (token_address ~ '^0x[a-fA-F0-9]{40}$'),
    
    -- Decision details
    decision_type TEXT NOT NULL CHECK (decision_type IN ('BUY', 'SELL', 'WAIT')),
    decision_timestamp BIGINT NOT NULL,
    decision_price_usd NUMERIC NOT NULL,
    confidence_score NUMERIC CHECK (confidence_score >= 0 AND confidence_score <= 1),
    
    -- Previous BUY reference
    previous_buy_id BIGINT REFERENCES trading_outcomes(id),
    previous_buy_price_usd NUMERIC,
    
    -- Status tracking
    status TEXT NOT NULL CHECK (
        status IN (
            'PENDING_EXECUTION',
            'EXECUTION_FAILED',
            'AWAITING_24H_RESULT',
            'AWAITING_7D_RESULT',
            'COMPLETED'
        )
    ) DEFAULT 'PENDING_EXECUTION',
    next_update_due BIGINT NOT NULL,
    
    -- Execution details
    execution_successful BOOLEAN DEFAULT false,
    execution_price_usd NUMERIC,
    gas_cost_eth NUMERIC,
    
    -- Forward-looking performance metrics
    price_24h_after_usd NUMERIC,
    price_7d_after_usd NUMERIC,
    price_change_24h_pct NUMERIC,
    price_change_7d_pct NUMERIC,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_sell_reference CHECK (
        (decision_type = 'SELL' AND (previous_buy_id IS NULL OR previous_buy_price_usd IS NOT NULL)) OR
        decision_type != 'SELL'
    ),
    CONSTRAINT valid_price_changes CHECK (
        (status IN ('AWAITING_7D_RESULT', 'COMPLETED') AND price_24h_after_usd IS NOT NULL AND price_change_24h_pct IS NOT NULL) OR
        (status = 'COMPLETED' AND price_7d_after_usd IS NOT NULL AND price_change_7d_pct IS NOT NULL) OR
        status NOT IN ('AWAITING_7D_RESULT', 'COMPLETED')
    )
);

-- Indexes
CREATE INDEX idx_trading_outcomes_observation ON trading_outcomes(observation_id);
CREATE INDEX idx_trading_outcomes_wallet ON trading_outcomes(wallet_address);
CREATE INDEX idx_trading_outcomes_token ON trading_outcomes(token_address);
CREATE INDEX idx_trading_outcomes_status ON trading_outcomes(status);
CREATE INDEX idx_trading_outcomes_next_update ON trading_outcomes(next_update_due);
CREATE INDEX idx_trading_outcomes_decision ON trading_outcomes(token_address, decision_type, decision_timestamp DESC);

-- Helper function to find last BUY price for a token
CREATE OR REPLACE FUNCTION get_last_buy_price(
    p_token_address TEXT,
    p_before_timestamp BIGINT
) RETURNS TABLE (
    buy_id BIGINT,
    buy_price NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT id, decision_price_usd
    FROM trading_outcomes
    WHERE token_address = p_token_address
    AND decision_type = 'BUY'
    AND decision_timestamp < p_before_timestamp
    AND execution_successful = true
    ORDER BY decision_timestamp DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;