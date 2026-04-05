'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, Search, Loader2, BookOpen, X, CheckCircle, AlertCircle, ArrowLeft, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useSidebarStore } from '@/components/layout/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { createClient } from '@/lib/supabase/client';
import { NotificationDropdown } from '@/components/layout/notification-dropdown';
import type { Book } from '@/types';

// --- Page Title Mapping ---

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/books': 'Browse Books',
  '/discover': 'Discover',
  '/favorites': 'Favorites',
  '/history': 'Borrowing History',
  '/messages': 'Messages',
  '/profile': 'Profile',
  '/tickets': 'Support',
  '/admin/users': 'Manage Users',
  '/admin/books': 'Manage Books',
  '/admin/analytics': 'Analytics',
  '/admin/tickets': 'Support Tickets',
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];

  const segments = pathname.split('/').filter(Boolean);
  while (segments.length > 0) {
    const candidate = '/' + segments.join('/');
    if (pageTitles[candidate]) return pageTitles[candidate];
    segments.pop();
  }

  return 'Dashboard';
}

// --- Types ---

interface AISearchResult {
  id: string;
  title: string;
  authors: string[];
  description: string | null;
  coverImage: string | null;
  categories: string[];
  relevanceScore: number;
  relevanceReason: string;
  pageCount: number | null;
  averageRating: number | null;
  source?: 'local' | 'open-library';
  openLibraryKey?: string;
}

// --- Header Component ---

