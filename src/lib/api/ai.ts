import OpenAI from 'openai';
import { BookRecommendation, OpenLibraryWork } from '@/types';
import { GENRES, normalizeGenres } from '@/lib/utils';

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

function isComplexQuery(query: string): boolean {
  const words = query.trim().split(/\s+/);
  if (words.length > 4) return true;
  const lower = query.toLowerCase();
  return COMPLEX_PHRASES.some((phrase) => lower.includes(phrase));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function inferGenreFromQuery(query: string): string | undefined {
  const lowered = query.toLowerCase();
  const exactGenre = GENRES.find((genre) =>
    lowered.includes(genre.toLowerCase())
  );

  if (exactGenre) {
    return exactGenre;
  }

  const normalized = normalizeGenres(query);
  return normalized[0] === 'Fiction' && !lowered.includes('fiction')
    ? undefined
    : normalized[0];
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

  const queryLower = query.toLowerCase();
  const queryTokens = tokenize(queryLower);
  const requestedTitle = params?.title?.toLowerCase().trim();
  const requestedAuthor = params?.author?.toLowerCase().trim();
  const genre = params?.genre?.toLowerCase().trim();
  const keywords = (params?.keywords ?? []).flatMap(tokenize);
  const concepts = (params?.concepts ?? []).flatMap(tokenize);

  return books
    .map((book) => {
      let score = 0;
      const titleLower = (book.title ?? '').toLowerCase();
      const authorLower = (book.author_name ?? []).join(' ').toLowerCase();
      const subjects = (book.subject ?? []).map((s) => s.toLowerCase());
      const combinedText = `${titleLower} ${authorLower} ${subjects.join(' ')}`;

      if (requestedTitle && titleLower === requestedTitle) {
        score += 1.15;
      } else if (requestedTitle && titleLower.includes(requestedTitle)) {
        score += 0.9;
      } else if (titleLower === queryLower) {
        score += 1.0;
      } else if (titleLower.includes(queryLower)) {
        score += 0.7;
      }

      if (requestedAuthor) {
        if (authorLower.includes(requestedAuthor)) {
          score += 0.8;
        } else {
          score -= 0.2;
        }
      }

      if (queryTokens.length > 0) {
        const titleHits = queryTokens.filter((token) =>
          titleLower.includes(token)
        ).length;
        const authorHits = queryTokens.filter((token) =>
          authorLower.includes(token)
        ).length;
        const subjectHits = queryTokens.filter((token) =>
          subjects.some((subject) => subject.includes(token))
        ).length;

        score += (titleHits / queryTokens.length) * 0.45;
        score += (authorHits / queryTokens.length) * 0.3;
        score += (subjectHits / queryTokens.length) * 0.2;
      }

      // Genre / subject match
      if (genre) {
        if (subjects.some((s) => s.includes(genre))) {
          score += 0.45;
        } else {
          score -= 0.15;
        }
      }

      // Keyword and concept matches against the full searchable text
      if (keywords.length > 0) {
        const kwHits = keywords.filter((kw) =>
          combinedText.includes(kw),
        ).length;
        score += (kwHits / keywords.length) * 0.35;
      }

      if (concepts.length > 0) {
        const conceptHits = concepts.filter((concept) =>
          combinedText.includes(concept),
        ).length;
        score += (conceptHits / concepts.length) * 0.2;
      }

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
        ? 'Strong match on title, author, and subject.'
        : score > 0.55
          ? 'Good match on several search signals.'
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
    const result: StructuredSearchParams = {
      searchQuery: query,
      genre: inferGenreFromQuery(query),
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
  "genre": "best matching genre if implied",
  "keywords": ["important concrete terms"],
  "concepts": ["themes or abstract ideas"]
}

Rules:
- Preserve explicit titles and author names when present.
- Keep searchQuery short and optimized for finding relevant books.
- Prefer a single best matching genre from common library genres.
- Do not invent values that are not supported by the query.

Examples:
- "something like Harry Potter but darker" -> {"searchQuery":"dark fantasy magic boarding school","title":"Harry Potter","genre":"Fantasy","keywords":["dark","magic","boarding school"],"concepts":["coming of age"]}
- "books by Octavia Butler" -> {"searchQuery":"Octavia Butler","author":"Octavia Butler","genre":"Science Fiction","keywords":["Octavia Butler"]}
- "a sad literary novel about grief" -> {"searchQuery":"literary grief novel","genre":"Fiction","keywords":["literary","grief","novel"],"concepts":["loss","mourning"]}`;

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

    const result: StructuredSearchParams = {
      searchQuery: parsed.searchQuery || query,
      title: parsed.title,
      author: parsed.author,
      genre: parsed.genre,
      keywords: parsed.keywords,
      concepts: parsed.concepts,
    };

    searchCache.set(query, result);
    return result;
  } catch {
    // Fallback: use raw query on any failure (timeout, network, parse error)
    const fallback: StructuredSearchParams = {
      searchQuery: query,
      genre: inferGenreFromQuery(query),
      keywords: tokenize(query).slice(0, 6),
    };
    searchCache.set(query, fallback);
    return fallback;
  }
}
