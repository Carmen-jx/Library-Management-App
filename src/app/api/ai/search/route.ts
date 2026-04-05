import { NextRequest, NextResponse } from 'next/server';
import { inferGenresFromQuery } from '@/lib/api/ai';
import { hybridBookSearch, fetchFeedbackMap, normalizeFeedbackQuery } from '@/lib/hybridSearch';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { scoreBookCandidate, buildQuerySignals } from '@/lib/search/ranking';
import type { Book } from '@/types';

const MIN_HYBRID_THRESHOLD = 6;
const FEEDBACK_BOOST_WEIGHT = 0.15;

function formatBookResult(book: Book, score: number, reason: string) {
  return {
    id: book.id,
    title: book.title,
    authors: [book.author],
    description: book.description,
    coverImage: book.cover_url,
    publishedDate: null,
    categories: book.genre ?? [],
    relevanceScore: score,
    relevanceReason: reason,
    pageCount: null,
    averageRating: null,
    ratingsCount: null,
    available: book.available,
    bookId: book.id,
  };
}

interface ScoredFallbackResult {
  book: Book;
  score: number;
}

async function genreFallback(
  query: string,
  genres: string[],
): Promise<ScoredFallbackResult[]> {
  const supabase = createServerSupabaseClient();

  const genreQueries = genres.slice(0, 3).map((genre) =>
    supabase.from('books').select('*').contains('genre', [genre]).limit(12),
  );

  const keywordQuery = supabase
    .rpc('search_books', { search_query: query })
    .limit(20);

  const [genreResults, keywordResult] = await Promise.all([
    Promise.all(genreQueries),
    keywordQuery,
  ]);

  const seen = new Set<string>();
  const candidates: Book[] = [];

  for (const { data } of genreResults) {
    for (const book of (data ?? []) as Book[]) {
      if (!seen.has(book.id)) {
        seen.add(book.id);
        candidates.push(book);
      }
    }
  }

  if (!keywordResult.error) {
    for (const book of (keywordResult.data ?? []) as Book[]) {
      if (!seen.has(book.id)) {
        seen.add(book.id);
        candidates.push(book);
      }
    }
  }

  const signals = buildQuerySignals(query, { searchQuery: query, genres });

  return candidates
    .map((book) => ({ book, score: scoreBookCandidate(book, signals) }))
    .filter(({ score }) => score >= 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

function hybridSourceReason(source: 'both' | 'semantic' | 'keyword'): string {
  if (source === 'both') return 'Matched by semantic similarity and keyword search.';
  if (source === 'semantic') return 'Matched by semantic similarity.';
  return 'Matched by keyword search.';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'A non-empty query string is required.' },
        { status: 400 },
      );
    }

    const trimmedQuery = query.trim();
    const requestedGenres = inferGenresFromQuery(trimmedQuery);

    // Primary: hybrid search (embedding + keyword + genre + feedback)
    let hybridResults: Awaited<ReturnType<typeof hybridBookSearch>> = [];
    try {
      hybridResults = await hybridBookSearch(trimmedQuery);
    } catch (err) {
      console.error(
        'Hybrid search failed:',
        err instanceof Error ? err.message : err,
      );
    }

    // If hybrid returned enough results, return them directly
    if (hybridResults.length >= MIN_HYBRID_THRESHOLD) {
      return NextResponse.json({
        query: trimmedQuery,
        source: 'hybrid',
        results: hybridResults.map((r) =>
          formatBookResult(r.book, r.score, hybridSourceReason(r.source)),
        ),
        totalResults: hybridResults.length,
      });
    }

    // Supplement sparse hybrid results with genre fallback + feedback scoring
    const supabase = createServerSupabaseClient();
    const [fallbackResults, feedbackMap] = await Promise.all([
      genreFallback(trimmedQuery, requestedGenres),
      fetchFeedbackMap(supabase, normalizeFeedbackQuery(trimmedQuery)),
    ]);

    // Merge: hybrid results first, then fallback (deduped)
    const seenIds = new Set<string>();
    const merged: ReturnType<typeof formatBookResult>[] = [];

    for (const r of hybridResults) {
      seenIds.add(r.book.id);
      merged.push(formatBookResult(r.book, r.score, hybridSourceReason(r.source)));
    }

    for (const { book, score: rawScore } of fallbackResults) {
      if (seenIds.has(book.id)) continue;
      seenIds.add(book.id);

      // Normalize candidate score to 0-1 range and apply feedback boost
      const feedbackScore = feedbackMap.get(book.id) ?? 0;
      const feedbackBoost = Math.tanh(feedbackScore) * FEEDBACK_BOOST_WEIGHT;
      const normalizedScore = Math.max(0, Math.min(1, rawScore / 2 + feedbackBoost));

      merged.push(formatBookResult(book, normalizedScore, 'Matched from library.'));
    }

    // Sort by score descending and limit
    merged.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const finalResults = merged.slice(0, 20);

    if (finalResults.length > 0) {
      return NextResponse.json({
        query: trimmedQuery,
        source: hybridResults.length > 0 ? 'hybrid_supplemented' : 'local_fallback',
        results: finalResults,
        totalResults: finalResults.length,
      });
    }

    return NextResponse.json({
      query: trimmedQuery,
      results: [],
      message: 'No books found matching your search.',
    });
  } catch (error) {
    console.error('AI search API error:', error);

    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';

    return NextResponse.json(
      { error: `Failed to process search: ${message}` },
      { status: 500 },
    );
  }
}
