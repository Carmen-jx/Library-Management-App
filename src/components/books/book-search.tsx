'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, GENRES } from '@/lib/utils';

interface BookSearchFilters {
  genres?: string[];
  available?: boolean;
}

interface BookSearchProps {
  onSearch: (query: string) => void;
  onFilterChange?: (filters: BookSearchFilters) => void;
  placeholder?: string;
}

export function BookSearch({
  onSearch,
  onFilterChange,
  placeholder = 'Search by title or author...',
}: BookSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [availableOnly, setAvailableOnly] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      onSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, onSearch]);

  const handleGenreToggle = (genre: string) => {
    setSelectedGenres((prev) => {
      const next = prev.includes(genre)
        ? prev.filter((g) => g !== genre)
        : [...prev, genre];

      onFilterChange?.({
        genres: next.length > 0 ? next : undefined,
        available: availableOnly || undefined,
      });

      return next;
    });
  };

  const handleAvailableToggle = () => {
    const next = !availableOnly;
    setAvailableOnly(next);
    onFilterChange?.({
      genres: selectedGenres.length > 0 ? selectedGenres : undefined,
      available: next || undefined,
    });
  };

  const handleClear = () => {
    setQuery('');
    setSelectedGenres([]);
    setAvailableOnly(false);
    onSearch('');
    onFilterChange?.({});
  };

  const hasFilters = query || selectedGenres.length > 0 || availableOnly;

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="block w-full rounded-lg border-0 py-2 pl-10 pr-3.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={availableOnly ? 'primary' : 'secondary'}
          size="md"
          onClick={handleAvailableToggle}
        >
          Available
        </Button>

        {hasFilters && (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-gray-500 transition-colors hover:text-gray-700"
            aria-label="Clear filters"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}
      </div>

      {/* Genre Filter */}
      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">Genres</p>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => handleGenreToggle(genre)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                selectedGenres.includes(genre)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
