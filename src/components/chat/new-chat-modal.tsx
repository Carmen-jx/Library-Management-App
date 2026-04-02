'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, Users } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Avatar } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/hooks/useAuth';
import { getConnections } from '@/services/connections';
import type { Profile, Connection } from '@/types';

interface NewChatModalProps {
  open: boolean;
  onClose: () => void;
  onSelectUser: (userId: string) => void;
}

export function NewChatModal({ open, onClose, onSelectUser }: NewChatModalProps) {
  const { user } = useAuth();
  const [connections, setConnections] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchConnections = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getConnections(user.id, 'accepted');
      const users: Profile[] = data
        .map((conn: Connection) =>
          conn.requester_id === user.id ? conn.receiver : conn.requester
        )
        .filter((p): p is Profile => p !== undefined);
      setConnections(users);
    } catch (err) {
      console.error('Failed to fetch connections:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (open) {
      fetchConnections();
      setSearch('');
    }
  }, [open, fetchConnections]);

  const filtered = connections.filter((c) =>
    search.trim() === ''
      ? true
      : (c.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (userId: string) => {
    onSelectUser(userId);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="New Chat" size="sm">
      {connections.length > 3 && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search connections..."
            className="w-full rounded-lg border-0 py-2 pl-9 pr-3 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600"
          />
        </div>
      )}

      <div className="max-h-72 space-y-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Users className="h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">
              {connections.length === 0
                ? 'No connections yet. Connect with users on the Discover page!'
                : 'No connections match your search.'}
            </p>
          </div>
        )}

        {!loading &&
          filtered.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => handleSelect(person.id)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
            >
              <Avatar src={person.avatar_url} name={person.name} size="sm" />
              <span className="text-sm font-medium text-gray-900">
                {person.name}
              </span>
            </button>
          ))}
      </div>
    </Modal>
  );
}
