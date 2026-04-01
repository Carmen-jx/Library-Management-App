'use client';

import { useState } from 'react';
import { Camera } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { cn, GENRES } from '@/lib/utils';
import type { Profile } from '@/types';

// --- Types ---

export interface ProfileFormValues {
  name: string;
  bio: string;
  birthday: string;
  favorite_genres: string[];
  show_reading_activity: boolean;
  avatarFile?: File | null;
}

interface ProfileFormProps {
  profile: Profile;
  onSave: (values: ProfileFormValues) => Promise<void>;
}

// --- Profile Form ---

export function ProfileForm({ profile, onSave }: ProfileFormProps) {
  const [name, setName] = useState(profile.name || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [birthday, setBirthday] = useState(profile.birthday || '');
  const [selectedGenres, setSelectedGenres] = useState<string[]>(
    profile.favorite_genres || []
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    profile.avatar_url
  );
  const [showReadingActivity, setShowReadingActivity] = useState(
    profile.show_reading_activity ?? false
  );
  const [saving, setSaving] = useState(false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarFile(file);

    // Create a local preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleGenreToggle = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre)
        ? prev.filter((g) => g !== genre)
        : [...prev, genre]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await onSave({
        name,
        bio,
        birthday,
        favorite_genres: selectedGenres,
        show_reading_activity: showReadingActivity,
        avatarFile,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Avatar Upload */}
      <div className="flex items-center gap-6">
        <div className="relative">
          <Avatar
            src={avatarPreview}
            name={name || profile.name}
            size="xl"
          />
          <label
            htmlFor="avatar-upload"
            className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            <Camera className="h-3.5 w-3.5" />
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </label>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Profile Photo</p>
          <p className="text-xs text-gray-500">
            JPG, PNG, or GIF. Max 2MB.
          </p>
        </div>
      </div>

      {/* Name */}
      <Input
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your full name"
        required
      />

      {/* Bio */}
      <Textarea
        label="Bio"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="Tell us about yourself..."
        rows={3}
      />

      {/* Birthday */}
      <Input
        label="Birthday"
        type="date"
        value={birthday}
        onChange={(e) => setBirthday(e.target.value)}
      />

      {/* Favorite Genres */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Favorite Genres
        </label>
        <p className="mb-3 text-xs text-gray-500">
          Select the genres you enjoy reading.
        </p>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => handleGenreToggle(genre)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                selectedGenres.includes(genre)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* Show Reading Activity Toggle */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
        <div>
          <p className="text-sm font-medium text-gray-900">
            Show Reading Activity
          </p>
          <p className="text-xs text-gray-500">
            Display your currently borrowed books and reading history on your profile.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={showReadingActivity}
          onClick={() => setShowReadingActivity((prev) => !prev)}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors',
            showReadingActivity ? 'bg-indigo-600' : 'bg-gray-200'
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow ring-0 transition-transform',
              showReadingActivity ? 'translate-x-5.5' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <Button type="submit" loading={saving}>
          Save Changes
        </Button>
      </div>
    </form>
  );
}
