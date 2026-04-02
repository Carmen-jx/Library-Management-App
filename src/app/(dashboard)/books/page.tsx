'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BookGrid } from '@/components/books/book-grid';
import { BookSearch } from '@/components/books/book-search';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/components/ui/toast';
import type { Book } from '@/types';

const BOOKS_PER_PAGE = 12;

// --- Loading Skeleton ---

function BooksPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-72" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-24" />
      </div>
      <BookGrid books={[]} loading />
    </div>
  );
}

// --- Books Page ---

export default function BooksPage() {
  const { user, loading: authLoading } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<{ genres?: string[]; available?: boolean }>({});
  const [page, setPage] = useState(0);

  // Fetch books (server-side pagination + filtering)
  useEffect(() => {
    const fetchBooks = async () => {
      setLoading(true);
      const supabase = createClient();
      const from = page * BOOKS_PER_PAGE;
      const to = from + BOOKS_PER_PAGE - 1;

      let query = supabase
        .from('books')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (searchQuery) {
        query = query.or(
          `title.ilike.%${searchQuery}%,author.ilike.%${searchQuery}%`
        );
      }

      if (filters.genres && filters.genres.length > 0) {
        query = query.overlaps('genre', filters.genres);
      }

      if (filters.available) {
        query = query.eq('available', true);
      }

      const { data, count, error } = await query;

      if (error) {
        console.error('Error fetching books:', error.message);
        toast.error('Failed to load books.');
      } else {
        setBooks((data as Book[]) ?? []);
        setTotalCount(count ?? 0);
      }
      setLoading(false);
    };

    fetchBooks();
  }, [page, searchQuery, filters]);

  // Fetch favorites
  useEffect(() => {
    if (!user) return;

    const fetchFavorites = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('favorites')
        .select('book_id')
        .eq('user_id', user.id);

      if (data) {
        setFavorites(data.map((f: { book_id: string }) => f.book_id));
      }
    };

    fetchFavorites();
  }, [user]);

  // Pagination (server-side)
  const totalPages = Math.ceil(totalCount / BOOKS_PER_PAGE);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [searchQuery, filters]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleFilterChange = useCallback((newFilters: { genres?: string[]; available?: boolean }) => {
    setFilters(newFilters);
  }, []);

  const handleFavoriteToggle = async (bookId: string) => {
    if (!user) {
      toast.warning('Please sign in to add favorites.');
      return;
    }

    const supabase = createClient();
    const isFavorited = favorites.includes(bookId);

    if (isFavorited) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('book_id', bookId);

      if (error) {
        toast.error('Failed to remove favorite.');
      } else {
        setFavorites((prev) => prev.filter((id) => id !== bookId));
        toast.success('Removed from favorites.');
      }
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, book_id: bookId });

      if (error) {
        toast.error('Failed to add favorite.');
      } else {
        setFavorites((prev) => [...prev, bookId]);
        toast.success('Added to favorites.');
      }
    }
  };

  if (authLoading || loading) {
    return <BooksPageSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Browse Books</h2>
        <p className="mt-1 text-gray-500">
          Explore our collection of {totalCount} books.
        </p>
      </div>

      {/* Search & Filters */}
      <BookSearch
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
      />

      {/* Book Grid */}
      <BookGrid
        books={books}
        showActions
        favorites={favorites}
        onFavoriteToggle={handleFavoriteToggle}
        emptyMessage="No books match your search criteria."
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <p className="text-sm text-gray-500">
            Showing {page * BOOKS_PER_PAGE + 1}–
            {Math.min((page + 1) * BOOKS_PER_PAGE, totalCount)} of{' '}
            {totalCount} books
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
