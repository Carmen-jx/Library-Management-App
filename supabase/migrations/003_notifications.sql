-- Migration 003: Notifications Table
-- Real-time notification system for connection requests, ticket updates, etc.

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Authenticated users can create notifications where they are the actor
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = actor_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