export function Header() {
  const pathname = usePathname();
  const { profile, user } = useAuth();
  const toggle = useSidebarStore((s) => s.toggle);

  const title = getPageTitle(pathname);

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchMode, setSearchMode] = useState<'basic' | 'ai'>('basic');
  const [nlQuery, setNlQuery] = useState('');
  const [nlResults, setNlResults] = useState<AISearchResult[]>([]);
  const [nlLoading, setNlLoading] = useState(false);
  const [nlError, setNlError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Book detail modal state
  const [selectedResult, setSelectedResult] = useState<AISearchResult | null>(null);
  const [libraryMatch, setLibraryMatch] = useState<Book | null>(null);
  const [checkingLibrary, setCheckingLibrary] = useState(false);
  const [requestingBook, setRequestingBook] = useState(false);
  const [bookRequested, setBookRequested] = useState(false);

  // Feedback state (AI search mode only)
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, boolean | null>>({});

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click (skip when book detail modal is open)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectedResult) return;
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    if (searchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchOpen, selectedResult]);

  // Close on Escape (close modal first, then dropdown)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedResult) {
          setSelectedResult(null);
        } else {
          setSearchOpen(false);
        }
      }
    };
    if (searchOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [searchOpen, selectedResult]);

  // Close on route change
  useEffect(() => {
    setSearchOpen(false);
  }, [pathname]);

  // Focus input when dropdown opens
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [searchOpen]);

  const handleSearch = async () => {
    if (!nlQuery.trim()) return;

    if (searchMode === 'basic') {
      return handleBasicSearch();
    }

    setNlLoading(true);
    setNlError(null);
    setHasSearched(true);
    try {
      const response = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: nlQuery.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Search failed');
      }

      const data = await response.json();
      setNlResults(data.results ?? []);
    } catch (err) {
      console.error('AI search failed:', err);
      setNlError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setNlLoading(false);
    }
  };

  const handleBasicSearch = async () => {
    if (!nlQuery.trim()) return;

    setNlLoading(true);
    setNlError(null);
    setHasSearched(true);
    try {
      const q = nlQuery.trim();
      const supabase = createClient();

      // Search local library and Open Library in parallel
      const [localSettled, olSettled] = await Promise.allSettled([
        supabase
          .from('books')
          .select('*')
          .or(`title.ilike.%${q}%,author.ilike.%${q}%`)
          .order('title')
          .limit(20),
        fetch(`/api/search/open-library?q=${encodeURIComponent(q)}&limit=10`)
          .then((res) => (res.ok ? res.json() : { results: [] })),
      ]);

      // Map local results
      const localBooks: Book[] =
        localSettled.status === 'fulfilled' && !localSettled.value.error
          ? (localSettled.value.data as Book[])
          : [];

      const localMapped: AISearchResult[] = localBooks.map((book) => ({
        id: book.id,
        title: book.title,
        authors: [book.author],
        description: book.description ?? null,
        coverImage: book.cover_url ?? null,
        categories: book.genre ?? [],
        relevanceScore: 1,
        relevanceReason: 'Available in library',
        pageCount: (book.metadata?.pageCount as number) ?? null,
        averageRating: null,
        source: 'local' as const,
        openLibraryKey: book.open_library_key ?? undefined,
      }));

      // Extract Open Library results
      const olResults: AISearchResult[] =
        olSettled.status === 'fulfilled'
          ? (olSettled.value.results ?? [])
          : [];

      // Deduplicate: remove OL results already in local library
      const localKeys = new Set(
        localMapped
          .map((r) => r.openLibraryKey)
          .filter((k): k is string => Boolean(k)),
      );
      const localTitles = new Set(
        localMapped.map((r) => r.title.toLowerCase().trim()),
      );

      const filteredOl = olResults.filter((r) => {
        if (r.openLibraryKey && localKeys.has(r.openLibraryKey)) return false;
        if (localTitles.has(r.title.toLowerCase().trim())) return false;
        return true;
      });

      // Merge: local first, then Open Library
      setNlResults([...localMapped, ...filteredOl]);
    } catch (err) {
      console.error('Basic search failed:', err);
      setNlError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setNlLoading(false);
    }
  };

  const handleSwitchMode = (mode: 'basic' | 'ai') => {
    setSearchMode(mode);
    setNlResults([]);
    setNlError(null);
    setHasSearched(false);
  };

  const handleToggleSearch = () => {
    setSearchOpen((prev) => !prev);
  };

  const handleSelectResult = async (result: AISearchResult) => {
    setSelectedResult(result);
    setLibraryMatch(null);
    setCheckingLibrary(true);
    setBookRequested(false);

    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('books')
        .select('*')
        .ilike('title', result.title)
        .limit(1)
        .maybeSingle();

      setLibraryMatch(data as Book | null);
    } catch {
      setLibraryMatch(null);
    } finally {
      setCheckingLibrary(false);
    }
  };

  const handleRequestBook = async () => {
    if (!user || !selectedResult) return;

    setRequestingBook(true);
    try {
      const response = await fetch('/api/tickets/request-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: `Book Request: ${selectedResult.title}`,
          message: `I would like to request the following book to be added to the library:\n\nTitle: ${selectedResult.title}\nAuthor: ${selectedResult.authors.join(', ') || 'Unknown'}\nCategories: ${selectedResult.categories.join(', ') || 'N/A'}`,
          priority: 'medium',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit request.');
      }

      setBookRequested(true);
      toast.success('Book request submitted!');
    } catch {
      toast.error('Failed to submit request.');
    } finally {
      setRequestingBook(false);
    }
  };

  const handleFeedback = async (bookId: string, isRelevant: boolean) => {
    if (!nlQuery.trim()) return;

    setFeedbackGiven((prev) => ({ ...prev, [bookId]: isRelevant }));

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: nlQuery.trim(),
          bookId,
          isRelevant,
        }),
      });

      if (!response.ok) {
        setFeedbackGiven((prev) => ({ ...prev, [bookId]: null }));
        toast.error('Failed to submit feedback.');
        return;
      }

      // Re-fetch search results so scores reflect the new feedback
      try {
        const searchResponse = await fetch('/api/ai/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: nlQuery.trim() }),
        });

        if (searchResponse.ok) {
          const data = await searchResponse.json();
          const updatedResults: AISearchResult[] = data.results ?? [];
          setNlResults(updatedResults);

          // Update the selected result's score if the modal is still open
          if (selectedResult) {
            const updated = updatedResults.find((r: AISearchResult) => r.id === selectedResult.id);
            if (updated) {
              setSelectedResult(updated);
            }
          }
        }
      } catch {
        // Non-critical: feedback was saved, just couldn't refresh scores
      }
    } catch {
      setFeedbackGiven((prev) => ({ ...prev, [bookId]: null }));
      toast.error('Failed to submit feedback.');
    }
  };

  return (
    <>
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-4 sm:px-6">
      {/* Hamburger (mobile only) */}
      <button
        type="button"
        onClick={toggle}
        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 lg:hidden"
        aria-label="Open sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Search Button + Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={handleToggleSearch}
            className={`rounded-lg p-2 transition-colors ${
              searchOpen
                ? 'bg-indigo-50 text-indigo-600'
                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
            }`}
            aria-label="Search"
          >
            {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </button>

          {/* Search Dropdown */}
          {searchOpen && (
            <div className="absolute right-0 top-full mt-2 w-[min(600px,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white shadow-xl">
              {/* Header + Mode Toggle */}
              <div className="border-b border-gray-100 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Search className="h-4 w-4 text-indigo-600" />
                    {searchMode === 'basic' ? 'Library Search' : 'AI Search'}
                  </h3>
                  <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('basic')}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        searchMode === 'basic'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Library
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('ai')}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        searchMode === 'ai'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      AI Search
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {searchMode === 'basic'
                    ? 'Search our library and Open Library by title or author.'
                    : "Describe what you're looking for in your own words and let AI find the best matches."}
                </p>
              </div>

              {/* Input */}
              <div className="flex gap-2 border-b border-gray-100 px-5 py-3">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={searchMode === 'basic' ? 'Search by title or author...' : 'e.g., A dark fantasy book with a strong female lead'}
                  value={nlQuery}
                  onChange={(e) => setNlQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !nlLoading) handleSearch();
                  }}
                  className="flex-1 rounded-lg border-0 px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
                />
                <button
                  onClick={handleSearch}
                  disabled={nlLoading || !nlQuery.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {nlLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="hidden sm:inline">Searching...</span>
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      <span className="hidden sm:inline">Search</span>
                    </>
                  )}
                </button>
              </div>

              {/* Results Area */}
              <div className="max-h-[60vh] overflow-y-auto">
                {/* Error */}
                {nlError && (
                  <div className="px-5 py-3">
                    <Card className="border-red-200 bg-red-50 p-3">
                      <p className="text-sm text-red-700">{nlError}</p>
                    </Card>
                  </div>
                )}

                {/* Loading */}
                {nlLoading && (
                  <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex gap-3 rounded-lg border border-gray-100 p-3">
                        <Skeleton className="h-28 w-20 flex-shrink-0 rounded-md" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Results */}
                {!nlLoading && nlResults.length > 0 && (
                  <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
                    {nlResults.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => handleSelectResult(result)}
                        className="flex gap-3 rounded-lg border border-gray-100 p-3 hover:border-indigo-200 hover:shadow-sm transition-all text-left"
                      >
                        {result.coverImage ? (
                          <div className="relative h-28 w-20 flex-shrink-0 overflow-hidden rounded-md bg-gray-100">
                            <Image
                              src={result.coverImage}
                              alt={`Cover of ${result.title}`}
                              fill
                              className="object-cover"
                              sizes="80px"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="flex h-28 w-20 flex-shrink-0 items-center justify-center rounded-md bg-gray-100">
                            <BookOpen className="h-6 w-6 text-gray-300" />
                          </div>
                        )}
                        <div className="flex flex-1 flex-col min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-semibold leading-tight line-clamp-2 text-gray-900">
                              {result.title}
                            </h4>
                            {result.source === 'open-library' && (
                              <span className="inline-flex flex-shrink-0 items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                                Open Library
                              </span>
                            )}
                            {searchMode === 'ai' && (
                              <span className="inline-flex flex-shrink-0 items-center rounded-full bg-green-50 px-1.5 py-0.5 text-xs font-semibold text-green-700">
                                {Math.round(result.relevanceScore * 100)}%
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            by {result.authors.join(', ') || 'Unknown'}
                          </p>
                          {result.categories.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {result.categories.slice(0, 2).map((cat) => (
                                <span
                                  key={cat}
                                  className="inline-flex items-center rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700"
                                >
                                  {cat}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                            {result.relevanceReason}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Empty state */}
                {!nlLoading && !nlError && hasSearched && nlResults.length === 0 && (
                  <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
                    <BookOpen className="h-10 w-10 text-gray-300" />
                    <p className="mt-3 text-sm font-medium text-gray-900">No results found</p>
                    <p className="mt-1 text-xs text-gray-500">Try a different description.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <NotificationDropdown />

        {/* User Avatar */}
        <Avatar
          src={profile?.avatar_url}
          name={profile?.name}
          size="sm"
        />
      </div>
    </header>

    {/* Book Detail Modal — closing returns to search results */}
    <Modal
      open={!!selectedResult}
      onClose={() => setSelectedResult(null)}
      title="Book Details"
      size="lg"
    >
      {selectedResult && (
        <div className="space-y-5">
          {/* Back to results */}
          <button
            type="button"
            onClick={() => setSelectedResult(null)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to search results
          </button>

          {/* Book Info */}
          <div className="flex gap-4">
            {selectedResult.coverImage ? (
              <div className="relative h-40 w-28 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                <Image
                  src={selectedResult.coverImage}
                  alt={selectedResult.title}
                  fill
                  className="object-cover"
                  sizes="112px"
                  unoptimized
                />
              </div>
            ) : (
              <div className="flex h-40 w-28 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
                <BookOpen className="h-8 w-8 text-gray-300" />
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <h3 className="text-lg font-bold text-gray-900">{selectedResult.title}</h3>
              <p className="text-sm text-gray-500">
                by {selectedResult.authors.join(', ') || 'Unknown'}
              </p>
              {selectedResult.categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedResult.categories.map((cat) => (
                    <Badge key={cat}>{cat}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Match score */}
          {searchMode === 'ai' && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Relevance Score</span>
                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-semibold text-green-800">
                  {Math.round(selectedResult.relevanceScore * 100)}%
                </span>
              </div>
            </div>
          )}

          {/* Search Feedback (AI mode only, requires library match for valid book_id) */}
          {searchMode === 'ai' && !checkingLibrary && libraryMatch && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-700">Was this result relevant to your search?</p>
              {feedbackGiven[libraryMatch.id] != null ? (
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Thanks for your feedback!
                </div>
              ) : (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleFeedback(libraryMatch.id, true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-green-300 hover:bg-green-50 hover:text-green-700 transition-colors"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    Relevant
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFeedback(libraryMatch.id, false)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-red-300 hover:bg-red-50 hover:text-red-700 transition-colors"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                    Not Relevant
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Library Availability */}
          <div className="rounded-lg border border-gray-200 p-4">
            {checkingLibrary ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking library availability...
              </div>
            ) : libraryMatch ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                  <CheckCircle className="h-4 w-4" />
                  Available in our library
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant={libraryMatch.available ? 'success' : 'danger'}>
                    {libraryMatch.available ? 'Available to Borrow' : 'Currently Borrowed'}
                  </Badge>
                  <Link
                    href={`/books/${libraryMatch.id}`}
                    onClick={() => setSelectedResult(null)}
                  >
                    <Button variant="primary" size="sm">
                      View in Library
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
                  <AlertCircle className="h-4 w-4" />
                  Not currently in our library
                </div>
                {bookRequested ? (
                  <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    Request submitted! An admin will review it.
                  </div>
                ) : user ? (
                  <Button
                    variant="primary"
                    size="sm"
                    loading={requestingBook}
                    onClick={handleRequestBook}
                  >
                    Request this Book
                  </Button>
                ) : (
                  <p className="text-xs text-gray-500">Log in to request this book.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
    </>
  );
}
