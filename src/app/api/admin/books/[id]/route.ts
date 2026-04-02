import { NextRequest, NextResponse } from 'next/server';
import { ensureBookEmbedding } from '@/lib/hybridSearch';
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase/server';
import { normalizeGenres } from '@/lib/utils';

async function requireAdmin() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) };
  }

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Admin access required.' }, { status: 403 }) };
  }

  return { adminClient };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireAdmin();
    if ('error' in access) {
      return access.error;
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || body.title.trim().length === 0) {
        return NextResponse.json(
          { error: 'Title is required.' },
          { status: 400 }
        );
      }
      updates.title = body.title.trim();
    }

    if (body.author !== undefined) {
      if (typeof body.author !== 'string' || body.author.trim().length === 0) {
        return NextResponse.json(
          { error: 'Author is required.' },
          { status: 400 }
        );
      }
      updates.author = body.author.trim();
    }

    if (body.genre !== undefined) {
      updates.genre = normalizeGenres(body.genre);
    }

    if (body.description !== undefined) {
      updates.description =
        typeof body.description === 'string' && body.description.trim()
          ? body.description.trim()
          : null;
    }

    if (body.cover_url !== undefined) {
      updates.cover_url =
        typeof body.cover_url === 'string' && body.cover_url.trim()
          ? body.cover_url.trim()
          : null;
    }

    if (body.available !== undefined) {
      updates.available = Boolean(body.available);
    }

    const { data, error } = await access.adminClient
      .from('books')
      .update(updates)
      .eq('id', params.id)
      .select('*')
      .single();

    if (error || !data) {
      console.error('Admin book update failed:', error);
      return NextResponse.json(
        { error: 'Failed to update book.' },
        { status: 500 }
      );
    }

    try {
      await ensureBookEmbedding({
        id: data.id,
        title: data.title,
        author: data.author,
        description: data.description,
        genre: data.genre,
      });
    } catch (embeddingError) {
      console.error('Book updated but embedding generation failed:', embeddingError);
    }

    return NextResponse.json({ book: data });
  } catch (error) {
    console.error('Admin book update API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireAdmin();
    if ('error' in access) {
      return access.error;
    }

    const { error } = await access.adminClient
      .from('books')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('Admin book delete failed:', error);
      return NextResponse.json(
        { error: 'Failed to delete book.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin book delete API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
