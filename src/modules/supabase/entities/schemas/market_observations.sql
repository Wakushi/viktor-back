CREATE TABLE market_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  token_id NUMERIC NOT NULL,
  key TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  decimals INTEGER NOT NULL,
  logo TEXT,
  rank INTEGER,

  price NUMERIC NOT NULL,
  market_cap NUMERIC NOT NULL,
  market_cap_diluted NUMERIC,
  volume NUMERIC NOT NULL,
  volume_change_24h NUMERIC,
  volume_7d NUMERIC,
  liquidity NUMERIC,

  ath NUMERIC,
  atl NUMERIC,
  off_chain_volume NUMERIC,
  is_listed BOOLEAN DEFAULT TRUE,

  price_change_1h NUMERIC,
  price_change_24h NUMERIC,
  price_change_7d NUMERIC,
  price_change_1m NUMERIC,
  price_change_1y NUMERIC,

  total_supply NUMERIC,
  circulating_supply NUMERIC,

  embedding VECTOR(1024),

  extra JSONB DEFAULT '{}'::jsonb,
  contracts JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT market_observations_unique_key_ts UNIQUE (key, timestamp)
);

CREATE INDEX idx_market_observations_key ON market_observations(key);
CREATE INDEX idx_market_observations_timestamp ON market_observations(timestamp);
CREATE INDEX idx_market_observations_price ON market_observations(price);