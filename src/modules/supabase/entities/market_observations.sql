create table market_observations (
    id bigserial primary key,
    
    -- Token identification
    token_address text not null check (token_address ~ '^0x[a-fA-F0-9]{40}$'),
    token_symbol text not null,
    
    -- Timestamp and creation metadata
    timestamp bigint not null,  -- When this observation was made
    created_at timestamp with time zone default now(),
    
    -- Market metrics
    price_usd numeric not null,
    volume_24h_usd numeric not null,
    liquidity_usd numeric not null,
    price_change_24h_pct numeric,
    volume_change_24h_pct numeric,
    
    -- On-chain metrics
    holder_count integer,
    active_addresses_24h integer,
    large_transactions_24h integer,
    
    -- Sentiment data
    sentiment_score numeric check (sentiment_score >= -1 and sentiment_score <= 1),
    social_volume_24h integer,
    news_sentiment_24h numeric check (news_sentiment_24h >= -1 and news_sentiment_24h <= 1),
    
    -- Vector embedding of market context
    embedding vector(1024) not null,
    
    -- Constraints
    constraint positive_metrics check (
        price_usd >= 0 and
        volume_24h_usd >= 0 and
        liquidity_usd >= 0
    )
);