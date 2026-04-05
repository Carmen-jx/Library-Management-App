// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const middlewareMocks = vi.hoisted(() => {
  const getUser = vi.fn();
  const createServerClient = vi.fn(() => ({
    auth: {
      getUser,
    },
    from: vi.fn(),
  }));

  return {
    createServerClient,
    getUser,
  };
});

vi.mock('@supabase/ssr', () => ({
  createServerClient: middlewareMocks.createServerClient,
}));

describe('updateSession', () => {
  beforeEach(() => {
    vi.resetModules();
    middlewareMocks.createServerClient.mockClear();
    middlewareMocks.getUser.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.example.com';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  });

  it('redirects unauthenticated users away from protected routes', async () => {
    middlewareMocks.getUser.mockResolvedValue({ data: { user: null } });

    const { updateSession } = await import('@/lib/supabase/middleware');
    const response = await updateSession(
      new NextRequest('https://app.example.com/dashboard')
    );

    expect(response.headers.get('location')).toBe('https://app.example.com/login');
  });

  it('allows unauthenticated OAuth callbacks through to the route handler', async () => {
    middlewareMocks.getUser.mockResolvedValue({ data: { user: null } });

    const { updateSession } = await import('@/lib/supabase/middleware');
    const response = await updateSession(
      new NextRequest('https://app.example.com/auth/callback?code=oauth-code')
    );

    expect(response.headers.get('location')).toBeNull();
    expect(response.status).toBe(200);
  });

  it('redirects authenticated users away from auth pages', async () => {
    middlewareMocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'reader@example.com',
        },
      },
    });

    const { updateSession } = await import('@/lib/supabase/middleware');
    const response = await updateSession(
      new NextRequest('https://app.example.com/login')
    );

    expect(response.headers.get('location')).toBe(
      'https://app.example.com/dashboard'
    );
  });
});