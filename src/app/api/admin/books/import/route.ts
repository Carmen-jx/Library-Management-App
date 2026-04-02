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

export async function POST(request: NextRequest) {
  try {
    const access = await requireAdmin();
    if ('error' in access) {
      return access.error;
    }

    const body = await request.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const author = typeof body.author === 'string' ? body.author.trim() : '';

    if (!title || !author) {
      return NextResponse.json(
        { error: 'Title and author are required.' },
        { status: 400 }
      );
    }

    const payload = {
      open_library_key:
        typeof body.open_library_key === 'string' && body.open_library_key.trim()
          ? body.open_library_key.trim()
          : null,
      title,
      author,
      genre: normalizeGenres(body.genre),
      description:
        typeof body.description === 'string' && body.description.trim()
          ? body.description.trim()
          : null,
      cover_url:
        typeof body.cover_url === 'string' && body.cover_url.trim()
          ? body.cover_url.trim()
          : null,
      available: typeof body.available === 'boolean' ? body.available : true,
      metadata:
        body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
          ? body.metadata
          : {},
    };

    const { data, error } = await access.adminClient
      .from('books')
      .upsert(payload, { onConflict: 'open_library_key' })
      .select('*')
      .single();

    if (error || !data) {
      console.error('Admin book import failed:', error);
      return NextResponse.json(
        { error: 'Failed to import book.' },
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
      console.error('Book imported but embedding generation failed:', embeddingError);
    }

    return NextResponse.json({ book: data });
  } catch (error) {
    console.error('Admin book import API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
