import { PublicUserProfile, UserProfile, UserRole } from '@/types/auth';

type AuthUser = {
  id: string;
  email?: string;
  created_at?: string;
  user_metadata?: Record<string, unknown>;
};

export function profileFromRow(user: AuthUser, row: Record<string, any>): UserProfile {
  const metadata = user.user_metadata || {};
  return {
    id: user.id,
    email: user.email || '',
    fullName: row.full_name ?? row.fullName ?? metadata.full_name ?? '',
    phoneNumber: row.phone_number ?? row.phoneNumber ?? metadata.phone_number ?? '',
    role: (row.role ?? metadata.role ?? 'Tenant') as UserRole,
    bio: row.bio ?? '',
    avatarUrl: row.avatar_url ?? row.avatarUrl ?? '',
    occupation: row.occupation ?? '',
    preferredZone: row.preferred_zone ?? row.preferredZone ?? '',
    budget: row.budget == null ? undefined : Number(row.budget),
    gender: row.gender || undefined,
    habits: row.habits || [],
    language: 'en',
    notificationsEnabled: true,
    createdAt: row.created_at || row.createdAt || user.created_at || new Date().toISOString(),
  };
}

export function publicProfileFromRow(row: Record<string, any>): PublicUserProfile {
  return {
    id: row.id,
    fullName: row.full_name || '',
    phoneNumber: row.phone_number || '',
    role: (row.role || 'Tenant') as UserRole,
    bio: row.bio || '',
    avatarUrl: row.avatar_url || '',
    occupation: row.occupation || '',
    preferredZone: row.preferred_zone || '',
    budget: row.budget == null ? undefined : Number(row.budget),
  };
}
