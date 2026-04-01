import type { OpenLibraryWork, OpenLibrarySearchResponse, Book } from '@/types';
import { normalizeGenres } from '@/lib/utils';

const BASE_URL = 'https://openlibrary.org';
const COVERS_URL = 'https://covers.openlibrary.org';
const MAX_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry<T>(
  url: string,
  label: string,
  retries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
      });

      if (response.ok) {
        return await response.json();
      }

      const retriable = response.status === 429 || response.status >= 500;
      const error = new Error(
        `${label} error: HTTP ${response.status} ${response.statusText}`
      );

      if (!retriable || attempt === retries) {
        throw error;
      }

      lastError = error;
      await sleep(400 * attempt);
    } catch (error) {
      const normalizedError =
        error instanceof Error
          ? error
          : new Error(`${label} error: request failed`);

      if (attempt === retries) {
        throw normalizedError;
      }

      lastError = normalizedError;
      await sleep(400 * attempt);
    }
  }

  throw lastError ?? new Error(`${label} error: request failed`);
}

export function getCoverUrl(coverId: number | undefined, size: 'S' | 'M' | 'L' = 'M'): string | null {
  if (!coverId) return null;
  return `${COVERS_URL}/b/id/${coverId}-${size}.jpg`;
}

export async function searchOpenLibrary(query: string, limit = 10): Promise<OpenLibraryWork[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const url = `${BASE_URL}/search.json?q=${encodeURIComponent(trimmedQuery)}&limit=${limit}`;
  const data = await fetchJsonWithRetry<OpenLibrarySearchResponse>(
    url,
    'Open Library search'
  );
  return data.docs ?? [];
}

export async function getOpenLibraryWork(key: string): Promise<OpenLibraryWork> {
  // key format: "/works/OL45804W" or just "OL45804W"
  const workKey = key.startsWith('/works/') ? key : `/works/${key}`;
  const url = `${BASE_URL}${workKey}.json`;
  return await fetchJsonWithRetry<OpenLibraryWork>(url, 'Open Library work');
}

export function openLibraryWorkToBook(work: OpenLibraryWork): Partial<Book> & { open_library_key: string } {
  return {
    open_library_key: work.key,
    title: work.title,
    author: work.author_name?.join(', ') ?? 'Unknown Author',
    genre: normalizeGenres(work.subject),
    description: null, // Open Library search results don't include descriptions inline
    cover_url: getCoverUrl(work.cover_i, 'M'),
    metadata: {
      first_publish_year: work.first_publish_year,
      number_of_pages: work.number_of_pages_median,
      isbn: work.isbn?.[0],
      publisher: work.publisher?.[0],
      language: work.language,
      ratings_average: work.ratings_average,
      ratings_count: work.ratings_count,
      edition_key: work.edition_key?.[0],
    } as Record<string, unknown>,
  };
}
