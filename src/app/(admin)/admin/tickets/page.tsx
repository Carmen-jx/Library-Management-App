'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  TicketCheck,
  AlertCircle,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Send,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import { getAllTickets } from '@/services/tickets';
import { cn, formatDate, timeAgo } from '@/lib/utils';
import type { Ticket, TicketStatus, TicketPriority } from '@/types';

// --- Constants ---

type FilterTab = 'all' | TicketStatus;

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
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

// --- Loading Skeleton ---

function TicketsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-64" />
      </div>

      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-lg" />
        ))}
      </div>

      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <Card.Body>
              <div className="flex items-start gap-4">
                <Skeleton variant="circular" className="h-10 w-10" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-64" />
                  <Skeleton className="h-4 w-36" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            </Card.Body>
          </Card>
        ))}
      </div>
    </div>
  );
}

// --- Ticket Row ---

interface TicketRowProps {
  ticket: Ticket;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (ticket: Ticket) => void;
  currentUserId: string;
}

function TicketRow({ ticket, expanded, onToggle, onUpdate, currentUserId }: TicketRowProps) {
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [adminResponse, setAdminResponse] = useState(ticket.admin_response ?? '');
  const [saving, setSaving] = useState(false);

  const StatusIcon = STATUS_ICONS[ticket.status];

  const handleSave = async () => {
    setSaving(true);

    try {
      const response = await fetch('/api/tickets/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticket.id,
          status,
          admin_response: adminResponse || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update ticket.');
      }

      const { ticket: updated } = await response.json();
      onUpdate(updated);
      toast.success('Ticket updated successfully.');
    } catch (err) {
      console.error('Update ticket error:', err);
      toast.error('Failed to update ticket.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="transition-shadow hover:shadow-md">
      {/* Summary Row */}
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
          <div className="flex items-center gap-2">
            <h4 className="truncate text-sm font-semibold text-gray-900">
              {ticket.subject}
            </h4>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {ticket.profile?.name ?? 'Unknown User'} -- {timeAgo(ticket.created_at)}
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
          </div>
        </div>

        <div className="shrink-0 pt-1 text-gray-400">
          {expanded ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </div>
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-gray-200 px-6 py-4">
          {/* User Message */}
          <div className="mb-5">
            <h5 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-gray-500">
              User Message
            </h5>
            <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700 whitespace-pre-wrap">
              {ticket.message}
            </div>
          </div>

          {/* Ticket metadata */}
          <div className="mb-5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-500">
            <span>Created: {formatDate(ticket.created_at)}</span>
            <span>Updated: {formatDate(ticket.updated_at)}</span>
            <span>ID: {ticket.id.slice(0, 8)}...</span>
          </div>

          {/* Admin Controls */}
          <div className="space-y-4">
            <div className="w-full sm:w-48">
              <Select
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TicketStatus)}
                options={STATUS_OPTIONS}
              />
            </div>

            <Textarea
              label="Admin Response"
              value={adminResponse}
              onChange={(e) => setAdminResponse(e.target.value)}
              placeholder="Write a response to the user..."
              rows={3}
            />

            <div className="flex justify-end gap-3">
              <Button
                variant="primary"
                loading={saving}
                onClick={handleSave}
              >
                <Send className="h-4 w-4" />
                Save Response
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// --- Page ---

export default function AdminTicketsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [expandedId, setExpandedId] = useState<string | null>(
    searchParams.get('ticketId')
  );

  // Fetch tickets
  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const data = await getAllTickets();
        setTickets(data);
      } catch (err) {
        console.error('Tickets fetch error:', err);
        toast.error('Failed to load tickets.');
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, []);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    if (activeTab === 'all') return tickets;
    return tickets.filter((t) => t.status === activeTab);
  }, [tickets, activeTab]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: tickets.length };
    for (const t of tickets) {
      counts[t.status] = (counts[t.status] ?? 0) + 1;
    }
    return counts;
  }, [tickets]);

  // Toggle expand
  const toggleExpanded = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Handle ticket update from child
  const handleTicketUpdate = (updated: Ticket) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)),
    );
  };

  if (loading) {
    return <TicketsSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Support Tickets</h2>
        <p className="mt-1 text-gray-500">
          {tickets.length} total tickets. Review and respond to user issues.
        </p>
      </div>

      {/* Filter Tabs */}
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
                  : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50',
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'inline-flex items-center justify-center rounded-full px-1.5 text-xs font-medium',
                  isActive
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-100 text-gray-600',
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tickets List */}
      {filteredTickets.length === 0 ? (
        <Card>
          <Card.Body>
            <div className="flex flex-col items-center py-12 text-center">
              <TicketCheck className="h-12 w-12 text-gray-300" />
              <p className="mt-4 text-sm text-gray-500">
                {activeTab === 'all'
                  ? 'No tickets found.'
                  : `No ${activeTab.replace('_', ' ')} tickets.`}
              </p>
            </div>
          </Card.Body>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredTickets.map((ticket) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              expanded={expandedId === ticket.id}
              onToggle={() => toggleExpanded(ticket.id)}
              onUpdate={handleTicketUpdate}
              currentUserId={user?.id ?? ''}
            />
          ))}
        </div>
      )}
    </div>
  );
}
