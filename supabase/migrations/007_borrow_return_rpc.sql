-- Migration 007: Borrow/Return RPC functions
-- These bypass RLS so normal users can update books.available during borrow/return.

-- borrow_book: atomically claim book + create borrow record
CREATE OR REPLACE FUNCTION borrow_book(p_book_id UUID)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_borrow RECORD;
BEGIN
  -- Atomically claim the book — only succeeds if currently available
  UPDATE books SET available = false
  WHERE id = p_book_id AND available = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOK_NOT_AVAILABLE';
  END IF;

  -- Create borrow record (due_date uses table default: NOW() + 14 days)
  INSERT INTO borrows (user_id, book_id, status)
  VALUES (v_user_id, p_book_id, 'borrowed')
  RETURNING * INTO v_borrow;

  RETURN row_to_json(v_borrow);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- return_book: mark borrow as returned + mark book available
CREATE OR REPLACE FUNCTION return_book(p_borrow_id UUID)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_borrow RECORD;
BEGIN
  -- Update borrow to returned — owner or admin
  UPDATE borrows
  SET status = 'returned', returned_at = NOW()
  WHERE id = p_borrow_id
    AND status = 'borrowed'
    AND (
      user_id = v_user_id
      OR EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND role = 'admin')
    )
  RETURNING * INTO v_borrow;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BORROW_NOT_FOUND';
  END IF;

  -- Mark book available if no other active borrow exists
  UPDATE books SET available = true
  WHERE id = v_borrow.book_id
  AND NOT EXISTS (
    SELECT 1 FROM borrows
    WHERE book_id = v_borrow.book_id AND status = 'borrowed' AND id != v_borrow.id
  );

  RETURN row_to_json(v_borrow);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
