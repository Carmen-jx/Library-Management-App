-- Migration 003: Functions and Triggers

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at on profiles
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER recommendation_cache_updated_at
  BEFORE UPDATE ON recommendation_cache
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Full-text search function for books
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

-- Get borrow statistics for admin dashboard
CREATE OR REPLACE FUNCTION get_borrow_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_books', (SELECT COUNT(*) FROM books),
    'active_borrows', (SELECT COUNT(*) FROM borrows WHERE status = 'borrowed'),
    'total_users', (SELECT COUNT(*) FROM profiles),
    'open_tickets', (SELECT COUNT(*) FROM tickets WHERE status = 'open')
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get popular books by borrow count
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

-- Get popular genres
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

-- Get borrows over time (last 30 days)
CREATE OR REPLACE FUNCTION get_borrows_over_time()
RETURNS TABLE(
  date DATE,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(borrowed_at) AS date,
    COUNT(*) AS count
  FROM borrows
  WHERE borrowed_at >= NOW() - INTERVAL '30 days'
  GROUP BY DATE(borrowed_at)
  ORDER BY date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Supabase storage bucket for avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: anyone can view avatars
CREATE POLICY "avatars_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

-- Storage policy: authenticated users can upload their own avatars
CREATE POLICY "avatars_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Storage policy: users can update their own avatars
CREATE POLICY "avatars_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Storage policy: users can delete their own avatars
CREATE POLICY "avatars_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
