create or replace function match_market_observations (
  query_embedding vector(1024),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
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
set search_path = public, extensions
as $$
  select
    mo.id,
    mo.key,
    mo.name,
    mo.symbol,
    mo."timestamp",
    mo.price,
    mo.market_cap,
    mo.market_cap_diluted,
    mo.volume,
    mo.volume_change_24h,
    mo.volume_7d,
    mo.liquidity,
    mo.ath,
    mo.atl,
    mo.off_chain_volume,
    mo.is_listed,
    mo.price_change_1h,
    mo.price_change_24h,
    mo.price_change_7d,
    mo.price_change_1m,
    mo.price_change_1y,
    mo.total_supply,
    mo.circulating_supply,
    1 - (mo.embedding::vector <=> query_embedding::vector) as similarity
  from market_observations mo
  where 1 - (mo.embedding::vector <=> query_embedding::vector) > match_threshold
  order by similarity desc
  limit match_count;
$$;