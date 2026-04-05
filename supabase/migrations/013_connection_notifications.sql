-- Migration 013: Automatic connection notifications via database trigger
-- Ensures notifications are always sent for connection requests and acceptances

-- Function to create notifications on connection changes
CREATE OR REPLACE FUNCTION public.handle_connection_notification()
RETURNS TRIGGER AS $$
DECLARE
  actor_name TEXT;
BEGIN
  -- Get the actor's name for the notification message
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- New connection request: notify the receiver
    SELECT name INTO actor_name FROM public.profiles WHERE id = NEW.requester_id;
    INSERT INTO public.notifications (user_id, actor_id, type, title, message, link)
    VALUES (
      NEW.receiver_id,
      NEW.requester_id,
      'connection_request',
      'New Connection Request',
      COALESCE(actor_name, 'Someone') || ' wants to connect with you.',
      '/profile/' || NEW.requester_id
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    -- Connection accepted: notify the requester
    SELECT name INTO actor_name FROM public.profiles WHERE id = NEW.receiver_id;
    INSERT INTO public.notifications (user_id, actor_id, type, title, message, link)
    VALUES (
      NEW.requester_id,
      NEW.receiver_id,
      'connection_accepted',
      'Connection Accepted',
      COALESCE(actor_name, 'Someone') || ' accepted your connection request.',
      '/profile/' || NEW.receiver_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on insert (new connection request)
CREATE OR REPLACE TRIGGER on_connection_request
  AFTER INSERT ON public.connections
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_connection_notification();

-- Trigger on update (connection accepted)
CREATE OR REPLACE TRIGGER on_connection_accepted
  AFTER UPDATE ON public.connections
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_connection_notification();
