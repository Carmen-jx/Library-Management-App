import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConversationList } from '@/components/chat/conversation-list';
import type { Conversation } from '@/types';

describe('ConversationList', () => {
  it('sorts conversations by the most recent message first', () => {
    const conversations: Conversation[] = [
      {
        user: {
          id: 'older',
          name: 'Older Thread',
          avatar_url: null,
          bio: null,
          birthday: null,
          favorite_genres: [],
          show_reading_activity: true,
          role: 'user',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
        last_message: {
          id: 'message-1',
          sender_id: 'older',
          receiver_id: 'me',
          content: 'Earlier message',
          read: false,
          created_at: '2026-04-05T09:00:00Z',
        },
        unread_count: 0,
      },
      {
        user: {
          id: 'newer',
          name: 'Newest Thread',
          avatar_url: null,
          bio: null,
          birthday: null,
          favorite_genres: [],
          show_reading_activity: true,
          role: 'user',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
        last_message: {
          id: 'message-2',
          sender_id: 'newer',
          receiver_id: 'me',
          content: 'Latest message',
          read: false,
          created_at: '2026-04-05T11:59:00Z',
        },
        unread_count: 3,
      },
    ];

    render(
      <ConversationList
        conversations={conversations}
        activeId="newer"
        onSelect={() => {}}
      />
    );

    const items = screen.getAllByRole('button');
    expect(items[0]).toHaveTextContent('Newest Thread');
    expect(items[1]).toHaveTextContent('Older Thread');
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('calls onSelect with the selected conversation user id', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <ConversationList
        conversations={[
          {
            user: {
              id: 'target-user',
              name: 'Target User',
              avatar_url: null,
              bio: null,
              birthday: null,
              favorite_genres: [],
              show_reading_activity: true,
              role: 'user',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
            last_message: {
              id: 'message-3',
              sender_id: 'target-user',
              receiver_id: 'me',
              content: 'Ping',
              read: true,
              created_at: '2026-04-05T11:00:00Z',
            },
            unread_count: 0,
          },
        ]}
        onSelect={onSelect}
      />
    );

    await user.click(screen.getByRole('button', { name: /target user/i }));

    expect(onSelect).toHaveBeenCalledWith('target-user');
  });
});