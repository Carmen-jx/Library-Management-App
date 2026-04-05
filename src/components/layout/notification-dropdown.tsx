'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Bell, CheckCheck, UserPlus, UserCheck, TicketIcon, MessageSquare } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { timeAgo } from '@/lib/utils';
import type { NotificationType } from '@/types';

const TYPE_ICONS: Record<NotificationType, typeof UserPlus> = {
  connection_request: UserPlus,
  connection_accepted: UserCheck,
  ticket_created: TicketIcon,
  ticket_updated: MessageSquare,
  ticket_assigned: TicketIcon,
};

export function NotificationDropdown() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } =
    useNotifications(user?.id);

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open]);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const handleNotificationClick = async (notificationId: string, link: string | null) => {
    await markAsRead(notificationId);
    setOpen(false);
    if (link) {
      router.push(link);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`relative rounded-lg p-2 transition-colors ${
          open
            ? 'bg-indigo-50 text-indigo-600'
            : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
        }`}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(400px,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-[60vh] overflow-y-auto">
            {loading && notifications.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                Loading...
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
                <Bell className="h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm font-medium text-gray-900">No notifications</p>
                <p className="mt-0.5 text-xs text-gray-500">You&apos;re all caught up.</p>
              </div>
            )}

            {notifications.map((notification) => {
              const Icon = TYPE_ICONS[notification.type as NotificationType] ?? Bell;
              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleNotificationClick(notification.id, notification.link)}
                  className={`flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-gray-50 ${
                    !notification.read ? 'bg-indigo-50/40' : ''
                  }`}
                >
                  {notification.actor ? (
                    <Avatar
                      src={notification.actor.avatar_url}
                      name={notification.actor.name}
                      size="sm"
                    />
                  ) : (
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                      <Icon className="h-4 w-4 text-gray-500" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-indigo-600" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="mt-1 text-[11px] text-gray-400">
                      {timeAgo(notification.created_at)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
