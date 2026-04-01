'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, BookOpen, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GenreBadges } from '@/components/ui/genre-badges';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import { getUserFavorites, toggleFavorite } from '@/services/favorites';
import type { Favorite } from '@/types';

// --- Loading Skeleton ---

function FavoritesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <Skeleton variant="rectangular" className="aspect-[2/3] w-full" />
            <div className="space-y-2 p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// --- Favorites Page ---

export default function FavoritesPage() {
  const { user, loading: authLoading } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;

    const fetchFavorites = async () => {
      try {
        const data = await getUserFavorites(user.id);
        setFavorites(data);
      } catch {
        toast.error('Failed to load favorites.');
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, [user, authLoading]);

  const handleRemoveFavorite = async (favorite: Favorite) => {
    if (!user) return;
    setRemovingId(favorite.id);

    try {
      await toggleFavorite(user.id, favorite.book_id);
      setFavorites((prev) => prev.filter((f) => f.id !== favorite.id));
      toast.success(`"${favorite.book?.title}" removed from favorites.`);
    } catch {
      toast.error('Failed to remove from favorites.');
    } finally {
      setRemovingId(null);
    }
  };

  if (authLoading || loading) {
    return <FavoritesSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">My Favorites</h2>
        <p className="mt-1 text-gray-500">
          {favorites.length > 0
            ? `You have ${favorites.length} favorited book${favorites.length !== 1 ? 's' : ''}.`
            : 'Books you favorite will appear here.'}
        </p>
      </div>

      {/* Empty State */}
      {favorites.length === 0 ? (
        <Card padding="lg">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Heart className="h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-sm font-medium text-gray-900">
              No favorites yet
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Browse our book collection and tap the heart icon to save your favorites.
            </p>
            <Link href="/books" className="mt-4">
              <Button variant="primary" size="sm">
                Browse Books <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        /* Favorites Grid */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {favorites.map((favorite) => (
            <Card key={favorite.id} className="group h-full overflow-hidden">
              {/* Cover Image */}
              <Link href={`/books/${favorite.book_id}`} className="block">
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-gray-100">
                  {favorite.book?.cover_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={favorite.book.cover_url}
                      alt={favorite.book.title}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <BookOpen className="h-12 w-12 text-gray-300" />
                    </div>
                  )}

                  {/* Unfavorite Button */}
                  <button
                    type="button"
                    disabled={removingId === favorite.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemoveFavorite(favorite);
                    }}
                    className="absolute right-2 top-2 rounded-full bg-white/80 p-1.5 shadow-sm backdrop-blur-sm transition-colors hover:bg-white disabled:opacity-50"
                    aria-label="Remove from favorites"
                  >
                    <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
                  </button>
                </div>
              </Link>

              {/* Book Info */}
              <div className="space-y-2 p-4">
                <h3 className="line-clamp-1 text-sm font-semibold text-gray-900">
                  {favorite.book?.title ?? 'Unknown Book'}
                </h3>
                <p className="line-clamp-1 text-xs text-gray-500">
                  {favorite.book?.author ?? 'Unknown Author'}
                </p>
                <div className="flex items-center gap-2">
                  {favorite.book?.genre && (
                    <GenreBadges genres={favorite.book.genre} />
                  )}
                  {favorite.book && (
                    <Badge variant={favorite.book.available ? 'success' : 'danger'}>
                      {favorite.book.available ? 'Available' : 'Borrowed'}
                    </Badge>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
