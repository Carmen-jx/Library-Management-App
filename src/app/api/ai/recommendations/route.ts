import { NextRequest, NextResponse } from 'next/server';
import { getBookRecommendations } from '@/lib/api/ai';
import { searchOpenLibrary, getCoverUrl } from '@/lib/api/open-library';
import type { BookRecommendation } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { favorites, borrowHistory, genres, previousRecommendations } = body;

    if (!Array.isArray(favorites) || !Array.isArray(borrowHistory) || !Array.isArray(genres)) {
      return NextResponse.json(
        { error: 'Invalid request body. Expected favorites, borrowHistory, and genres arrays.' },
        { status: 400 }
      );
    }

    const recommendations = await getBookRecommendations({
      favorites,
      borrowHistory,
      genres,
      previousRecommendations: Array.isArray(previousRecommendations) ? previousRecommendations : [],
    });

    const enrichedRecommendations = await Promise.allSettled(
      recommendations.map(async (rec) => {
        try {
          const query = `${rec.title} ${rec.author}`;
          const works = await searchOpenLibrary(query, 1);

          if (works.length > 0) {
            const coverUrl = getCoverUrl(works[0].cover_i);

            return {
              ...rec,
              cover_url: coverUrl || undefined,
              open_library_key: works[0].key,
            } satisfies BookRecommendation;
          }
        } catch (error) {
          console.warn(`Failed to fetch cover image for "${rec.title}":`, error);
        }
        return rec satisfies BookRecommendation;
      })
    );

    const results = enrichedRecommendations
      .map((result) => (result.status === 'fulfilled' ? result.value : null))
      .filter((result): result is BookRecommendation => Boolean(result));

    return NextResponse.json({ recommendations: results });
  } catch (error) {
    console.error('Recommendations API error:', error);

    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';

    return NextResponse.json(
      { error: `Failed to generate recommendations: ${message}` },
      { status: 500 }
    );
  }
}
