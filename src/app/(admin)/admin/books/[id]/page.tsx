'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  Trash2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { GenreBadges } from '@/components/ui/genre-badges';
import { toast } from '@/components/ui/toast';
import { createClient } from '@/lib/supabase/client';
import { GENRES, normalizeGenres } from '@/lib/utils';
import type { Book } from '@/types';

interface EditFormState {
  title: string;
  author: string;
  genres: string;
  description: string;
  cover_url: string;
  available: boolean;
}

function AdminBookEditorSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-32" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
        <Card className="overflow-hidden">
          <Skeleton variant="rectangular" className="aspect-[2/3] w-full" />
        </Card>
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-5 w-48" />
          </div>
          <Card padding="md">
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function AdminBookEditorPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;

  const [book, setBook] = useState<Book | null>(null);
  const [form, setForm] = useState<EditFormState>({
    title: '',
    author: '',
    genres: '',
    description: '',
    cover_url: '',
    available: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchBook = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('id', bookId)
        .single();

      if (error || !data) {
        toast.error('Book not found.');
        router.push('/admin/books');
        return;
      }

      const nextBook = data as Book;
      setBook(nextBook);
      setForm({
        title: nextBook.title,
        author: nextBook.author,
        genres: nextBook.genre.join(', '),
        description: nextBook.description || '',
        cover_url: nextBook.cover_url || '',
        available: nextBook.available,
      });
      setLoading(false);
    };

    fetchBook();
  }, [bookId, router]);

  const handleSave = async () => {
    if (!book) return;

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      author: form.author.trim(),
      genre: normalizeGenres(form.genres),
      description: form.description.trim() || null,
      cover_url: form.cover_url.trim() || null,
      available: form.available,
    };

    const response = await fetch(`/api/admin/books/${book.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      toast.error('Failed to save book changes.');
      setSaving(false);
      return;
    }

    const { book: updatedBook } = await response.json();
    setBook(updatedBook);
    setForm({
      title: updatedBook.title,
      author: updatedBook.author,
      genres: updatedBook.genre.join(', '),
      description: updatedBook.description || '',
      cover_url: updatedBook.cover_url || '',
      available: updatedBook.available,
    });
    toast.success('Book updated in Supabase.');
    setSaving(false);
    router.push(`/books/${book.id}`);
  };

  const handleDelete = async () => {
    if (!book) return;

    setDeleting(true);
    const response = await fetch(`/api/admin/books/${book.id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      toast.error('Failed to delete book.');
      setDeleting(false);
      return;
    }

    toast.success('Book deleted from Supabase.');
    router.push('/admin/books');
    router.refresh();
  };

  if (loading) {
    return <AdminBookEditorSkeleton />;
  }

  if (!book) {
    return null;
  }

  const metadata = book.metadata as Record<string, unknown> | null;
  const parsedGenres = normalizeGenres(form.genres);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/books"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Manage Books
      </Link>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="relative aspect-[2/3] w-full bg-gray-100">
              {form.cover_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={form.cover_url}
                  alt={form.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <BookOpen className="h-16 w-16 text-gray-300" />
                </div>
              )}
            </div>
          </Card>

          <Card padding="md">
            <div className="space-y-3 text-sm text-gray-600">
              <div>
                <p className="font-medium text-gray-900">Book ID</p>
                <p className="break-all">{book.id}</p>
              </div>
              {book.open_library_key && (
                <div>
                  <p className="font-medium text-gray-900">Open Library Key</p>
                  <p className="break-all">{book.open_library_key}</p>
                </div>
              )}
              <div>
                <p className="font-medium text-gray-900">Created</p>
                <p>{new Date(book.created_at).toLocaleString()}</p>
              </div>
              {metadata && (
                <div>
                  <p className="font-medium text-gray-900">Metadata</p>
                  <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                    {JSON.stringify(metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Open Editor</h1>
            <p className="mt-1 text-sm text-gray-500">
              Changes here update the matching row in the Supabase `books` table.
            </p>
          </div>

          <Card padding="md">
            <div className="space-y-4">
              <Input
                label="Title"
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
              />
              <Input
                label="Author"
                value={form.author}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, author: e.target.value }))
                }
              />
              <Input
                label="Genres"
                value={form.genres}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, genres: e.target.value }))
                }
                placeholder={GENRES.join(', ')}
              />
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Parsed Genres</p>
                <div className="flex flex-wrap gap-2">
                  <GenreBadges genres={parsedGenres} maxVisible={6} />
                </div>
              </div>
              <Textarea
                label="Description"
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={6}
              />
              <Input
                label="Cover URL"
                value={form.cover_url}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, cover_url: e.target.value }))
                }
              />
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={form.available}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, available: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                />
                Available for borrowing
              </label>
            </div>
          </Card>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="danger"
              onClick={() => setDeleteModalOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete Book
            </Button>

            <div className="flex gap-3">
              <Link
                href="/admin/books"
                className="inline-flex items-center justify-center rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-gray-900 ring-1 ring-inset ring-gray-300 transition-colors hover:bg-gray-50"
              >
                Cancel
              </Link>
              <Button loading={saving} onClick={handleSave}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Book"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Delete <span className="font-semibold text-gray-900">{book.title}</span> from the
            Supabase `books` table? This cannot be undone.
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
              Delete Book
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
