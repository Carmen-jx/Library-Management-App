'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: CardPadding;
  onClick?: () => void;
}

const paddingStyles: Record<CardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({ children, className, padding = 'none', onClick }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl bg-white shadow-sm ring-1 ring-gray-200',
        paddingStyles[padding],
        className,
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

function CardHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('border-b border-gray-200 px-6 py-4', className)}
    >
      {children}
    </div>
  );
}

function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('px-6 py-4', className)}>{children}</div>;
}

function CardFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('border-t border-gray-200 px-6 py-4', className)}
    >
      {children}
    </div>
  );
}

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;
