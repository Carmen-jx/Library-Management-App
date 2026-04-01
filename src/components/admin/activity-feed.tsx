'use client';

import {
  BookOpen,
  RotateCcw,
  Heart,
  UserPlus,
  MessageSquare,
  TicketCheck,
  Activity,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { cn, timeAgo } from '@/lib/utils';
import type { ActivityLog } from '@/types';

// --- Action Config ---

interface ActionConfig {
  icon: typeof BookOpen;
  color: string;
  bgColor: string;
  label: string;
}

const ACTION_MAP: Record<string, ActionConfig> = {
  borrow: {
    icon: BookOpen,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    label: 'borrowed a book',
  },
  return: {
    icon: RotateCcw,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    label: 'returned a book',
  },
  favorite: {
    icon: Heart,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    label: 'favorited a book',
  },
  unfavorite: {
    icon: Heart,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
    label: 'unfavorited a book',
  },
  connection_request: {
    icon: UserPlus,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    label: 'sent a connection request',
  },
  connection_accept: {
    icon: UserPlus,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    label: 'accepted a connection',
  },
  message: {
    icon: MessageSquare,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    label: 'sent a message',
  },
  ticket_create: {
    icon: TicketCheck,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    label: 'created a support ticket',
  },
  ticket_resolve: {
    icon: TicketCheck,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    label: 'resolved a ticket',
  },
};

const DEFAULT_ACTION: ActionConfig = {
  icon: Activity,
  color: 'text-gray-500',
  bgColor: 'bg-gray-50',
  label: 'performed an action',
};

function getActionConfig(action: string): ActionConfig {
  return ACTION_MAP[action] ?? DEFAULT_ACTION;
}

function getDescription(activity: ActivityLog): string {
  const config = getActionConfig(activity.action);
  const meta = activity.metadata;

  if (meta) {
    const bookTitle = meta.book_title as string | undefined;
    const userName = meta.target_user_name as string | undefined;

    if (bookTitle) {
      return `${config.label}: "${bookTitle}"`;
    }
    if (userName) {
      return `${config.label} with ${userName}`;
    }
  }

  return config.label;
}

// --- Component ---

interface ActivityFeedProps {
  activities: ActivityLog[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Activity className="h-10 w-10 text-gray-300" />
        <p className="mt-3 text-sm text-gray-500">No recent activity.</p>
      </div>
    );
  }

  return (
    <div className="max-h-[480px] overflow-y-auto">
      <ul className="divide-y divide-gray-100">
        {activities.map((activity) => {
          const config = getActionConfig(activity.action);
          const Icon = config.icon;
          const description = getDescription(activity);

          return (
            <li key={activity.id} className="flex items-start gap-3 px-1 py-3">
              <div className="relative shrink-0">
                <Avatar
                  src={activity.profile?.avatar_url}
                  name={activity.profile?.name ?? 'User'}
                  size="sm"
                />
                <span
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white',
                    config.bgColor,
                  )}
                >
                  <Icon className={cn('h-2.5 w-2.5', config.color)} />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-900">
                  <span className="font-medium">
                    {activity.profile?.name ?? 'Unknown User'}
                  </span>{' '}
                  <span className="text-gray-600">{description}</span>
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {timeAgo(activity.created_at)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
