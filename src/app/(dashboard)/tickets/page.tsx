'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MessageSquare,
  Plus,
  Send,
  TicketIcon,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { sortTicketsByUpdatedAt } from '@/lib/tickets';
import { cn, formatDate, timeAgo } from '@/lib/utils';
import { logActivity } from '@/services/activity';
import { getUserTickets } from '@/services/tickets';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import type { Ticket, TicketMessage, TicketPriority, TicketStatus } from '@/types';

type FilterTab = 'all' | TicketStatus;

const FILTER_TABS: Array<{ value: FilterTab; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
];

const STATUS_BADGE_VARIANT: Record<TicketStatus, BadgeVariant> = {
  open: 'warning',
  in_progress: 'info',
  resolved: 'success',
};

const STATUS_ICONS: Record<TicketStatus, typeof AlertCircle> = {
  open: AlertCircle,
  in_progress: Clock,
  resolved: CheckCircle2,
};

const PRIORITY_BADGE_VARIANT: Record<TicketPriority, BadgeVariant> = {
  low: 'default',
  medium: 'warning',
  high: 'danger',
};

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

function TicketsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-5 w-72" />
      </div>

      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-24 rounded-lg" />
        ))}
      </div>

      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <Card.Body>
              <div className="space-y-3">
                <Skeleton className="h-5 w-64" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-32" />
              </div>
            </Card.Body>
          </Card>
        ))}
      </div>
    </div>
  );
}

function getSenderDisplayName(message: TicketMessage) {
  return message.sender_role === 'admin'
    ? message.sender?.name ?? 'Support Team'
    : 'You';
}

