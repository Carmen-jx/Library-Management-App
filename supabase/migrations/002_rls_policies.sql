-- Migration 002: Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrows ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_cache ENABLE ROW LEVEL SECURITY;

-- ==================== PROFILES ====================
-- Anyone authenticated can view profiles
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (true);

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can update any profile
CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ==================== BOOKS ====================
-- Anyone authenticated can view books
CREATE POLICY "books_select" ON books
  FOR SELECT TO authenticated
  USING (true);

-- Only admins can insert books
CREATE POLICY "books_insert_admin" ON books
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Only admins can update books
CREATE POLICY "books_update_admin" ON books
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Only admins can delete books
CREATE POLICY "books_delete_admin" ON books
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ==================== BORROWS ====================
-- Users can view their own borrows
CREATE POLICY "borrows_select_own" ON borrows
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all borrows
CREATE POLICY "borrows_select_admin" ON borrows
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Users can create borrows for themselves
CREATE POLICY "borrows_insert" ON borrows
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own borrows (return)
CREATE POLICY "borrows_update_own" ON borrows
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Admins can update any borrow
CREATE POLICY "borrows_update_admin" ON borrows
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ==================== FAVORITES ====================
-- Users can view their own favorites
CREATE POLICY "favorites_select_own" ON favorites
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can add favorites
CREATE POLICY "favorites_insert" ON favorites
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can remove their own favorites
CREATE POLICY "favorites_delete_own" ON favorites
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ==================== MESSAGES ====================
-- Users can view messages they sent or received
CREATE POLICY "messages_select" ON messages
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can send messages
CREATE POLICY "messages_insert" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- Users can update messages they received (mark read)
CREATE POLICY "messages_update" ON messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id);

-- ==================== CONNECTIONS ====================
-- Users can view their own connections
CREATE POLICY "connections_select" ON connections
  FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

-- Users can create connection requests
CREATE POLICY "connections_insert" ON connections
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);

-- Users can update connections they received (accept/reject)
CREATE POLICY "connections_update" ON connections
  FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id);

-- Users can delete their own connections
CREATE POLICY "connections_delete" ON connections
  FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

-- ==================== TICKETS ====================
-- Users can view their own tickets
CREATE POLICY "tickets_select_own" ON tickets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all tickets
CREATE POLICY "tickets_select_admin" ON tickets
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Users can create tickets
CREATE POLICY "tickets_insert" ON tickets
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can update any ticket
CREATE POLICY "tickets_update_admin" ON tickets
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ==================== ACTIVITY LOGS ====================
-- Users can insert their own activity logs
CREATE POLICY "activity_logs_insert" ON activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own activity logs
CREATE POLICY "activity_logs_select_own" ON activity_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all activity logs
CREATE POLICY "activity_logs_select_admin" ON activity_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ==================== RECOMMENDATION CACHE ====================
-- Users can view their own cached recommendations
CREATE POLICY "recommendation_cache_select_own" ON recommendation_cache
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can create their own cached recommendations
CREATE POLICY "recommendation_cache_insert_own" ON recommendation_cache
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can refresh their own cached recommendations
CREATE POLICY "recommendation_cache_update_own" ON recommendation_cache
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
