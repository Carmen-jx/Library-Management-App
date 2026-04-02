import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { notifyAdminsServer } from '@/lib/server/notifications';
import { TICKET_THREAD_SELECT, normalizeTicket } from '@/lib/tickets';

async function getAdminWithLeastTasksServer() {
  const adminClient = createAdminClient();

  const { data: admins, error: adminError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('role', 'admin');

  if (adminError) throw adminError;
  if (!admins || admins.length === 0) return null;

  const { data: tickets, error: ticketError } = await adminClient
    .from('tickets')
    .select('assigned_to')
    .neq('status', 'resolved')
    .not('assigned_to', 'is', null);

  if (ticketError) throw ticketError;

  const counts = new Map<string, number>();
  for (const ticket of tickets ?? []) {
    const id = (ticket as { assigned_to: string }).assigned_to;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  let adminWithLeast = admins[0].id;
  let leastCount = counts.get(admins[0].id) ?? 0;

  for (const admin of admins) {
    const count = counts.get(admin.id) ?? 0;
    if (count < leastCount) {
      leastCount = count;
      adminWithLeast = admin.id;
    }
  }

  return adminWithLeast;
}

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
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    // Get the admin with least tasks for fair distribution
    const assignedToAdmin = await getAdminWithLeastTasks();

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        user_id: user.id,
        subject: trimmedSubject,
        message: trimmedMessage,
        priority,
        assigned_to: assignedToAdmin,
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

    const adminClient = createAdminClient();

    try {
      const { error: messageError } = await adminClient.from('ticket_messages').insert({
        ticket_id: ticket.id,
        sender_id: user.id,
        sender_role: 'user',
        message: trimmedMessage,
      });

      if (messageError) {
        throw messageError;
      }

      const { data: fullTicket, error: fullTicketError } = await adminClient
        .from('tickets')
        .select(TICKET_THREAD_SELECT)
        .eq('id', ticket.id)
        .single();

      if (fullTicketError) {
        throw fullTicketError;
      }

      const { data: profile } = await adminClient
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();

      await notifyAdminsServer(
        user.id,
        'ticket_created',
        trimmedSubject,
        `${profile?.name ?? 'A user'} requested a book to be added to the library.`,
        `/admin/tickets?ticketId=${ticket.id}`
      );

      return NextResponse.json({ ticket: normalizeTicket(fullTicket) });
    } catch (notifyError) {
      console.error('Failed to finish book request workflow:', notifyError);
    }

    return NextResponse.json({ ticket: normalizeTicket(ticket) });
  } catch (error) {
    console.error('Book request API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
