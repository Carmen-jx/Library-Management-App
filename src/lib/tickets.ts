import type { Ticket, TicketMessage } from '@/types';

export const TICKET_THREAD_SELECT = `
  *,
  profile:profiles!tickets_user_id_fkey(*),
  assigned_admin:profiles!tickets_assigned_to_fkey(*),
  messages:ticket_messages(
    *,
    sender:profiles!ticket_messages_sender_id_fkey(*)
  )
`;

function sortTicketMessages(messages: TicketMessage[] | undefined): TicketMessage[] {
  return [...(messages ?? [])].sort(
    (left, right) =>
      new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  );
}

export function normalizeTicket(ticket: Ticket): Ticket {
  return {
    ...ticket,
    messages: sortTicketMessages(ticket.messages),
  };
}

export function normalizeTickets(tickets: Ticket[] | null | undefined): Ticket[] {
  return sortTicketsByUpdatedAt((tickets ?? []).map(normalizeTicket));
}

export function sortTicketsByUpdatedAt(tickets: Ticket[]): Ticket[] {
  return [...tickets].sort(
    (left, right) =>
      new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
  );
}
