'use client';

import { UserPlus, Clock, UserCheck, Check, X } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import type { Profile, ConnectionStatus } from '@/types';

// --- Types ---

interface UserCardProps {
  user: Profile;
  connectionStatus?: ConnectionStatus | null;
  onConnect?: (userId: string) => void;
  onAccept?: (userId: string) => void;
  onReject?: (userId: string) => void;
  onCancel?: (userId: string) => void;
  loading?: boolean;
}

// --- Connection Button ---

function ConnectionButton({
  userId,
  status,
  onConnect,
  onAccept,
  onReject,
  onCancel,
  loading,
}: {
  userId: string;
  status?: ConnectionStatus | null;
  onConnect?: (userId: string) => void;
  onAccept?: (userId: string) => void;
  onReject?: (userId: string) => void;
  onCancel?: (userId: string) => void;
  loading?: boolean;
}) {
  if (status === 'accepted') {
    return (
      <Button variant="ghost" size="sm" disabled>
        <UserCheck className="h-4 w-4" />
        Connected
      </Button>
    );
  }

  if (status === 'pending' && onAccept && onReject) {
    return (
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          loading={loading}
          onClick={() => onAccept(userId)}
        >
          <Check className="h-4 w-4" />
          Accept
        </Button>
        <Button
          variant="danger"
          size="sm"
          loading={loading}
          onClick={() => onReject(userId)}
        >
          <X className="h-4 w-4" />
          Reject
        </Button>
      </div>
    );
  }

  if (status === 'pending' && onCancel) {
    return (
      <Button
        variant="secondary"
        size="sm"
        loading={loading}
        onClick={() => onCancel(userId)}
      >
        <X className="h-4 w-4" />
        Cancel Request
      </Button>
    );
  }

  if (status === 'pending') {
    return (
      <Button variant="secondary" size="sm" disabled>
        <Clock className="h-4 w-4" />
        Pending
      </Button>
    );
  }

  // No connection yet
  if (onConnect) {
    return (
      <Button
        variant="primary"
        size="sm"
        loading={loading}
        onClick={() => onConnect(userId)}
      >
        <UserPlus className="h-4 w-4" />
        Connect
      </Button>
    );
  }

  return null;
}

// --- User Card ---

export function UserCard({
  user,
  connectionStatus,
  onConnect,
  onAccept,
  onReject,
  onCancel,
  loading,
}: UserCardProps) {
  return (
    <Card padding="md">
      <div className="flex items-start gap-4">
        {/* Avatar - clickable */}
        <Link href={`/profile/${user.id}`}>
          <Avatar src={user.avatar_url} name={user.name} size="lg" />
        </Link>

        {/* User Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/profile/${user.id}`}
              className="truncate text-sm font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
            >
              {user.name}
            </Link>
            {user.role === 'admin' && (
              <Badge variant="info">Admin</Badge>
            )}
          </div>

          {user.bio && (
            <p className="mt-1 line-clamp-2 text-xs text-gray-500">
              {user.bio}
            </p>
          )}

          {/* Genre Tags */}
          {user.favorite_genres && user.favorite_genres.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {user.favorite_genres.slice(0, 4).map((genre) => (
                <Badge key={genre} variant="default">
                  {genre}
                </Badge>
              ))}
              {user.favorite_genres.length > 4 && (
                <span className="inline-flex items-center text-xs text-gray-400">
                  +{user.favorite_genres.length - 4} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Connection Action */}
        <div className="shrink-0">
          <ConnectionButton
            userId={user.id}
            status={connectionStatus}
            onConnect={onConnect}
            onAccept={onAccept}
            onReject={onReject}
            onCancel={onCancel}
            loading={loading}
          />
        </div>
      </div>
    </Card>
  );
}
