import { getStructuredGenres } from '@/lib/api/ai';
import { normalizeGenres } from '@/lib/utils';
import type { Book, OpenLibraryWork } from '@/types';

export interface StructuredSearchInput {
  searchQuery: string;
  title?: string;
  author?: string;
  genres?: string[];
  genre?: string;
  keywords?: string[];
  concepts?: string[];
}

export interface QuerySignals {
  rawQuery: string;
  searchQuery: string;
  tokens: string[];
  requestedGenres: string[];
  keywords: string[];
  concepts: string[];
  title?: string;
  author?: string;
}

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'book',
  'books',
  'for',
  'from',
  'i',
  'in',
  'like',
  'me',
  'of',
  'on',
  'or',
  'read',
  'similar',
  'something',
  'that',
  'the',
  'to',
  'with',
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export function buildQuerySignals(
  rawQuery: string,
  params: StructuredSearchInput
): QuerySignals {
  return {
    rawQuery,
    searchQuery: params.searchQuery || rawQuery,
    tokens: tokenize(rawQuery),
    requestedGenres: getStructuredGenres(params),
    keywords: (params.keywords ?? []).flatMap(tokenize),
    concepts: (params.concepts ?? []).flatMap(tokenize),
    title: params.title?.toLowerCase().trim(),
    author: params.author?.toLowerCase().trim(),
  };
}

function overlapScore(queryTokens: string[], fieldText: string): number {
  if (queryTokens.length === 0 || !fieldText) return 0;

  const hits = queryTokens.filter((token) => fieldText.includes(token)).length;
  return hits / queryTokens.length;
}

function dedupeTokens(tokens: string[]): string[] {
  return Array.from(new Set(tokens.filter(Boolean)));
}

export function scoreBookCandidate(
  book: Pick<Book, 'title' | 'author' | 'genre' | 'description'>,
  signals: QuerySignals
): number {
  const title = book.title.toLowerCase();
  const author = book.author.toLowerCase();
  const description = (book.description ?? '').toLowerCase();
  const genres = normalizeGenres(book.genre ?? []);
  const genreText = genres.join(' ').toLowerCase();

  const allQueryTokens = dedupeTokens([
    ...signals.tokens,
    ...signals.keywords,
    ...signals.concepts,
  ]);

  let score = 0;

  if (signals.title) {
    if (title === signals.title) {
      score += 1;
    } else if (title.includes(signals.title)) {
      score += 0.7;
    }
  }

  if (signals.author) {
    if (author.includes(signals.author)) {
      score += 0.7;
    } else {
      score -= 0.1;
    }
  }

  score += overlapScore(allQueryTokens, title) * 0.8;
  score += overlapScore(allQueryTokens, author) * 0.35;
  score += overlapScore(allQueryTokens, description) * 0.65;
  score += overlapScore(allQueryTokens, genreText) * 0.5;

  if (signals.requestedGenres.length > 0) {
    const matchedGenres = signals.requestedGenres.filter((genre) =>
      genres.includes(genre)
    );
    const genreCoverage = matchedGenres.length / signals.requestedGenres.length;
    score += genreCoverage * 0.75;
  }

  return Math.max(score, 0);
}

export function scoreOpenLibraryCandidate(
  book: OpenLibraryWork,
  signals: QuerySignals
): number {
  const title = (book.title ?? '').toLowerCase();
  const author = (book.author_name ?? []).join(' ').toLowerCase();
  const subjects = (book.subject ?? []).join(' ').toLowerCase();
  const genres = normalizeGenres(book.subject ?? []);
  const genreText = genres.join(' ').toLowerCase();

  const allQueryTokens = dedupeTokens([
    ...signals.tokens,
    ...signals.keywords,
    ...signals.concepts,
  ]);

  let score = 0;

  if (signals.title) {
    if (title === signals.title) {
      score += 1;
    } else if (title.includes(signals.title)) {
      score += 0.7;
    }
  }

  if (signals.author) {
    if (author.includes(signals.author)) {
      score += 0.7;
    } else {
      score -= 0.1;
    }
  }

  score += overlapScore(allQueryTokens, title) * 0.8;
  score += overlapScore(allQueryTokens, author) * 0.35;
  score += overlapScore(allQueryTokens, subjects) * 0.7;
  score += overlapScore(allQueryTokens, genreText) * 0.5;

  if (signals.requestedGenres.length > 0) {
    const matchedGenres = signals.requestedGenres.filter((genre) =>
      genres.includes(genre)
    );
    const genreCoverage = matchedGenres.length / signals.requestedGenres.length;
    score += genreCoverage * 0.75;
  }

  if (book.ratings_count && book.ratings_count > 0) {
    score += Math.min(0.05, book.ratings_count / 100000);
  }

  return Math.max(score, 0);
}
