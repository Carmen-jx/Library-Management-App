import type { Message } from '@/types';
import { cn, timeAgo } from '@/lib/utils';
import { CheckCheck } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 max-w-[75%]',
        isOwn ? 'ml-auto items-end' : 'mr-auto items-start',
      )}
    >
      <div
        className={cn(
          'px-4 py-2',
          isOwn
            ? 'rounded-2xl rounded-br-md bg-indigo-600 text-white'
            : 'rounded-2xl rounded-bl-md bg-gray-100 text-gray-900',
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>

      <div
        className={cn(
          'flex items-center gap-1 px-1',
          isOwn ? 'flex-row-reverse' : 'flex-row',
        )}
      >
        <span
          className={cn(
            'text-xs',
            isOwn ? 'text-indigo-200' : 'text-gray-400',
          )}
        >
          {timeAgo(message.created_at)}
        </span>

        {isOwn && message.read && (
          <CheckCheck className="h-3.5 w-3.5 text-indigo-200" />
        )}
      </div>
    </div>
  );
}
