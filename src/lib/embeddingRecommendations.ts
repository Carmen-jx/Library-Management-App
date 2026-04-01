import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateEmbedding, buildBookEmbeddingText } from '@/lib/embeddings';
import type { Book } from '@/types';

export interface EmbeddingRecommendation {
  book: Book;
  similarity: number;
}

// ---------------------------------------------------------------------------
// Personalized recommendations via embedding similarity
// ---------------------------------------------------------------------------

export async function getPersonalizedRecommendations(
  userId: string
): Promise<EmbeddingRecommendation[]> {
  const supabase = createServerSupabaseClient();

  // 1. Fetch user's favorites, borrows, and profile genres in parallel
  const [favoritesResult, borrowsResult, profileResult] = await Promise.all([
    supabase
      .from('favorites')
      .select('book:books(id, title, author, description, genre)')
      .eq('user_id', userId),
    supabase
      .from('borrows')
      .select('book:books(id, title, author, description, genre)')
      .eq('user_id', userId),
    supabase
      .from('profiles')
      .select('favorite_genres')
      .eq('id', userId)
      .single(),
  ]);

  if (favoritesResult.error) {
    console.error('Failed to fetch favorites:', favoritesResult.error.message);
  }
  if (borrowsResult.error) {
    console.error('Failed to fetch borrows:', borrowsResult.error.message);
  }

  // 2. Collect all books the user has interacted with
  type PartialBook = {
    id: string;
    title: string;
    author: string;
    description: string | null;
    genre: string[];
  };

  const seenBookIds = new Set<string>();
  const userBooks: PartialBook[] = [];

  const extractBooks = (rows: Record<string, unknown>[] | null) => {
    if (!rows) return;
    for (const row of rows) {
      const book = row.book as PartialBook | null;
      if (book && !seenBookIds.has(book.id)) {
        seenBookIds.add(book.id);
        userBooks.push(book);
      }
    }
  };

  extractBooks(favoritesResult.data);
  extractBooks(borrowsResult.data);

  // 3. Build user profile text from books + genres
  const profileTexts: string[] = [];

  for (const book of userBooks) {
    profileTexts.push(buildBookEmbeddingText(book));
  }

  const profileGenres = profileResult.data?.favorite_genres ?? [];
  if (profileGenres.length > 0) {
    profileTexts.push(`Preferred genres: ${profileGenres.join(', ')}`);
  }

  if (profileTexts.length === 0) {
    // No data to base recommendations on
    return [];
  }

  // 4. Generate embedding for combined user profile
  const profileText = profileTexts.join('. ').slice(0, 8000);
  const profileEmbedding = await generateEmbedding(profileText);

  // 5. Vector search via RPC
  const { data, error } = await supabase.rpc('match_books_by_embedding', {
    query_embedding: JSON.stringify(profileEmbedding),
    match_threshold: 0.15,
    match_count: 30,
  });

  if (error) {
    console.error('Embedding recommendation search error:', error.message);
    return [];
  }

  // 6. Filter out already-seen books and return top 10
  const recommendations: EmbeddingRecommendation[] = [];

  for (const row of data ?? []) {
    if (seenBookIds.has(row.id)) continue;

    recommendations.push({
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
    });

    if (recommendations.length >= 10) break;
  }

  return recommendations;
}
