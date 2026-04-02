'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, RotateCcw, Clock, BookX } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import { getUserBorrows, returnBook } from '@/services/borrows';
import { logActivity } from '@/services/activity';
import { formatDate } from '@/lib/utils';
import type { Borrow, BorrowStatus } from '@/types';

// --- Filter Tabs ---

type FilterTab = 'all' | 'borrowed' | 'returned';

const tabs: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'borrowed', label: 'Currently Borrowed' },
  { key: 'returned', label: 'Returned' },
];

// --- Status Badge ---

function StatusBadge({ status }: { status: BorrowStatus }) {
  const variants: Record<BorrowStatus, 'warning' | 'success' | 'danger'> = {
    borrowed: 'warning',
    returned: 'success',
    overdue: 'danger',
  };

  const labels: Record<BorrowStatus, string> = {
    borrowed: 'Borrowed',
    returned: 'Returned',
    overdue: 'Overdue',
  };

  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}

// --- Loading Skeleton ---

function HistorySkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-80" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-32 rounded-lg" />
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} padding="md">
            <div className="flex items-center gap-4">
              <Skeleton variant="rectangular" className="h-20 w-14 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-56" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// --- History Page ---

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const [borrows, setBorrows] = useState<Borrow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [returningId, setReturningId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;

    const fetchBorrows = async () => {
      try {
        const data = await getUserBorrows(user.id);
        setBorrows(data);
      } catch {
        toast.error('Failed to load borrowing history.');
      } finally {
        setLoading(false);
      }
    };

    fetchBorrows();
  }, [user, authLoading]);

  const handleReturn = async (borrow: Borrow) => {
    if (!user || !borrow.book) return;
    setReturningId(borrow.id);

    try {
      await returnBook(borrow.id, borrow.book_id);
      await logActivity(user.id, 'returned_book', {
        book_id: borrow.book_id,
        book_title: borrow.book.title,
      });

      setBorrows((prev) =>
        prev.map((b) =>
          b.id === borrow.id
            ? { ...b, status: 'returned' as BorrowStatus, returned_at: new Date().toISOString() }
            : b
        )
      );

      toast.success(`"${borrow.book.title}" has been returned.`);
    } catch {
      toast.error('Failed to return the book. Please try again.');
    } finally {
      setReturningId(null);
    }
  };

  // Client-side filtering
  const filteredBorrows = borrows.filter((borrow) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'borrowed') return borrow.status === 'borrowed' || borrow.status === 'overdue';
    if (activeTab === 'returned') return borrow.status === 'returned';
    return true;
  });

  if (authLoading || loading) {
    return <HistorySkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Borrowing History</h2>
        <p className="mt-1 text-gray-500">
          View and manage all your past and current borrows.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Borrows List */}
      {filteredBorrows.length === 0 ? (
        <Card padding="lg">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <BookX className="h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-sm font-medium text-gray-900">No borrows found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {activeTab === 'all'
                ? 'You haven\'t borrowed any books yet. Head to the books page to get started!'
                : activeTab === 'borrowed'
                  ? 'You don\'t have any books currently borrowed.'
                  : 'You haven\'t returned any books yet.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredBorrows.map((borrow) => (
            <Card key={borrow.id} padding="md">
              <div className="flex items-center gap-4">
                {/* Book Cover & Info (clickable) */}
                <Link
                  href={`/books/${borrow.book_id}`}
                  className="flex min-w-0 flex-1 items-center gap-4 hover:opacity-80"
                >
                  <div className="flex h-20 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-gray-100">
                    {borrow.book?.cover_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={borrow.book.cover_url}
                        alt={borrow.book.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <BookOpen className="h-6 w-6 text-gray-300" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-gray-900">
                      {borrow.book?.title ?? 'Unknown Book'}
                    </h3>
                    <p className="truncate text-xs text-gray-500">
                      {borrow.book?.author ?? 'Unknown Author'}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        Borrowed {formatDate(borrow.borrowed_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Due {formatDate(borrow.due_date)}
                      </span>
                      {borrow.returned_at && (
                        <span className="flex items-center gap-1">
                          <RotateCcw className="h-3 w-3" />
                          Returned {formatDate(borrow.returned_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>

                {/* Status & Action */}
                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge status={borrow.status} />
                  {(borrow.status === 'borrowed' || borrow.status === 'overdue') && (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={returningId === borrow.id}
                      onClick={() => handleReturn(borrow)}
                    >
                      Return
                    </Button>
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
