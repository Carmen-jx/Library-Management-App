'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { ProfileForm } from '@/components/profile/profile-form';
import type { ProfileFormValues } from '@/components/profile/profile-form';

// --- Loading Skeleton ---

function EditSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <Card>
        <div className="space-y-6 p-6">
          <div className="flex items-center gap-6">
            <Skeleton variant="circular" className="h-16 w-16" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton variant="rectangular" className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full" />
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

// --- Edit Profile Page ---

export default function EditProfilePage() {
  const { profile, loading: authLoading, updateProfile } = useAuth();
  const router = useRouter();

  const handleSave = async (values: ProfileFormValues) => {
    if (!profile) return;

    try {
      let avatarUrl: string | null | undefined;

      if (values.avatarFile) {
        const supabase = createClient();
        const fileExt = values.avatarFile.name.split('.').pop();
        const filePath = `${profile.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, values.avatarFile, { upsert: true });

        if (uploadError) {
          toast.error('Failed to upload avatar image.');
          return;
        }

        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        avatarUrl = urlData.publicUrl;
      }

      const { error } = await updateProfile({
        name: values.name,
        bio: values.bio || null,
        birthday: values.birthday || null,
        favorite_genres: values.favorite_genres,
        show_reading_activity: values.show_reading_activity,
        ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
      });

      if (error) {
        toast.error('Failed to update profile.');
        return;
      }

      toast.success('Profile updated successfully.');
      router.push('/profile');
    } catch {
      toast.error('An unexpected error occurred.');
    }
  };

  if (authLoading || !profile) {
    return <EditSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Back Link & Header */}
      <div className="flex items-center gap-3">
        <Link href="/profile">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Edit Profile</h2>
          <p className="mt-1 text-gray-500">
            Update your personal information and preferences.
          </p>
        </div>
      </div>

      {/* Profile Form */}
      <Card>
        <Card.Body>
          <ProfileForm profile={profile} onSave={handleSave} />
        </Card.Body>
      </Card>
    </div>
  );
}
