'use client';

import { type ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: { value: number; positive: boolean };
  className?: string;
}

export function StatsCard({ title, value, icon, trend, className }: StatsCardProps) {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <Card.Body>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-500">{title}</p>
            <div className="mt-1 flex items-baseline gap-2">
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              {trend && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 text-xs font-medium',
                    trend.positive ? 'text-green-600' : 'text-red-600',
                  )}
                >
                  {trend.positive ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  {Math.abs(trend.value)}%
                </span>
              )}
            </div>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}
