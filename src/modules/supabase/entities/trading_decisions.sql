CREATE TABLE trading_decisions (
    -- Core identifiers
    id BIGSERIAL PRIMARY KEY,
    observation_id BIGINT REFERENCES market_observations(id),
    wallet_address TEXT NOT NULL CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$'),
    token_address TEXT NOT NULL CHECK (token_address ~ '^0x[a-fA-F0-9]{40}$'),
    
    -- Decision details
    decision_type TEXT NOT NULL CHECK (decision_type IN ('BUY', 'SELL')),
    decision_timestamp BIGINT NOT NULL,
    decision_price_usd NUMERIC NOT NULL,
    
    -- Previous BUY reference
    previous_buy_id BIGINT REFERENCES trading_decisions(id),
    previous_buy_price_usd NUMERIC,
    
    -- Status tracking
    status TEXT NOT NULL CHECK (
        status IN (
            'PENDING_EXECUTION',
            'EXECUTION_FAILED',
            'AWAITING_24H_RESULT',
            'COMPLETED'
        )
    ) DEFAULT 'PENDING_EXECUTION',
    
    -- Execution details
    execution_successful BOOLEAN DEFAULT false,
    execution_price_usd NUMERIC,
    
    -- Forward-looking performance metrics
    price_24h_after_usd NUMERIC,
    price_change_24h_pct NUMERIC,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_sell_reference CHECK (
        (decision_type = 'SELL' AND (previous_buy_id IS NULL OR previous_buy_price_usd IS NOT NULL)) OR
        decision_type != 'SELL'
    ),
    CONSTRAINT valid_price_changes CHECK (
        (status = 'COMPLETED' AND price_24h_after_usd IS NOT NULL AND price_change_24h_pct IS NOT NULL) OR
        status NOT IN ('COMPLETED')
    )
);

-- Indexes
CREATE INDEX idx_trading_decisions_observation ON trading_decisions(observation_id);
CREATE INDEX idx_trading_decisions_wallet ON trading_decisions(wallet_address);
CREATE INDEX idx_trading_decisions_token ON trading_decisions(token_address);
CREATE INDEX idx_trading_decisions_status ON trading_decisions(status);
CREATE INDEX idx_trading_decisions_decision ON trading_decisions(token_address, decision_type, decision_timestamp DESC);

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
    FROM trading_decisions
    WHERE token_address = p_token_address
    AND decision_type = 'BUY'
    AND decision_timestamp < p_before_timestamp
    AND execution_successful = true
    ORDER BY decision_timestamp DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;