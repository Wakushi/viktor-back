create table document_embeddings (
  id bigserial primary key,
  content text, -- corresponds to the "text chunk"
  embedding vector(1024) -- 1024 works for VoyageAI embeddings
);

create or replace function match_document_embeddings (
  query_embedding vector(1024),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  content text,
  similarity float
)
language sql stable
as $$
  select
    document_embeddings.id,
    document_embeddings.content,
    1 - (document_embeddings.embedding <=> query_embedding) as similarity
  from document_embeddings
  where 1 - (document_embeddings.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;