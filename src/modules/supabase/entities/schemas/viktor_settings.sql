create table viktor_settings (
   id BIGSERIAL PRIMARY KEY,
   whitelisted_chains TEXT[] not null,
   created_at timestamptz not null default now()
);