import { createClient } from '@/lib/supabase/client';
import type { Borrow, BorrowStatus } from '@/types';

export async function borrowBook(userId: string, bookId: string) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('borrow_book', {
    p_book_id: bookId,
  });

  if (error) {
    if (error.message?.includes('BOOK_NOT_AVAILABLE')) {
      throw new Error('This book is no longer available.');
    }
    throw error;
  }

  return data as unknown as Borrow;
}

export async function returnBook(borrowId: string, bookId: string) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('return_book', {
    p_borrow_id: borrowId,
  });

  if (error) {
    if (error.message?.includes('BORROW_NOT_FOUND')) {
      throw new Error('Borrow record not found.');
    }
    throw error;
  }

  return data as unknown as Borrow;
}

export async function getUserBorrows(userId: string, status?: BorrowStatus) {
  const supabase = createClient();

  let query = supabase
    .from('borrows')
    .select('*, book:books(*)')
    .eq('user_id', userId)
    .order('borrowed_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as Borrow[];
}

export async function getActiveBorrow(userId: string, bookId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('borrows')
    .select('*, book:books(*)')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .eq('status', 'borrowed')
    .maybeSingle();

  if (error) throw error;
  return data as Borrow | null;
}

interface GetAllBorrowsOptions {
  status?: BorrowStatus;
  limit?: number;
}

export async function getAllBorrows(options: GetAllBorrowsOptions = {}) {
  const { status, limit = 50 } = options;
  const supabase = createClient();

  let query = supabase
    .from('borrows')
    .select('*, book:books(*), profile:profiles(*)')
    .order('borrowed_at', { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as Borrow[];
}
