create table analysis_results (
   id BIGSERIAL PRIMARY KEY,             
   analysis jsonb,        
   created_at timestamptz not null default now()
);