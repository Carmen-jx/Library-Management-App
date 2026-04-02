-- Migration 009: improve book search candidate retrieval
-- Includes genre text in full-text search and uses weighted web-style queries.

CREATE OR REPLACE FUNCTION search_books(search_query TEXT)
RETURNS SETOF books AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM books
  WHERE
    (
      setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
      setweight(to_tsvector('english', COALESCE(author, '')), 'A') ||
      setweight(to_tsvector('english', array_to_string(COALESCE(genre, ARRAY[]::TEXT[]), ' ')), 'B') ||
      setweight(to_tsvector('english', COALESCE(description, '')), 'C')
    ) @@ websearch_to_tsquery('english', search_query)
  ORDER BY
    ts_rank(
      (
        setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(author, '')), 'A') ||
        setweight(to_tsvector('english', array_to_string(COALESCE(genre, ARRAY[]::TEXT[]), ' ')), 'B') ||
        setweight(to_tsvector('english', COALESCE(description, '')), 'C')
      ),
      websearch_to_tsquery('english', search_query)
    ) DESC;
END;
$$ LANGUAGE plpgsql;
