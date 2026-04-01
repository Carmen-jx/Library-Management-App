-- Migration 005: Per-user cached AI recommendations

CREATE TABLE IF NOT EXISTS recommendation_cache (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  recommendations JSONB NOT NULL DEFAULT '[]'::JSONB,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recommendation_cache_refreshed_at
  ON recommendation_cache(refreshed_at DESC);

ALTER TABLE recommendation_cache ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recommendation_cache'
      AND policyname = 'recommendation_cache_select_own'
  ) THEN
    CREATE POLICY "recommendation_cache_select_own" ON recommendation_cache
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recommendation_cache'
      AND policyname = 'recommendation_cache_insert_own'
  ) THEN
    CREATE POLICY "recommendation_cache_insert_own" ON recommendation_cache
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recommendation_cache'
      AND policyname = 'recommendation_cache_update_own'
  ) THEN
    CREATE POLICY "recommendation_cache_update_own" ON recommendation_cache
      FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS recommendation_cache_updated_at ON recommendation_cache;

CREATE TRIGGER recommendation_cache_updated_at
  BEFORE UPDATE ON recommendation_cache
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
