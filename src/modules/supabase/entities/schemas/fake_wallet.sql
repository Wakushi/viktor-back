create table fake_wallet (
   id BIGSERIAL PRIMARY KEY,
   tokens jsonb, -- Mobula token id -> amount { 102479749: 0.8, 102479743: 1500 }
   total_value_usd NUMERIC,
   daily_return_percent NUMERIC,
   cumulative_return_percent NUMERIC,
   created_at timestamptz not null default now()
);