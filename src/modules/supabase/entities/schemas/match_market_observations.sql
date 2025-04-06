create or replace function match_market_observations (
  query_embedding vector(1024),
  match_threshold float,
  match_count int
)
returns table (
  id text,
  key text,
  name text,
  symbol text,
  "timestamp" bigint,
  price numeric,
  market_cap numeric,
  market_cap_diluted numeric,
  volume numeric,
  volume_change_24h numeric,
  volume_7d numeric,
  liquidity numeric,
  ath numeric,
  atl numeric,
  off_chain_volume numeric,
  is_listed boolean,
  price_change_1h numeric,
  price_change_24h numeric,
  price_change_7d numeric,
  price_change_1m numeric,
  price_change_1y numeric,
  total_supply numeric,
  circulating_supply numeric,
  similarity float
)
language sql stable
set statement_timeout = '30s'
as $$
  select
    market_observations.id,
    market_observations.key,
    market_observations.name,
    market_observations.symbol,
    market_observations."timestamp",
    market_observations.price,
    market_observations.market_cap,
    market_observations.market_cap_diluted,
    market_observations.volume,
    market_observations.volume_change_24h,
    market_observations.volume_7d,
    market_observations.liquidity,
    market_observations.ath,
    market_observations.atl,
    market_observations.off_chain_volume,
    market_observations.is_listed,
    market_observations.price_change_1h,
    market_observations.price_change_24h,
    market_observations.price_change_7d,
    market_observations.price_change_1m,
    market_observations.price_change_1y,
    market_observations.total_supply,
    market_observations.circulating_supply,
    1 - (market_observations.embedding <=> query_embedding) as similarity
  from market_observations
  where 1 - (market_observations.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;