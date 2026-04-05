import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Borrow } from '@/types';

// --- Types ---

export interface DashboardData {
  dueSoon: Borrow[];
  overdue: Borrow[];
  currentlyBorrowed: Borrow[];
  friendsBorrows: FriendBorrow[];
  recentActivity: RecentActivity[];
}

export type FriendBorrow = Omit<Borrow, 'profile'> & {
  profile: { id: string; name: string; avatar_url: string | null };
};

export interface RecentActivity {
  id: string;
  bookTitle: string;
  action: 'borrowed' | 'returned';
  date: string;
}

// --- Main aggregated fetch (server-side) ---

export async function fetchDashboardDataServer(userId: string): Promise<DashboardData> {
  const supabase = createServerSupabaseClient();
  const now = new Date().toISOString();
  const fiveDaysFromNow = new Date();
  fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

  // Run ALL queries in parallel — one round-trip batch
  const [dueSoonResult, overdueResult, borrowedResult, connectionsResult, recentBorrowsResult] =
    await Promise.all([
      supabase
        .from('borrows')
        .select('*, book:books(*)')
        .eq('user_id', userId)
        .neq('status', 'returned')
        .gte('due_date', now)
        .lte('due_date', fiveDaysFromNow.toISOString())
        .order('due_date', { ascending: true })
        .limit(5),
      supabase
        .from('borrows')
        .select('*, book:books(*)')
        .eq('user_id', userId)
        .neq('status', 'returned')
        .lt('due_date', now)
        .order('due_date', { ascending: true })
        .limit(5),
      supabase
        .from('borrows')
        .select('*, book:books(*)')
        .eq('user_id', userId)
        .eq('status', 'borrowed')
        .order('borrowed_at', { ascending: false })
        .limit(10),
      supabase
        .from('connections')
        .select('requester_id, receiver_id')
        .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
        .eq('status', 'accepted'),
      supabase
        .from('borrows')
        .select('id, borrowed_at, returned_at, status, book:books(title)')
        .eq('user_id', userId)
        .order('borrowed_at', { ascending: false })
        .limit(5),
    ]);

  // Friends borrows (depends on connections result)
  const friendIds = (connectionsResult.data ?? []).map((conn: { requester_id: string; receiver_id: string }) =>
    conn.requester_id === userId ? conn.receiver_id : conn.requester_id
  );

  let friendsBorrows: FriendBorrow[] = [];
  if (friendIds.length > 0) {
    const { data: borrows } = await supabase
      .from('borrows')
      .select('*, book:books(*), profile:profiles(id, name, avatar_url)')
      .in('user_id', friendIds)
      .eq('status', 'borrowed')
      .order('borrowed_at', { ascending: false })
      .limit(5);
    friendsBorrows = (borrows ?? []) as FriendBorrow[];
  }

  // Build recent activity
  const recentActivity: RecentActivity[] = [];
  for (const borrow of (recentBorrowsResult.data ?? []) as unknown as Array<{
    id: string;
    borrowed_at: string;
    returned_at: string | null;
    status: string;
    book: { title: string } | null;
  }>) {
    const bookTitle = borrow.book?.title ?? 'Unknown Book';
    if (borrow.returned_at) {
      recentActivity.push({
        id: `${borrow.id}-returned`,
        bookTitle,
        action: 'returned',
        date: borrow.returned_at,
      });
    }
    recentActivity.push({
      id: `${borrow.id}-borrowed`,
      bookTitle,
      action: 'borrowed',
      date: borrow.borrowed_at,
    });
  }
  recentActivity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    dueSoon: (dueSoonResult.data ?? []) as Borrow[],
    overdue: (overdueResult.data ?? []) as Borrow[],
    currentlyBorrowed: (borrowedResult.data ?? []) as Borrow[],
    friendsBorrows,
    recentActivity: recentActivity.slice(0, 5),
  };
}
