import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { notifyAdminsServer } from '@/lib/server/notifications';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { subject, message, priority = 'low' } = body;

    if (!subject || !message) {
      return NextResponse.json(
        { error: 'Subject and message are required.' },
        { status: 400 }
      );
    }

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        user_id: user.id,
        subject: subject.trim(),
        message: message.trim(),
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

    try {
      const adminClient = createAdminClient();
      const { data: profile } = await adminClient
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();

      await notifyAdminsServer(
        user.id,
        'ticket_created',
        `New Ticket: ${ticket.subject}`,
        `${profile?.name ?? 'A user'} submitted a support ticket.`,
        `/admin/tickets?ticketId=${ticket.id}`
      );
    } catch (notifyError) {
      console.error('Failed to notify admins for ticket creation:', notifyError);
    }

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error('Ticket create API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
