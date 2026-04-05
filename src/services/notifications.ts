import { createClient } from '@/lib/supabase/client';
import type { Notification, NotificationType } from '@/types';

export async function createNotification(
  actorId: string,
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      actor_id: actorId,
      user_id: userId,
      type,
      title,
      message,
      link: link ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Notification;
}

export async function notifyAdmins(
  actorId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
) {
  const supabase = createClient();

  const { data: admins, error: adminError } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin');

  if (adminError) throw adminError;
  if (!admins || admins.length === 0) return;

  const rows = admins.map((admin: { id: string }) => ({
    actor_id: actorId,
    user_id: admin.id,
    type,
    title,
    message,
    link: link ?? null,
  }));

  const { error } = await supabase.from('notifications').insert(rows);
  if (error) throw error;
}

export async function getNotifications(userId: string, limit = 30) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('notifications')
    .select('*, actor:profiles!actor_id(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as Notification[];
}

export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = createClient();

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw error;
  return count ?? 0;
}

export async function markAsRead(notificationId: string) {
  const supabase = createClient();

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) throw error;
}

export async function markAllAsRead(userId: string) {
  const supabase = createClient();

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw error;
}
