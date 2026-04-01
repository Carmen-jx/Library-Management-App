'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  getNotifications,
  getUnreadCount,
  markAsRead as markAsReadService,
  markAllAsRead as markAllAsReadService,
} from '@/services/notifications';
import type { Notification } from '@/types';

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const [items, count] = await Promise.all([
        getNotifications(userId),
        getUnreadCount(userId),
      ]);
      setNotifications(items);
      setUnreadCount(count);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications((prev) => [newNotification, ...prev]);
          setUnreadCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await markAsReadService(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    try {
      await markAllAsReadService(userId);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }, [userId]);

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refresh };
}
