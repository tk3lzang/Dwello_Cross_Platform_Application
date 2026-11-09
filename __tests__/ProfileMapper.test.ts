import { profileFromRow, publicProfileFromRow } from '@/services/profileMapper';

describe('Profile data mapping', () => {
  const authUser = {
    id: '90d5d9c7-6c8e-4301-b026-f34a2c5391b5',
    email: 'user@example.com',
    created_at: '2026-11-09T00:00:00.000Z',
  };

  test('maps persisted profile fields into the signed-in user model', () => {
    const profile = profileFromRow(authUser, {
      id: authUser.id,
      full_name: 'Tashi Wangchuk',
      phone_number: '17123456',
      role: 'Student',
      bio: 'Looking for a quiet place.',
      avatar_url: 'https://storage.example/avatar.jpg?v=123',
      occupation: 'Student',
      preferred_zone: 'Babesa',
      budget: '12000',
      gender: 'Other',
      habits: ['Quiet / Study Environment'],
    });

    expect(profile).toMatchObject({
      id: authUser.id,
      fullName: 'Tashi Wangchuk',
      phoneNumber: '17123456',
      role: 'Student',
      bio: 'Looking for a quiet place.',
      avatarUrl: 'https://storage.example/avatar.jpg?v=123',
      occupation: 'Student',
      preferredZone: 'Babesa',
      budget: 12000,
      gender: 'Other',
      habits: ['Quiet / Study Environment'],
    });
  });

  test('maps a public profile only from its supplied user row', () => {
    const profile = publicProfileFromRow({
      id: authUser.id,
      full_name: 'Pema Choden',
      phone_number: '77123456',
      role: 'Tenant',
      bio: '',
      avatar_url: '',
      occupation: 'Teacher',
      preferred_zone: 'Thimphu',
      budget: 18000,
      gender: 'Female',
      habits: ['Private preference'],
    });

    expect(profile).toEqual({
      id: authUser.id,
      fullName: 'Pema Choden',
      phoneNumber: '77123456',
      role: 'Tenant',
      bio: '',
      avatarUrl: '',
      occupation: 'Teacher',
      preferredZone: 'Thimphu',
      budget: 18000,
    });
  });

  test('does not retain old public values when the next user has empty fields', () => {
    const profile = publicProfileFromRow({
      id: '3ba7022c-e2b8-4375-b961-f895b9bd8f17',
      full_name: '',
      phone_number: '',
      role: 'Tenant',
      bio: '',
      avatar_url: '',
      occupation: '',
      preferred_zone: '',
      budget: null,
    });

    expect(profile.fullName).toBe('');
    expect(profile.avatarUrl).toBe('');
    expect(profile.bio).toBe('');
    expect(profile.budget).toBeUndefined();
  });
});
