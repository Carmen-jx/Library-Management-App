'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Send, Copy, Check, Search } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { Profile, Book } from '@/types';

interface ShareBookModalProps {
  book: Book;
  open: boolean;
  onClose: () => void;
}

export function ShareBookModal({ book, open, onClose }: ShareBookModalProps) {
  const { user } = useAuth();
  const [connections, setConnections] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchConnections = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    const supabase = createClient();

    // Get accepted connections where user is either requester or receiver
    const { data, error } = await supabase
      .from('connections')
      .select(
        'requester:profiles!connections_requester_id_fkey(id, name, avatar_url), receiver:profiles!connections_receiver_id_fkey(id, name, avatar_url)'
      )
      .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .eq('status', 'accepted');

    if (error) {
      console.error('Failed to fetch connections:', error);
      setLoading(false);
      return;
    }

    // Extract the other user from each connection
    const users: Profile[] = [];
    for (const conn of data ?? []) {
      const requester = conn.requester as unknown as Profile;
      const receiver = conn.receiver as unknown as Profile;
      if (requester?.id === user.id) {
        if (receiver) users.push(receiver);
      } else {
        if (requester) users.push(requester);
      }
    }

    setConnections(users);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (open) {
      fetchConnections();
      setSearch('');
      setCopied(false);
    }
  }, [open, fetchConnections]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, onClose]);

  const handleSendMessage = async (targetUser: Profile) => {
    if (!user) return;

    setSendingTo(targetUser.id);
    const supabase = createClient();

    const messageContent = `📚 Check out this book: "${book.title}" by ${book.author} — /books/${book.id}`;

    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: targetUser.id,
      content: messageContent,
    });

    if (error) {
      toast.error('Failed to send message.');
      setSendingTo(null);
      return;
    }

    toast.success(`Shared with ${targetUser.name}!`);
    setSendingTo(null);
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/books/${book.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link.');
    }
  };

  const filteredConnections = connections.filter((c) =>
    search.trim() === ''
      ? true
      : (c.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-xl bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Share &quot;{book.title}&quot;
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Copy Link */}
          <div className="border-b px-5 py-3">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 text-gray-400" />
              )}
              {copied ? 'Copied!' : 'Copy link to clipboard'}
            </button>
          </div>

          {/* Share via Message */}
          <div className="px-5 py-3">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
              Share via message
            </p>

            {/* Search connections */}
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

            {/* Connection list */}
            <div className="max-h-60 space-y-1 overflow-y-auto">
              {loading && (
                <p className="py-4 text-center text-sm text-gray-400">
                  Loading connections...
                </p>
              )}

              {!loading && filteredConnections.length === 0 && (
                <p className="py-4 text-center text-sm text-gray-400">
                  {connections.length === 0
                    ? 'No connections yet. Connect with users on the Discover page!'
                    : 'No connections match your search.'}
                </p>
              )}

              {filteredConnections.map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={conn.avatar_url}
                      name={conn.name}
                      size="sm"
                    />
                    <span className="text-sm font-medium text-gray-900">
                      {conn.name}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={sendingTo === conn.id}
                    onClick={() => handleSendMessage(conn)}
                  >
                    <Send className={cn('h-3.5 w-3.5', sendingTo === conn.id ? '' : 'text-gray-400')} />
                    Send
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t px-5 py-3">
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={onClose}
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
