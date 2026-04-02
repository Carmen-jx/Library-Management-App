import OpenAI from 'openai';
import { BookRecommendation, OpenLibraryWork } from '@/types';
import { GENRES, normalizeGenres } from '@/lib/utils';
import { buildQuerySignals, scoreOpenLibraryCandidate, tokenize } from '@/lib/search/ranking';

let _deepseek: OpenAI | null = null;

function getDeepSeekClient(): OpenAI {
  if (!_deepseek) {
    _deepseek = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY,
    });
  }
  return _deepseek;
}

interface RecommendationParams {
  favorites: string[];
  borrowHistory: string[];
  genres: string[];
  recentSearches?: string[];
}

interface StructuredSearchParams {
  searchQuery: string;
  title?: string;
  author?: string;
  genres?: string[];
  genre?: string;
  keywords?: string[];
  concepts?: string[];
}

interface RankedResult {
  book: OpenLibraryWork;
  score: number;
  reason: string;
}

// --- In-memory cache for parsed search queries ---
const searchCache = new Map<string, StructuredSearchParams>();

// --- Complexity detection: only call AI for non-trivial queries ---
const COMPLEX_PHRASES = [
  'something like',
  'books about',
  'recommend',
  'similar to',
  'in the style of',
  'for someone who',
  'if i liked',
  'looking for',
];

const QUERY_GENRE_PATTERNS: Partial<Record<(typeof GENRES)[number], string[]>> = {
  Fiction: ['fiction', 'literary fiction'],
  'Non-Fiction': ['non-fiction', 'nonfiction'],
  'Science Fiction': [
    'science fiction',
    'sci-fi',
    'sci fi',
    'scifi',
    'cyberpunk',
    'dystopian',
    'dystopia',
    'space opera',
  ],
  Fantasy: ['fantasy', 'dark fantasy', 'epic fantasy', 'urban fantasy', 'high fantasy'],
  Mystery: ['mystery', 'detective', 'crime fiction', 'whodunit'],
  Thriller: ['thriller', 'suspense', 'psychological thriller'],
  Romance: ['romance', 'romantasy', 'love story', 'love stories'],
  Horror: ['horror', 'gothic', 'supernatural horror'],
  Biography: ['biography', 'autobiography', 'memoir', 'memoirs'],
  History: ['history', 'historical'],
  Science: ['science', 'physics', 'biology', 'chemistry', 'astronomy'],
  Technology: ['technology', 'programming', 'computer science', 'engineering'],
  'Self-Help': ['self-help', 'self help', 'personal development'],
  Poetry: ['poetry', 'poems', 'verse'],
  Drama: ['drama', 'play', 'plays', 'theatre', 'theater'],
  Comedy: ['comedy', 'humor', 'humour', 'satire'],
  Adventure: ['adventure', 'action adventure'],
  Children: ['children', "children's", 'middle grade', 'picture book', 'juvenile'],
  'Young Adult': ['young adult', 'ya', 'teen'],
  'Graphic Novel': ['graphic novel', 'graphic novels', 'comics', 'manga'],
};

function isComplexQuery(query: string): boolean {
  const words = query.trim().split(/\s+/);
  if (words.length > 4) return true;
  const lower = query.toLowerCase();
  return COMPLEX_PHRASES.some((phrase) => lower.includes(phrase));
}

export function inferGenresFromQuery(query: string): string[] {
  const lowered = query.toLowerCase();
  const matches = new Set<string>();

  for (const genre of GENRES) {
    const patterns = QUERY_GENRE_PATTERNS[genre] ?? [genre.toLowerCase()];
    if (patterns.some((pattern) => lowered.includes(pattern))) {
      matches.add(genre);
    }
  }

  return Array.from(matches);
}

export function getStructuredGenres(
  params?: Pick<StructuredSearchParams, 'genres' | 'genre'>
): string[] {
  if (!params) return [];

  const rawGenres = [
    ...(params.genres ?? []),
    ...(params.genre ? [params.genre] : []),
  ].filter(Boolean);

  if (rawGenres.length === 0) return [];

  const normalized = normalizeGenres(rawGenres);
  const rawLower = rawGenres.join(' ').toLowerCase();

  if (
    normalized.length === 1 &&
    normalized[0] === 'Fiction' &&
    !rawLower.includes('fiction')
  ) {
    return [];
  }

  return normalized;
}

// --- Timeout helper: races a promise against a deadline ---
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// --- Lightweight local ranking (replaces LLM-based rankSearchResults) ---
export function rankSearchResultsLocally(
  query: string,
  books: OpenLibraryWork[],
  params?: StructuredSearchParams,
): RankedResult[] {
  if (books.length === 0) return [];

  const signals = buildQuerySignals(query, {
    searchQuery: params?.searchQuery || query,
    title: params?.title,
    author: params?.author,
    genres: params?.genres,
    genre: params?.genre,
    keywords: params?.keywords,
    concepts: params?.concepts,
  });

  return books
    .map((book) => {
      let score = scoreOpenLibraryCandidate(book, signals);

      // Small boost for books with ratings (popularity proxy)
      if (book.ratings_count && book.ratings_count > 0) {
        score += Math.min(0.05, book.ratings_count / 100000);
      }

      if (book.first_publish_year) {
        const age = Math.abs(new Date().getFullYear() - book.first_publish_year);
        if (age < 20) {
          score += 0.03;
        }
      }

      const reason = score > 0.9
        ? 'Strong match on query intent and subject.'
        : score > 0.55
          ? 'Good match across semantic and textual signals.'
          : 'Broader match included for variety.';

      return { book, score: Math.min(score, 1), reason };
    })
    .sort((a, b) => b.score - a.score);
}

