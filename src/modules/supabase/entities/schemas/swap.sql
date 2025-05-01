create table swaps (
   id BIGSERIAL PRIMARY KEY,
   chain TEXT not null,
   token_in TEXT not null,
   token_out TEXT not null,
   amount_in TEXT not null,
   amount_out TEXT not null,
   transaction_hash TEXT not null,
   created_at timestamptz not null default now()
);