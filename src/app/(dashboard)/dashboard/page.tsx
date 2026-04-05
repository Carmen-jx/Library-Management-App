import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { fetchDashboardDataServer } from '@/lib/userDashboard.server';
import DashboardClient from './dashboard-client';
import type { Profile } from '@/types';

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch profile and dashboard data in parallel
  const [profileResult, dashboardData] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    fetchDashboardDataServer(user.id),
  ]);

  const profile = profileResult.data as Profile | null;

  if (!profile) {
    redirect('/login');
  }

  return (
    <DashboardClient
      profile={profile}
      userId={user.id}
      initialData={dashboardData}
    />
  );
}

