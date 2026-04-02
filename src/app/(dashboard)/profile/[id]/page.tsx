'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Users, CalendarDays, Shield, ArrowLeft, UserPlus, UserCheck, BookOpen, ArrowRight, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import {
  getConnectionCount,
  getConnectionStatus,
  sendConnectionRequest,
  acceptConnection,
  removeConnection,
} from '@/services/connections';
import { getUserBorrows } from '@/services/borrows';
import { logActivity } from '@/services/activity';
import { createNotification } from '@/services/notifications';
import { formatDate, getPrimaryGenre } from '@/lib/utils';
import type { Profile, Connection, Borrow } from '@/types';
import Link from 'next/link';

// --- Loading Skeleton ---

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-24" />
      <Card padding="md">
        <div className="flex flex-col items-center text-center">
          <Skeleton variant="circular" className="h-32 w-32" />
          <Skeleton className="mt-4 h-7 w-48" />
          <Skeleton className="mt-2 h-4 w-32" />
          <Skeleton className="mt-3 h-4 w-64" />
        </div>
      </Card>
    </div>
  );
}

// --- User Profile Page ---

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile: myProfile } = useAuth();
  const userId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionCount, setConnectionCount] = useState<number>(0);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentBorrows, setCurrentBorrows] = useState<Borrow[]>([]);
  const [pastBorrows, setPastBorrows] = useState<Borrow[]>([]);

  // Redirect to /profile if viewing own profile
  useEffect(() => {
    if (user && userId === user.id) {
      router.replace('/profile');
    }
  }, [user, userId, router]);

  const fetchProfile = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        toast.error('User not found.');
        router.push('/discover');
        return;
      }

      const userProfile = data as Profile;
      setProfile(userProfile);

      // Fetch reading activity if opted in
      if (userProfile.show_reading_activity) {
        getUserBorrows(userId, 'borrowed')
          .then(setCurrentBorrows)
          .catch(() => setCurrentBorrows([]));
        getUserBorrows(userId, 'returned')
          .then(setPastBorrows)
          .catch(() => setPastBorrows([]));
      }
    } catch {
      toast.error('Failed to load profile.');
      router.push('/discover');
    } finally {
      setLoading(false);
    }
  }, [userId, router]);

  const fetchConnectionData = useCallback(async () => {
    if (!user) return;

    try {
      const [count, status] = await Promise.all([
        getConnectionCount(userId),
        getConnectionStatus(user.id, userId),
      ]);
      setConnectionCount(count);
      setConnection(status);
    } catch {
      // Silently fail for connection data
    }
  }, [user, userId]);

  useEffect(() => {
    fetchProfile();
    fetchConnectionData();
  }, [fetchProfile, fetchConnectionData]);

  const handleConnect = async () => {
    if (!user) return;

    setActionLoading(true);
    try {
      const conn = await sendConnectionRequest(user.id, userId);
      await logActivity(user.id, 'connection_request', { targetId: userId });
      await createNotification(
        user.id,
        userId,
        'connection_request',
        'New Connection Request',
        `${myProfile?.name ?? 'Someone'} wants to connect with you.`,
        `/profile/${user.id}`
      );
      setConnection(conn);
      toast.success('Connection request sent!');
    } catch {
      toast.error('Failed to send request. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!user || !connection) return;

    setActionLoading(true);
    try {
      const updated = await acceptConnection(connection.id);
      await logActivity(user.id, 'connection_accepted', { targetId: userId });
      await createNotification(
        user.id,
        connection.requester_id,
        'connection_accepted',
        'Connection Accepted',
        `${myProfile?.name ?? 'Someone'} accepted your connection request.`,
        `/profile/${user.id}`
      );
      setConnection(updated);
      setConnectionCount((prev) => prev + 1);
      toast.success('Connection accepted!');
    } catch {
      toast.error('Failed to accept connection. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!user || !connection) return;

    setActionLoading(true);
    try {
      await removeConnection(connection.id);
      setConnection(null);
      toast.success('Connection request cancelled.');
    } catch {
      toast.error('Failed to cancel request. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (!profile) {
    return null;
  }

  const isOwnOutgoing =
    connection?.status === 'pending' && connection.requester_id === user?.id;
  const isIncomingPending =
    connection?.status === 'pending' && connection.receiver_id === user?.id;
  const isConnected = connection?.status === 'accepted';

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/discover">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </Link>

      {/* Profile Header - centered */}
      <Card padding="md">
        <div className="flex flex-col items-center text-center">
          <Avatar
            src={profile.avatar_url}
            name={profile.name}
            size="3xl"
          />

          <div className="mt-4 flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {profile.name}
            </h1>
            {profile.role === 'admin' && (
              <Badge variant="info">
                <Shield className="mr-1 h-3 w-3" />
                Admin
              </Badge>
            )}
          </div>

          <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span className="font-medium text-gray-900">{connectionCount}</span>{' '}
              {connectionCount === 1 ? 'connection' : 'connections'}
            </span>
            <span className="flex items-center gap-1">
              <CalendarDays className="h-4 w-4" />
              Joined {formatDate(profile.created_at)}
            </span>
          </div>

          {profile.bio && (
            <p className="mt-3 max-w-lg text-sm text-gray-600">{profile.bio}</p>
          )}

          {/* Connection Button */}
          <div className="mt-4">
            {isConnected && (
              <Button variant="ghost" size="sm" disabled>
                <UserCheck className="h-4 w-4" />
                Connected
              </Button>
            )}
            {isOwnOutgoing && (
              <Button
                variant="secondary"
                size="sm"
                loading={actionLoading}
                onClick={handleCancelRequest}
              >
                <X className="h-4 w-4" />
                Cancel Request
              </Button>
            )}
            {isIncomingPending && (
              <Button
                variant="primary"
                size="sm"
                loading={actionLoading}
                onClick={handleAccept}
              >
                <UserCheck className="h-4 w-4" />
                Accept Connection
              </Button>
            )}
            {!connection && (
              <Button
                variant="primary"
                size="sm"
                loading={actionLoading}
                onClick={handleConnect}
              >
                <UserPlus className="h-4 w-4" />
                Connect
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Favorite Genres */}
      {profile.favorite_genres && profile.favorite_genres.length > 0 && (
        <Card padding="md">
          <h3 className="text-sm font-semibold text-gray-900">
            Favorite Genres
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.favorite_genres.map((genre) => (
              <Badge key={genre} variant="default">
                {genre}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Reading Activity - only shown if user opted in */}
      {profile.show_reading_activity && (
        <>
          {/* Currently Borrowing */}
          <Card>
            <Card.Header>
              <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <BookOpen className="h-4 w-4 text-indigo-600" />
                Currently Borrowing
              </h3>
            </Card.Header>
            <Card.Body>
              {currentBorrows.length > 0 ? (
                <div className="grid auto-cols-[88%] grid-flow-col gap-5 overflow-x-auto pb-3 sm:auto-cols-[62%] lg:auto-cols-[calc((100%-2.5rem)/3)]">
                  {currentBorrows.map((borrow) => (
                    <Card key={borrow.id} className="overflow-hidden transition-shadow hover:shadow-md">
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
                          <h4 className="truncate text-base font-semibold text-gray-900" title={borrow.book?.title}>
                            {borrow.book?.title}
                          </h4>
                          <p className="mt-1 truncate text-sm text-gray-500">
                            by {borrow.book?.author}
                          </p>
                          <span className="mt-2 inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                            {getPrimaryGenre(borrow.book?.genre ?? null)}
                          </span>
                          {borrow.due_date && (
                            <p className="mt-3 text-sm leading-6 text-gray-600">
                              Due {formatDate(borrow.due_date)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="border-t border-gray-100 px-4 py-2.5">
                        <Link
                          href={`/books/${borrow.book_id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                        >
                          View Book
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 px-6 py-10 text-center">
                  <BookOpen className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-3 text-sm text-gray-500">
                    Not currently borrowing any books.
                  </p>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Past Borrows */}
          {pastBorrows.length > 0 && (
            <Card>
              <Card.Header>
                <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                  <BookOpen className="h-4 w-4 text-indigo-600" />
                  Reading History
                </h3>
              </Card.Header>
              <Card.Body>
                <div className="grid auto-cols-[88%] grid-flow-col gap-5 overflow-x-auto pb-3 sm:auto-cols-[62%] lg:auto-cols-[calc((100%-2.5rem)/3)]">
                  {pastBorrows.slice(0, 10).map((borrow) => (
                    <Card key={borrow.id} className="overflow-hidden transition-shadow hover:shadow-md">
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
                          <h4 className="truncate text-base font-semibold text-gray-900" title={borrow.book?.title}>
                            {borrow.book?.title}
                          </h4>
                          <p className="mt-1 truncate text-sm text-gray-500">
                            by {borrow.book?.author}
                          </p>
                          <span className="mt-2 inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                            {getPrimaryGenre(borrow.book?.genre ?? null)}
                          </span>
                          {borrow.returned_at && (
                            <p className="mt-3 text-sm leading-6 text-gray-600">
                              Returned {formatDate(borrow.returned_at)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="border-t border-gray-100 px-4 py-2.5">
                        <Link
                          href={`/books/${borrow.book_id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                        >
                          View Book
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              </Card.Body>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
