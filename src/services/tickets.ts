import { createClient } from '@/lib/supabase/client';
import type { Ticket, TicketStatus, TicketPriority } from '@/types';

interface CreateTicketData {
  subject: string;
  message: string;
  priority?: TicketPriority;
}

export async function createTicket(userId: string, data: CreateTicketData) {
  const supabase = createClient();

  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      user_id: userId,
      subject: data.subject,
      message: data.message,
      priority: data.priority ?? 'medium',
    })
    .select()
    .single();

  if (error) throw error;
  return ticket as Ticket;
}

export async function getUserTickets(userId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Ticket[];
}

export async function getAllTickets(status?: TicketStatus) {
  const supabase = createClient();

  let query = supabase
    .from('tickets')
    .select('*, profile:profiles(*)')
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as Ticket[];
}

export async function updateTicket(
  ticketId: string,
  updates: Partial<Pick<Ticket, 'status' | 'admin_response' | 'priority'>>
) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('tickets')
    .update(updates)
    .eq('id', ticketId)
    .select()
    .single();

  if (error) throw error;
  return data as Ticket;
}
