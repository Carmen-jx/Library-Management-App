'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useUnreadMessages(userId: string | undefined) {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', userId)
      .eq('read', false);

    if (!error) {
      setUnreadCount(count ?? 0);
    }
  }, [userId]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  // Realtime: new messages arrive or messages marked as read
  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`unread-messages-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${userId}`,
        },
        () => {
          setUnreadCount((prev) => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${userId}`,
        },
        () => {
          // Re-fetch on update since multiple messages may be marked read at once
          fetchCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchCount]);

  return { unreadCount };
}
