import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { createNotificationServer } from '@/lib/server/notifications';
import { TICKET_THREAD_SELECT, normalizeTicket } from '@/lib/tickets';

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();

    // Authenticate the user and verify they are an admin
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

    const adminClient = createAdminClient();

    const { data: profile } = await adminClient
      .from('profiles')
      .select('role, name')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { ticketId, status, admin_response, message, assigned_to } = body;
    const replyMessage =
      typeof message === 'string'
        ? message.trim()
        : typeof admin_response === 'string'
          ? admin_response.trim()
          : '';

    if (!ticketId) {
      return NextResponse.json(
        { error: 'Ticket ID is required.' },
        { status: 400 }
      );
    }

    // Update the ticket using admin client (bypasses RLS)
    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to;
    if (replyMessage) {
      updates.admin_response = replyMessage;
    } else if (admin_response === null) {
      updates.admin_response = null;
    }

    const { data: existingTicket, error: existingTicketError } = await adminClient
      .from('tickets')
      .select('id, user_id, subject, status, assigned_to')
      .eq('id', ticketId)
      .single();

    if (existingTicketError || !existingTicket) {
      return NextResponse.json(
        { error: 'Ticket not found.' },
        { status: 404 }
      );
    }

    if (replyMessage) {
      const { error: messageError } = await adminClient.from('ticket_messages').insert({
        ticket_id: ticketId,
        sender_id: user.id,
        sender_role: 'admin',
        message: replyMessage,
      });

      if (messageError) {
        console.error('Failed to create ticket reply:', messageError);
        return NextResponse.json(
          { error: 'Failed to save ticket reply.' },
          { status: 500 }
        );
      }
    }

    const { data: ticket, error: updateError } = await adminClient
      .from('tickets')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .select(TICKET_THREAD_SELECT)
      .single();

    if (updateError) {
      console.error('Failed to update ticket:', updateError);
      return NextResponse.json(
        { error: 'Failed to update ticket.' },
        { status: 500 }
      );
    }

    // Notify the ticket owner about the update (only for status/reply changes)
    if (ticket.user_id && (status !== undefined || replyMessage)) {
      const nextStatus = (status ?? existingTicket.status).replace('_', ' ');
      const notificationMessage = replyMessage
        ? `Your ticket is now "${nextStatus}" and has a new support reply.`
        : `Your ticket has been updated to "${nextStatus}".`;

      try {
        await createNotificationServer(
          user.id,
          ticket.user_id,
          'ticket_updated',
          `Ticket Updated: ${ticket.subject}`,
          notificationMessage,
          `/tickets?ticketId=${ticket.id}`
        );
      } catch (notifyError) {
        console.error('Failed to notify user:', notifyError);
      }
    }

    // Notify the newly assigned admin (if assignment changed and it's not self-assignment)
    if (
      assigned_to !== undefined &&
      assigned_to !== existingTicket.assigned_to &&
      assigned_to !== null &&
      assigned_to !== user.id
    ) {
      try {
        await createNotificationServer(
          user.id,
          assigned_to,
          'ticket_assigned',
          `Ticket Assigned: ${ticket.subject}`,
          `${profile.name ?? 'An admin'} assigned you a support ticket.`,
          `/admin/tickets?ticketId=${ticket.id}`
        );
      } catch (notifyError) {
        console.error('Failed to notify assigned admin:', notifyError);
      }
    }

    return NextResponse.json({ ticket: normalizeTicket(ticket) });
  } catch (error) {
    console.error('Ticket update API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
