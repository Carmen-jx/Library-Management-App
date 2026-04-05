import { createClient } from '@/lib/supabase/client';
import { getPrimaryGenre } from '@/lib/utils';
import type { BookRecommendation, RecommendationCache } from '@/types';

const REFRESH_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;

interface RecommendationResponse {
  recommendations: BookRecommendation[];
  refreshedAt: string | null;
  stale: boolean;
}

interface SupabaseLikeError {
  code?: string;
  message?: string;
}

interface RecommendationSourceBook {
  title: string;
  author: string;
  genre: string[];
}

interface BorrowedBookReference {
  title: string;
  author: string;
  open_library_key: string | null;
}

interface BorrowedBookLookup {
  workKeys: Set<string>;
  titleAuthorKeys: Set<string>;
}

function formatBookForPrompt(book: RecommendationSourceBook): string {
  return `${book.title} by ${book.author} (${getPrimaryGenre(book.genre)})`;
}

function isCacheFresh(refreshedAt: string): boolean {
  return Date.now() - new Date(refreshedAt).getTime() < REFRESH_INTERVAL_MS;
}

function isCacheTableUnavailable(error: SupabaseLikeError): boolean {
  return error.code === '42P01' || error.code === 'PGRST205';
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function toWorkKey(openLibraryKey: string | null | undefined): string | null {
  const normalized = normalizeText(openLibraryKey);
  return normalized.length > 0 ? normalized : null;
}

function toTitleAuthorKey(title: string, author: string): string {
  return `${normalizeText(title)}::${normalizeText(author)}`;
}

function filterBorrowedRecommendations(
  recommendations: BookRecommendation[],
  borrowedLookup: BorrowedBookLookup
): BookRecommendation[] {
  return recommendations.filter((recommendation) => {
    const workKey = toWorkKey(recommendation.open_library_key);
    if (workKey && borrowedLookup.workKeys.has(workKey)) {
      return false;
    }

    const titleAuthorKey = toTitleAuthorKey(recommendation.title, recommendation.author);
    return !borrowedLookup.titleAuthorKeys.has(titleAuthorKey);
  });
}

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    return error;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as SupabaseLikeError).message === 'string'
  ) {
    return new Error((error as SupabaseLikeError).message);
  }

  return new Error(fallback);
}

async function buildRecommendationRequest(userId: string) {
  const supabase = createClient();

  const [profileResult, favoritesResult, borrowsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('favorite_genres')
      .eq('id', userId)
      .single(),
    supabase
      .from('favorites')
      .select('book:books(title, author, genre)')
      .eq('user_id', userId),
    supabase
      .from('borrows')
      .select('book:books(title, author, genre)')
      .eq('user_id', userId),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (favoritesResult.error) {
    throw favoritesResult.error;
  }

  if (borrowsResult.error) {
    throw borrowsResult.error;
  }

  const favorites = (favoritesResult.data ?? [])
    .map((row: Record<string, unknown>) => row.book as RecommendationSourceBook | null)
    .filter((book: RecommendationSourceBook | null): book is RecommendationSourceBook => Boolean(book))
    .map(formatBookForPrompt);

  const borrowHistory = (borrowsResult.data ?? [])
    .map((row: Record<string, unknown>) => row.book as RecommendationSourceBook | null)
    .filter((book: RecommendationSourceBook | null): book is RecommendationSourceBook => Boolean(book))
    .map(formatBookForPrompt);

  return {
    favorites,
    borrowHistory,
    genres: profileResult.data?.favorite_genres ?? [],
  };
}

async function generateRecommendations(
  userId: string,
  previousRecommendations: BookRecommendation[] = []
): Promise<BookRecommendation[]> {
  const payload = await buildRecommendationRequest(userId);

  const excludeTitles = previousRecommendations.map(
    (rec) => `${rec.title} by ${rec.author}`
  );

  const response = await fetch('/api/ai/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, previousRecommendations: excludeTitles }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.error || `Recommendation request failed with status ${response.status}`
    );
  }

  const data = await response.json();
  return (data.recommendations ?? []) as BookRecommendation[];
}

