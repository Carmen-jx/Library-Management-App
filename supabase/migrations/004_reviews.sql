-- Migration 004: Reviews table
-- Users can rate and review books (1 review per user per book)

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

CREATE INDEX idx_reviews_book_id ON reviews(book_id);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);

-- Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view reviews
CREATE POLICY "reviews_select" ON reviews
  FOR SELECT TO authenticated
  USING (true);

-- Users can insert their own reviews
CREATE POLICY "reviews_insert" ON reviews
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own reviews
CREATE POLICY "reviews_update_own" ON reviews
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own reviews
CREATE POLICY "reviews_delete_own" ON reviews
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
