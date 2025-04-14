create or replace function match_week_observations (
  query_embedding vector(1024),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  token_name text,
  start_date date,
  end_date date,
  observation_text text,
  raw_ohlcv_window jsonb,
  next_day_close numeric,
  next_day_change numeric,
  outcome text,
  similarity float,
  created_at timestamptz
)
language sql stable
set search_path = public, extensions
as $$
  select
    wo.id,
    wo.token_name,
    wo.start_date,
    wo.end_date,
    wo.observation_text,
    wo.raw_ohlcv_window,
    wo.next_day_close,
    wo.next_day_change,
    wo.outcome,
    1 - (wo.embedding <=> query_embedding::vector) as similarity,
    wo.created_at
  from week_observations wo
  where 1 - (wo.embedding <=> query_embedding::vector) > match_threshold
  order by similarity desc
  limit match_count;
$$;