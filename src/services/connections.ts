import { createClient } from '@/lib/supabase/client';
import type { Connection, ConnectionStatus } from '@/types';

export async function sendConnectionRequest(
  requesterId: string,
  receiverId: string
) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('connections')
    .insert({
      requester_id: requesterId,
      receiver_id: receiverId,
      status: 'pending' as ConnectionStatus,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Connection;
}

export async function acceptConnection(connectionId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('connections')
    .update({ status: 'accepted' as ConnectionStatus })
    .eq('id', connectionId)
    .select()
    .single();

  if (error) throw error;
  return data as Connection;
}

export async function rejectConnection(connectionId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('connections')
    .update({ status: 'rejected' as ConnectionStatus })
    .eq('id', connectionId)
    .select()
    .single();

  if (error) throw error;
  return data as Connection;
}

export async function getConnections(
  userId: string,
  status?: ConnectionStatus
) {
  const supabase = createClient();

  let query = supabase
    .from('connections')
    .select(
      '*, requester:profiles!requester_id(*), receiver:profiles!receiver_id(*)'
    )
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as Connection[];
}

export async function getPendingRequests(userId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('connections')
    .select(
      '*, requester:profiles!requester_id(*), receiver:profiles!receiver_id(*)'
    )
    .eq('receiver_id', userId)
    .eq('status', 'pending');

  if (error) throw error;
  return data as Connection[];
}

export async function getConnectionStatus(
  userId: string,
  otherUserId: string
) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('connections')
    .select(
      '*, requester:profiles!requester_id(*), receiver:profiles!receiver_id(*)'
    )
    .or(
      `and(requester_id.eq.${userId},receiver_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},receiver_id.eq.${userId})`
    )
    .maybeSingle();

  if (error) throw error;
  return data as Connection | null;
}

export async function getConnectionCount(userId: string): Promise<number> {
  const supabase = createClient();

  const { count, error } = await supabase
    .from('connections')
    .select('*', { count: 'exact', head: true })
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
    .eq('status', 'accepted');

  if (error) throw error;
  return count ?? 0;
}

export async function removeConnection(connectionId: string) {
  const supabase = createClient();

  const { error } = await supabase
    .from('connections')
    .delete()
    .eq('id', connectionId);

  if (error) throw error;
}
