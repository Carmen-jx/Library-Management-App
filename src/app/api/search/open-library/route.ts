import { NextRequest, NextResponse } from 'next/server';
import { searchOpenLibrary, getCoverUrl } from '@/lib/api/open-library';
import { normalizeGenres } from '@/lib/utils';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get('q');
  const limit = Math.min(Number(searchParams.get('limit') ?? 10), 20);

  if (!query || query.trim().length === 0) {
    return NextResponse.json(
      { error: 'A non-empty query parameter "q" is required.' },
      { status: 400 },
    );
  }

  try {
    const works = await searchOpenLibrary(query.trim(), limit);

    const results = works.map((work) => ({
      id: work.key,
      title: work.title,
      authors: work.author_name ?? [],
      description: null,
      coverImage: getCoverUrl(work.cover_i, 'M'),
      categories: normalizeGenres(work.subject ?? []).slice(0, 5),
      relevanceScore: 0.5,
      relevanceReason: 'Found on Open Library',
      pageCount: work.number_of_pages_median ?? null,
      averageRating: work.ratings_average ?? null,
      source: 'open-library' as const,
      openLibraryKey: work.key,
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error(
      'Open Library search failed:',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ results: [] });
  }
}
