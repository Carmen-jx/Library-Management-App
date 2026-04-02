import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase/server';
import { notifyAdminsServer } from '@/lib/server/notifications';
import { TICKET_THREAD_SELECT, normalizeTicket } from '@/lib/tickets';

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
    const ticketId = typeof body.ticketId === 'string' ? body.ticketId.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (!ticketId || !message) {
      return NextResponse.json(
        { error: 'Ticket ID and message are required.' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const { data: ticket, error: ticketError } = await adminClient
      .from('tickets')
      .select('id, user_id, subject, status')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json(
        { error: 'Ticket not found.' },
        { status: 404 }
      );
    }

    if (ticket.user_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not have access to this ticket.' },
        { status: 403 }
      );
    }

    const { error: replyError } = await adminClient.from('ticket_messages').insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      sender_role: 'user',
      message,
    });

    if (replyError) {
      console.error('Failed to save ticket reply:', replyError);
      return NextResponse.json(
        { error: 'Failed to save reply.' },
        { status: 500 }
      );
    }

    const nextStatus = ticket.status === 'resolved' ? 'open' : ticket.status;
    const { data: updatedTicket, error: updateError } = await adminClient
      .from('tickets')
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket.id)
      .select(TICKET_THREAD_SELECT)
      .single();

    if (updateError || !updatedTicket) {
      console.error('Failed to refresh ticket thread after reply:', updateError);
      return NextResponse.json(
        { error: 'Failed to refresh ticket.' },
        { status: 500 }
      );
    }

    try {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();

      await notifyAdminsServer(
        user.id,
        'ticket_updated',
        `Ticket Reply: ${ticket.subject}`,
        `${profile?.name ?? 'A user'} replied to a support ticket.`,
        `/admin/tickets?ticketId=${ticket.id}`
      );
    } catch (notifyError) {
      console.error('Failed to notify admins about ticket reply:', notifyError);
    }

    return NextResponse.json({ ticket: normalizeTicket(updatedTicket) });
  } catch (error) {
    console.error('Ticket reply API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
