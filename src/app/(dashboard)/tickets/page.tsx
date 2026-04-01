'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getUserTickets } from '@/services/tickets';
import { logActivity } from '@/services/activity';
import { Ticket, TicketStatus, TicketPriority } from '@/types';
import { cn, formatDate, timeAgo } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import {
  Plus,
  ChevronDown,
  ChevronUp,
  TicketIcon,
  MessageSquare,
} from 'lucide-react';

const STATUS_BADGE_VARIANT: Record<TicketStatus, BadgeVariant> = {
  open: 'info',
  in_progress: 'warning',
  resolved: 'success',
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

const PRIORITY_BADGE_VARIANT: Record<TicketPriority, BadgeVariant> = {
  low: 'default',
  medium: 'warning',
  high: 'danger',
};

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export default function TicketsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(
    searchParams.get('ticketId')
  );
  const [submitting, setSubmitting] = useState(false);

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('low');

  const fetchTickets = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const data = await getUserTickets(user.id);
      setTickets(data);
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
      toast.error('Failed to load tickets.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const resetForm = () => {
    setSubject('');
    setMessage('');
    setPriority('low');
  };

  const handleCreateTicket = async () => {
    if (!user?.id) return;
    if (!subject.trim() || !message.trim()) {
      toast.error('Please fill in all fields.');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch('/api/tickets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
          priority,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create ticket.');
      }

      const { ticket: newTicket } = await response.json();

      await logActivity(user.id, 'ticket_created', {
        ticketId: newTicket.id,
        subject: newTicket.subject,
        priority,
      });

      setTickets((prev) => [newTicket, ...prev]);
      toast.success('Ticket created successfully.');
      resetForm();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to create ticket:', error);
      toast.error('Failed to create ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleExpanded = (ticketId: string) => {
    setExpandedTicketId((prev) => (prev === ticketId ? null : ticketId));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
          <p className="mt-1 text-sm text-gray-500">
            View and manage your support requests
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Ticket
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-5 w-5" />
              </div>
            </Card>
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <TicketIcon className="mb-4 h-12 w-12 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900">No tickets yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Create a ticket to get help from our support team.
          </p>
          <Button className="mt-4" onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Ticket
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => {
            const isExpanded = expandedTicketId === ticket.id;
            return (
              <Card
                key={ticket.id}
                className={cn(
                  'cursor-pointer transition-shadow hover:shadow-md',
                  isExpanded && 'ring-2 ring-blue-200'
                )}
                onClick={() => toggleExpanded(ticket.id)}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-semibold text-gray-900">
                        {ticket.subject}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant={STATUS_BADGE_VARIANT[ticket.status]}>
                          {STATUS_LABELS[ticket.status]}
                        </Badge>
                        <Badge variant={PRIORITY_BADGE_VARIANT[ticket.priority]}>
                          {PRIORITY_LABELS[ticket.priority]}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-gray-400">
                        Created {timeAgo(ticket.created_at)}
                        {' \u00B7 '}
                        {formatDate(ticket.created_at)}
                      </p>
                    </div>
                    <div className="ml-4 flex-shrink-0 text-gray-400">
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 space-y-4 border-t pt-4">
                      <div>
                        <h4 className="mb-1 text-sm font-medium text-gray-700">
                          Message
                        </h4>
                        <p className="whitespace-pre-wrap text-sm text-gray-600">
                          {ticket.message}
                        </p>
                      </div>

                      {ticket.admin_response && (
                        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                          <div className="mb-2 flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-green-600" />
                            <h4 className="text-sm font-semibold text-green-800">
                              Admin Response
                            </h4>
                          </div>
                          <p className="whitespace-pre-wrap text-sm text-green-700">
                            {ticket.admin_response}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={isModalOpen}
        onClose={() => {
          if (!submitting) {
            setIsModalOpen(false);
            resetForm();
          }
        }}
        title="Create Support Ticket"
      >
        <div className="space-y-4">
          <div>
            <label
              htmlFor="ticket-subject"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Subject
            </label>
            <Input
              id="ticket-subject"
              placeholder="Brief description of your issue"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="ticket-message"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Message
            </label>
            <Textarea
              id="ticket-message"
              placeholder="Describe your issue in detail..."
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="ticket-priority"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Priority
            </label>
            <Select
              id="ticket-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TicketPriority)}
              options={PRIORITY_OPTIONS}
              disabled={submitting}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTicket}
              disabled={submitting || !subject.trim() || !message.trim()}
            >
              {submitting ? 'Creating...' : 'Create Ticket'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
