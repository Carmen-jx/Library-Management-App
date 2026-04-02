import { NextRequest, NextResponse } from 'next/server';
import { inferGenresFromQuery } from '@/lib/api/ai';
import { hybridBookSearch } from '@/lib/hybridSearch';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { scoreBookCandidate, buildQuerySignals } from '@/lib/search/ranking';
import type { Book } from '@/types';

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

async function genreFallback(
  query: string,
  genres: string[],
): Promise<Book[]> {
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
    .slice(0, 12)
    .map(({ book }) => book);
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

    // Primary: hybrid search (embedding + keyword + genre + feedback)
    try {
      const hybridResults = await hybridBookSearch(trimmedQuery);

      if (hybridResults.length > 0) {
        return NextResponse.json({
          query: trimmedQuery,
          source: 'hybrid',
          results: hybridResults.map((r) => {
            const reason =
              r.source === 'both'
                ? 'Matched by semantic similarity and keyword search.'
                : r.source === 'semantic'
                  ? 'Matched by semantic similarity.'
                  : 'Matched by keyword search.';
            return formatBookResult(r.book, r.score, reason);
          }),
          totalResults: hybridResults.length,
        });
      }
    } catch (err) {
      console.error(
        'Hybrid search failed:',
        err instanceof Error ? err.message : err,
      );
    }

    // Fallback: genre + keyword search against local library
    const requestedGenres = inferGenresFromQuery(trimmedQuery);
    const fallbackResults = await genreFallback(trimmedQuery, requestedGenres);

    if (fallbackResults.length > 0) {
      return NextResponse.json({
        query: trimmedQuery,
        source: 'local_fallback',
        results: fallbackResults.map((book) =>
          formatBookResult(book, 0.25, 'Closest match from your library.'),
        ),
        totalResults: fallbackResults.length,
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
