'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MessageSquare,
  Send,
  TicketCheck,
  User,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { createClient } from '@/lib/supabase/client';
import { getAllTickets } from '@/services/tickets';
import { sortTicketsByUpdatedAt } from '@/lib/tickets';
import { cn, formatDate, timeAgo } from '@/lib/utils';
import type { Ticket, TicketMessage, TicketPriority, TicketStatus } from '@/types';

type FilterTab = 'all' | 'my-tickets' | TicketStatus;

const FILTER_TABS: Array<{ value: FilterTab; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'my-tickets', label: 'My Tickets' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
];

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
];

const STATUS_BADGE_VARIANT: Record<TicketStatus, 'warning' | 'info' | 'success'> = {
  open: 'warning',
  in_progress: 'info',
  resolved: 'success',
};

const STATUS_ICONS: Record<TicketStatus, typeof AlertCircle> = {
  open: AlertCircle,
  in_progress: Clock,
  resolved: CheckCircle2,
};

const PRIORITY_BADGE_VARIANT: Record<TicketPriority, 'default' | 'warning' | 'danger'> = {
  low: 'default',
  medium: 'warning',
  high: 'danger',
};

function TicketsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
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
              <div className="flex items-start gap-4">
                <Skeleton variant="circular" className="h-10 w-10" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-64" />
                  <Skeleton className="h-4 w-40" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                </div>
                <Skeleton className="h-5 w-5" />
              </div>
            </Card.Body>
          </Card>
        ))}
      </div>
    </div>
  );
}

function getSenderDisplayName(ticket: Ticket, message: TicketMessage) {
  if (message.sender_role === 'admin') {
    return message.sender?.name ?? 'Support Team';
  }

  return message.sender?.name ?? ticket.profile?.name ?? 'User';
}

