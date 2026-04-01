'use client';

import { cn } from '@/lib/utils';

type SkeletonVariant = 'text' | 'circular' | 'rectangular';

interface SkeletonProps {
  className?: string;
  variant?: SkeletonVariant;
}

const variantStyles: Record<SkeletonVariant, string> = {
  text: 'h-4 w-full rounded',
  circular: 'rounded-full',
  rectangular: 'w-full rounded-lg',
};

export function Skeleton({ className, variant = 'text' }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-gray-200',
        variantStyles[variant],
        className,
      )}
      aria-hidden="true"
    />
  );
}
