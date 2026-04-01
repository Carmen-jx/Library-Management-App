'use client';

import { useEffect, useState } from 'react';
import {
  BookOpen,
  Users,
  BookMarked,
  TicketCheck,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { StatsCard } from '@/components/admin/stats-card';
import {
  BorrowsOverTimeChart,
  PopularGenresChart,
  TopBooksChart,
} from '@/components/admin/charts';
import { ActivityFeed } from '@/components/admin/activity-feed';
import { createClient } from '@/lib/supabase/client';
import { getAllActivity } from '@/services/activity';
import type { ActivityLog } from '@/types';

// --- Types ---

interface BorrowStats {
  total_books: number;
  active_borrows: number;
  total_users: number;
  open_tickets: number;
}

interface BorrowOverTime {
  date: string;
  count: number;
}

interface GenreStat {
  genre: string;
  count: number;
}

interface BookStat {
  title: string;
  borrow_count: number;
}

// --- Loading Skeleton ---

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-72" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <Card.Body>
              <div className="flex items-center gap-4">
                <Skeleton variant="rectangular" className="h-12 w-12 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-7 w-16" />
                </div>
              </div>
            </Card.Body>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <Card.Header>
            <Skeleton className="h-5 w-36" />
          </Card.Header>
          <Card.Body>
            <Skeleton variant="rectangular" className="h-64" />
          </Card.Body>
        </Card>
        <Card>
          <Card.Header>
            <Skeleton className="h-5 w-32" />
          </Card.Header>
          <Card.Body>
            <Skeleton variant="rectangular" className="h-64" />
          </Card.Body>
        </Card>
      </div>

      {/* Bottom row */}
      <Card>
        <Card.Header>
          <Skeleton className="h-5 w-40" />
        </Card.Header>
        <Card.Body>
          <Skeleton variant="rectangular" className="h-72" />
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>
          <Skeleton className="h-5 w-32" />
        </Card.Header>
        <Card.Body>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton variant="circular" className="h-8 w-8" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}

// --- Dashboard Page ---

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<BorrowStats | null>(null);
  const [borrowsOverTime, setBorrowsOverTime] = useState<BorrowOverTime[]>([]);
  const [popularGenres, setPopularGenres] = useState<GenreStat[]>([]);
  const [popularBooks, setPopularBooks] = useState<BookStat[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const supabase = createClient();

      try {
        // Fetch all data in parallel
        const [
          statsResult,
          borrowsResult,
          genresResult,
          booksResult,
          activityData,
        ] = await Promise.all([
          supabase.rpc('get_borrow_stats'),
          supabase.rpc('get_borrows_over_time'),
          supabase.rpc('get_popular_genres'),
          supabase.rpc('get_popular_books', { limit_count: 10 }),
          getAllActivity(20),
        ]);

        if (statsResult.error) {
          console.error('Stats error:', statsResult.error);
        } else {
          setStats(statsResult.data as BorrowStats);
        }

        if (borrowsResult.error) {
          console.error('Borrows over time error:', borrowsResult.error);
        } else {
          setBorrowsOverTime((borrowsResult.data as BorrowOverTime[]) ?? []);
        }

        if (genresResult.error) {
          console.error('Genres error:', genresResult.error);
        } else {
          setPopularGenres((genresResult.data as GenreStat[]) ?? []);
        }

        if (booksResult.error) {
          console.error('Books error:', booksResult.error);
        } else {
          setPopularBooks((booksResult.data as BookStat[]) ?? []);
        }

        setActivities(activityData);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        toast.error('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>
        <p className="mt-1 text-gray-500">
          Overview of library activity and key metrics.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Books"
          value={stats?.total_books ?? 0}
          icon={<BookOpen className="h-6 w-6" />}
        />
        <StatsCard
          title="Active Borrows"
          value={stats?.active_borrows ?? 0}
          icon={<BookMarked className="h-6 w-6" />}
        />
        <StatsCard
          title="Total Users"
          value={stats?.total_users ?? 0}
          icon={<Users className="h-6 w-6" />}
        />
        <StatsCard
          title="Open Tickets"
          value={stats?.open_tickets ?? 0}
          icon={<TicketCheck className="h-6 w-6" />}
        />
      </div>

      {/* Charts - 2 column */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BorrowsOverTimeChart data={borrowsOverTime} />
        <PopularGenresChart data={popularGenres} />
      </div>

      {/* Top Books */}
      <TopBooksChart data={popularBooks} />

      {/* Activity Feed */}
      <Card>
        <Card.Header>
          <h3 className="text-base font-semibold text-gray-900">Recent Activity</h3>
        </Card.Header>
        <Card.Body>
          <ActivityFeed activities={activities} />
        </Card.Body>
      </Card>
    </div>
  );
}
