import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChatInput } from '@/components/chat/chat-input';

describe('ChatInput', () => {
  it('sends trimmed messages on Enter and clears the input', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} />);

    const textarea = screen.getByPlaceholderText('Type a message...');
    await user.type(textarea, '  hello world{enter}');

    expect(onSend).toHaveBeenCalledWith('hello world');
    expect(textarea).toHaveValue('');
  });

  it('does not send on Shift+Enter and keeps the newline in the draft', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} />);

    const textarea = screen.getByPlaceholderText('Type a message...');
    await user.type(textarea, 'hello{shift>}{enter}{/shift}world');

    expect(onSend).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('hello\nworld');
  });

  it('disables both typing and sending when the composer is disabled', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} disabled />);

    const textarea = screen.getByPlaceholderText('Type a message...');
    const sendButton = screen.getByRole('button', { name: 'Send message' });

    expect(textarea).toBeDisabled();
    expect(sendButton).toBeDisabled();

    await user.click(sendButton);

    expect(onSend).not.toHaveBeenCalled();
  });
});