'use client';

import { useEffect, useState, useMemo } from 'react';
import { Search, Pencil, Users, ShieldCheck, User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';
import type { Profile, UserRole } from '@/types';

// --- Role Options ---

const roleOptions = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
];

// --- Loading Skeleton ---

function UsersSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-64" />
      </div>
      <Card>
        <div className="border-b border-gray-200 px-6 py-4">
          <Skeleton className="h-9 w-64" />
        </div>
        <div className="divide-y divide-gray-100">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <Skeleton variant="circular" className="h-10 w-10" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// --- Edit User Form State ---

interface EditFormState {
  name: string;
  role: UserRole;
}

// --- Page ---

export default function AdminUsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({ name: '', role: 'user' });
  const [saving, setSaving] = useState(false);

  // Fetch all profiles
  useEffect(() => {
    const fetchProfiles = async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Failed to load users.');
        console.error('Profiles fetch error:', error);
      } else {
        setProfiles(data as Profile[]);
      }

      setLoading(false);
    };

    fetchProfiles();
  }, []);

  // Filter + search
  const filteredProfiles = useMemo(() => {
    let result = profiles;

    if (roleFilter !== 'all') {
      result = result.filter((p) => p.role === roleFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.id.toLowerCase().includes(query),
      );
    }

    return result;
  }, [profiles, searchQuery, roleFilter]);

  // Edit handlers
  const openEditModal = (profile: Profile) => {
    setEditingProfile(profile);
    setEditForm({ name: profile.name, role: profile.role });
    setEditModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingProfile) return;

    setSaving(true);
    const supabase = createClient();

    const { error } = await supabase
      .from('profiles')
      .update({
        name: editForm.name,
        role: editForm.role,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingProfile.id);

    if (error) {
      toast.error('Failed to update user.');
      console.error('Update profile error:', error);
    } else {
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === editingProfile.id
            ? { ...p, name: editForm.name, role: editForm.role }
            : p,
        ),
      );
      toast.success('User updated successfully.');
      setEditModalOpen(false);
    }

    setSaving(false);
  };

  if (loading) {
    return <UsersSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Manage Users</h2>
        <p className="mt-1 text-gray-500">
          {profiles.length} registered users. Search, filter, and manage user roles.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <Card.Body>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name..."
                className="block w-full rounded-lg border-0 py-2 pl-10 pr-3.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              />
            </div>
            <div className="w-full sm:w-40">
              <Select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Roles' },
                  { value: 'user', label: 'Users' },
                  { value: 'admin', label: 'Admins' },
                ]}
              />
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Users Table */}
      <Card>
        <Card.Header>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-400" />
            <h3 className="text-base font-semibold text-gray-900">
              Users ({filteredProfiles.length})
            </h3>
          </div>
        </Card.Header>

        {filteredProfiles.length === 0 ? (
          <Card.Body>
            <div className="flex flex-col items-center py-8 text-center">
              <Users className="h-12 w-12 text-gray-300" />
              <p className="mt-4 text-sm text-gray-500">
                {searchQuery || roleFilter !== 'all'
                  ? 'No users match your filters.'
                  : 'No users found.'}
              </p>
            </div>
          </Card.Body>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredProfiles.map((profile) => (
                  <tr key={profile.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={profile.avatar_url}
                          name={profile.name}
                          size="md"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {profile.name}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {profile.id.slice(0, 8)}...
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <Badge variant={profile.role === 'admin' ? 'info' : 'default'}>
                        <span className="flex items-center gap-1">
                          {profile.role === 'admin' ? (
                            <ShieldCheck className="h-3 w-3" />
                          ) : (
                            <User className="h-3 w-3" />
                          )}
                          {profile.role}
                        </span>
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {formatDate(profile.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openEditModal(profile)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                        aria-label={`Edit ${profile.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Edit Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit User"
      >
        {editingProfile && (
          <div className="space-y-5">
            {/* User preview */}
            <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
              <Avatar
                src={editingProfile.avatar_url}
                name={editingProfile.name}
                size="lg"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {editingProfile.name}
                </p>
                <p className="text-xs text-gray-500">
                  Member since {formatDate(editingProfile.created_at)}
                </p>
              </div>
            </div>

            <Input
              label="Name"
              value={editForm.name}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, name: e.target.value }))
              }
            />

            <Select
              label="Role"
              value={editForm.role}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  role: e.target.value as UserRole,
                }))
              }
              options={roleOptions}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setEditModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={saving}
                onClick={handleSave}
              >
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
