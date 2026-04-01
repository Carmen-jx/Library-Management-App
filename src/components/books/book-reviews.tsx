'use client';

import { useEffect, useState, useCallback } from 'react';
import { Star, Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { cn, formatDate } from '@/lib/utils';
import type { Review } from '@/types';

interface BookReviewsProps {
  bookId: string;
}

function StarRating({
  rating,
  interactive = false,
  onRate,
  size = 'sm',
}: {
  rating: number;
  interactive?: boolean;
  onRate?: (rating: number) => void;
  size?: 'sm' | 'md';
}) {
  const [hovered, setHovered] = useState(0);
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = interactive ? star <= (hovered || rating) : star <= rating;
        return (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => onRate?.(star)}
            onMouseEnter={() => interactive && setHovered(star)}
            onMouseLeave={() => interactive && setHovered(0)}
            className={cn(
              'transition-colors',
              interactive
                ? 'cursor-pointer hover:scale-110'
                : 'cursor-default',
            )}
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
          >
            <Star
              className={cn(
                iconSize,
                filled
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-gray-300',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

export function BookReviews({ bookId }: BookReviewsProps) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formRating, setFormRating] = useState(0);
  const [formContent, setFormContent] = useState('');
  const [editing, setEditing] = useState(false);

  const userReview = reviews.find((r) => r.user_id === user?.id);
  const otherReviews = reviews.filter((r) => r.user_id !== user?.id);

  const fetchReviews = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('reviews')
      .select('*, profile:profiles(id, name, avatar_url)')
      .eq('book_id', bookId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch reviews:', error);
      return;
    }

    setReviews(
      (data ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        profile: r.profile as Review['profile'],
      })) as Review[]
    );
    setLoading(false);
  }, [bookId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // Populate form when editing existing review
  useEffect(() => {
    if (editing && userReview) {
      setFormRating(userReview.rating);
      setFormContent(userReview.content ?? '');
    }
  }, [editing, userReview]);

  const handleSubmit = async () => {
    if (!user || formRating === 0) {
      toast.error('Please select a rating.');
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    if (userReview) {
      // Update existing review
      const { error } = await supabase
        .from('reviews')
        .update({
          rating: formRating,
          content: formContent.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userReview.id);

      if (error) {
        toast.error('Failed to update review.');
        setSubmitting(false);
        return;
      }

      toast.success('Review updated!');
    } else {
      // Insert new review
      const { error } = await supabase.from('reviews').insert({
        user_id: user.id,
        book_id: bookId,
        rating: formRating,
        content: formContent.trim() || null,
      });

      if (error) {
        toast.error('Failed to submit review.');
        setSubmitting(false);
        return;
      }

      toast.success('Review submitted!');
    }

    setEditing(false);
    setFormRating(0);
    setFormContent('');
    setSubmitting(false);
    fetchReviews();
  };

  const handleDelete = async () => {
    if (!userReview) return;

    setDeleting(true);
    const supabase = createClient();

    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', userReview.id);

    if (error) {
      toast.error('Failed to delete review.');
      setDeleting(false);
      return;
    }

    toast.success('Review deleted.');
    setEditing(false);
    setFormRating(0);
    setFormContent('');
    setDeleting(false);
    fetchReviews();
  };

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const showForm = user && (!userReview || editing);

  return (
    <div className="space-y-6">
      {/* Header with average rating */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Reviews</h2>
          {reviews.length > 0 && (
            <div className="mt-1 flex items-center gap-2">
              <StarRating rating={Math.round(averageRating)} />
              <span className="text-sm text-gray-500">
                {averageRating.toFixed(1)} ({reviews.length}{' '}
                {reviews.length === 1 ? 'review' : 'reviews'})
              </span>
            </div>
          )}
        </div>
        {user && userReview && !editing && (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              loading={deleting}
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Review Form */}
      {showForm && (
        <Card padding="md" className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">
            {userReview ? 'Edit Your Review' : 'Write a Review'}
          </h3>
          <div>
            <p className="mb-1.5 text-xs text-gray-500">Your rating</p>
            <StarRating
              rating={formRating}
              interactive
              onRate={setFormRating}
              size="md"
            />
          </div>
          <div>
            <label htmlFor="review-content" className="mb-1.5 block text-xs text-gray-500">
              Your review (optional)
            </label>
            <textarea
              id="review-content"
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="Share your thoughts about this book..."
              rows={3}
              className="block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              loading={submitting}
              onClick={handleSubmit}
              disabled={formRating === 0}
            >
              {userReview ? 'Update Review' : 'Submit Review'}
            </Button>
            {editing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setFormRating(0);
                  setFormContent('');
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* User's own review (when not editing) */}
      {userReview && !editing && (
        <Card padding="md" className="border-l-4 border-l-indigo-500">
          <div className="flex items-start gap-3">
            <Avatar
              src={userReview.profile?.avatar_url}
              name={userReview.profile?.name}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">
                  {userReview.profile?.name ?? 'You'}
                </span>
                <span className="text-xs text-gray-400">
                  {formatDate(userReview.created_at)}
                </span>
              </div>
              <StarRating rating={userReview.rating} />
              {userReview.content && (
                <p className="mt-2 text-sm text-gray-600">
                  {userReview.content}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Other reviews */}
      {otherReviews.length > 0 && (
        <div className="space-y-3">
          {otherReviews.map((review) => (
            <Card key={review.id} padding="md">
              <div className="flex items-start gap-3">
                <Avatar
                  src={review.profile?.avatar_url}
                  name={review.profile?.name}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {review.profile?.name ?? 'Anonymous'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDate(review.created_at)}
                    </span>
                  </div>
                  <StarRating rating={review.rating} />
                  {review.content && (
                    <p className="mt-2 text-sm text-gray-600">
                      {review.content}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {reviews.length === 0 && !showForm && (
        <p className="text-sm text-gray-500">
          No reviews yet. Be the first to review this book!
        </p>
      )}
    </div>
  );
}
