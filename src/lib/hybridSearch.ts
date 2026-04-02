import { inferGenresFromQuery } from '@/lib/api/ai';
import { buildBookEmbeddingText, generateEmbedding } from '@/lib/embeddings';
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase/server';
import { normalizeGenres } from '@/lib/utils';
import type { Book } from '@/types';

export interface HybridSearchResult {
  book: Book;
  score: number;
  source: 'semantic' | 'keyword' | 'both';
}

const DEFAULT_RESULT_LIMIT = 20;
const SEARCH_FETCH_LIMIT = 40;
const FEEDBACK_MATCH_LIMIT = 100;
const FEEDBACK_SIMILARITY_THRESHOLD = 0.35;
const MIN_FEEDBACK_VOTES = 1;
const MATCH_THRESHOLD = 0.1;
const MIN_RESULT_SCORE = 0.12;
const SEMANTIC_WEIGHT = 0.6;
const KEYWORD_WEIGHT = 0.4;
const BOTH_MATCH_BOOST = 0.05;
const FEEDBACK_BOOST_WEIGHT = 0.15;
const GENRE_MATCH_WEIGHT = 0.3;
const GENRE_MISMATCH_PENALTY = 0.2;

type BookEmbeddingInput = {
  id: string;
  title: string;
  author: string;
  description?: string | null;
  genre?: string[];
};

type SemanticSearchRow = Book & {
  similarity: number;
};

type FeedbackScoreRow = {
  book_id: string;
  feedback_score: number;
  vote_count: number;
};

type RankedCandidate = {
  book: Book;
  semanticScore: number;
  keywordScore: number;
};

type SupabaseClient = ReturnType<typeof createServerSupabaseClient>;

function serializeEmbedding(embedding: number[]): string {
  return JSON.stringify(embedding);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function keywordRankScore(index: number, total: number): number {
  if (total <= 0) return 0;
  return clamp01(1 - index / total);
}

function normalizeFeedbackQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ');
}

function rankHybridResults(
  semanticResults: SemanticSearchRow[],
  keywordResults: Book[],
  feedbackMap: Map<string, number>,
  requestedGenres: string[]
): HybridSearchResult[] {
  const merged = new Map<string, RankedCandidate>();
  const keywordTotal = keywordResults.length;

  for (const row of semanticResults) {
    merged.set(row.id, {
      book: row,
      semanticScore: clamp01(row.similarity),
      keywordScore: 0,
    });
  }

  for (let index = 0; index < keywordResults.length; index += 1) {
    const book = keywordResults[index];
    const keywordScore = keywordRankScore(index, keywordTotal);
    const existing = merged.get(book.id);

    if (existing) {
      existing.book = book;
      existing.keywordScore = Math.max(existing.keywordScore, keywordScore);
      continue;
    }

    merged.set(book.id, {
      book,
      semanticScore: 0,
      keywordScore,
    });
  }

  return Array.from(merged.values())
    .map(({ book, semanticScore, keywordScore }) => {
      const matchedBoth = semanticScore > 0 && keywordScore > 0;
      const feedbackScore = feedbackMap.get(book.id) ?? 0;
      const feedbackBoost = Math.tanh(feedbackScore) * FEEDBACK_BOOST_WEIGHT;

      let genreBoost = 0;
      if (requestedGenres.length > 0) {
        const bookGenres = normalizeGenres(book.genre ?? []);
        const matchedCount = requestedGenres.filter((g) =>
          bookGenres.includes(g)
        ).length;
        if (matchedCount > 0) {
          genreBoost = (matchedCount / requestedGenres.length) * GENRE_MATCH_WEIGHT;
        } else {
          genreBoost = -GENRE_MISMATCH_PENALTY;
        }
      }

      const score = clamp01(
        semanticScore * SEMANTIC_WEIGHT +
          keywordScore * KEYWORD_WEIGHT +
          (matchedBoth ? BOTH_MATCH_BOOST : 0) +
          feedbackBoost +
          genreBoost
      );

      let source: HybridSearchResult['source'] = 'keyword';
      if (matchedBoth) {
        source = 'both';
      } else if (semanticScore > 0) {
        source = 'semantic';
      }

      return { book, score, source };
    })
    .filter((result) => result.score >= MIN_RESULT_SCORE)
    .sort((left, right) => right.score - left.score)
    .slice(0, DEFAULT_RESULT_LIMIT);
}

export async function ensureBookEmbedding(
  book: BookEmbeddingInput
): Promise<void> {
  const text = buildBookEmbeddingText(book);
  const embedding = await generateEmbedding(text);

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from('books')
    .update({ embedding: serializeEmbedding(embedding) })
    .eq('id', book.id);

  if (error) {
    console.error(
      `Failed to store embedding for book ${book.id}:`,
      error.message
    );
  }
}

export async function hybridBookSearch(
  query: string,
): Promise<HybridSearchResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const requestedGenres = inferGenresFromQuery(trimmedQuery);
  const supabase = createServerSupabaseClient();

  const [semanticResults, keywordResults, feedbackMap] = await Promise.all([
    semanticSearch(supabase, trimmedQuery),
    keywordSearch(supabase, trimmedQuery),
    fetchFeedbackMap(supabase, normalizeFeedbackQuery(trimmedQuery)),
  ]);

  return rankHybridResults(semanticResults, keywordResults, feedbackMap, requestedGenres);
}

async function semanticSearch(
  supabase: SupabaseClient,
  query: string
): Promise<SemanticSearchRow[]> {
  try {
    const queryEmbedding = await generateEmbedding(query);
    const { data, error } = await supabase.rpc('match_books_by_embedding', {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: MATCH_THRESHOLD,
      match_count: SEARCH_FETCH_LIMIT,
    });

    if (error) {
      console.error('Semantic search error:', error.message);
      return [];
    }

    return (data ?? []) as SemanticSearchRow[];
  } catch (error) {
    console.error(
      'Semantic search failed:',
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

async function keywordSearch(
  supabase: SupabaseClient,
  query: string
): Promise<Book[]> {
  try {
    const { data, error } = await supabase
      .rpc('search_books', {
        search_query: query,
      })
      .limit(SEARCH_FETCH_LIMIT);

    if (error) {
      console.error('Keyword search error:', error.message);
      return [];
    }

    return ((data ?? []) as Book[]).slice(0, SEARCH_FETCH_LIMIT);
  } catch (error) {
    console.error(
      'Keyword search failed:',
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

async function fetchFeedbackMap(
  supabase: SupabaseClient,
  query: string
): Promise<Map<string, number>> {
  if (!query) return new Map();

  try {
    const { data, error } = await supabase.rpc('match_book_search_feedback', {
      search_query: query,
      similarity_threshold: FEEDBACK_SIMILARITY_THRESHOLD,
      min_votes: MIN_FEEDBACK_VOTES,
      match_count: FEEDBACK_MATCH_LIMIT,
    });

    if (error) {
      console.error('Feedback fetch error:', error.message);
      return new Map();
    }

    const feedbackMap = new Map<string, number>();

    for (const row of (data ?? []) as FeedbackScoreRow[]) {
      if (!row.book_id || row.vote_count < MIN_FEEDBACK_VOTES) {
        continue;
      }

      feedbackMap.set(row.book_id, row.feedback_score);
    }

    return feedbackMap;
  } catch (error) {
    console.error(
      'Feedback fetch failed:',
      error instanceof Error ? error.message : error
    );
    return new Map();
  }
}
