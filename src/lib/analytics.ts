import { createClient } from '@/lib/supabase/client';

// --- Types ---

export interface AnalyticsData {
  kpis: {
    totalUsers: number;
    dau: number;
    activeBorrows: number;
    borrowRate: number;
  };
  engagement: {
    dau: number;
    wau: number;
    newUsers: number;
    returningUsers: number;
    repeatBorrowRate: number;
  };
  inventory: {
    totalBooks: number;
    availableBooks: number;
    availabilityRate: number;
    overdueCount: number;
  };
  behavior: {
    topSearches: { query: string; count: number }[];
    searchBorrowConversion: number;
  };
  social: {
    messagesSent7d: number;
    newConnections7d: number;
  };
  charts: {
    borrowsOverTime: { date: string; count: number }[];
    popularGenres: { genre: string; count: number }[];
    popularBooks: { title: string; borrow_count: number }[];
  };
}

// --- Helpers ---

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// --- Main fetch ---

export async function fetchAnalyticsData(): Promise<AnalyticsData> {
  const supabase = createClient();
  const now = new Date().toISOString();
  const oneDayAgo = daysAgo(1);
  const sevenDaysAgo = daysAgo(7);
  const fourteenDaysAgo = daysAgo(14);

  // Run all queries in parallel
  const [
    // KPI / engagement
    totalUsersResult,
    dauResult,
    wauResult,
    previousWeekActiveResult,
    newUsersResult,
    activeBorrowsResult,
    borrowsLast7dResult,
    repeatBorrowResult,
    _totalBorrowersResult,
    // Inventory
    totalBooksResult,
    availableBooksResult,
    overdueResult,
    // Behavior
    searchLogsResult,
    searchUsersResult,
    borrowAfterSearchResult,
    // Social
    messagesResult,
    connectionsResult,
    // Charts (RPC)
    borrowsOverTimeResult,
    popularGenresBorrowsResult,
    popularBooksResult,
  ] = await Promise.all([
    // Total users
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true }),

    // DAU: distinct users with activity in last 24h
    supabase
      .from('activity_logs')
      .select('user_id', { count: 'exact', head: false })
      .gte('created_at', oneDayAgo),

    // WAU: distinct users with activity in last 7 days
    supabase
      .from('activity_logs')
      .select('user_id', { count: 'exact', head: false })
      .gte('created_at', sevenDaysAgo),

    // Previous week active users (8-14 days ago)
    supabase
      .from('activity_logs')
      .select('user_id', { count: 'exact', head: false })
      .gte('created_at', fourteenDaysAgo)
      .lt('created_at', sevenDaysAgo),

    // New users (last 7 days)
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo),

    // Active borrows
    supabase
      .from('borrows')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'borrowed'),

    // Borrows in last 7 days
    supabase
      .from('borrows')
      .select('*', { count: 'exact', head: true })
      .gte('borrowed_at', sevenDaysAgo),

    // Users with >1 borrow (for repeat borrow rate)
    supabase
      .from('borrows')
      .select('user_id'),

    // Total distinct borrowers
    supabase
      .from('borrows')
      .select('user_id'),

    // Total books
    supabase
      .from('books')
      .select('*', { count: 'exact', head: true }),

    // Available books
    supabase
      .from('books')
      .select('*', { count: 'exact', head: true })
      .eq('available', true),

    // Overdue books
    supabase
      .from('borrows')
      .select('*', { count: 'exact', head: true })
      .lt('due_date', now)
      .neq('status', 'returned'),

    // Search logs (last 30 days, for top queries)
    supabase
      .from('activity_logs')
      .select('metadata')
      .eq('action', 'search')
      .gte('created_at', daysAgo(30))
      .limit(1000),

    // Users who searched in last 7 days
    supabase
      .from('activity_logs')
      .select('user_id, created_at')
      .eq('action', 'search')
      .gte('created_at', sevenDaysAgo),

    // Users who borrowed in last 7 days (for conversion)
    supabase
      .from('borrows')
      .select('user_id, borrowed_at')
      .gte('borrowed_at', sevenDaysAgo),

    // Messages sent (last 7 days)
    supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo),

    // New connections (last 7 days)
    supabase
      .from('connections')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .gte('created_at', sevenDaysAgo),

    // Chart RPCs
    supabase.rpc('get_borrows_over_time'),
    supabase
      .from('borrows')
      .select('books!inner(genre)'),
    supabase.rpc('get_popular_books', { limit_count: 10 }),
  ]);

  // --- Process results ---

  const totalUsers = totalUsersResult.count ?? 0;

  // DAU: count distinct user_ids
  const dauUserIds = new Set(
    (dauResult.data as { user_id: string }[] | null)?.map((r) => r.user_id) ?? []
  );
  const dau = dauUserIds.size;

  // WAU: count distinct user_ids
  const wauUserIds = new Set(
    (wauResult.data as { user_id: string }[] | null)?.map((r) => r.user_id) ?? []
  );
  const wau = wauUserIds.size;

  // Returning users: active this week AND active previous week
  const prevWeekUserIds = new Set(
    (previousWeekActiveResult.data as { user_id: string }[] | null)?.map((r) => r.user_id) ?? []
  );
  let returningUsers = 0;
  Array.from(wauUserIds).forEach((uid) => {
    if (prevWeekUserIds.has(uid)) returningUsers++;
  });

  const newUsers = newUsersResult.count ?? 0;
  const activeBorrows = activeBorrowsResult.count ?? 0;
  const borrowsLast7d = borrowsLast7dResult.count ?? 0;
  const borrowRate = wau > 0 ? Math.round((borrowsLast7d / wau) * 100) / 100 : 0;

  // Repeat borrow rate
  const allBorrowUserIds = (repeatBorrowResult.data as { user_id: string }[] | null) ?? [];
  const borrowCountByUser = new Map<string, number>();
  for (const row of allBorrowUserIds) {
    borrowCountByUser.set(row.user_id, (borrowCountByUser.get(row.user_id) ?? 0) + 1);
  }
  const totalBorrowers = borrowCountByUser.size;
  let repeatBorrowers = 0;
  Array.from(borrowCountByUser.values()).forEach((count) => {
    if (count > 1) repeatBorrowers++;
  });
  const repeatBorrowRate = totalBorrowers > 0
    ? Math.round((repeatBorrowers / totalBorrowers) * 100)
    : 0;

  // Inventory
  const totalBooks = totalBooksResult.count ?? 0;
  const availableBooks = availableBooksResult.count ?? 0;
  const availabilityRate = totalBooks > 0
    ? Math.round((availableBooks / totalBooks) * 1000) / 10
    : 0;
  const overdueCount = overdueResult.count ?? 0;

  // Top search queries
  const searchLogs = (searchLogsResult.data as { metadata: Record<string, unknown> | null }[] | null) ?? [];
  const queryCountMap = new Map<string, number>();
  for (const log of searchLogs) {
    const q = (log.metadata?.query as string)?.toLowerCase().trim();
    if (q) {
      queryCountMap.set(q, (queryCountMap.get(q) ?? 0) + 1);
    }
  }
  const topSearches = Array.from(queryCountMap.entries())
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Search → Borrow conversion
  const searchUsers = (searchUsersResult.data as { user_id: string; created_at: string }[] | null) ?? [];
  const borrowUsers = (borrowAfterSearchResult.data as { user_id: string; borrowed_at: string }[] | null) ?? [];
  const searchUserIdSet = new Set(searchUsers.map((s) => s.user_id));
  const borrowUserIdSet = new Set(borrowUsers.map((b) => b.user_id));
  let convertedUsers = 0;
  Array.from(searchUserIdSet).forEach((uid) => {
    if (borrowUserIdSet.has(uid)) convertedUsers++;
  });
  const searchBorrowConversion = searchUserIdSet.size > 0
    ? Math.round((convertedUsers / searchUserIdSet.size) * 100)
    : 0;

  // Social
  const messagesSent7d = messagesResult.count ?? 0;
  const newConnections7d = connectionsResult.count ?? 0;

  // Charts
  const borrowsOverTime = (borrowsOverTimeResult.data as { date: string; count: number }[] | null) ?? [];
  const borrowedGenresRows = (
    popularGenresBorrowsResult.data as { books: { genre: string[] | null } | null }[] | null
  ) ?? [];
  const genreCountMap = new Map<string, number>();
  for (const row of borrowedGenresRows) {
    const genres = row.books?.genre;
    const normalizedGenres = genres && genres.length > 0 ? genres : ['Fiction'];
    for (const genre of normalizedGenres) {
      genreCountMap.set(genre, (genreCountMap.get(genre) ?? 0) + 1);
    }
  }
  const popularGenres = Array.from(genreCountMap.entries())
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count);
  const popularBooks = (popularBooksResult.data as { title: string; borrow_count: number }[] | null) ?? [];

  return {
    kpis: {
      totalUsers,
      dau,
      activeBorrows,
      borrowRate,
    },
    engagement: {
      dau,
      wau,
      newUsers,
      returningUsers,
      repeatBorrowRate,
    },
    inventory: {
      totalBooks,
      availableBooks,
      availabilityRate,
      overdueCount,
    },
    behavior: {
      topSearches,
      searchBorrowConversion,
    },
    social: {
      messagesSent7d,
      newConnections7d,
    },
    charts: {
      borrowsOverTime,
      popularGenres,
      popularBooks,
    },
  };
}
