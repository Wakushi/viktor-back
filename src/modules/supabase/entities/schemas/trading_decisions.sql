CREATE TABLE trading_decisions (
    -- Core identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    observation_id UUID REFERENCES market_observations(id),
    token_id INTEGER,  -- Optional reference to Mobula token ID
    wallet_address TEXT NOT NULL CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$'),
    token_address TEXT NOT NULL CHECK (token_address ~ '^0x[a-fA-F0-9]{40}$'),
    
    -- Decision details
    decision_type TEXT NOT NULL CHECK (decision_type IN ('BUY', 'SELL')),
    decision_timestamp BIGINT NOT NULL,
    decision_price_usd NUMERIC NOT NULL,
    
    -- Previous BUY reference
    previous_buy_id UUID REFERENCES trading_decisions(id),
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

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