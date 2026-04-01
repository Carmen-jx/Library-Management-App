import { createClient } from '@/lib/supabase/client';
import { openLibraryWorkToBook } from '@/lib/api/open-library';
import type { Book, OpenLibraryWork } from '@/types';

interface GetBooksOptions {
  search?: string;
  genre?: string;
  available?: boolean;
  page?: number;
  limit?: number;
}

export async function getBooks(options: GetBooksOptions = {}) {
  const { search, genre, available, page = 1, limit = 20 } = options;
  const supabase = createClient();

  let query = supabase
    .from('books')
    .select('*', { count: 'exact' });

  if (search) {
    query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%`);
  }

  if (genre) {
    query = query.contains('genre', [genre]);
  }

  if (available !== undefined) {
    query = query.eq('available', available);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw error;
  return { data: data as Book[], count };
}

export async function getBook(id: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Book;
}

export async function searchBooksFullText(query: string) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('search_books', {
    search_query: query,
  });

  if (error) throw error;
  return data as Book[];
}

export async function createBook(book: Omit<Book, 'id' | 'created_at'>) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('books')
    .insert(book)
    .select()
    .single();

  if (error) throw error;
  return data as Book;
}

export async function updateBook(id: string, updates: Partial<Book>) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('books')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Book;
}

export async function deleteBook(id: string) {
  const supabase = createClient();

  const { error } = await supabase
    .from('books')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function importFromOpenLibrary(work: OpenLibraryWork) {
  const supabase = createClient();
  const bookData = openLibraryWorkToBook(work);

  const { data, error } = await supabase
    .from('books')
    .upsert(bookData, { onConflict: 'open_library_key' })
    .select()
    .single();

  if (error) throw error;
  return data as Book;
}
