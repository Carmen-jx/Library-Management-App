-- Migration 004: Analytics Indexes
-- Performance indexes for analytics queries on activity_logs and borrows

-- Index on action for filtering by activity type (search, ai_search, etc.)
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);

-- Composite index for action + time range queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_created ON activity_logs(action, created_at DESC);

-- Index on due_date for overdue borrow queries
CREATE INDEX IF NOT EXISTS idx_borrows_due_date ON borrows(due_date);

-- Index on borrowed_at for time-range borrow queries
CREATE INDEX IF NOT EXISTS idx_borrows_borrowed_at ON borrows(borrowed_at DESC);
