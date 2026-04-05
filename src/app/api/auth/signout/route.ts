import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const cookieStore = cookies();

  // Sign out on the server side
  try {
    const supabase = createServerSupabaseClient();
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Continue even if signOut fails
  }

  // Clear all Supabase cookies from the server side
  cookieStore.getAll().forEach((cookie) => {
    if (cookie.name.startsWith('sb-')) {
      cookieStore.set(cookie.name, '', {
        path: '/',
        expires: new Date(0),
        maxAge: 0,
      });
    }
  });

  const response = NextResponse.redirect(`${origin}/login`);

  // Also clear cookies on the response
  cookieStore.getAll().forEach((cookie) => {
    if (cookie.name.startsWith('sb-')) {
      response.cookies.set(cookie.name, '', {
        path: '/',
        expires: new Date(0),
        maxAge: 0,
      });
    }
  });

  return response;
}
