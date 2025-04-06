create table market_observations (
  id uuid primary key,
  token_id numeric not null,

  key text not null,
  timestamp bigint not null,
  name text not null,
  symbol text not null,
  decimals integer not null,
  logo text,
  rank integer,

  price numeric not null,
  market_cap numeric not null,
  market_cap_diluted numeric,
  volume numeric not null,
  volume_change_24h numeric,
  volume_7d numeric,
  liquidity numeric,

  ath numeric,
  atl numeric,
  off_chain_volume numeric,
  is_listed boolean default true,

  price_change_1h numeric,
  price_change_24h numeric,
  price_change_7d numeric,
  price_change_1m numeric,
  price_change_1y numeric,

  total_supply numeric,
  circulating_supply numeric,

  embedding vector(1024),

  extra jsonb default '{}'::jsonb,
  contracts jsonb default '[]'::jsonb,

  created_at timestamp with time zone default now(),

  constraint market_observations_unique_key_ts unique (key, timestamp)
);

create index idx_market_observations_key on market_observations(key);
create index idx_market_observations_timestamp on market_observations(timestamp);
create index idx_market_observations_price on market_observations(price);