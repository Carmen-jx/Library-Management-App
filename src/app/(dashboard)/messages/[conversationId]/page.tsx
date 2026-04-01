'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { Profile } from '@/types';
import { MessageBubble } from '@/components/chat/message-bubble';
import { ChatInput } from '@/components/chat/chat-input';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';

export default function ConversationPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  const router = useRouter();
  const { user } = useAuth();
  const chat = useChat(user?.id);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [otherUserLoading, setOtherUserLoading] = useState(true);
  const prevMessageCountRef = useRef(0);

  // Fetch the other user's profile
  useEffect(() => {
    if (!conversationId) return;

    const fetchOtherUser = async () => {
      setOtherUserLoading(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', conversationId)
          .single();

        if (error) throw error;
        setOtherUser(data);
      } catch (err) {
        console.error('Failed to fetch user profile:', err);
        toast.error('Could not load user profile.');
      } finally {
        setOtherUserLoading(false);
      }
    };

    fetchOtherUser();
  }, [conversationId]);

  // Load messages and mark as read on mount
  useEffect(() => {
    if (!conversationId || !user?.id) return;

    chat.loadMessages(conversationId);
    chat.markRead(conversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, user?.id]);

  // Mark as read when new messages from the other user arrive
  useEffect(() => {
    if (!conversationId || !user?.id) return;

    const currentCount = chat.activeMessages.length;
    if (currentCount > prevMessageCountRef.current) {
      const newMessages = chat.activeMessages.slice(prevMessageCountRef.current);
      const hasIncoming = newMessages.some(
        (msg) => msg.sender_id !== user.id
      );
      if (hasIncoming) {
        chat.markRead(conversationId);
      }
    }
    prevMessageCountRef.current = currentCount;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.activeMessages.length, conversationId, user?.id]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [chat.activeMessages]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!conversationId) return;

      try {
        await chat.send(conversationId, content);
      } catch (err) {
        console.error('Failed to send message:', err);
        toast.error('Failed to send message. Please try again.');
      }
    },
    [chat, conversationId]
  );

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] flex-col">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/messages')}
          aria-label="Back to messages"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {otherUserLoading ? (
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
        ) : otherUser ? (
          <div className="flex items-center gap-3">
            <Avatar
              src={otherUser.avatar_url}
              name={otherUser.name ?? 'User'}
              className="h-9 w-9"
            />
            <div>
              <p className="text-sm font-semibold leading-none">
                {otherUser.name ?? 'Unknown User'}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Unknown User</p>
        )}
      </div>

      {/* Message List */}
      <div
        ref={scrollContainerRef}
        className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-4"
      >
        {chat.loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner className="h-6 w-6" />
          </div>
        ) : chat.activeMessages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">
              No messages yet. Send a message to start the conversation!
            </p>
          </div>
        ) : (
          chat.activeMessages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.sender_id === user?.id}
            />
          ))
        )}
      </div>

      {/* Chat Input */}
      <div className="border-t bg-background px-4 py-3">
        <ChatInput
          onSend={handleSend}
          disabled={!otherUser || chat.loading}
          placeholder={
            otherUser
              ? `Message ${otherUser.name ?? 'user'}...`
              : 'Loading...'
          }
        />
      </div>
    </div>
  );
}
