'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { create } from 'zustand';
import {
  BookOpen,
  LayoutDashboard,
  Library,
  Compass,
  Heart,
  Clock,
  MessageCircle,
  User,
  LifeBuoy,
  LogOut,
  Users,
  BookCopy,
  BarChart3,
  TicketCheck,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';

// --- Sidebar Store ---

interface SidebarState {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  toggle: () => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  mobileOpen: false,
  setMobileOpen: (open) => set({ mobileOpen: open }),
  toggle: () => set((s) => ({ mobileOpen: !s.mobileOpen })),
}));

// --- Navigation Links ---

interface NavLink {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}

const mainLinks: NavLink[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Browse Books', href: '/books', icon: Library },
  { label: 'Discover', href: '/discover', icon: Compass },
  { label: 'Favorites', href: '/favorites', icon: Heart },
  { label: 'History', href: '/history', icon: Clock },
  { label: 'Messages', href: '/messages', icon: MessageCircle },
  { label: 'Profile', href: '/profile', icon: User },
  { label: 'Support', href: '/tickets', icon: LifeBuoy },
];

const adminLinks: NavLink[] = [
  { label: 'Manage Users', href: '/admin/users', icon: Users },
  { label: 'Manage Books', href: '/admin/books', icon: BookCopy },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { label: 'Tickets', href: '/admin/tickets', icon: TicketCheck },
];

// --- Sidebar Component ---

export function Sidebar() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const { mobileOpen, setMobileOpen } = useSidebarStore();
  const { unreadCount: unreadMessages } = useUnreadMessages(profile?.id);
  const supabase = createClient();

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  const handleSignOut = async () => {
    console.log('[Sidebar] Logout button clicked');
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Continue even if signOut fails
    }
    // Force clear all supabase cookies (including any httpOnly ones the browser allows)
    document.cookie.split(';').forEach((c) => {
      const cookieName = c.trim().split('=')[0];
      if (cookieName.startsWith('sb-')) {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      }
    });
    console.log('[Sidebar] Cookies cleared, redirecting to /login');
    window.location.href = '/api/auth/signout';
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const navContent = (
    <div className="flex h-full flex-col">
      {/* Branding */}
      <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <BookOpen className="h-5 w-5" />
        </div>
        <span className="text-lg font-bold tracking-tight text-gray-900">
          Manos Library
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {mainLinks.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon className={cn('h-5 w-5 shrink-0', active ? 'text-indigo-600' : 'text-gray-400')} />
              {link.label}
              {link.label === 'Messages' && unreadMessages > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              )}
            </Link>
          );
        })}

        {/* Admin Section */}
        {profile?.role === 'admin' && (
          <>
            <div className="pb-1 pt-4">
              <p className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Admin
              </p>
            </div>
            {adminLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <Icon className={cn('h-5 w-5 shrink-0', active ? 'text-indigo-600' : 'text-gray-400')} />
                  {link.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User Footer */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <Avatar
            src={profile?.avatar_url}
            name={profile?.name}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">
              {profile?.name || 'User'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-gray-200 bg-white lg:block">
        {navContent}
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 border-r border-gray-200 bg-white transition-transform duration-200 ease-in-out lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-4 rounded-lg p-1 text-gray-400 hover:text-gray-600"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
        {navContent}
      </aside>
    </>
  );
}
