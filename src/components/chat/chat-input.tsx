'use client';

import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resetTextarea = useCallback(() => {
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    resetTextarea();
  }, [value, disabled, onSend, resetTextarea]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  return (
    <div
      className={cn(
        'flex items-end gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2',
        disabled && 'opacity-50',
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          handleInput();
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className={cn(
          'max-h-40 min-h-[36px] flex-1 resize-none bg-transparent py-1 text-sm',
          'placeholder:text-gray-400 focus:outline-none',
          'disabled:cursor-not-allowed',
        )}
      />

      <button
        type="button"
        onClick={handleSend}
        disabled={disabled || value.trim().length === 0}
        aria-label="Send message"
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          'bg-indigo-600 text-white transition-colors',
          'hover:bg-indigo-700',
          'disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500',
        )}
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}
