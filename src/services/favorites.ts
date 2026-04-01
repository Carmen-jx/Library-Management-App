import { createClient } from '@/lib/supabase/client';
import type { Favorite } from '@/types';

export async function toggleFavorite(
  userId: string,
  bookId: string
): Promise<{ favorited: boolean }> {
  const supabase = createClient();

  // Check if already favorited
  const { data: existing, error: checkError } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .maybeSingle();

  if (checkError) throw checkError;

  if (existing) {
    // Remove favorite
    const { error: deleteError } = await supabase
      .from('favorites')
      .delete()
      .eq('id', existing.id);

    if (deleteError) throw deleteError;
    return { favorited: false };
  } else {
    // Add favorite
    const { error: insertError } = await supabase
      .from('favorites')
      .insert({ user_id: userId, book_id: bookId });

    if (insertError) throw insertError;
    return { favorited: true };
  }
}

export async function getUserFavorites(userId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('favorites')
    .select('*, book:books(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Favorite[];
}

export async function isFavorited(
  userId: string,
  bookId: string
): Promise<boolean> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}
