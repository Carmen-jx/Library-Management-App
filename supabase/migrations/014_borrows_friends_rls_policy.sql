-- Allow users to view borrows of their accepted connections (friends)
CREATE POLICY "borrows_select_friends" ON borrows
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM connections
      WHERE status = 'accepted'
      AND (
        (requester_id = auth.uid() AND receiver_id = borrows.user_id)
        OR
        (receiver_id = auth.uid() AND requester_id = borrows.user_id)
      )
    )
  );
