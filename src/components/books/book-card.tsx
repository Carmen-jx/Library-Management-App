'use client';

import Link from 'next/link';
import Image from 'next/image';
import { BookOpen, Heart } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GenreBadges } from '@/components/ui/genre-badges';
import { cn } from '@/lib/utils';
import type { Book } from '@/types';

interface BookCardProps {
  book: Book;
  showActions?: boolean;
  onFavoriteToggle?: (bookId: string) => void;
  isFavorited?: boolean;
}

export function BookCard({
  book,
  showActions = false,
  onFavoriteToggle,
  isFavorited = false,
}: BookCardProps) {
  return (
    <Link href={`/books/${book.id}`} className="group block">
      <Card className="h-full overflow-hidden transition-all duration-200 group-hover:shadow-md group-hover:scale-[1.02]">
        {/* Cover Image */}
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-gray-100">
          {book.cover_url ? (
            <Image
              src={book.cover_url}
              alt={book.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <BookOpen className="h-12 w-12 text-gray-300" />
            </div>
          )}

          {/* Favorite Button */}
          {showActions && onFavoriteToggle && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onFavoriteToggle(book.id);
              }}
              className="absolute right-2 top-2 rounded-full bg-white/80 p-1.5 shadow-sm backdrop-blur-sm transition-colors hover:bg-white"
              aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart
                className={cn(
                  'h-4 w-4 transition-colors',
                  isFavorited
                    ? 'fill-rose-500 text-rose-500'
                    : 'text-gray-500 hover:text-rose-500'
                )}
              />
            </button>
          )}
        </div>

        {/* Book Info */}
        <div className="space-y-2 p-4">
          <h3 className="line-clamp-1 text-sm font-semibold text-gray-900">
            {book.title}
          </h3>
          <p className="line-clamp-1 text-xs text-gray-500">{book.author}</p>
          <div className="flex items-center gap-2">
            <GenreBadges genres={book.genre} />
            <Badge variant={book.available ? 'success' : 'danger'}>
              {book.available ? 'Available' : 'Borrowed'}
            </Badge>
          </div>
        </div>
      </Card>
    </Link>
  );
}
