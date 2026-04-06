'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { GENRES } from '@/lib/utils';

interface GenreDropdownProps {
  selected: string[];
  onChange: (genres: string[]) => void;
  /** Compact mode uses smaller text/padding (for admin table headers). */
  compact?: boolean;
}

export function GenreDropdown({
  selected,
  onChange,
  compact = false,
}: GenreDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggle = (genre: string) => {
    onChange(
      selected.includes(genre)
        ? selected.filter((g) => g !== genre)
        : [...selected, genre]
    );
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-lg ring-1 ring-inset ring-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 transition-colors ${
          compact
            ? 'px-2.5 py-1 text-xs'
            : 'px-3 py-2 text-sm'
        }`}
      >
        <span>
          {selected.length > 0
            ? `Genres (${selected.length})`
            : 'Filter by genre'}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-gray-400 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 z-30 mt-1 w-64 rounded-lg border border-gray-200 bg-white shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Genres
            </span>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Options list */}
          <ul className="max-h-60 overflow-y-auto py-1">
            {GENRES.map((genre) => {
              const checked = selected.includes(genre);
              return (
                <li key={genre}>
                  <button
                    type="button"
                    onClick={() => toggle(genre)}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        checked
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-gray-300'
                      }`}
                    >
                      {checked && (
                        <svg
                          className="h-3 w-3"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M2.5 6l2.5 2.5 4.5-5" />
                        </svg>
                      )}
                    </span>
                    {genre}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Selected genre tags */}
      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((genre) => (
            <span
              key={genre}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
            >
              {genre}
              <button
                type="button"
                onClick={() => toggle(genre)}
                className="rounded-full p-0.5 hover:bg-indigo-100 transition-colors"
                aria-label={`Remove ${genre}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
