'use client';

import { BookOpen } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BookCard } from '@/components/books/book-card';
import type { Book } from '@/types';

interface BookGridProps {
  books: Book[];
  loading?: boolean;
  emptyMessage?: string;
  showActions?: boolean;
  favorites?: string[];
  onFavoriteToggle?: (bookId: string) => void;
}

function BookCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton variant="rectangular" className="aspect-[2/3] w-full" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
    </Card>
  );
}

export function BookGrid({
  books,
  loading = false,
  emptyMessage = 'No books found.',
  showActions = false,
  favorites = [],
  onFavoriteToggle,
}: BookGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <BookCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <BookOpen className="h-12 w-12 text-gray-300" />
        <p className="mt-4 text-sm text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {books.map((book) => (
        <BookCard
          key={book.id}
          book={book}
          showActions={showActions}
          isFavorited={favorites.includes(book.id)}
          onFavoriteToggle={onFavoriteToggle}
        />
      ))}
    </div>
  );
}
