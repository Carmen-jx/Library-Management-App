import { createClient } from '@/lib/supabase/client';
import { TICKET_THREAD_SELECT, normalizeTicket, normalizeTickets } from '@/lib/tickets';
import type { Ticket, TicketStatus, TicketPriority } from '@/types';

interface CreateTicketData {
  subject: string;
  message: string;
  priority?: TicketPriority;
}

interface AdminTaskCount {
  assigned_to: string;
  active_count: number;
}

/**
 * Get the number of active (non-resolved) tasks assigned to each admin
 */
export async function getAdminTaskCounts() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('tickets')
    .select('assigned_to')
    .neq('status', 'resolved')
    .not('assigned_to', 'is', null);

  if (error) throw error;

  // Count tasks per admin
  const counts = new Map<string, number>();
  (data as { assigned_to: string }[]).forEach((ticket) => {
    counts.set(ticket.assigned_to, (counts.get(ticket.assigned_to) ?? 0) + 1);
  });

  return counts;
}

/**
 * Get all active admins and find the one with the least tasks
 */
export async function getAdminWithLeastTasks(): Promise<string | null> {
  const supabase = createClient();

  // Get all active admins
  const { data: admins, error: adminError } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin');

  if (adminError) throw adminError;

  if (!admins || admins.length === 0) return null;

  // Get task counts
  const taskCounts = await getAdminTaskCounts();

  // Find admin with least tasks
  let adminWithLeast = admins[0].id;
  let leastCount = taskCounts.get(admins[0].id) ?? 0;

  for (const admin of admins) {
    const count = taskCounts.get(admin.id) ?? 0;
    if (count < leastCount) {
      leastCount = count;
      adminWithLeast = admin.id;
    }
  }

  return adminWithLeast;
}

export async function createTicket(userId: string, data: CreateTicketData) {
  const supabase = createClient();

  // Get the admin with the least tasks for fair distribution
  const assignedToAdmin = await getAdminWithLeastTasks();

  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      user_id: userId,
      subject: data.subject,
      message: data.message,
      priority: data.priority ?? 'medium',
      assigned_to: assignedToAdmin,
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
    .select(TICKET_THREAD_SELECT)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: true, foreignTable: 'ticket_messages' });

  if (error) throw error;
  return normalizeTickets(data as Ticket[]);
}

export async function getAllTickets(status?: TicketStatus) {
  const supabase = createClient();

  let query = supabase
    .from('tickets')
    .select(TICKET_THREAD_SELECT)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: true, foreignTable: 'ticket_messages' });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return normalizeTickets(data as Ticket[]);
}

export async function getAdminTickets(adminId: string, status?: TicketStatus) {
  const supabase = createClient();

  let query = supabase
    .from('tickets')
    .select(TICKET_THREAD_SELECT)
    .eq('assigned_to', adminId)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: true, foreignTable: 'ticket_messages' });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return normalizeTickets(data as Ticket[]);
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
    .select(TICKET_THREAD_SELECT)
    .single();

  if (error) throw error;
  return normalizeTicket(data as Ticket);
}
