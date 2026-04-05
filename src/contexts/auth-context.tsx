'use client';

import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { User, AuthError, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';

// --- Types ---

interface SignInParams {
  email: string;
  password: string;
}

interface SignUpParams {
  email: string;
  password: string;
  name: string;
}

interface UpdateProfileParams {
  name?: string;
  avatar_url?: string | null;
  bio?: string | null;
  birthday?: string | null;
  favorite_genres?: string[];
  show_reading_activity?: boolean;
}

export interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (params: SignInParams) => Promise<{ error: AuthError | null }>;
  signUp: (params: SignUpParams) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  updateProfile: (params: UpdateProfileParams) => Promise<{ error: Error | null }>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

// --- Provider ---

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => createClient(), []);

  const fetchProfile = useCallback(
    async (userId: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error.message);
        return null;
      }

      return data as Profile;
    },
    [supabase]
  );

  // Track auth state changes — no async calls here to avoid Supabase auth lock deadlock
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Fetch profile in a separate effect whenever user changes — runs outside the auth lock
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const loadProfile = async () => {
      const userProfile = await fetchProfile(user.id);
      if (!cancelled) {
        setProfile(userProfile);
        setLoading(false);
      }
    };

    loadProfile();
    return () => { cancelled = true; };
  }, [user, fetchProfile]);

  const signIn = async ({
    email,
    password,
  }: SignInParams): Promise<{ error: AuthError | null }> => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async ({
    email,
    password,
    name,
  }: SignUpParams): Promise<{ error: AuthError | null }> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });
    return { error };
  };

  const signInWithGoogle = async (): Promise<{ error: AuthError | null }> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { error: error as AuthError | null };
  };

  const signOut = async (): Promise<{ error: AuthError | null }> => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    setUser(null);
    setProfile(null);
    // Force clear all supabase cookies in case signOut didn't
    document.cookie.split(';').forEach((c) => {
      const name = c.trim().split('=')[0];
      if (name.startsWith('sb-')) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      }
    });
    return { error };
  };

  const updateProfile = async (
    params: UpdateProfileParams
  ): Promise<{ error: Error | null }> => {
    if (!user) {
      return { error: new Error('No authenticated user') };
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...params,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      return { error };
    }

    setProfile(data as Profile);
    return { error: null };
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signIn, signUp, signInWithGoogle, signOut, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}
