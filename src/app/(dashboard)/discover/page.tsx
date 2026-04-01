'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Profile, ConnectionStatus } from '@/types';
import {
  sendConnectionRequest,
  acceptConnection,
  rejectConnection,
  getConnectionStatus,
} from '@/services/connections';
import { logActivity } from '@/services/activity';
import { createNotification } from '@/services/notifications';
import { UserCard } from '@/components/profile/user-card';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';

interface UserWithStatus {
  profile: Profile;
  connectionStatus: ConnectionStatus | 'pending_outgoing' | 'connected' | 'none' | null;
  connectionId?: string;
  actionLoading: boolean;
}

export default function DiscoverPage() {
  const { user, profile: currentProfile } = useAuth();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<UserWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const supabase = createClient();
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user.id);

      if (error) throw error;

      const usersWithStatus = await Promise.all(
        (profiles ?? []).map(async (profile: Profile) => {
          const connection = await getConnectionStatus(user.id, profile.id);
          return {
            profile,
            connectionStatus: connection?.status ?? null,
            connectionId: connection?.id,
            actionLoading: false,
          };
        })
      );

      setUsers(usersWithStatus);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      toast.error('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const setUserActionLoading = (userId: string, isLoading: boolean) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.profile.id === userId ? { ...u, actionLoading: isLoading } : u
      )
    );
  };

  const updateUserStatus = (
    userId: string,
    status: ConnectionStatus | 'pending_outgoing' | 'connected' | 'none',
    connectionId?: string
  ) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.profile.id === userId
          ? { ...u, connectionStatus: status, ...(connectionId !== undefined && { connectionId }) }
          : u
      )
    );
  };

  const handleConnect = async (targetUserId: string) => {
    if (!user) return;

    setUserActionLoading(targetUserId, true);
    try {
      const connection = await sendConnectionRequest(user.id, targetUserId);
      await logActivity(user.id, 'connection_request', { targetId: targetUserId });
      await createNotification(
        user.id,
        targetUserId,
        'connection_request',
        'New Connection Request',
        `${currentProfile?.name ?? 'Someone'} wants to connect with you.`,
        `/profile/${user.id}`
      );
      updateUserStatus(targetUserId, 'pending_outgoing', connection.id);
      toast.success('Connection request sent!');
    } catch (err) {
      console.error('Failed to send connection request:', err);
      toast.error('Failed to send request. Please try again.');
    } finally {
      setUserActionLoading(targetUserId, false);
    }
  };

  const handleAccept = async (targetUserId: string) => {
    if (!user) return;

    const targetUser = users.find((u) => u.profile.id === targetUserId);
    if (!targetUser?.connectionId) return;

    setUserActionLoading(targetUserId, true);
    try {
      await acceptConnection(targetUser.connectionId);
      await logActivity(user.id, 'connection_accepted', { targetId: targetUserId });
      await createNotification(
        user.id,
        targetUserId,
        'connection_accepted',
        'Connection Accepted',
        `${currentProfile?.name ?? 'Someone'} accepted your connection request.`,
        `/profile/${user.id}`
      );
      updateUserStatus(targetUserId, 'connected');
      toast.success('Connection accepted!');
    } catch (err) {
      console.error('Failed to accept connection:', err);
      toast.error('Failed to accept connection. Please try again.');
    } finally {
      setUserActionLoading(targetUserId, false);
    }
  };

  const handleReject = async (targetUserId: string) => {
    if (!user) return;

    const targetUser = users.find((u) => u.profile.id === targetUserId);
    if (!targetUser?.connectionId) return;

    setUserActionLoading(targetUserId, true);
    try {
      await rejectConnection(targetUser.connectionId);
      updateUserStatus(targetUserId, 'none');
      toast.success('Connection request declined.');
    } catch (err) {
      console.error('Failed to reject connection:', err);
      toast.error('Failed to decline request. Please try again.');
    } finally {
      setUserActionLoading(targetUserId, false);
    }
  };

  const filteredUsers = users.filter((u) =>
    search.trim() === ''
      ? true
      : (u.profile.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Discover</h1>
        <p className="mt-1 text-sm text-gray-500">
          Find other readers and grow your library network.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-6">
              <div className="flex items-start gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Skeleton className="h-9 w-full" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && filteredUsers.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredUsers.map((u) => (
            <UserCard
              key={u.profile.id}
              user={u.profile}
              connectionStatus={
                u.connectionStatus === 'pending_outgoing' ? 'pending' :
                u.connectionStatus === 'connected' ? 'accepted' :
                u.connectionStatus === 'none' ? null :
                u.connectionStatus
              }
              onConnect={() => handleConnect(u.profile.id)}
              onAccept={() => handleAccept(u.profile.id)}
              onReject={() => handleReject(u.profile.id)}
              loading={u.actionLoading}
            />
          ))}
        </div>
      )}

      {!loading && filteredUsers.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Users className="h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">No users found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {search.trim()
              ? 'Try adjusting your search terms.'
              : 'No other users have joined yet. Check back later.'}
          </p>
        </div>
      )}
    </div>
  );
}
