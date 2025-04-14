CREATE TABLE week_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  token_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  observation_text TEXT NOT NULL,
  embedding VECTOR(1024) NOT NULL,

  raw_ohlcv_window JSONB NOT NULL,

  next_day_close NUMERIC NOT NULL,
  next_day_change NUMERIC NOT NULL,
  outcome TEXT CHECK (outcome IN ('bullish', 'bearish', 'neutral')) NOT NULL,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_week_observations_token_name ON week_observations(token_name);
CREATE INDEX idx_week_observations_start_date ON week_observations(start_date);
CREATE INDEX idx_week_observations_outcome ON week_observations(outcome);