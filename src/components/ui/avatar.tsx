'use client';

import { cn } from '@/lib/utils';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: AvatarSize;
  className?: string;
}

const sizeStyles: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
  '2xl': 'h-24 w-24 text-2xl',
  '3xl': 'h-32 w-32 text-3xl',
};

const bgColors = [
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-purple-500',
  'bg-fuchsia-500',
  'bg-pink-500',
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return bgColors[Math.abs(hash) % bgColors.length];
}

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name || 'Avatar'}
        className={cn(
          'inline-block rounded-full object-cover',
          sizeStyles[size],
          className,
        )}
      />
    );
  }

  const initials = name ? getInitials(name) : '?';
  const bgColor = name ? getColorFromName(name) : 'bg-gray-400';

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-medium text-white',
        sizeStyles[size],
        bgColor,
        className,
      )}
      aria-label={name || 'Avatar'}
    >
      {initials}
    </span>
  );
}
