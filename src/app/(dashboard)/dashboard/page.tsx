'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  Heart,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Loader2,
  TrendingUp,
  Tag,
  User,
  Clock,
  Search,
  X,
  Users,
  RotateCcw,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar } from '@/components/ui/avatar';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { timeAgo, formatDate } from '@/lib/utils';
import { getUserRecommendations } from '@/services/recommendations';
import { returnBook } from '@/services/borrows';
import { logActivity } from '@/services/activity';
import { createTicket } from '@/services/tickets';
import { notifyAdmins } from '@/services/notifications';
import { fetchAllDashboardData, type DashboardData, type FriendBorrow } from '@/lib/userDashboard';
import type { BookRecommendation, Book, Borrow } from '@/types';

// --- Types ---

interface RecentActivity {
  id: string;
  bookTitle: string;
  action: 'borrowed' | 'returned';
  date: string;
}

// --- Stat Card ---

function InsightCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string | number;
  subtitle?: string;
  color: string;
}) {
  return (
    <Card padding="md">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className="truncate text-lg font-bold text-gray-900">{value}</p>
          {subtitle && <p className="truncate text-xs text-gray-400">{subtitle}</p>}
        </div>
      </div>
    </Card>
  );
}

// --- Recommendation Skeleton ---

function RecommendationSkeleton() {
  return (
    <div className="grid auto-cols-[88%] grid-flow-col gap-5 overflow-x-auto pb-3 sm:auto-cols-[62%] lg:auto-cols-[calc((100%-2.5rem)/3)]">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <div className="flex gap-5 p-5">
            <Skeleton className="h-40 w-28 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// --- Loading Skeleton ---

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-96" />
      </div>

      {/* Continue Reading */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <div className="grid auto-cols-[88%] grid-flow-col gap-5 overflow-x-auto pb-3 sm:auto-cols-[62%] lg:auto-cols-[calc((100%-2.5rem)/3)]">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="flex gap-5 p-5">
                <Skeleton className="h-40 w-28 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} padding="md">
            <div className="flex items-center gap-3">
              <Skeleton variant="rectangular" className="h-10 w-10 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-10" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Recommendations */}
      <Card>
        <div className="border-b border-gray-200 px-6 py-4">
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="px-6 py-4">
          <RecommendationSkeleton />
        </div>
      </Card>

      {/* Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="border-b border-gray-200 px-6 py-4">
            <Skeleton className="h-6 w-36" />
          </div>
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <Skeleton variant="circular" className="h-8 w-8" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="border-b border-gray-200 px-6 py-4">
            <Skeleton className="h-6 w-36" />
          </div>
          <div className="px-6 py-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// --- Dashboard Page ---

export default function DashboardPage() {
  const { profile, user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Dashboard data
  const [data, setData] = useState<DashboardData | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  // Recommendations
  const [recommendations, setRecommendations] = useState<BookRecommendation[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [recommendationsRefreshedAt, setRecommendationsRefreshedAt] = useState<string | null>(null);
  const [showingStaleRecommendations, setShowingStaleRecommendations] = useState(false);

  // Recommendation modal
  const [selectedRec, setSelectedRec] = useState<BookRecommendation | null>(null);
  const [libraryMatch, setLibraryMatch] = useState<Book | null>(null);
  const [checkingLibrary, setCheckingLibrary] = useState(false);
  const [requestingBook, setRequestingBook] = useState(false);
  const [bookRequested, setBookRequested] = useState(false);

  // Return book loading
  const [returningBookId, setReturningBookId] = useState<string | null>(null);

  // Redirect to login if auth finished but no user
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  const loadDashboard = useCallback(async () => {
    if (!profile) return;

    try {
      const [dashboardData] = await Promise.all([
        fetchAllDashboardData(profile.id),
      ]);
      setData(dashboardData);

      // Build recent activity from currently borrowed + recent borrows
      const supabase = createClient();
      const { data: recentBorrows } = await supabase
        .from('borrows')
        .select('id, borrowed_at, returned_at, status, book:books(title)')
        .eq('user_id', profile.id)
        .order('borrowed_at', { ascending: false })
        .limit(5);

      if (recentBorrows) {
        const activities: RecentActivity[] = [];
        for (const borrow of recentBorrows as unknown as Array<{
          id: string;
          borrowed_at: string;
          returned_at: string | null;
          status: string;
          book: { title: string } | null;
        }>) {
          const bookTitle = borrow.book?.title ?? 'Unknown Book';

          if (borrow.returned_at) {
            activities.push({
              id: `${borrow.id}-returned`,
              bookTitle,
              action: 'returned',
              date: borrow.returned_at,
            });
          }
          activities.push({
            id: `${borrow.id}-borrowed`,
            bookTitle,
            action: 'borrowed',
            date: borrow.borrowed_at,
          });
        }
        activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setRecentActivity(activities.slice(0, 5));
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (authLoading || !profile) return;
    loadDashboard();
  }, [authLoading, profile, loadDashboard]);

  // Recommendations (separate fetch)
  useEffect(() => {
    if (authLoading || !profile) return;

    const fetchRecommendations = async () => {
      setRecommendationsLoading(true);
      setRecommendationsError(null);
      try {
        const result = await getUserRecommendations(profile.id);
        setRecommendations(result.recommendations);
        setRecommendationsRefreshedAt(result.refreshedAt);
        setShowingStaleRecommendations(result.stale);
      } catch (error) {
        console.error('Failed to load recommendations:', error);
        setRecommendationsError(
          error instanceof Error ? error.message : 'Failed to load recommendations.'
        );
      } finally {
        setRecommendationsLoading(false);
      }
    };

    fetchRecommendations();
  }, [profile, authLoading]);

  // --- Handlers ---

  const handleSelectRec = async (rec: BookRecommendation) => {
    setSelectedRec(rec);
    setLibraryMatch(null);
    setCheckingLibrary(true);
    setBookRequested(false);

    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('books')
        .select('*')
        .ilike('title', rec.title)
        .limit(1)
        .maybeSingle();
      setLibraryMatch(data as Book | null);
    } catch {
      setLibraryMatch(null);
    } finally {
      setCheckingLibrary(false);
    }
  };

  const handleRequestBook = async () => {
    if (!user || !selectedRec) return;
    setRequestingBook(true);
    try {
      const ticket = await createTicket(user.id, {
        subject: `Book Request: ${selectedRec.title}`,
        message: `I would like to request the following book to be added to the library:\n\nTitle: ${selectedRec.title}\nAuthor: ${selectedRec.author}\nGenre: ${selectedRec.genre}\n\nReason: AI-recommended — ${selectedRec.reason}`,
        priority: 'medium',
      });
      await notifyAdmins(
        user.id,
        'ticket_created',
        `Book Request: ${selectedRec.title}`,
        `${profile?.name ?? 'A user'} requested a book to be added to the library.`,
        `/admin/tickets?ticketId=${ticket.id}`
      );
      setBookRequested(true);
      toast.success('Book request submitted!');
    } catch {
      toast.error('Failed to submit request.');
    } finally {
      setRequestingBook(false);
    }
  };

  const handleReturnBook = async (borrow: Borrow) => {
    if (!borrow.book_id) return;
    setReturningBookId(borrow.id);
    try {
      await returnBook(borrow.id, borrow.book_id);
      toast.success(`Returned "${borrow.book?.title ?? 'book'}"`);
      // Refresh dashboard data
      await loadDashboard();
    } catch {
      toast.error('Failed to return book.');
    } finally {
      setReturningBookId(null);
    }
  };

  const handleMoreLikeThis = async (rec: BookRecommendation) => {
    if (!user) return;
    try {
      await logActivity(user.id, 'recommendation_more_like_this', {
        title: rec.title,
        author: rec.author,
        genre: rec.genre,
      });
      toast.success("We'll find more like this!");
    } catch {
      // silent fail
    }
  };

  const handleDismissRec = async (rec: BookRecommendation) => {
    if (!user) return;
    setRecommendations((prev) => prev.filter((r) => r.title !== rec.title));
    try {
      await logActivity(user.id, 'recommendation_dismissed', {
        title: rec.title,
        author: rec.author,
      });
    } catch {
      // silent fail
    }
  };

  if (authLoading || loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Welcome back, {profile?.name?.split(' ')[0] || 'Reader'}!
        </h2>
        <p className="mt-1 text-gray-500">
          Here&apos;s what&apos;s happening with your library activity.
        </p>
      </div>

      {/* ========== SECTION 1: ACTION ========== */}

      {/* Due Soon / Overdue Alerts */}
      {data && data.overdue.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-sm font-semibold text-red-800">
              {data.overdue.length} overdue {data.overdue.length === 1 ? 'book' : 'books'}
            </span>
          </div>
          <ul className="mt-2 space-y-1">
            {data.overdue.map((b) => (
              <li key={b.id} className="text-sm text-red-700">
                <span className="font-medium">{b.book?.title ?? 'Unknown'}</span>
                {' — due '}
                {formatDate(b.due_date)}
              </li>
            ))}
          </ul>
          <Link
            href="/history"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-red-700 hover:text-red-800"
          >
            Return now <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {data && data.dueSoon.length > 0 && data.overdue.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">
              {data.dueSoon.length} {data.dueSoon.length === 1 ? 'book' : 'books'} due soon
            </span>
          </div>
          <ul className="mt-2 space-y-1">
            {data.dueSoon.map((b) => (
              <li key={b.id} className="text-sm text-amber-700">
                <span className="font-medium">{b.book?.title ?? 'Unknown'}</span>
                {' — due '}
                {formatDate(b.due_date)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Continue Reading */}
      {data && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Continue Reading</h3>
          {data.currentlyBorrowed.length > 0 ? (
            <div className="grid auto-cols-[88%] grid-flow-col gap-5 overflow-x-auto pb-3 sm:auto-cols-[62%] lg:auto-cols-[calc((100%-2.5rem)/3)]">
              {data.currentlyBorrowed.map((borrow) => (
                <Card key={borrow.id} className="overflow-hidden">
                  <div className="flex gap-5 p-5">
                    {borrow.book?.cover_url ? (
                      <div className="relative h-40 w-28 flex-shrink-0 overflow-hidden rounded-md bg-gray-100">
                        <Image
                          src={borrow.book.cover_url}
                          alt={`Cover of ${borrow.book.title}`}
                          fill
                          className="object-cover"
                          sizes="112px"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="flex h-40 w-28 flex-shrink-0 items-center justify-center rounded-md bg-gray-100">
                        <BookOpen className="h-8 w-8 text-gray-300" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4
                        className="truncate text-base font-semibold text-gray-900"
                        title={borrow.book?.title}
                      >
                        {borrow.book?.title}
                      </h4>
                      <p className="mt-1 truncate text-sm text-gray-500">
                        by {borrow.book?.author}
                      </p>
                      {borrow.due_date && (
                        <p className="mt-2 text-xs text-gray-400">
                          Due {formatDate(borrow.due_date)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 border-t border-gray-100 px-5 py-2.5">
                    <Link
                      href={`/books/${borrow.book_id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      View Book <ArrowRight className="h-3 w-3" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleReturnBook(borrow)}
                      disabled={returningBookId === borrow.id}
                      className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50"
                    >
                      {returningBookId === borrow.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                      Return
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <div className="px-6 py-10 text-center">
                <BookOpen className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-3 text-sm text-gray-500">
                  No books checked out.{' '}
                  <Link href="/books" className="font-medium text-indigo-600 hover:text-indigo-700">
                    Browse the collection
                  </Link>
                </p>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ========== SECTION 2: INSIGHTS ========== */}

      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <InsightCard
            icon={BookOpen}
            label="Total Borrowed"
            value={data.totalBorrowed}
            color="bg-indigo-600"
          />
          <InsightCard
            icon={Heart}
            label="Favorites"
            value={data.favoritesCount}
            color="bg-rose-600"
          />
          <InsightCard
            icon={TrendingUp}
            label="This Month"
            value={data.monthlyBorrowCount}
            subtitle={`book${data.monthlyBorrowCount === 1 ? '' : 's'} borrowed`}
            color="bg-emerald-600"
          />
          <InsightCard
            icon={Tag}
            label="Top Genre"
            value={data.favoriteGenre ?? '\u2014'}
            color="bg-violet-600"
          />
          <InsightCard
            icon={User}
            label="Top Author"
            value={data.mostReadAuthor ?? '\u2014'}
            color="bg-amber-600"
          />
        </div>
      )}

      {/* ========== SECTION 3: AI RECOMMENDATIONS ========== */}

      <Card>
        <Card.Header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              Recommended For You
            </h3>
          </div>
          {recommendationsRefreshedAt && (
            <p className="text-xs text-gray-500">
              Last refreshed {timeAgo(recommendationsRefreshedAt)}
            </p>
          )}
        </Card.Header>
        <Card.Body className="space-y-4">
          {showingStaleRecommendations && recommendations.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Showing your last saved recommendations while the latest refresh is unavailable.
            </div>
          )}

          {recommendationsLoading && <RecommendationSkeleton />}

          {!recommendationsLoading && recommendations.length > 0 && (
            <div className="grid auto-cols-[88%] grid-flow-col gap-5 overflow-x-auto pb-3 sm:auto-cols-[62%] lg:auto-cols-[calc((100%-2.5rem)/3)]">
              {recommendations.map((rec, idx) => (
                <Card
                  key={`${rec.title}-${idx}`}
                  className="overflow-hidden transition-shadow hover:shadow-md"
                >
                  <button
                    type="button"
                    onClick={() => handleSelectRec(rec)}
                    className="w-full text-left"
                  >
                    <div className="flex gap-5 p-5">
                      {rec.cover_url ? (
                        <div className="relative h-40 w-28 flex-shrink-0 overflow-hidden rounded-md bg-gray-100">
                          <Image
                            src={rec.cover_url}
                            alt={`Cover of ${rec.title}`}
                            fill
                            className="object-cover"
                            sizes="112px"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="flex h-40 w-28 flex-shrink-0 items-center justify-center rounded-md bg-gray-100">
                          <BookOpen className="h-8 w-8 text-gray-300" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4
                          className="truncate text-base font-semibold text-gray-900"
                          title={rec.title}
                        >
                          {rec.title}
                        </h4>
                        <p className="mt-1 truncate text-sm text-gray-500">by {rec.author}</p>
                        <span className="mt-2 inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                          {rec.genre}
                        </span>
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-600">
                          {rec.reason}
                        </p>
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 border-t border-gray-100 px-5 py-2.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoreLikeThis(rec);
                      }}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      <Sparkles className="h-3 w-3" />
                      More like this
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDismissRec(rec);
                      }}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
                    >
                      <X className="h-3 w-3" />
                      Not interested
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {!recommendationsLoading && recommendations.length === 0 && recommendationsError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {recommendationsError}
            </div>
          )}

          {!recommendationsLoading && recommendations.length === 0 && !recommendationsError && (
            <div className="rounded-lg border border-dashed border-gray-200 px-6 py-10 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">
                Your recommendation list is being prepared. Check back shortly.
              </p>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* ========== SECTION 4: ACTIVITY & DISCOVERY ========== */}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <Card.Header>
            <h3 className="text-base font-semibold text-gray-900">Recent Activity</h3>
          </Card.Header>
          {recentActivity.length === 0 ? (
            <Card.Body>
              <p className="text-center text-sm text-gray-500">
                No recent activity. Start by browsing our collection!
              </p>
            </Card.Body>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentActivity.slice(0, 4).map((activity) => (
                <div key={activity.id} className="flex items-center gap-4 px-6 py-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      activity.action === 'borrowed'
                        ? 'bg-indigo-100 text-indigo-600'
                        : 'bg-green-100 text-green-600'
                    }`}
                  >
                    {activity.action === 'borrowed' ? (
                      <BookOpen className="h-4 w-4" />
                    ) : (
                      <Clock className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {activity.bookTitle}
                    </p>
                    <p className="text-xs text-gray-500">{timeAgo(activity.date)}</p>
                  </div>
                  <Badge variant={activity.action === 'borrowed' ? 'info' : 'success'}>
                    {activity.action === 'borrowed' ? 'Borrowed' : 'Returned'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Searches */}
        <Card>
          <Card.Header>
            <h3 className="text-base font-semibold text-gray-900">Recent Searches</h3>
          </Card.Header>
          {data && data.recentSearches.length === 0 ? (
            <Card.Body>
              <p className="text-center text-sm text-gray-500">No recent searches</p>
            </Card.Body>
          ) : (
            <div className="divide-y divide-gray-100">
              {data?.recentSearches.slice(0, 4).map((search, idx) => (
                <Link
                  key={`${search.query}-${idx}`}
                  href={`/books?q=${encodeURIComponent(search.query)}`}
                  className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-gray-50"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                    <Search className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{search.query}</p>
                    <p className="text-xs text-gray-500">{timeAgo(search.date)}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300" />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Social — Friends Recently Borrowed */}
      <Card>
        <Card.Header>
          <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <Users className="h-4 w-4 text-indigo-600" />
            Friends Recently Borrowed
          </h3>
        </Card.Header>
        {data && data.friendsBorrows.length === 0 ? (
          <Card.Body>
            <div className="rounded-lg border border-dashed border-gray-200 px-6 py-10 text-center">
              <Users className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">
                Connect with other members to see what they&apos;re reading!
              </p>
            </div>
          </Card.Body>
        ) : (
          <div className="divide-y divide-gray-100">
            {data?.friendsBorrows.slice(0, 4).map((fb) => (
              <div key={fb.id} className="flex items-center gap-4 px-6 py-3">
                <Avatar
                  src={fb.profile?.avatar_url}
                  name={fb.profile?.name ?? ''}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-gray-900">
                    <span className="font-medium">{fb.profile?.name}</span>
                    {' borrowed '}
                    <Link
                      href={`/books/${fb.book_id}`}
                      className="font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      {fb.book?.title ?? 'a book'}
                    </Link>
                  </p>
                  <p className="text-xs text-gray-500">{timeAgo(fb.borrowed_at)}</p>
                </div>
                {fb.book?.cover_url && (
                  <div className="relative h-10 w-7 flex-shrink-0 overflow-hidden rounded bg-gray-100">
                    <Image
                      src={fb.book.cover_url}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="28px"
                      unoptimized
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Browse Books</h4>
              <p className="mt-1 text-sm text-gray-500">Explore our full collection of books.</p>
            </div>
            <Link href="/books">
              <Button variant="primary" size="sm">
                Browse <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Borrowing History</h4>
              <p className="mt-1 text-sm text-gray-500">View all your past and current borrows.</p>
            </div>
            <Link href="/history">
              <Button variant="secondary" size="sm">
                View <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* Recommendation Detail Modal */}
      <Modal open={!!selectedRec} onClose={() => setSelectedRec(null)} title="Book Details" size="lg">
        {selectedRec && (
          <div className="space-y-5">
            <div className="flex gap-4">
              {selectedRec.cover_url ? (
                <div className="relative h-40 w-28 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  <Image
                    src={selectedRec.cover_url}
                    alt={`Cover of ${selectedRec.title}`}
                    fill
                    className="object-cover"
                    sizes="112px"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="flex h-40 w-28 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
                  <BookOpen className="h-8 w-8 text-gray-300" />
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <h3 className="text-lg font-bold text-gray-900">{selectedRec.title}</h3>
                <p className="text-sm text-gray-500">by {selectedRec.author}</p>
                <Badge>{selectedRec.genre}</Badge>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
              <span className="text-sm font-medium text-gray-700">Why this book?</span>
              <p className="mt-1 text-sm text-gray-600">{selectedRec.reason}</p>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              {checkingLibrary ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking library availability...
                </div>
              ) : libraryMatch ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    Available in our library
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant={libraryMatch.available ? 'success' : 'danger'}>
                      {libraryMatch.available ? 'Available to Borrow' : 'Currently Borrowed'}
                    </Badge>
                    <Link href={`/books/${libraryMatch.id}`} onClick={() => setSelectedRec(null)}>
                      <Button variant="primary" size="sm">
                        View in Library
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
                    <AlertCircle className="h-4 w-4" />
                    Not currently in our library
                  </div>
                  {bookRequested ? (
                    <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                      <CheckCircle className="h-4 w-4" />
                      Request submitted! An admin will review it.
                    </div>
                  ) : user ? (
                    <Button
                      variant="primary"
                      size="sm"
                      loading={requestingBook}
                      onClick={handleRequestBook}
                    >
                      Request this Book
                    </Button>
                  ) : (
                    <p className="text-xs text-gray-500">Log in to request this book.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
