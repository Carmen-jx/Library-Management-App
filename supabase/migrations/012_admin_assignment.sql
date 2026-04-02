-- Migration 012: Admin Task Assignment System
-- Adds fair task distribution to admins

-- Add assigned_to column to tickets table
ALTER TABLE tickets ADD COLUMN assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Add indexes for efficient admin task queries
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_tickets_assigned_to_status ON tickets(assigned_to, status);

-- Add comment for clarity
COMMENT ON COLUMN tickets.assigned_to IS 'ID of the admin this ticket is assigned to. NULL if unassigned.';
