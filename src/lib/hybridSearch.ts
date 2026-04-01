import { createServerSupabaseClient } from '@/lib/supabase/server';
import { naturalLanguageBookSearch } from '@/lib/api/ai';
import { generateEmbedding } from '@/lib/embeddings';
import type { Book } from '@/types';

export interface HybridSearchResult {
  book: Book;
  score: number;
  source: 'semantic' | 'keyword' | 'both';
}

// ---------------------------------------------------------------------------
// Hybrid search: combines semantic (embedding) + keyword (full-text) + genre
// ---------------------------------------------------------------------------

export async function hybridBookSearch(
  query: string
): Promise<HybridSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // 1. Parse query with DeepSeek for structured params
  const structuredParams = await naturalLanguageBookSearch(trimmed);

  // 2. Run semantic search + keyword search in parallel
  const [semanticResults, keywordResults] = await Promise.all([
    semanticSearch(trimmed),
    keywordSearch(structuredParams.searchQuery || trimmed),
  ]);

  // 3. Combine and score
  const scoreMap = new Map<
    string,
    { book: Book; semantic: number; keyword: number; genre: number }
  >();

  // Semantic results: normalize similarity to 0–1
  for (const result of semanticResults) {
    scoreMap.set(result.id, {
      book: result.book,
      semantic: result.similarity,
      keyword: 0,
      genre: 0,
    });
  }

  // Keyword results: score based on position (first = highest)
  const kwTotal = keywordResults.length || 1;
  for (let i = 0; i < keywordResults.length; i++) {
    const book = keywordResults[i];
    const kwScore = 1 - i / kwTotal;
    const existing = scoreMap.get(book.id);
    if (existing) {
      existing.keyword = kwScore;
      existing.book = book; // prefer full book data
    } else {
      scoreMap.set(book.id, {
        book,
        semantic: 0,
        keyword: kwScore,
        genre: 0,
      });
    }
  }

  // Genre boost from structured params
  const inferredGenre = structuredParams.genre?.toLowerCase();
  if (inferredGenre) {
    Array.from(scoreMap.values()).forEach((entry) => {
      const bookGenres = (entry.book.genre ?? []).map((g: string) => g.toLowerCase());
      if (bookGenres.some((g: string) => g.includes(inferredGenre))) {
        entry.genre = 1;
      }
    });
  }

  // 4. Calculate combined score: semantic 0.6 + keyword 0.3 + genre 0.1
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

  // 5. Sort by score descending and return top 20
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

async function semanticSearch(query: string): Promise<SemanticResult[]> {
  try {
    const queryEmbedding = await generateEmbedding(query);
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
