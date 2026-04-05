import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from '@/components/ui/avatar';

describe('Avatar', () => {
  it('renders initials for multi-word names when no image is provided', () => {
    render(<Avatar name="Jane Doe" />);

    expect(screen.getByLabelText('Jane Doe')).toHaveTextContent('JD');
  });

  it('renders the provided image source instead of initials', () => {
    render(<Avatar name="Jane Doe" src="https://example.com/avatar.png" />);

    expect(screen.getByRole('img', { name: 'Jane Doe' })).toHaveAttribute(
      'src',
      'https://example.com/avatar.png'
    );
    expect(screen.queryByText('JD')).not.toBeInTheDocument();
  });
});