async function getCache(userId: string): Promise<RecommendationCache | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('recommendation_cache')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (isCacheTableUnavailable(error)) {
      return null;
    }
    throw toError(error, 'Failed to load cached recommendations.');
  }

  return data as RecommendationCache | null;
}

async function saveCache(
  userId: string,
  recommendations: BookRecommendation[]
): Promise<RecommendationCache | null> {
  const supabase = createClient();
  const refreshedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from('recommendation_cache')
    .upsert(
      {
        user_id: userId,
        recommendations,
        refreshed_at: refreshedAt,
      },
      { onConflict: 'user_id' }
    )
    .select('*')
    .single();

  if (error) {
    if (isCacheTableUnavailable(error)) {
      return null;
    }
    throw toError(error, 'Failed to save cached recommendations.');
  }

  return data as RecommendationCache;
}

async function getBorrowedBookLookup(userId: string): Promise<BorrowedBookLookup> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('borrows')
    .select('book:books(title, author, open_library_key)')
    .eq('user_id', userId)
    .in('status', ['borrowed', 'overdue']);

  if (error) {
    throw toError(error, 'Failed to load borrowed books.');
  }

  const borrowedBooks = (data ?? [])
    .map((row: Record<string, unknown>) => row.book as BorrowedBookReference | null)
    .filter((book: BorrowedBookReference | null): book is BorrowedBookReference => Boolean(book));

  return {
    workKeys: new Set(
      borrowedBooks
        .map((book: BorrowedBookReference) => toWorkKey(book.open_library_key))
        .filter((key: string | null): key is string => Boolean(key))
    ),
    titleAuthorKeys: new Set(
      borrowedBooks.map((book: BorrowedBookReference) => toTitleAuthorKey(book.title, book.author))
    ),
  };
}

export async function getUserRecommendations(
  userId: string,
  options?: { forceRefresh?: boolean }
): Promise<RecommendationResponse> {
  const forceRefresh = options?.forceRefresh ?? false;

  // Fetch cache and borrowed-book lookup in parallel instead of sequentially
  const [cache, borrowedLookup] = await Promise.all([
    getCache(userId),
    getBorrowedBookLookup(userId),
  ]);
  const hasCachedRecommendations =
    Boolean(cache) && Array.isArray(cache?.recommendations) && cache!.recommendations.length > 0;

  if (!forceRefresh && cache && hasCachedRecommendations && isCacheFresh(cache.refreshed_at)) {
    return {
      recommendations: filterBorrowedRecommendations(cache.recommendations, borrowedLookup),
      refreshedAt: cache.refreshed_at,
      stale: false,
    };
  }

  try {
    const previousRecs = hasCachedRecommendations ? cache!.recommendations : [];
    const recommendations = filterBorrowedRecommendations(
      await generateRecommendations(userId, previousRecs),
      borrowedLookup
    );

    if (recommendations.length === 0 && hasCachedRecommendations) {
      return {
        recommendations: filterBorrowedRecommendations(cache!.recommendations, borrowedLookup),
        refreshedAt: cache!.refreshed_at,
        stale: false,
      };
    }

    const saved = await saveCache(userId, recommendations);
    return {
      recommendations,
      refreshedAt: saved?.refreshed_at ?? new Date().toISOString(),
      stale: false,
    };
  } catch (error) {
    console.error('[Recommendations] Failed to generate fresh recommendations:', error);

    if (hasCachedRecommendations) {
      return {
        recommendations: filterBorrowedRecommendations(cache!.recommendations, borrowedLookup),
        refreshedAt: cache!.refreshed_at,
        stale: true,
      };
    }

    throw toError(error, 'Failed to load recommendations.');
  }
}
