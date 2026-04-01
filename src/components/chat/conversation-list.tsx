'use client';

import { useMemo } from 'react';
import type { Conversation } from '@/types';
import { cn, timeAgo } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageSquare } from 'lucide-react';

interface ConversationListProps {
  conversations: Conversation[];
  activeId?: string;
  onSelect: (userId: string) => void;
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
}: ConversationListProps) {
  const sorted = useMemo(
    () =>
      [...conversations].sort((a, b) => {
        const timeA = new Date(a.last_message?.created_at ?? 0).getTime();
        const timeB = new Date(b.last_message?.created_at ?? 0).getTime();
        return timeB - timeA;
      }),
    [conversations],
  );

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-400">
        <MessageSquare className="h-8 w-8" />
        <p className="text-sm">No conversations yet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {sorted.map((conversation) => {
        const isActive = conversation.user.id === activeId;

        return (
          <button
            key={conversation.user.id}
            type="button"
            onClick={() => onSelect(conversation.user.id)}
            className={cn(
              'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
              'hover:bg-gray-50',
              isActive && 'border-l-2 border-indigo-600 bg-indigo-50',
              !isActive && 'border-l-2 border-transparent',
            )}
          >
            <Avatar
              src={conversation.user?.avatar_url}
              name={conversation.user?.name ?? ''}
              size="sm"
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">
                  {conversation.user?.name ?? 'Unknown'}
                </span>
                {conversation.last_message?.created_at && (
                  <span className="shrink-0 text-xs text-gray-400">
                    {timeAgo(conversation.last_message.created_at)}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm text-gray-500">
                  {conversation.last_message?.content ?? ''}
                </p>
                {conversation.unread_count > 0 && (
                  <Badge className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 p-0 text-xs text-white">
                    {conversation.unread_count}
                  </Badge>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
