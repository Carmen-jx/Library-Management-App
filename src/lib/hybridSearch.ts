import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { naturalLanguageBookSearch } from '@/lib/api/ai';
import {
  generateEmbedding,
  generateEmbeddingsBatch,
  buildBookEmbeddingText,
} from '@/lib/embeddings';
import type { Book } from '@/types';

export interface HybridSearchResult {
  book: Book;
  score: number;
  source: 'semantic' | 'keyword' | 'both';
}

// ---------------------------------------------------------------------------
// Cosine similarity between two vectors
// ---------------------------------------------------------------------------

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// On-demand embedding backfill: generate, persist, and score
// ---------------------------------------------------------------------------

const BACKFILL_BATCH_LIMIT = 20;

async function backfillAndScore(
  books: Book[],
  queryEmbedding: number[]
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  if (books.length === 0) return scores;

  const batch = books.slice(0, BACKFILL_BATCH_LIMIT);
  const texts = batch.map((book) => buildBookEmbeddingText(book));
  const embeddings = await generateEmbeddingsBatch(texts);

  // Persist embeddings via admin client (bypasses RLS)
  const adminClient = createAdminClient();
  await Promise.allSettled(
    batch.map((book, i) =>
      adminClient
        .from('books')
        .update({ embedding: JSON.stringify(embeddings[i]) })
        .eq('id', book.id)
    )
  );

  // Compute cosine similarity locally for the current search
  for (let i = 0; i < batch.length; i++) {
    scores.set(batch[i].id, cosineSimilarity(queryEmbedding, embeddings[i]));
  }

  return scores;
}

// ---------------------------------------------------------------------------
// Ensure a single book has an embedding (call after insert)
// ---------------------------------------------------------------------------

export async function ensureBookEmbedding(book: {
  id: string;
  title: string;
  author: string;
  description?: string | null;
  genre?: string[];
}): Promise<void> {
  const text = buildBookEmbeddingText(book);
  const embedding = await generateEmbedding(text);

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from('books')
    .update({ embedding: JSON.stringify(embedding) })
    .eq('id', book.id);

  if (error) {
    console.error(
      `Failed to store embedding for book ${book.id}:`,
      error.message
    );
  }
}

// ---------------------------------------------------------------------------
// Hybrid search: semantic (embedding) + keyword (full-text) + genre
// ---------------------------------------------------------------------------

export async function hybridBookSearch(
  query: string
): Promise<HybridSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // 1. Parse structured params + generate query embedding in parallel
  const [structuredParams, queryEmbedding] = await Promise.all([
    naturalLanguageBookSearch(trimmed),
    generateEmbedding(trimmed),
  ]);

  // 2. Run semantic search + keyword search in parallel
  const [semanticResults, keywordResults] = await Promise.all([
    semanticSearch(queryEmbedding),
    keywordSearch(structuredParams.searchQuery || trimmed),
  ]);

  // 3. Detect keyword-hit books missing from semantic results and backfill
  const semanticIds = new Set(semanticResults.map((r) => r.id));
  const missingFromSemantic = keywordResults.filter(
    (b) => !semanticIds.has(b.id)
  );

  let backfillScores = new Map<string, number>();

  if (missingFromSemantic.length > 0) {
    try {
      // Check which of these actually lack embeddings in the DB
      const supabase = createServerSupabaseClient();
      const { data: withEmbedding } = await supabase
        .from('books')
        .select('id')
        .in(
          'id',
          missingFromSemantic.map((b) => b.id)
        )
        .not('embedding', 'is', null);

      const hasEmbeddingIds = new Set(
        (withEmbedding ?? []).map((row: { id: string }) => row.id)
      );
      const needsBackfill = missingFromSemantic.filter(
        (b) => !hasEmbeddingIds.has(b.id)
      );

      if (needsBackfill.length > 0) {
        backfillScores = await backfillAndScore(needsBackfill, queryEmbedding);
      }
    } catch (err) {
      console.error(
        'Embedding backfill failed:',
        err instanceof Error ? err.message : err
      );
    }
  }

  // 4. Combine and score
  const scoreMap = new Map<
    string,
    { book: Book; semantic: number; keyword: number; genre: number }
  >();

  // Semantic results from pgvector
  for (const result of semanticResults) {
    scoreMap.set(result.id, {
      book: result.book,
      semantic: result.similarity,
      keyword: 0,
      genre: 0,
    });
  }

  // Keyword results
  const kwTotal = keywordResults.length || 1;
  for (let i = 0; i < keywordResults.length; i++) {
    const book = keywordResults[i];
    const kwScore = 1 - i / kwTotal;
    const existing = scoreMap.get(book.id);
    if (existing) {
      existing.keyword = kwScore;
      existing.book = book; // prefer full book data
    } else {
      // Book wasn't in semantic results — use backfill similarity if available
      scoreMap.set(book.id, {
        book,
        semantic: backfillScores.get(book.id) ?? 0,
        keyword: kwScore,
        genre: 0,
      });
    }
  }

  // Genre boost from structured params
  const inferredGenre = structuredParams.genre?.toLowerCase();
  if (inferredGenre) {
    Array.from(scoreMap.values()).forEach((entry) => {
      const bookGenres = (entry.book.genre ?? []).map((g: string) =>
        g.toLowerCase()
      );
      if (bookGenres.some((g: string) => g.includes(inferredGenre))) {
        entry.genre = 1;
      }
    });
  }

  // 5. Combined score: semantic 0.6 + keyword 0.3 + genre 0.1
  const results: HybridSearchResult[] = [];

  for (const entry of Array.from(scoreMap.values())) {
    const score =
      entry.semantic * 0.6 + entry.keyword * 0.3 + entry.genre * 0.1;

    let source: HybridSearchResult['source'] = 'keyword';
    if (entry.semantic > 0 && entry.keyword > 0) {
      source = 'both';
    } else if (entry.semantic > 0) {
      source = 'semantic';
    }

    results.push({ book: entry.book, score, source });
  }

  // 6. Sort by score descending and return top 20
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 20);
}

// ---------------------------------------------------------------------------
// Semantic search via pgvector RPC
// ---------------------------------------------------------------------------

interface SemanticResult {
  id: string;
  book: Book;
  similarity: number;
}

async function semanticSearch(
  queryEmbedding: number[]
): Promise<SemanticResult[]> {
  try {
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('match_books_by_embedding', {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: 0.1,
      match_count: 20,
    });

    if (error) {
      console.error('Semantic search error:', error.message);
      return [];
    }

    return (data ?? []).map(
      (row: Book & { similarity: number }) => ({
        id: row.id,
        book: {
          id: row.id,
          title: row.title,
          author: row.author,
          genre: row.genre,
          description: row.description,
          cover_url: row.cover_url,
          metadata: row.metadata,
          available: row.available,
          open_library_key: row.open_library_key,
          created_at: row.created_at,
        } as Book,
        similarity: row.similarity as number,
      })
    );
  } catch (err) {
    console.error(
      'Semantic search failed:',
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Keyword search via existing full-text search RPC
// ---------------------------------------------------------------------------

async function keywordSearch(query: string): Promise<Book[]> {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.rpc('search_books', {
      search_query: query,
    });
    if (error) {
      console.error('Keyword search error:', error.message);
      return [];
    }
    return (data ?? []) as Book[];
  } catch (err) {
    console.error(
      'Keyword search failed:',
      err instanceof Error ? err.message : err
    );
    return [];
  }
}