function TicketThread({ ticket }: { ticket: Ticket }) {
  const messages = ticket.messages ?? [];

  return (
    <div className="h-48 space-y-2 overflow-y-auto pr-1">
      {messages.map((message) => {
        const isAdminMessage = message.sender_role === 'admin';

        return (
          <div
            key={message.id}
            className={cn(
              'flex',
              isAdminMessage ? 'justify-end' : 'justify-start'
            )}
          >
            {!isAdminMessage && (
              <Avatar
                src={message.sender?.avatar_url}
                name={getSenderDisplayName(ticket, message)}
                size="sm"
                className="mt-1 shrink-0"
              />
            )}

            <div
              className={cn(
                'max-w-[70%] rounded-xl px-3 py-2 text-xs shadow-sm ring-1',
                isAdminMessage
                  ? 'bg-indigo-600 text-white ring-indigo-600'
                  : 'bg-gray-50 text-gray-700 ring-gray-200'
              )}
            >
              <div
                className={cn(
                  'mb-1 flex items-center gap-2 text-xs font-medium',
                  isAdminMessage ? 'text-indigo-100' : 'text-gray-500'
                )}
              >
                <span>{getSenderDisplayName(ticket, message)}</span>
                <span>{formatDate(message.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap">{message.message}</p>
            </div>

            {isAdminMessage && (
              <Avatar
                src={message.sender?.avatar_url}
                name={getSenderDisplayName(ticket, message)}
                size="sm"
                className="mt-1 shrink-0"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface TicketRowProps {
  ticket: Ticket;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (ticket: Ticket) => void;
  currentAdminId: string | null;
  adminList: Array<{ id: string; name: string }>;
}

function TicketRow({ ticket, expanded, onToggle, onUpdate, currentAdminId, adminList }: TicketRowProps) {
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [assignedTo, setAssignedTo] = useState<string>(ticket.assigned_to ?? '');
  const [reply, setReply] = useState('');
  const [saving, setSaving] = useState(false);
  const [reassigning, setReassigning] = useState(false);

  useEffect(() => {
    setStatus(ticket.status);
  }, [ticket.status]);

  useEffect(() => {
    setAssignedTo(ticket.assigned_to ?? '');
  }, [ticket.assigned_to]);

  const StatusIcon = STATUS_ICONS[ticket.status];
  const messageCount = ticket.messages?.length ?? 0;
  const isAssignedToMe = currentAdminId != null && ticket.assigned_to === currentAdminId;
  const canSubmit = status !== ticket.status || reply.trim().length > 0;

  const assignOptions = adminList.map((admin) => ({
    value: admin.id,
    label: admin.name,
  }));

  const handleSave = async () => {
    if (!canSubmit) return;

    setSaving(true);

    try {
      const response = await fetch('/api/tickets/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticket.id,
          status,
          message: reply.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update ticket.');
      }

      const { ticket: updated } = await response.json();
      onUpdate(updated);
      setReply('');
      toast.success('Ticket updated successfully.');
    } catch (error) {
      console.error('Update ticket error:', error);
      toast.error('Failed to update ticket.');
    } finally {
      setSaving(false);
    }
  };

  const handleReassign = async (newAdminId: string) => {
    if (newAdminId === ticket.assigned_to) return;

    setReassigning(true);
    setAssignedTo(newAdminId);

    try {
      const response = await fetch('/api/tickets/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticket.id,
          assigned_to: newAdminId || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reassign ticket.');
      }

      const { ticket: updated } = await response.json();
      onUpdate(updated);
      const adminName = adminList.find((a) => a.id === newAdminId)?.name ?? 'admin';
      toast.success(`Ticket reassigned to ${adminName}.`);
    } catch (error) {
      console.error('Reassign ticket error:', error);
      setAssignedTo(ticket.assigned_to ?? '');
      toast.error('Failed to reassign ticket.');
    } finally {
      setReassigning(false);
    }
  };

  return (
    <Card className="transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-4 px-6 py-4 text-left"
      >
        <Avatar
          src={ticket.profile?.avatar_url}
          name={ticket.profile?.name ?? 'User'}
          size="md"
        />

        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-semibold text-gray-900">
            {ticket.subject}
          </h4>
          <p className="mt-0.5 text-xs text-gray-500">
            {ticket.profile?.name ?? 'Unknown User'} · {timeAgo(ticket.updated_at)}
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
            {ticket.assigned_admin && (
              <Badge variant="default" className="flex items-center gap-1.5">
                <User className="h-3 w-3" />
                {ticket.assigned_admin.name}
              </Badge>
            )}
          </div>
        </div>

        <div className="shrink-0 pt-1 text-gray-400">
          {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </button>

      {expanded && (
        <div className="space-y-5 border-t border-gray-200 px-16 py-4">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-500">
            <span>Created: {formatDate(ticket.created_at)}</span>
            <span>Updated: {formatDate(ticket.updated_at)}</span>
            <span>ID: {ticket.id.slice(0, 8)}...</span>
          </div>

          <div className="flex gap-10">
            {/* Conversation - left side */}
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                <MessageSquare className="h-4 w-4" />
                Conversation
              </div>
              <TicketThread ticket={ticket} />
            </div>

            {/* Controls - right side */}
            <div className="w-56 shrink-0 space-y-4">
              <Select
                label="Status"
                value={status}
                onChange={(event) => setStatus(event.target.value as TicketStatus)}
                options={STATUS_OPTIONS}
                disabled={!isAssignedToMe}
              />
              <Select
                label="Assign to"
                value={assignedTo}
                onChange={(event) => handleReassign(event.target.value)}
                options={assignOptions}
                disabled={reassigning}
              />
            </div>
          </div>

          {isAssignedToMe ? (
            <>
              <div>
                <Textarea
                  label="Reply"
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="Send the user another response..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end">
                <Button variant="primary" loading={saving} disabled={!canSubmit} onClick={handleSave}>
                  <Send className="h-4 w-4" />
                  Send Update
                </Button>
              </div>
            </>
          ) : (
            <p className="text-center text-sm text-gray-400">
              This ticket is assigned to {ticket.assigned_admin?.name ?? 'another admin'}. Only the assigned admin can change the status and reply.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function AdminTicketsContent() {
  const searchParams = useSearchParams();
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [expandedId, setExpandedId] = useState<string | null>(
    searchParams.get('ticketId')
  );
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [adminList, setAdminList] = useState<Array<{ id: string; name: string }>>([]);
  const [adminFilter, setAdminFilter] = useState<string>('');

  useEffect(() => {
    const init = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setCurrentAdminId(user.id);
        }

        const [ticketData, adminData] = await Promise.all([
          getAllTickets(),
          supabase
            .from('profiles')
            .select('id, name')
            .eq('role', 'admin')
            .order('name'),
        ]);

        setAllTickets(ticketData);

        if (adminData.data) {
          setAdminList(adminData.data as Array<{ id: string; name: string }>);
        }
      } catch (error) {
        console.error('Init error:', error);
        toast.error('Failed to load tickets.');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const adminFilteredTickets = useMemo(() => {
    if (!adminFilter) return allTickets;
    return allTickets.filter((ticket) => ticket.assigned_to === adminFilter);
  }, [allTickets, adminFilter]);

  const filteredTickets = useMemo(() => {
    if (activeTab === 'all') return adminFilteredTickets;
    if (activeTab === 'my-tickets') {
      return adminFilteredTickets.filter((ticket) => ticket.assigned_to === currentAdminId);
    }
    return adminFilteredTickets.filter((ticket) => ticket.status === activeTab);
  }, [adminFilteredTickets, activeTab, currentAdminId]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: adminFilteredTickets.length, 'my-tickets': 0 };

    for (const ticket of adminFilteredTickets) {
      if (currentAdminId && ticket.assigned_to === currentAdminId) {
        counts['my-tickets'] = (counts['my-tickets'] ?? 0) + 1;
      }
      counts[ticket.status] = (counts[ticket.status] ?? 0) + 1;
    }

    return counts;
  }, [adminFilteredTickets, currentAdminId]);

  const handleTicketUpdate = (updated: Ticket) => {
    setAllTickets((previous) =>
      sortTicketsByUpdatedAt(
        previous.map((ticket) => (ticket.id === updated.id ? updated : ticket))
      )
    );
  };

  if (loading) {
    return <TicketsSkeleton />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Support Tickets</h2>
        <p className="mt-1 text-gray-500">
          {allTickets.length} total tickets. Review, reply, and manage ticket status.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap gap-2">
          {FILTER_TABS.map((tab) => {
            const isActive = activeTab === tab.value;
            const count = tabCounts[tab.value] ?? 0;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setActiveTab(tab.value);
                  if (tab.value === 'my-tickets') setAdminFilter('');
                }}
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

        {activeTab !== 'my-tickets' && (
          <div className="w-48">
            <Select
              value={adminFilter}
              onChange={(event) => setAdminFilter(event.target.value)}
              options={[
                { value: '', label: 'All Admins' },
                ...adminList.map((admin) => ({ value: admin.id, label: admin.name })),
              ]}
            />
          </div>
        )}
      </div>

      {filteredTickets.length === 0 ? (
        <Card>
          <Card.Body>
            <div className="flex flex-col items-center py-12 text-center">
              <TicketCheck className="h-12 w-12 text-gray-300" />
              <p className="mt-4 text-sm text-gray-500">
                {activeTab === 'all'
                  ? adminFilter
                    ? 'No tickets assigned to this admin.'
                    : 'No tickets found.'
                  : activeTab === 'my-tickets'
                    ? 'No tickets assigned to you.'
                    : adminFilter
                      ? `No ${activeTab.replace('_', ' ')} tickets for this admin.`
                      : `No ${activeTab.replace('_', ' ')} tickets.`}
              </p>
            </div>
          </Card.Body>
        </Card>
      ) : (
        <div className="w-full space-y-4">
          {filteredTickets.map((ticket) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              expanded={expandedId === ticket.id}
              onToggle={() =>
                setExpandedId((previous) => (previous === ticket.id ? null : ticket.id))
              }
              onUpdate={handleTicketUpdate}
              currentAdminId={currentAdminId}
              adminList={adminList}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminTicketsPage() {
  return (
    <Suspense fallback={<TicketsSkeleton />}>
      <AdminTicketsContent />
    </Suspense>
  );
}
