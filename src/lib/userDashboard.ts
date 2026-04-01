import { createClient } from '@/lib/supabase/client';
import type { Borrow } from '@/types';

// --- Types ---

export interface DashboardData {
  dueSoon: Borrow[];
  overdue: Borrow[];
  currentlyBorrowed: Borrow[];
  monthlyBorrowCount: number;
  favoriteGenre: string | null;
  mostReadAuthor: string | null;
  friendsBorrows: FriendBorrow[];
  totalBorrowed: number;
  favoritesCount: number;
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

async function getMonthlyBorrowCount(userId: string): Promise<number> {
  const supabase = createClient();
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { count, error } = await supabase
    .from('borrows')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('borrowed_at', firstOfMonth);

  if (error) throw error;
  return count ?? 0;
}

async function getFavoriteGenre(userId: string): Promise<string | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('borrows')
    .select('book:books(genre)')
    .eq('user_id', userId);

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const genreCount = new Map<string, number>();
  for (const row of data) {
    const book = (row as unknown as { book: { genre: string[] } | null }).book;
    if (!book?.genre) continue;
    for (const g of book.genre) {
      genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
    }
  }

  let topGenre: string | null = null;
  let maxCount = 0;
  Array.from(genreCount.entries()).forEach(([genre, count]) => {
    if (count > maxCount) {
      maxCount = count;
      topGenre = genre;
    }
  });

  return topGenre;
}

async function getMostReadAuthor(userId: string): Promise<string | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('borrows')
    .select('book:books(author)')
    .eq('user_id', userId);

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const authorCount = new Map<string, number>();
  for (const row of data) {
    const book = (row as unknown as { book: { author: string } | null }).book;
    if (!book?.author) continue;
    authorCount.set(book.author, (authorCount.get(book.author) ?? 0) + 1);
  }

  let topAuthor: string | null = null;
  let maxCount = 0;
  Array.from(authorCount.entries()).forEach(([author, count]) => {
    if (count > maxCount) {
      maxCount = count;
      topAuthor = author;
    }
  });

  return topAuthor;
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
  const supabase = createClient();

  const [
    dueSoon,
    overdue,
    currentlyBorrowed,
    monthlyBorrowCount,
    favoriteGenre,
    mostReadAuthor,
    friendsBorrows,
    totalBorrowedResult,
    favoritesResult,
  ] = await Promise.all([
    getDueSoonBooks(userId),
    getOverdueBooks(userId),
    getCurrentlyBorrowedBooks(userId),
    getMonthlyBorrowCount(userId),
    getFavoriteGenre(userId),
    getMostReadAuthor(userId),
    getFriendsRecentBorrows(userId),
    supabase
      .from('borrows')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('favorites')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
  ]);

  return {
    dueSoon,
    overdue,
    currentlyBorrowed,
    monthlyBorrowCount,
    favoriteGenre,
    mostReadAuthor,
    friendsBorrows,
    totalBorrowed: totalBorrowedResult.count ?? 0,
    favoritesCount: favoritesResult.count ?? 0,
  };
}
