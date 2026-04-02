-- Migration 010: lightweight search feedback for hybrid ranking

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS book_search_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query TEXT NOT NULL,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  is_relevant BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_search_feedback_book_id
  ON book_search_feedback (book_id);

CREATE INDEX IF NOT EXISTS idx_book_search_feedback_created_at
  ON book_search_feedback (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_book_search_feedback_query_trgm
  ON book_search_feedback
  USING gin (lower(query) gin_trgm_ops);

ALTER TABLE book_search_feedback ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION match_book_search_feedback(
  search_query TEXT,
  similarity_threshold REAL DEFAULT 0.35,
  min_votes INT DEFAULT 3,
  match_count INT DEFAULT 100
)
RETURNS TABLE(
  book_id UUID,
  feedback_score INT,
  vote_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    feedback.book_id,
    SUM(CASE WHEN feedback.is_relevant THEN 1 ELSE -1 END)::INT AS feedback_score,
    COUNT(*)::BIGINT AS vote_count
  FROM book_search_feedback AS feedback
  WHERE
    lower(feedback.query) % lower(search_query)
    AND similarity(lower(feedback.query), lower(search_query)) >= similarity_threshold
  GROUP BY feedback.book_id
  HAVING COUNT(*) >= min_votes
  ORDER BY COUNT(*) DESC, ABS(SUM(CASE WHEN feedback.is_relevant THEN 1 ELSE -1 END)) DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
