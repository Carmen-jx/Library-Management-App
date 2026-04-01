'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { ConversationList } from '@/components/chat/conversation-list';
import { Skeleton } from '@/components/ui/skeleton';

export default function MessagesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const chat = useChat(user?.id);

  useEffect(() => {
    if (user?.id) {
      chat.loadConversations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleSelectConversation = (conversationUserId: string) => {
    router.push(`/messages/${conversationUserId}`);
  };

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversation List */}
        <div className="w-full border-r md:w-80">
          {chat.loading ? (
            <div className="flex flex-col gap-1 p-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg p-3">
                  <Skeleton className="h-10 w-10 flex-shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <Skeleton className="h-3 w-10" />
                </div>
              ))}
            </div>
          ) : chat.conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="rounded-full bg-muted p-4">
                <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">No messages yet</h3>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Connect with other users to start chatting!
              </p>
            </div>
          ) : (
            <ConversationList
              conversations={chat.conversations}
              activeId={undefined}
              onSelect={handleSelectConversation}
            />
          )}
        </div>

        {/* Desktop: Right Panel Placeholder */}
        <div className="hidden flex-1 items-center justify-center md:flex">
          <div className="flex flex-col items-center text-center px-6">
            <div className="rounded-full bg-muted p-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">
              Select a conversation
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a conversation from the list to start chatting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
