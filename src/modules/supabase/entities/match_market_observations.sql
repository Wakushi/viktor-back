create or replace function match_market_observations (
  query_embedding vector(1024),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  coin_gecko_id text,
  "timestamp" bigint,
  market_cap_rank integer,
  price_usd numeric,
  high_24h numeric,
  low_24h numeric,
  ath numeric,
  ath_change_percentage numeric,
  atl numeric,
  atl_change_percentage numeric,
  market_cap numeric,
  fully_diluted_valuation numeric,
  circulating_supply numeric,
  total_supply numeric,
  total_volume numeric,
  max_supply numeric,
  supply_ratio numeric,
  price_change_24h numeric,
  price_change_percentage_24h numeric,
  market_cap_change_24h numeric,
  market_cap_change_percentage_24h numeric,
  similarity float
)
language sql stable
set statement_timeout = '30s'
as $$
  select
    market_observations.id,
    market_observations.coin_gecko_id,
    market_observations."timestamp",
    market_observations.market_cap_rank,
    market_observations.price_usd,
    market_observations.high_24h,
    market_observations.low_24h,
    market_observations.ath,
    market_observations.ath_change_percentage,
    market_observations.atl,
    market_observations.atl_change_percentage,
    market_observations.market_cap,
    market_observations.fully_diluted_valuation,
    market_observations.circulating_supply,
    market_observations.total_supply,
    market_observations.total_volume,
    market_observations.max_supply,
    market_observations.supply_ratio,
    market_observations.price_change_24h,
    market_observations.price_change_percentage_24h,
    market_observations.market_cap_change_24h,
    market_observations.market_cap_change_percentage_24h,
    1 - (market_observations.embedding <=> query_embedding) as similarity
  from market_observations
  where 1 - (market_observations.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;