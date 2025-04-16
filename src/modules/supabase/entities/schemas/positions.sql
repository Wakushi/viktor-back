CREATE TABLE positions (
  id BIGSERIAL PRIMARY KEY,
  token_id INTEGER NOT NULL,
  amount NUMERIC NOT NULL,
  bought_at_price NUMERIC NOT NULL, -- USD
  bought_at_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);