-- Migration 006: Sync book availability with borrow status
-- Fixes existing data and adds trigger to keep available in sync going forward.

-- 1. Fix existing data: mark books with active borrows as unavailable
UPDATE books SET available = false
WHERE id IN (SELECT DISTINCT book_id FROM borrows WHERE status = 'borrowed');

-- 2. Fix inverse: mark books with no active borrow as available
UPDATE books SET available = true
WHERE available = false
AND id NOT IN (SELECT DISTINCT book_id FROM borrows WHERE status = 'borrowed');

-- 3. Trigger function to auto-sync books.available on borrow changes
CREATE OR REPLACE FUNCTION sync_book_availability()
RETURNS TRIGGER AS $$
BEGIN
  -- On new borrow: mark book unavailable
  IF (TG_OP = 'INSERT' AND NEW.status = 'borrowed') THEN
    UPDATE books SET available = false WHERE id = NEW.book_id;
  END IF;

  -- On status change to 'returned': mark book available if no other active borrow exists
  IF (TG_OP = 'UPDATE' AND NEW.status = 'returned' AND OLD.status != 'returned') THEN
    UPDATE books SET available = true
    WHERE id = NEW.book_id
    AND NOT EXISTS (
      SELECT 1 FROM borrows
      WHERE book_id = NEW.book_id AND status = 'borrowed' AND id != NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER sync_book_availability_trigger
  AFTER INSERT OR UPDATE ON borrows
  FOR EACH ROW EXECUTE FUNCTION sync_book_availability();
