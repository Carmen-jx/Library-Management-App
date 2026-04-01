import { NextRequest, NextResponse } from 'next/server';
import { naturalLanguageBookSearch, rankSearchResultsLocally } from '@/lib/api/ai';
import { searchOpenLibrary, getCoverUrl } from '@/lib/api/open-library';
import { hybridBookSearch } from '@/lib/hybridSearch';
import type { OpenLibraryWork } from '@/types';

function buildSearchCandidates(
  originalQuery: string,
  optimizedQuery: string,
  structuredParams: {
    title?: string;
    author?: string;
    genre?: string;
    keywords?: string[];
    concepts?: string[];
  }
): string[] {
  const titleAuthor = [structuredParams.title, structuredParams.author]
    .filter(Boolean)
    .join(' ')
    .trim();
  const keywordPhrase = (structuredParams.keywords ?? []).slice(0, 4).join(' ').trim();
  const conceptPhrase = (structuredParams.concepts ?? []).slice(0, 3).join(' ').trim();
  const candidates = [
    [optimizedQuery, structuredParams.genre].filter(Boolean).join(' ').trim(),
    [titleAuthor, structuredParams.genre].filter(Boolean).join(' ').trim(),
    [keywordPhrase, structuredParams.genre].filter(Boolean).join(' ').trim(),
    [conceptPhrase, structuredParams.genre].filter(Boolean).join(' ').trim(),
    optimizedQuery,
    titleAuthor,
    originalQuery,
  ];

  return Array.from(
    new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean))
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'A non-empty query string is required.' },
        { status: 400 }
      );
    }

    const trimmedQuery = query.trim();

    // --- Hybrid search path: try local books with embeddings first ---
    try {
      const hybridResults = await hybridBookSearch(trimmedQuery);

      if (hybridResults.length > 0) {
        return NextResponse.json({
          query: trimmedQuery,
          source: 'hybrid',
          results: hybridResults.map((result) => ({
            id: result.book.id,
            title: result.book.title,
            authors: [result.book.author],
            description: result.book.description,
            coverImage: result.book.cover_url,
            publishedDate: null,
            categories: result.book.genre ?? [],
            relevanceScore: result.score,
            relevanceReason:
              result.source === 'both'
                ? 'Matched by semantic similarity and keyword search.'
                : result.source === 'semantic'
                  ? 'Matched by semantic similarity.'
                  : 'Matched by keyword search.',
            pageCount: null,
            averageRating: null,
            ratingsCount: null,
            available: result.book.available,
            bookId: result.book.id,
          })),
          totalResults: hybridResults.length,
        });
      }
    } catch (err) {
      console.error(
        'Hybrid search failed, falling back to Open Library:',
        err instanceof Error ? err.message : err
      );
    }

    // --- Fallback: Open Library search pipeline ---

    // Step 1: Extract structured search parameters using AI
    const structuredParams = await naturalLanguageBookSearch(trimmedQuery);

    // Step 2: Search Open Library with the optimized query
    const searchCandidates = buildSearchCandidates(
      trimmedQuery,
      structuredParams.searchQuery || trimmedQuery,
      structuredParams
    );

    let openLibraryResults: OpenLibraryWork[] = [];
    let lastSearchError: Error | null = null;

    for (const candidate of searchCandidates) {
      try {
        const results = await searchOpenLibrary(candidate, 20);
        if (results.length > 0) {
          openLibraryResults = results;
          break;
        }

        if (openLibraryResults.length === 0) {
          openLibraryResults = results;
        }
      } catch (error) {
        lastSearchError =
          error instanceof Error
            ? error
            : new Error('Open Library search failed');
      }
    }

    if (openLibraryResults.length === 0) {
      return NextResponse.json({
        query: trimmedQuery,
        structuredParams,
        results: [],
        message: lastSearchError
          ? 'Book search is temporarily unavailable. Please try again in a moment.'
          : 'No books found matching your search.',
      });
    }

    // Step 3: Rank results locally (no LLM call)
    const rankedResults = rankSearchResultsLocally(
      trimmedQuery,
      openLibraryResults,
      structuredParams,
    );

    const response = {
      query: trimmedQuery,
      structuredParams,
      results: rankedResults.map((result) => {
        return {
          id: result.book.key,
          title: result.book.title,
          authors: result.book.author_name || [],
          description: null,
          coverImage: getCoverUrl(result.book.cover_i),
          publishedDate: result.book.first_publish_year || null,
          categories: result.book.subject || [],
          relevanceScore: result.score,
          relevanceReason: result.reason,
          pageCount: result.book.number_of_pages_median || null,
          averageRating: result.book.ratings_average || null,
          ratingsCount: result.book.ratings_count || null,
        };
      }),
      totalResults: rankedResults.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('AI search API error:', error);

    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';

    return NextResponse.json(
      { error: `Failed to process search: ${message}` },
      { status: 500 }
    );
  }
}
