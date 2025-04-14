create table analysis_results (
   id BIGSERIAL PRIMARY KEY,             
   analysis jsonb,        
   performance jsonb,
   fearAndGreedIndex text,        
   created_at timestamptz not null default now()
);