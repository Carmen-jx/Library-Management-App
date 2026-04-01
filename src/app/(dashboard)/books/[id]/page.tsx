'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Heart,
  Calendar,
  Building2,
  FileText,
  Share2,
  Pencil,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GenreBadges } from '@/components/ui/genre-badges';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { cn, formatDate } from '@/lib/utils';
import { BookReviews } from '@/components/books/book-reviews';
import { ShareBookModal } from '@/components/books/share-book-modal';
import type { Book, Borrow } from '@/types';

// --- Loading Skeleton ---

function BookDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-24" />
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[300px_1fr]">
        <Skeleton variant="rectangular" className="aspect-[2/3] w-full rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-24 w-full" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Book Detail Page ---

export default function BookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile: userProfile, loading: authLoading } = useAuth();
  const [book, setBook] = useState<Book | null>(null);
  const [activeBorrow, setActiveBorrow] = useState<Borrow | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [borrowing, setBorrowing] = useState(false);
  const [returning, setReturning] = useState(false);
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const bookId = params.id as string;

  // Fetch book, borrow status, and favorite status
  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      // Fetch book
      const { data: bookData, error: bookError } = await supabase
        .from('books')
        .select('*')
        .eq('id', bookId)
        .single();

      if (bookError || !bookData) {
        toast.error('Book not found.');
        router.push('/books');
        return;
      }

      setBook(bookData as Book);

      // If user is logged in, fetch borrow and favorite status
      if (user) {
        const [borrowResult, favoriteResult] = await Promise.all([
          supabase
            .from('borrows')
            .select('*')
            .eq('user_id', user.id)
            .eq('book_id', bookId)
            .eq('status', 'borrowed')
            .maybeSingle(),
          supabase
            .from('favorites')
            .select('id')
            .eq('user_id', user.id)
            .eq('book_id', bookId)
            .maybeSingle(),
        ]);

        if (borrowResult.data) {
          setActiveBorrow(borrowResult.data as Borrow);
        }

        setIsFavorited(!!favoriteResult.data);
      }

      setLoading(false);
    };

    if (!authLoading) {
      fetchData();
    }
  }, [bookId, user, authLoading, router]);

  // Borrow book
  const handleBorrow = async () => {
    if (!user || !book) return;

    setBorrowing(true);
    const supabase = createClient();

    const { data: borrow, error } = await supabase.rpc('borrow_book', {
      p_book_id: book.id,
    });

    if (error) {
      if (error.message?.includes('BOOK_NOT_AVAILABLE')) {
        setBook((prev) => (prev ? { ...prev, available: false } : prev));
        toast.error('This book is no longer available.');
      } else {
        toast.error('Failed to borrow book.');
      }
      setBorrowing(false);
      return;
    }

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'borrowed_book',
      metadata: { book_id: book.id, book_title: book.title },
    });

    setActiveBorrow(borrow as Borrow);
    setBook((prev) => (prev ? { ...prev, available: false } : prev));
    toast.success(`Successfully borrowed "${book.title}".`);
    setBorrowing(false);
  };

  // Return book
  const handleReturn = async () => {
    if (!user || !book || !activeBorrow) return;

    setReturning(true);
    const supabase = createClient();

    const { error } = await supabase.rpc('return_book', {
      p_borrow_id: activeBorrow.id,
    });

    if (error) {
      toast.error('Failed to return book.');
      setReturning(false);
      return;
    }

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'returned_book',
      metadata: { book_id: book.id, book_title: book.title },
    });

    setActiveBorrow(null);
    setBook((prev) => (prev ? { ...prev, available: true } : prev));
    toast.success(`Successfully returned "${book.title}".`);
    setReturning(false);
  };

  // Toggle favorite
  const handleFavoriteToggle = async () => {
    if (!user || !book) return;

    setTogglingFavorite(true);
    const supabase = createClient();

    if (isFavorited) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('book_id', book.id);

      if (error) {
        toast.error('Failed to remove from favorites.');
      } else {
        setIsFavorited(false);
        toast.success('Removed from favorites.');
      }
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, book_id: book.id });

      if (error) {
        toast.error('Failed to add to favorites.');
      } else {
        setIsFavorited(true);
        toast.success('Added to favorites.');
      }
    }

    setTogglingFavorite(false);
  };

  if (authLoading || loading) {
    return <BookDetailSkeleton />;
  }

  if (!book) return null;

  // Extract metadata fields
  const metadata = book.metadata as Record<string, unknown> | null;
  const pageCount = metadata?.pageCount as number | undefined;
  const publisher = metadata?.publisher as string | undefined;
  const publishedDate = metadata?.publishedDate as string | undefined;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href="/books"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Books
      </Link>

      {/* Book Detail Layout */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[300px_1fr]">
        {/* Cover Image */}
        <Card className="overflow-hidden self-start">
          <div className="relative aspect-[2/3] w-full bg-gray-100">
            {book.cover_url ? (
              <Image
                src={book.cover_url}
                alt={book.title}
                fill
                className="object-cover"
                sizes="300px"
                priority
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <BookOpen className="h-16 w-16 text-gray-300" />
              </div>
            )}
          </div>
        </Card>

        {/* Book Info */}
        <div className="space-y-6">
          {/* Title & Author */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{book.title}</h1>
            <p className="mt-1 text-lg text-gray-500">{book.author}</p>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <GenreBadges genres={book.genre} maxVisible={4} />
            <Badge variant={book.available ? 'success' : 'danger'}>
              {book.available ? 'Available' : 'Borrowed'}
            </Badge>
          </div>

          {/* Description */}
          {book.description && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Description</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {book.description}
              </p>
            </div>
          )}

          {/* Metadata */}
          {(pageCount || publisher || publishedDate) && (
            <Card padding="md">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">
                Book Details
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {pageCount && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <span>{pageCount} pages</span>
                  </div>
                )}
                {publisher && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span>{publisher}</span>
                  </div>
                )}
                {publishedDate && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span>{publishedDate}</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Active Borrow Info */}
          {activeBorrow && (
            <Card padding="md" className="border-l-4 border-l-indigo-500">
              <p className="text-sm text-gray-600">
                You borrowed this book. Due date:{' '}
                <span className="font-medium text-gray-900">
                  {formatDate(activeBorrow.due_date)}
                </span>
              </p>
            </Card>
          )}

          {/* Actions */}
          {user && (
            <div className="flex flex-wrap gap-3">
              {activeBorrow ? (
                <Button
                  variant="primary"
                  loading={returning}
                  onClick={handleReturn}
                >
                  Return Book
                </Button>
              ) : book.available ? (
                <Button
                  variant="primary"
                  loading={borrowing}
                  onClick={handleBorrow}
                >
                  Borrow Book
                </Button>
              ) : (
                <Button variant="secondary" disabled>
                  Currently Unavailable
                </Button>
              )}

              <Button
                variant="ghost"
                loading={togglingFavorite}
                onClick={handleFavoriteToggle}
              >
                <Heart
                  className={cn(
                    'h-4 w-4',
                    isFavorited
                      ? 'fill-rose-500 text-rose-500'
                      : 'text-gray-500'
                  )}
                />
                {isFavorited ? 'Favorited' : 'Favorite'}
              </Button>

              <Button
                variant="ghost"
                onClick={() => setShareOpen(true)}
              >
                <Share2 className="h-4 w-4 text-gray-500" />
                Share
              </Button>

              {userProfile?.role === 'admin' && (
                <Link href={`/admin/books/${book.id}`}>
                  <Button variant="secondary">
                    <Pencil className="h-4 w-4" />
                    Edit Book
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reviews Section */}
      <BookReviews bookId={bookId} />

      {/* Share Modal */}
      <ShareBookModal
        book={book}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}
