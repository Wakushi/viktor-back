create table market_observations (
    id bigserial primary key,
    coin_gecko_id text not null,
    timestamp bigint not null,
    created_at timestamp with time zone default now(),
    market_cap_rank integer not null,
    price_usd numeric not null,
    high_24h numeric not null,
    low_24h numeric not null,
    ath numeric not null,
    ath_change_percentage numeric not null,
    atl numeric not null,
    atl_change_percentage numeric not null,
    market_cap numeric not null,
    fully_diluted_valuation numeric,
    circulating_supply numeric not null,
    total_supply numeric,
    total_volume numeric not null,
    max_supply numeric,
    supply_ratio numeric,
    price_change_24h numeric not null,
    price_change_percentage_24h numeric not null,
    market_cap_change_24h numeric not null,
    market_cap_change_percentage_24h numeric not null,
    embedding vector(1024),  -- Added embedding column for vector similarity search

    -- Indexes for common queries
    constraint market_observations_unique_timestamp unique (coin_gecko_id, timestamp)
);

-- Create indexes for frequently accessed columns
create index idx_market_observations_coin_gecko_id on market_observations(coin_gecko_id);
create index idx_market_observations_timestamp on market_observations(timestamp);
create index idx_market_observations_price on market_observations(price_usd);