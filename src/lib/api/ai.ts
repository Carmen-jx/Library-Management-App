import OpenAI from 'openai';
import { BookRecommendation, OpenLibraryWork } from '@/types';

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

function isComplexQuery(query: string): boolean {
  const words = query.trim().split(/\s+/);
  if (words.length > 4) return true;
  const lower = query.toLowerCase();
  return COMPLEX_PHRASES.some((phrase) => lower.includes(phrase));
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
  const queryTokens = queryLower.split(/\s+/).filter(Boolean);
  const genre = params?.genre?.toLowerCase();
  const keywords = (params?.keywords ?? []).map((k) => k.toLowerCase());

  return books
    .map((book) => {
      let score = 0;
      const titleLower = (book.title ?? '').toLowerCase();
      const subjects = (book.subject ?? []).map((s) => s.toLowerCase());

      // Title: exact containment is the strongest signal
      if (titleLower === queryLower) {
        score += 1.0;
      } else if (titleLower.includes(queryLower)) {
        score += 0.7;
      } else {
        // Partial token overlap in title
        const hits = queryTokens.filter((t) => titleLower.includes(t)).length;
        score += (hits / queryTokens.length) * 0.5;
      }

      // Genre / subject match
      if (genre && subjects.some((s) => s.includes(genre))) {
        score += 0.3;
      }

      // Keyword match against subjects
      if (keywords.length > 0) {
        const kwHits = keywords.filter((kw) =>
          subjects.some((s) => s.includes(kw)),
        ).length;
        score += (kwHits / keywords.length) * 0.2;
      }

      // Small boost for books with ratings (popularity proxy)
      if (book.ratings_count && book.ratings_count > 0) {
        score += Math.min(0.05, book.ratings_count / 100000);
      }

      const reason = score > 0.5
        ? 'Strong match based on title and subject relevance.'
        : score > 0.2
          ? 'Partial match on keywords or genre.'
          : 'Weak match; included for breadth.';

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
    const result: StructuredSearchParams = { searchQuery: query };
    searchCache.set(query, result);
    return result;
  }

  // Complex query: call DeepSeek with timeout + fallback
  try {
    const prompt = `Extract search params from: "${query}"
Respond JSON only: {"searchQuery":"...","genre":"...","keywords":["..."]}`;

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
      genre: parsed.genre,
      keywords: parsed.keywords,
      concepts: parsed.concepts,
    };

    searchCache.set(query, result);
    return result;
  } catch {
    // Fallback: use raw query on any failure (timeout, network, parse error)
    const fallback: StructuredSearchParams = { searchQuery: query };
    searchCache.set(query, fallback);
    return fallback;
  }
}
