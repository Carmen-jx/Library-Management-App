'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  BookOpen,
  Pencil,
  Trash2,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GenreBadges } from '@/components/ui/genre-badges';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { createClient } from '@/lib/supabase/client';
import { GENRES, getPrimaryGenre, normalizeGenres } from '@/lib/utils';
import type { Book, OpenLibraryWork, OpenLibrarySearchResponse } from '@/types';

// --- Loading Skeleton ---

function AdminBooksSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-64" />
      </div>
      <Card>
        <div className="border-b border-gray-200 px-6 py-4">
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="divide-y divide-gray-100">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <Skeleton variant="rectangular" className="h-16 w-11 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// --- Admin Books Page ---

export default function AdminBooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Delete confirmation
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingBook, setDeletingBook] = useState<Book | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Library filter
  const [libraryFilter, setLibraryFilter] = useState('');
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  // Open Library search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OpenLibraryWork[]>([]);
  const [searching, setSearching] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);

  // Fetch library books (server-side pagination + filtering)
  useEffect(() => {
    const fetchBooks = async () => {
      setLoading(true);
      const supabase = createClient();
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('books')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (libraryFilter.trim()) {
        query = query.or(
          `title.ilike.%${libraryFilter}%,author.ilike.%${libraryFilter}%`
        );
      }

      if (genreFilter) {
        query = query.contains('genre', [genreFilter]);
      }

      const { data, count, error } = await query;

      if (error) {
        toast.error('Failed to load books.');
      } else {
        setBooks((data as Book[]) ?? []);
        setTotalCount(count ?? 0);
      }
      setLoading(false);
    };

    fetchBooks();
  }, [currentPage, libraryFilter, genreFilter]);

  // --- Edit Handlers ---

  // --- Delete Handlers ---

  const openDeleteModal = (book: Book) => {
    setDeletingBook(book);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingBook) return;

    setDeleting(true);
    const supabase = createClient();

    const { error } = await supabase
      .from('books')
      .delete()
      .eq('id', deletingBook.id);

    if (error) {
      toast.error('Failed to delete book.');
    } else {
      setBooks((prev) => prev.filter((b) => b.id !== deletingBook.id));
      toast.success('Book deleted successfully.');
      setDeleteModalOpen(false);
    }

    setDeleting(false);
  };

  // --- Open Library Handlers ---

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchResults([]);

    try {
      const res = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(
          searchQuery
        )}&limit=20`
      );
      const data: OpenLibrarySearchResponse = await res.json();
      setSearchResults(data.docs || []);

      if (!data.docs?.length) {
        toast.info('No results found on Open Library.');
      }
    } catch {
      toast.error('Failed to search Open Library.');
    }

    setSearching(false);
  };

  const handleImport = async (work: OpenLibraryWork) => {
    setImportingId(work.key);

    const newBook = {
      open_library_key: work.key,
      title: work.title,
      author: work.author_name?.join(', ') || 'Unknown Author',
      genre: normalizeGenres(work.subject),
      description: null,
      cover_url: work.cover_i
        ? `https://covers.openlibrary.org/b/id/${work.cover_i}-M.jpg`
        : null,
      available: true,
      metadata: {
        first_publish_year: work.first_publish_year,
        pageCount: work.number_of_pages_median,
        publisher: work.publisher?.[0],
        isbn: work.isbn?.[0],
        language: work.language,
      },
    };

    try {
      const response = await fetch('/api/admin/books/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBook),
      });

      if (!response.ok) {
        throw new Error('Failed to import book.');
      }

      const { book } = await response.json();
      setBooks((prev) => {
        const remaining = prev.filter((existingBook) => existingBook.id !== book.id);
        return [book as Book, ...remaining];
      });
      toast.success(`Imported "${work.title}" successfully.`);
    } catch {
      toast.error('Failed to import book.');
    }

    setImportingId(null);
  };

  // Pagination (server-side)
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [libraryFilter, genreFilter]);

  if (loading) {
    return <AdminBooksSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Manage Books</h2>
        <p className="mt-1 text-gray-500">
          {totalCount} books in the library. Edit, delete, or import new books.
        </p>
      </div>

      {/* Library Books Table */}
      <Card>
        <Card.Header>
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-base font-semibold text-gray-900">
                Library Books
              </h3>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={libraryFilter}
                  onChange={(e) => setLibraryFilter(e.target.value)}
                  placeholder="Search library books..."
                  className="block w-full rounded-lg border-0 py-1.5 pl-10 pr-3.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>
            {/* Genre Filter Chips */}
            <div className="flex flex-wrap gap-1.5">
              {genreFilter && (
                <button
                  type="button"
                  onClick={() => setGenreFilter(null)}
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-200 transition-colors"
                >
                  {genreFilter}
                  <X className="h-3 w-3" />
                </button>
              )}
              {GENRES.filter((g) => g !== genreFilter).map((genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => setGenreFilter(genre)}
                  className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>
        </Card.Header>

        {books.length === 0 ? (
          <Card.Body>
            <div className="flex flex-col items-center py-8 text-center">
              <BookOpen className="h-12 w-12 text-gray-300" />
              <p className="mt-4 text-sm text-gray-500">
                No books in the library yet. Import some from Open Library below.
              </p>
            </div>
          </Card.Body>
        ) : (
          <>
            <table className="w-full table-fixed divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-[45%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Book
                  </th>
                  <th className="w-[25%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Genre
                  </th>
                  <th className="w-[12%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="w-[18%] px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {books.map((book) => (
                  <tr key={book.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <Link
                        href={`/books/${book.id}`}
                        className="flex items-center gap-3 overflow-hidden"
                      >
                        <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-gray-100">
                          {book.cover_url ? (
                            <Image
                              src={book.cover_url}
                              alt={book.title}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <BookOpen className="h-4 w-4 text-gray-300" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900 hover:text-indigo-600">
                            {book.title}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {book.author}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        <GenreBadges genres={book.genre} maxVisible={2} />
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={book.available ? 'success' : 'danger'}>
                        {book.available ? 'Available' : 'Borrowed'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/books/${book.id}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => openDeleteModal(book)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          aria-label={`Delete ${book.title}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Footer */}
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount} books
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-2 text-xs font-medium text-gray-700">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </Card>

      {/* Open Library Import */}
      <Card>
        <Card.Header>
          <h3 className="text-base font-semibold text-gray-900">
            Import from Open Library
          </h3>
        </Card.Header>
        <Card.Body>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search Open Library..."
                className="block w-full rounded-lg border-0 py-2 pl-10 pr-3.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              />
            </div>
            <Button
              variant="primary"
              onClick={handleSearch}
              loading={searching}
            >
              Search
            </Button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Book
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Category
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {searchResults.map((work) => {
                    const coverUrl = work.cover_i
                      ? `https://covers.openlibrary.org/b/id/${work.cover_i}-S.jpg`
                      : null;
                    return (
                      <tr key={work.key} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-gray-100">
                              {coverUrl ? (
                                <Image
                                  src={coverUrl}
                                  alt={work.title}
                                  fill
                                  className="object-cover"
                                  sizes="40px"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center">
                                  <BookOpen className="h-4 w-4 text-gray-300" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900">
                                {work.title}
                              </p>
                              <p className="text-xs text-gray-500">
                                {work.author_name?.join(', ') || 'Unknown Author'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span className="text-sm text-gray-600">
                            {getPrimaryGenre(work.subject) || 'N/A'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={importingId === work.key}
                            onClick={() => handleImport(work)}
                          >
                            <Download className="h-3.5 w-3.5" />
                            Import
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Book"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-gray-900">
              {deletingBook?.title}
            </span>
            ? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              onClick={handleDelete}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
