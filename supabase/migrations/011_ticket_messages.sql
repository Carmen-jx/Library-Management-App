-- Migration 011: ticket message history and threaded support replies

CREATE TABLE IF NOT EXISTS ticket_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_role user_role NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id
  ON ticket_messages(ticket_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_sender_id
  ON ticket_messages(sender_id);

INSERT INTO ticket_messages (ticket_id, sender_id, sender_role, message, created_at)
SELECT
  tickets.id,
  tickets.user_id,
  'user'::user_role,
  tickets.message,
  tickets.created_at
FROM tickets
WHERE NOT EXISTS (
  SELECT 1
  FROM ticket_messages
  WHERE ticket_messages.ticket_id = tickets.id
);

INSERT INTO ticket_messages (ticket_id, sender_id, sender_role, message, created_at)
SELECT
  tickets.id,
  admin_profile.id,
  'admin'::user_role,
  tickets.admin_response,
  GREATEST(tickets.updated_at, tickets.created_at)
FROM tickets
CROSS JOIN LATERAL (
  SELECT profiles.id
  FROM profiles
  WHERE profiles.role = 'admin'
  ORDER BY profiles.created_at ASC
  LIMIT 1
) AS admin_profile
WHERE tickets.admin_response IS NOT NULL
  AND length(trim(tickets.admin_response)) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM ticket_messages
    WHERE ticket_messages.ticket_id = tickets.id
      AND ticket_messages.sender_role = 'admin'
      AND ticket_messages.message = tickets.admin_response
  );

ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_messages_select_own" ON ticket_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM tickets
      WHERE tickets.id = ticket_messages.ticket_id
        AND tickets.user_id = auth.uid()
    )
  );

CREATE POLICY "ticket_messages_select_admin" ON ticket_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY "ticket_messages_insert_own" ON ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_role = 'user'
    AND EXISTS (
      SELECT 1
      FROM tickets
      WHERE tickets.id = ticket_messages.ticket_id
        AND tickets.user_id = auth.uid()
    )
  );

CREATE POLICY "ticket_messages_insert_admin" ON ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_role = 'admin'
    AND EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
