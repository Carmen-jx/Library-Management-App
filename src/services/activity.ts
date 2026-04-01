import { createClient } from '@/lib/supabase/client';
import type { ActivityLog } from '@/types';

export async function logActivity(
  userId: string,
  action: string,
  metadata?: Record<string, unknown>
) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('activity_logs')
    .insert({
      user_id: userId,
      action,
      metadata: metadata ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ActivityLog;
}

export async function getUserActivity(userId: string, limit = 20) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as ActivityLog[];
}

export async function getAllActivity(limit = 50) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('activity_logs')
    .select('*, profile:profiles(*)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as ActivityLog[];
}
