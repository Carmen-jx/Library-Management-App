-- Migration 008: pgvector embeddings for semantic search
-- Enables vector similarity search on books using OpenAI text-embedding-3-small (1536 dimensions)

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding column to books
ALTER TABLE books ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3. Create IVFFlat index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS books_embedding_idx
ON books
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 4. RPC function: match books by embedding similarity
CREATE OR REPLACE FUNCTION match_books_by_embedding(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.0,
  match_count INT DEFAULT 20
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  author TEXT,
  genre TEXT[],
  description TEXT,
  cover_url TEXT,
  metadata JSONB,
  available BOOLEAN,
  open_library_key TEXT,
  created_at TIMESTAMPTZ,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.title,
    b.author,
    b.genre,
    b.description,
    b.cover_url,
    b.metadata,
    b.available,
    b.open_library_key,
    b.created_at,
    1 - (b.embedding <=> query_embedding) AS similarity
  FROM books b
  WHERE b.embedding IS NOT NULL
    AND 1 - (b.embedding <=> query_embedding) > match_threshold
  ORDER BY b.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Analyze for query planner
ANALYZE books;
