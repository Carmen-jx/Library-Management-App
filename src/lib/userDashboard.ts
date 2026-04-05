import { createClient } from '@/lib/supabase/client';
import type { Borrow } from '@/types';

// --- Types ---

export interface DashboardData {
  dueSoon: Borrow[];
  overdue: Borrow[];
  currentlyBorrowed: Borrow[];
  friendsBorrows: FriendBorrow[];
}

export type FriendBorrow = Omit<Borrow, 'profile'> & {
  profile: { id: string; name: string; avatar_url: string | null };
};

// --- Individual query helpers ---

async function getDueSoonBooks(userId: string): Promise<Borrow[]> {
  const supabase = createClient();
  const now = new Date().toISOString();
  const fiveDaysFromNow = new Date();
  fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

  const { data, error } = await supabase
    .from('borrows')
    .select('*, book:books(*)')
    .eq('user_id', userId)
    .neq('status', 'returned')
    .gte('due_date', now)
    .lte('due_date', fiveDaysFromNow.toISOString())
    .order('due_date', { ascending: true })
    .limit(5);

  if (error) throw error;
  return data as Borrow[];
}

async function getOverdueBooks(userId: string): Promise<Borrow[]> {
  const supabase = createClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('borrows')
    .select('*, book:books(*)')
    .eq('user_id', userId)
    .neq('status', 'returned')
    .lt('due_date', now)
    .order('due_date', { ascending: true })
    .limit(5);

  if (error) throw error;
  return data as Borrow[];
}

async function getCurrentlyBorrowedBooks(userId: string): Promise<Borrow[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('borrows')
    .select('*, book:books(*)')
    .eq('user_id', userId)
    .eq('status', 'borrowed')
    .order('borrowed_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data as Borrow[];
}

async function getFriendsRecentBorrows(userId: string): Promise<FriendBorrow[]> {
  const supabase = createClient();

  // Get accepted connections
  const { data: connections, error: connError } = await supabase
    .from('connections')
    .select('requester_id, receiver_id')
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
    .eq('status', 'accepted');

  if (connError) throw connError;
  if (!connections || connections.length === 0) return [];

  // Collect friend IDs
  const friendIds: string[] = [];
  for (const conn of connections) {
    const friendId = conn.requester_id === userId ? conn.receiver_id : conn.requester_id;
    friendIds.push(friendId);
  }

  if (friendIds.length === 0) return [];

  // Get recent borrows from friends
  const { data: borrows, error: borrowError } = await supabase
    .from('borrows')
    .select('*, book:books(*), profile:profiles(id, name, avatar_url)')
    .in('user_id', friendIds)
    .eq('status', 'borrowed')
    .order('borrowed_at', { ascending: false })
    .limit(5);

  if (borrowError) throw borrowError;
  return (borrows ?? []) as FriendBorrow[];
}

// --- Main aggregated fetch ---

export async function fetchAllDashboardData(userId: string): Promise<DashboardData> {
  const [dueSoon, overdue, currentlyBorrowed, friendsBorrows] = await Promise.all([
    getDueSoonBooks(userId),
    getOverdueBooks(userId),
    getCurrentlyBorrowedBooks(userId),
    getFriendsRecentBorrows(userId),
  ]);

  return {
    dueSoon,
    overdue,
    currentlyBorrowed,
    friendsBorrows,
  };
}
