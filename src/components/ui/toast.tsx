'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import {
  Check,
  X,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// --- Types ---

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastState {
  toasts: ToastItem[];
  add: (type: ToastType, message: string) => void;
  remove: (id: string) => void;
}

// --- Store ---

let counter = 0;

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (type, message) => {
    const id = String(++counter);
    set((state) => ({
      toasts: [...state.toasts, { id, type, message }],
    }));
  },
  remove: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

// --- Public API ---

export const toast = {
  success: (message: string) => useToastStore.getState().add('success', message),
  error: (message: string) => useToastStore.getState().add('error', message),
  info: (message: string) => useToastStore.getState().add('info', message),
  warning: (message: string) => useToastStore.getState().add('warning', message),
};

// --- Styles ---

const typeStyles: Record<ToastType, string> = {
  success: 'border-green-200 bg-green-50',
  error: 'border-red-200 bg-red-50',
  info: 'border-blue-200 bg-blue-50',
  warning: 'border-yellow-200 bg-yellow-50',
};

const iconStyles: Record<ToastType, string> = {
  success: 'text-green-600',
  error: 'text-red-600',
  info: 'text-blue-600',
  warning: 'text-yellow-600',
};

const icons: Record<ToastType, typeof Check> = {
  success: Check,
  error: X,
  info: Info,
  warning: AlertTriangle,
};

// --- Toast Item Component ---

function ToastNotification({ item }: { item: ToastItem }) {
  const remove = useToastStore((s) => s.remove);
  const Icon = icons[item.type];

  useEffect(() => {
    const timer = setTimeout(() => remove(item.id), 5000);
    return () => clearTimeout(timer);
  }, [item.id, remove]);

  return (
    <div
      className={cn(
        'pointer-events-auto flex w-80 items-start gap-3 rounded-lg border p-4 shadow-lg transition-all',
        typeStyles[item.type],
      )}
      role="alert"
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', iconStyles[item.type])} />
      <p className="flex-1 text-sm text-gray-900">{item.message}</p>
      <button
        type="button"
        onClick={() => remove(item.id)}
        className="shrink-0 rounded p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// --- Container ---

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-0 top-0 z-[100] flex flex-col gap-2 p-4"
    >
      {toasts.map((t) => (
        <ToastNotification key={t.id} item={t} />
      ))}
    </div>
  );
}
