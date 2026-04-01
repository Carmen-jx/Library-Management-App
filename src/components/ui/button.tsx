'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './spinner';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-500',
  secondary:
    'bg-white text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:ring-indigo-500',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
  ghost:
    'text-gray-700 hover:bg-gray-100 focus-visible:ring-indigo-500',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-sm',
  lg: 'px-4 py-2.5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      >
        {loading && <Spinner size="sm" className="shrink-0" />}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