function TicketThread({ ticket }: { ticket: Ticket }) {
  const messages = ticket.messages ?? [];

  return (
    <div className="h-72 space-y-2 overflow-y-auto pr-1">
      {messages.map((message) => {
        const isCurrentUser = message.sender_role === 'user';

        return (
          <div
            key={message.id}
            className={cn(
              'flex',
              isCurrentUser ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[70%] rounded-xl px-3 py-2 text-xs shadow-sm ring-1',
                isCurrentUser
                  ? 'bg-indigo-600 text-white ring-indigo-600'
                  : 'bg-gray-50 text-gray-700 ring-gray-200'
              )}
            >
              <div
                className={cn(
                  'mb-1 flex items-center gap-2 text-xs font-medium',
                  isCurrentUser ? 'text-indigo-100' : 'text-gray-500'
                )}
              >
                <span>{getSenderDisplayName(message)}</span>
                <span>{formatDate(message.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap">{message.message}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TicketsContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(
    searchParams.get('ticketId')
  );
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingTicketId, setReplyingTicketId] = useState<string | null>(null);
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

  const filteredTickets = useMemo(() => {
    if (activeTab === 'all') return tickets;
    return tickets.filter((ticket) => ticket.status === activeTab);
  }, [tickets, activeTab]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: tickets.length };

    for (const ticket of tickets) {
      counts[ticket.status] = (counts[ticket.status] ?? 0) + 1;
    }

    return counts;
  }, [tickets]);

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

      setTickets((previous) => sortTicketsByUpdatedAt([newTicket, ...previous]));
      setExpandedTicketId(newTicket.id);
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

  const handleReplyChange = (ticketId: string, value: string) => {
    setReplyDrafts((previous) => ({
      ...previous,
      [ticketId]: value,
    }));
  };

  const handleReply = async (ticketId: string) => {
    const reply = replyDrafts[ticketId]?.trim() ?? '';

    if (!reply) {
      toast.error('Write a reply before sending.');
      return;
    }

    try {
      setReplyingTicketId(ticketId);

      const response = await fetch('/api/tickets/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, message: reply }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send reply.');
      }

      const { ticket: updatedTicket } = await response.json();

      setTickets((previous) =>
        sortTicketsByUpdatedAt(
          previous.map((ticket) => (ticket.id === updatedTicket.id ? updatedTicket : ticket))
        )
      );
      setReplyDrafts((previous) => ({
        ...previous,
        [ticketId]: '',
      }));
      toast.success('Reply sent.');
    } catch (error) {
      console.error('Failed to send ticket reply:', error);
      toast.error('Failed to send reply.');
    } finally {
      setReplyingTicketId(null);
    }
  };

  if (loading) {
    return <TicketsSkeleton />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track every conversation with support and reply directly inside a ticket.
          </p>
        </div>

        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Create Ticket
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => {
          const isActive = activeTab === tab.value;
          const count = tabCounts[tab.value] ?? 0;

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'inline-flex items-center justify-center rounded-full px-1.5 text-xs font-medium',
                  isActive ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600'
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {tickets.length === 0 ? (
        <Card>
          <Card.Body>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <TicketIcon className="mb-4 h-12 w-12 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900">No tickets yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Create a ticket to get help from the support team.
              </p>
              <Button className="mt-4" onClick={() => setIsModalOpen(true)}>
                <Plus className="h-4 w-4" />
                Create Ticket
              </Button>
            </div>
          </Card.Body>
        </Card>
      ) : filteredTickets.length === 0 ? (
        <Card>
          <Card.Body>
            <div className="flex flex-col items-center py-12 text-center">
              <TicketIcon className="h-12 w-12 text-gray-300" />
              <p className="mt-4 text-sm text-gray-500">
                No {activeTab.replace('_', ' ')} tickets.
              </p>
            </div>
          </Card.Body>
        </Card>
      ) : (
        <div className="w-full space-y-4">
          {filteredTickets.map((ticket) => {
            const isExpanded = expandedTicketId === ticket.id;
            const StatusIcon = STATUS_ICONS[ticket.status];
            const replyDraft = replyDrafts[ticket.id] ?? '';
            const isReplying = replyingTicketId === ticket.id;
            const messageCount = ticket.messages?.length ?? 0;

            return (
              <Card key={ticket.id} className="transition-shadow hover:shadow-md">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedTicketId((previous) =>
                      previous === ticket.id ? null : ticket.id
                    )
                  }
                  className="flex w-full items-start gap-4 px-6 py-4 text-left"
                >
                  <div className="flex-1">
                    <h3 className="truncate text-sm font-semibold text-gray-900">
                      {ticket.subject}
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Updated {timeAgo(ticket.updated_at)}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant={STATUS_BADGE_VARIANT[ticket.status]}>
                        <span className="flex items-center gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {ticket.status.replace('_', ' ')}
                        </span>
                      </Badge>
                      <Badge variant={PRIORITY_BADGE_VARIANT[ticket.priority]}>
                        {ticket.priority} priority
                      </Badge>
                      <Badge variant="default">{messageCount} messages</Badge>
                    </div>
                  </div>

                  <div className="shrink-0 pt-1 text-gray-400">
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="space-y-5 border-t border-gray-200 px-6 py-4">
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-500">
                      <span>Created: {formatDate(ticket.created_at)}</span>
                      <span>Updated: {formatDate(ticket.updated_at)}</span>
                      <span>ID: {ticket.id.slice(0, 8)}...</span>
                    </div>

                    <div className="mx-auto w-full max-w-4xl">
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                        <MessageSquare className="h-4 w-4" />
                        Conversation
                      </div>
                      <TicketThread ticket={ticket} />
                    </div>

                    <div className="mx-auto w-full max-w-4xl">
                      <Textarea
                        label="Reply to support"
                        value={replyDraft}
                        onChange={(event) =>
                          handleReplyChange(ticket.id, event.target.value)
                        }
                        placeholder={
                          ticket.status === 'resolved'
                            ? 'Reply to reopen this ticket...'
                            : 'Add more details or respond to support...'
                        }
                        rows={3}
                      />
                    </div>

                    <div className="mx-auto flex w-full max-w-4xl justify-end">
                      <Button
                        loading={isReplying}
                        disabled={!replyDraft.trim()}
                        onClick={() => handleReply(ticket.id)}
                      >
                        <Send className="h-4 w-4" />
                        Send Reply
                      </Button>
                    </div>
                  </div>
                )}
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
              onChange={(event) => setSubject(event.target.value)}
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
              onChange={(event) => setMessage(event.target.value)}
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
              onChange={(event) => setPriority(event.target.value as TicketPriority)}
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

export default function TicketsPage() {
  return (
    <Suspense fallback={<TicketsSkeleton />}>
      <TicketsContent />
    </Suspense>
  );
}
