import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { createNotificationServer } from '@/lib/server/notifications';

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
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { ticketId, status, admin_response } = body;

    if (!ticketId) {
      return NextResponse.json(
        { error: 'Ticket ID is required.' },
        { status: 400 }
      );
    }

    // Update the ticket using admin client (bypasses RLS)
    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (admin_response !== undefined) updates.admin_response = admin_response;

    const { data: ticket, error: updateError } = await adminClient
      .from('tickets')
      .update(updates)
      .eq('id', ticketId)
      .select('*, profile:profiles(*)')
      .single();

    if (updateError) {
      console.error('Failed to update ticket:', updateError);
      return NextResponse.json(
        { error: 'Failed to update ticket.' },
        { status: 500 }
      );
    }

    // Notify the ticket owner about the update
    if (ticket.user_id) {
      const statusLabel = (status ?? ticket.status).replace('_', ' ');
      const message = admin_response
        ? `Your ticket is now "${statusLabel}" and has a new admin response.`
        : `Your ticket has been updated to "${statusLabel}".`;

      try {
        await createNotificationServer(
          user.id,
          ticket.user_id,
          'ticket_updated',
          `Ticket Updated: ${ticket.subject}`,
          message,
          `/tickets?ticketId=${ticket.id}`
        );
      } catch (notifyError) {
        console.error('Failed to notify user:', notifyError);
        // Ticket was still updated successfully, so return success
      }
    }

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error('Ticket update API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
