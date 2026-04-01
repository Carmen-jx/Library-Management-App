-- Migration 004: Convert books.genre to TEXT[] and update dependent indexes/functions

DO $$
DECLARE
  genre_udt TEXT;
BEGIN
  SELECT c.udt_name
  INTO genre_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'books'
    AND c.column_name = 'genre';

  IF genre_udt = 'text' THEN
    ALTER TABLE books
      ALTER COLUMN genre DROP DEFAULT;

    ALTER TABLE books
      ALTER COLUMN genre TYPE TEXT[]
      USING ARRAY[COALESCE(NULLIF(genre, ''), 'Fiction')];
  END IF;
END;
$$;

UPDATE books
SET genre = ARRAY['Fiction']::TEXT[]
WHERE genre IS NULL OR array_length(genre, 1) IS NULL;

ALTER TABLE books
  ALTER COLUMN genre SET DEFAULT ARRAY['Fiction']::TEXT[];

DROP INDEX IF EXISTS idx_books_genre;
CREATE INDEX IF NOT EXISTS idx_books_genre ON books USING gin(genre);

CREATE OR REPLACE FUNCTION get_popular_books(limit_count INT DEFAULT 10)
RETURNS TABLE(
  book_id UUID,
  title TEXT,
  author TEXT,
  cover_url TEXT,
  genre TEXT,
  borrow_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id AS book_id,
    b.title,
    b.author,
    b.cover_url,
    COALESCE(b.genre[1], 'Fiction'),
    COUNT(br.id) AS borrow_count
  FROM books b
  LEFT JOIN borrows br ON b.id = br.book_id
  GROUP BY b.id, b.title, b.author, b.cover_url, b.genre
  ORDER BY borrow_count DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_popular_genres()
RETURNS TABLE(
  genre TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT genre_name, COUNT(*) AS count
  FROM books b
  CROSS JOIN LATERAL unnest(
    CASE
      WHEN b.genre IS NULL OR array_length(b.genre, 1) IS NULL
        THEN ARRAY['Fiction']::TEXT[]
      ELSE b.genre
    END
  ) AS genre_name
  GROUP BY genre_name
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
