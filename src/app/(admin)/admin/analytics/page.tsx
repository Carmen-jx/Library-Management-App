'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Users,
  BookMarked,
  Activity,
  TrendingUp,
  UserPlus,
  UserCheck,
  Repeat,
  BookOpen,
  AlertTriangle,
  Search,
  ArrowRightLeft,
  MessageCircle,
  Link2,
  RefreshCw,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { StatsCard } from '@/components/admin/stats-card';
import {
  BorrowsOverTimeChart,
  PopularGenresChart,
  TopBooksChart,
  MetricCard,
  SearchQueriesTable,
} from '@/components/admin/charts';
import { ActivityFeed } from '@/components/admin/activity-feed';
import { getAllActivity } from '@/services/activity';
import { fetchAnalyticsData, type AnalyticsData } from '@/lib/analytics';
import type { ActivityLog } from '@/types';

// --- Loading Skeleton ---

function AnalyticsSkeleton() {
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

      {/* Engagement row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <Card.Body>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-7 w-16" />
            </Card.Body>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <Card.Header><Skeleton className="h-5 w-36" /></Card.Header>
            <Card.Body><Skeleton variant="rectangular" className="h-64" /></Card.Body>
          </Card>
        ))}
      </div>

      <Card>
        <Card.Header><Skeleton className="h-5 w-40" /></Card.Header>
        <Card.Body><Skeleton variant="rectangular" className="h-72" /></Card.Body>
      </Card>
    </div>
  );
}

// --- Section Header ---

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}

// --- Analytics Page ---

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [analyticsData, activityData] = await Promise.all([
        fetchAnalyticsData(),
        getAllActivity(20),
      ]);
      setData(analyticsData);
      setActivities(activityData);
      if (isRefresh) toast.success('Metrics refreshed.');
    } catch (err) {
      console.error('Analytics fetch error:', err);
      toast.error('Failed to load analytics data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading || !data) {
    return <AnalyticsSkeleton />;
  }

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics</h2>
          <p className="mt-1 text-gray-500">
            Product metrics and engagement insights.
          </p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          {refreshing ? 'Refreshing\u2026' : 'Refresh'}
        </button>
      </div>

      {/* A. Top KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Users"
          value={data.kpis.totalUsers}
          icon={<Users className="h-6 w-6" />}
        />
        <StatsCard
          title="Daily Active Users"
          value={data.kpis.dau}
          icon={<Activity className="h-6 w-6" />}
        />
        <StatsCard
          title="Active Borrows"
          value={data.kpis.activeBorrows}
          icon={<BookMarked className="h-6 w-6" />}
        />
        <StatsCard
          title="Borrow Rate (7d)"
          value={data.kpis.borrowRate}
          icon={<TrendingUp className="h-6 w-6" />}
        />
      </div>

      {/* B. Engagement Section */}
      <div className="space-y-4">
        <SectionHeader
          title="Engagement"
          subtitle="User activity and retention metrics"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            label="Daily Active Users"
            value={data.engagement.dau}
            subtitle="Last 24 hours"
            icon={<Activity className="h-5 w-5" />}
          />
          <MetricCard
            label="Weekly Active Users"
            value={data.engagement.wau}
            subtitle="Last 7 days"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <MetricCard
            label="New Users"
            value={data.engagement.newUsers}
            subtitle="Last 7 days"
            icon={<UserPlus className="h-5 w-5" />}
          />
          <MetricCard
            label="Returning Users"
            value={data.engagement.returningUsers}
            subtitle="Active both weeks"
            icon={<UserCheck className="h-5 w-5" />}
          />
          <MetricCard
            label="Repeat Borrow Rate"
            value={`${data.engagement.repeatBorrowRate}%`}
            subtitle="Users with 2+ borrows"
            icon={<Repeat className="h-5 w-5" />}
          />
        </div>
        <BorrowsOverTimeChart data={data.charts.borrowsOverTime} />
      </div>

      {/* C. Book Insights */}
      <div className="space-y-4">
        <SectionHeader
          title="Book Insights"
          subtitle="Inventory and popularity metrics"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard
            label="Availability Rate"
            value={`${data.inventory.availabilityRate}%`}
            subtitle={`${data.inventory.availableBooks} of ${data.inventory.totalBooks} books`}
            icon={<BookOpen className="h-5 w-5" />}
          />
          <MetricCard
            label="Total Books"
            value={data.inventory.totalBooks}
            icon={<BookOpen className="h-5 w-5" />}
          />
          <MetricCard
            label="Overdue Books"
            value={data.inventory.overdueCount}
            subtitle="Past due date"
            icon={<AlertTriangle className="h-5 w-5" />}
            accentColor={data.inventory.overdueCount > 0 ? 'text-red-600' : undefined}
          />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <PopularGenresChart data={data.charts.popularGenres} />
          <TopBooksChart data={data.charts.popularBooks} />
        </div>
      </div>

      {/* D. Behavior Section */}
      <div className="space-y-4">
        <SectionHeader
          title="Search & Discovery"
          subtitle="How users find books"
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SearchQueriesTable data={data.behavior.topSearches} />
          <div className="space-y-4">
            <MetricCard
              label="Search → Borrow Conversion"
              value={`${data.behavior.searchBorrowConversion}%`}
              subtitle="Users who searched and borrowed (7d)"
              icon={<ArrowRightLeft className="h-5 w-5" />}
            />
          </div>
        </div>
      </div>

      {/* E. Social Section */}
      <div className="space-y-4">
        <SectionHeader
          title="Social"
          subtitle="Community engagement (last 7 days)"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MetricCard
            label="Messages Sent"
            value={data.social.messagesSent7d}
            subtitle="Last 7 days"
            icon={<MessageCircle className="h-5 w-5" />}
          />
          <MetricCard
            label="New Connections"
            value={data.social.newConnections7d}
            subtitle="Last 7 days"
            icon={<Link2 className="h-5 w-5" />}
          />
        </div>
      </div>

      {/* F. Activity Feed */}
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
