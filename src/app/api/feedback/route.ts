import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

type FeedbackRequestBody = {
  query?: unknown;
  bookId?: unknown;
  isRelevant?: unknown;
};

function normalizeFeedbackQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ');
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FeedbackRequestBody;
    const query =
      typeof body.query === 'string' ? normalizeFeedbackQuery(body.query) : '';
    const bookId = typeof body.bookId === 'string' ? body.bookId.trim() : '';
    const isRelevant =
      typeof body.isRelevant === 'boolean' ? body.isRelevant : null;

    if (!query || !bookId || isRelevant === null) {
      return NextResponse.json(
        { error: 'query, bookId, and isRelevant are required.' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient.from('book_search_feedback').insert({
      query,
      book_id: bookId,
      is_relevant: isRelevant,
    });

    if (error) {
      const status =
        error.code === '22P02' || error.code === '23503' ? 400 : 500;

      console.error('Feedback insert failed:', error.message);
      return NextResponse.json(
        { error: 'Failed to record feedback.' },
        { status }
      );
    }

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    console.error('Feedback API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
