// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeMocks = vi.hoisted(() => {
  const exchangeCodeForSession = vi.fn();
  const createServerClient = vi.fn(() => ({
    auth: {
      exchangeCodeForSession,
    },
  }));
  const cookieStore = {
    getAll: vi.fn(() => []),
    set: vi.fn(),
  };
  const cookies = vi.fn(() => cookieStore);

  return {
    cookies,
    cookieStore,
    createServerClient,
    exchangeCodeForSession,
  };
});

vi.mock('@supabase/ssr', () => ({
  createServerClient: routeMocks.createServerClient,
}));

vi.mock('next/headers', () => ({
  cookies: routeMocks.cookies,
}));

describe('auth callback route', () => {
  beforeEach(() => {
    vi.resetModules();
    routeMocks.createServerClient.mockClear();
    routeMocks.exchangeCodeForSession.mockReset();
    routeMocks.cookieStore.getAll.mockReturnValue([]);
    routeMocks.cookieStore.set.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.example.com';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.NODE_ENV = 'development';
  });

  it('exchanges the OAuth code and redirects to a safe local path', async () => {
    routeMocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    routeMocks.cookieStore.getAll.mockReturnValue([
      { name: 'sb-access-token', value: 'token-value' },
    ]);

    const { GET } = await import('@/app/auth/callback/route');
    const response = await GET(
      new Request(
        'https://app.example.com/auth/callback?code=oauth-code&next=https://evil.example.com'
      )
    );

    expect(routeMocks.exchangeCodeForSession).toHaveBeenCalledWith('oauth-code');
    expect(response.headers.get('location')).toBe(
      'https://app.example.com/dashboard'
    );
    expect(response.cookies.get('sb-access-token')?.value).toBe('token-value');
  });

  it('uses the forwarded host in production when the exchange succeeds', async () => {
    process.env.NODE_ENV = 'production';
    routeMocks.exchangeCodeForSession.mockResolvedValue({ error: null });

    const request = new Request(
      'https://preview.internal/auth/callback?code=oauth-code&next=/messages',
      {
        headers: {
          'x-forwarded-host': 'manos.example.com',
        },
      }
    );

    const { GET } = await import('@/app/auth/callback/route');
    const response = await GET(request);

    expect(response.headers.get('location')).toBe(
      'https://manos.example.com/messages'
    );
  });

  it('falls back to the login page when no code is present or exchange fails', async () => {
    routeMocks.exchangeCodeForSession.mockResolvedValue({
      error: new Error('bad code'),
    });

    const { GET } = await import('@/app/auth/callback/route');
    const failed = await GET(
      new Request('https://app.example.com/auth/callback?code=bad')
    );
    const missing = await GET(
      new Request('https://app.example.com/auth/callback')
    );

    expect(failed.headers.get('location')).toBe('https://app.example.com/login');
    expect(missing.headers.get('location')).toBe('https://app.example.com/login');
  });
});