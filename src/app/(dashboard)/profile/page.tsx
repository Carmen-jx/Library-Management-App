'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Pencil, Users, CalendarDays, Shield, BookOpen, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import { getConnectionCount, getConnections, removeConnection } from '@/services/connections';
import { getUserBorrows } from '@/services/borrows';
import { formatDate, getPrimaryGenre } from '@/lib/utils';
import type { Borrow, Connection, Profile as ProfileType } from '@/types';

// --- Loading Skeleton ---

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
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

// --- Profile Page ---

export default function ProfilePage() {
  const { profile, loading: authLoading } = useAuth();
  const [connectionCount, setConnectionCount] = useState<number>(0);
  const [currentBorrows, setCurrentBorrows] = useState<Borrow[]>([]);
  const [pastBorrows, setPastBorrows] = useState<Borrow[]>([]);
  const [connectionsModalOpen, setConnectionsModalOpen] = useState(false);
  const [connectionsList, setConnectionsList] = useState<
    { connectionId: string; user: ProfileType }[]
  >([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    getConnectionCount(profile.id)
      .then(setConnectionCount)
      .catch(() => setConnectionCount(0));

    if (profile.show_reading_activity) {
      getUserBorrows(profile.id, 'borrowed')
        .then(setCurrentBorrows)
        .catch(() => setCurrentBorrows([]));
      getUserBorrows(profile.id, 'returned')
        .then(setPastBorrows)
        .catch(() => setPastBorrows([]));
    }
  }, [profile]);

  const fetchConnectionsList = useCallback(async () => {
    if (!profile) return;
    setConnectionsLoading(true);
    try {
      const data = await getConnections(profile.id, 'accepted');
      const list = data.map((conn: Connection) => ({
        connectionId: conn.id,
        user:
          conn.requester_id === profile.id
            ? (conn.receiver as ProfileType)
            : (conn.requester as ProfileType),
      }));
      setConnectionsList(list);
    } catch {
      toast.error('Failed to load connections.');
    } finally {
      setConnectionsLoading(false);
    }
  }, [profile]);

  const handleOpenConnectionsModal = () => {
    setConnectionsModalOpen(true);
    fetchConnectionsList();
  };

  const handleUnfollow = async (connectionId: string) => {
    setUnfollowingId(connectionId);
    try {
      await removeConnection(connectionId);
      setConnectionsList((prev) =>
        prev.filter((c) => c.connectionId !== connectionId)
      );
      setConnectionCount((prev) => Math.max(0, prev - 1));
      toast.success('Connection removed.');
    } catch {
      toast.error('Failed to remove connection.');
    } finally {
      setUnfollowingId(null);
    }
  };

  if (authLoading || !profile) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="space-y-6">
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
            <Badge variant={profile.role === 'admin' ? 'info' : 'default'}>
              <Shield className="mr-1 h-3 w-3" />
              {profile.role === 'admin' ? 'Admin' : 'Member'}
            </Badge>
          </div>

          <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
            <button
              type="button"
              onClick={handleOpenConnectionsModal}
              className="flex items-center gap-1 hover:text-indigo-600 transition-colors"
            >
              <Users className="h-4 w-4" />
              <span className="font-medium text-gray-900">{connectionCount}</span>{' '}
              {connectionCount === 1 ? 'connection' : 'connections'}
            </button>
            <span className="flex items-center gap-1">
              <CalendarDays className="h-4 w-4" />
              Member since {formatDate(profile.created_at)} ({Math.max(1, Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000))} days)
            </span>
          </div>

          {profile.bio && (
            <p className="mt-3 max-w-lg text-sm text-gray-600">{profile.bio}</p>
          )}

          {/* Edit Button */}
          <div className="mt-4">
            <Link href="/profile/edit">
              <Button variant="secondary" size="sm">
                <Pencil className="h-4 w-4" />
                Edit Profile
              </Button>
            </Link>
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

      {/* Reading Activity - only shown if opted in */}
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

      <Modal
        open={connectionsModalOpen}
        onClose={() => setConnectionsModalOpen(false)}
        title="Connections"
        size="sm"
      >
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {connectionsLoading && (
            <div className="flex justify-center py-8">
              <Spinner size="md" />
            </div>
          )}

          {!connectionsLoading && connectionsList.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Users className="h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-500">No connections yet.</p>
            </div>
          )}

          {!connectionsLoading &&
            connectionsList.map(({ connectionId, user: connUser }) => (
              <div
                key={connectionId}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-gray-50"
              >
                <Link
                  href={`/profile/${connUser.id}`}
                  className="flex min-w-0 items-center gap-3"
                >
                  <Avatar
                    src={connUser.avatar_url}
                    name={connUser.name}
                    size="sm"
                  />
                  <span className="truncate text-sm font-medium text-gray-900">
                    {connUser.name}
                  </span>
                </Link>
                <Button
                  variant="danger"
                  size="sm"
                  loading={unfollowingId === connectionId}
                  onClick={() => handleUnfollow(connectionId)}
                >
                  Unfollow
                </Button>
              </div>
            ))}
        </div>
      </Modal>
    </div>
  );
}
