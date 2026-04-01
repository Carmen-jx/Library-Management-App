import { createAdminClient } from '@/lib/supabase/server';
import type { NotificationType } from '@/types';

export async function createNotificationServer(
  actorId: string,
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
) {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
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
  return data;
}

export async function notifyAdminsServer(
  actorId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
) {
  const adminClient = createAdminClient();

  const { data: admins, error: adminError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('role', 'admin');

  if (adminError) throw adminError;
  if (!admins || admins.length === 0) return [];

  const rows = admins.map((admin) => ({
    actor_id: actorId,
    user_id: admin.id,
    type,
    title,
    message,
    link: link ?? null,
  }));

  const { data, error } = await adminClient
    .from('notifications')
    .insert(rows)
    .select();

  if (error) throw error;
  return data ?? [];
}
