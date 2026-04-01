'use client';

import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, rows = 4, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={cn(
            'block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
            error && 'ring-red-500 focus:ring-red-500',
            className,
          )}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={
            error && textareaId ? `${textareaId}-error` : undefined
          }
          {...props}
        />
        {error && (
          <p
            id={textareaId ? `${textareaId}-error` : undefined}
            className="mt-1.5 text-sm text-red-600"
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