// --- Book recommendations (token-reduced) ---
export async function getBookRecommendations(
  params: RecommendationParams
): Promise<BookRecommendation[]> {
  const { favorites, borrowHistory, genres, recentSearches } = params;

  const profileSections: string[] = [];

  if (favorites.length > 0) {
    profileSections.push(`Favorites: ${favorites.join(', ')}`);
  }
  if (borrowHistory.length > 0) {
    profileSections.push(`Borrowed: ${borrowHistory.join(', ')}`);
  }
  if (genres.length > 0) {
    profileSections.push(`Genres: ${genres.join(', ')}`);
  }
  if (recentSearches && recentSearches.length > 0) {
    profileSections.push(`Searches: ${recentSearches.join(', ')}`);
  }

  const prompt = `Recommend 5-10 books for this reader. Exclude books already listed.

${profileSections.join('\n')}

Respond with JSON only: {"recommendations":[{"title":"...","author":"...","reason":"...","genre":"..."}]}`;

  const response = await getDeepSeekClient().chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: 'Book recommendation expert. Respond with valid JSON only.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.8,
    max_tokens: 500,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response content from DeepSeek');
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse JSON from DeepSeek response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const recommendations: BookRecommendation[] = (
    parsed.recommendations || []
  ).map((rec: { title: string; author: string; reason: string; genre: string }) => ({
    title: rec.title,
    author: rec.author,
    reason: rec.reason,
    genre: rec.genre,
  }));

  return recommendations;
}

// --- Natural language search with caching, complexity check, timeout & fallback ---
export async function naturalLanguageBookSearch(
  query: string
): Promise<StructuredSearchParams> {
  // Return cached result immediately if available
  const cached = searchCache.get(query);
  if (cached) return cached;

  // Simple queries skip AI entirely
  if (!isComplexQuery(query)) {
    const inferredGenres = inferGenresFromQuery(query);
    const result: StructuredSearchParams = {
      searchQuery: query,
      genres: inferredGenres.length > 0 ? inferredGenres : undefined,
      genre: inferredGenres[0],
      keywords: tokenize(query).slice(0, 6),
    };
    searchCache.set(query, result);
    return result;
  }

  // Complex query: call DeepSeek with timeout + fallback
  try {
    const prompt = `Extract book search parameters from this request: "${query}".

Respond with JSON only in this shape:
{
  "searchQuery": "concise search query",
  "title": "specific title if clearly requested",
  "author": "specific author if clearly requested",
  "genres": ["one or more matching genres if explicit"],
  "keywords": ["important concrete terms"],
  "concepts": ["themes or abstract ideas"]
}

Rules:
- Preserve explicit titles and author names when present.
- Keep searchQuery short and optimized for finding relevant books.
- Return multiple genres when the request clearly names multiple genres.
- Do not invent values that are not supported by the query.

Examples:
- "something like Harry Potter but darker" -> {"searchQuery":"dark fantasy magic boarding school","title":"Harry Potter","genres":["Fantasy"],"keywords":["dark","magic","boarding school"],"concepts":["coming of age"]}
- "books by Octavia Butler" -> {"searchQuery":"Octavia Butler","author":"Octavia Butler","genres":["Science Fiction"],"keywords":["Octavia Butler"]}
- "a dark fantasy romance book with strong female lead" -> {"searchQuery":"dark fantasy romance strong female lead","genres":["Fantasy","Romance"],"keywords":["dark","strong female lead"],"concepts":["romance"]}`;

    const response = await withTimeout(
      getDeepSeekClient().chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'Extract book search params. JSON only.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
      1500, // abort after 1.5 seconds
    );

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response');

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid JSON');

    const parsed = JSON.parse(jsonMatch[0]);
    const parsedGenres = getStructuredGenres({
      genres: Array.isArray(parsed.genres)
        ? parsed.genres.filter((value: unknown): value is string => typeof value === 'string')
        : undefined,
      genre: typeof parsed.genre === 'string' ? parsed.genre : undefined,
    });

    const result: StructuredSearchParams = {
      searchQuery: parsed.searchQuery || query,
      title: parsed.title,
      author: parsed.author,
      genres: parsedGenres.length > 0 ? parsedGenres : undefined,
      genre: parsedGenres[0],
      keywords: Array.isArray(parsed.keywords)
        ? parsed.keywords.filter((value: unknown): value is string => typeof value === 'string')
        : undefined,
      concepts: Array.isArray(parsed.concepts)
        ? parsed.concepts.filter((value: unknown): value is string => typeof value === 'string')
        : undefined,
    };

    searchCache.set(query, result);
    return result;
  } catch {
    // Fallback: use raw query on any failure (timeout, network, parse error)
    const inferredGenres = inferGenresFromQuery(query);
    const fallback: StructuredSearchParams = {
      searchQuery: query,
      genres: inferredGenres.length > 0 ? inferredGenres : undefined,
      genre: inferredGenres[0],
      keywords: tokenize(query).slice(0, 6),
    };
    searchCache.set(query, fallback);
    return fallback;
  }
}
