import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { notifyAdminsServer } from '@/lib/server/notifications';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();

    // Authenticate the user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'You must be logged in to request a book.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { subject, message, priority = 'medium' } = body;

    if (!subject || !message) {
      return NextResponse.json(
        { error: 'Subject and message are required.' },
        { status: 400 }
      );
    }

    // Create the ticket using the authenticated user's client
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        user_id: user.id,
        subject,
        message,
        priority,
      })
      .select()
      .single();

    if (ticketError) {
      console.error('Failed to create ticket:', ticketError);
      return NextResponse.json(
        { error: 'Failed to create ticket.' },
        { status: 500 }
      );
    }

    // Notify admins using admin client (bypasses RLS)
    const adminClient = createAdminClient();

    // Get the requesting user's profile for the notification message
    const { data: profile } = await adminClient
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();

    try {
      await notifyAdminsServer(
        user.id,
        'ticket_created',
        subject,
        `${profile?.name ?? 'A user'} requested a book to be added to the library.`,
        `/admin/tickets?ticketId=${ticket.id}`
      );
    } catch (notifyError) {
      console.error('Failed to notify admins:', notifyError);
      // Ticket was still created successfully, so return success
    }

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error('Book request API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
