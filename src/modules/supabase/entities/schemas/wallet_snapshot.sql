CREATE TABLE wallet_snapshot (
  id BIGSERIAL PRIMARY KEY,
  balances jsonb,
  state TEXT CHECK (outcome IN ('before_sell', 'after_sell')) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);