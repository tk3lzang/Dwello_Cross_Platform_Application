/**
 * Authentication Service for Dwello Mobile
 * Incorporates Supabase Auth with persistent session caching and strict Bhutanese phone validation.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import { supabase, isSupabaseConfigured } from './supabase';
import { StorageService } from './storage';
import { ModerationService } from './moderationService';
import { PublicUserProfile, UserProfile, UserRole } from '@/types/auth';
import { validateBhutanPhone, validateEmail, validatePassword } from '@/utils/validation';
import { logBackendError } from '@/utils/backendError';
import { profileFromRow, publicProfileFromRow } from './profileMapper';
import { DatabaseService } from './database';

// Demo account used to seed sample listing ownership.
const DEFAULT_DEMO_USER: UserProfile = {
  id: 'owner-tandin',
  email: '02240180.cst@rub.edu.bt',
  fullName: 'Tandin Kelzang',
  phoneNumber: '17777777',
  role: 'Landlord',
  bio: 'Student at College of Science & Technology (CST), Rinchending. Managing urban rentals and flatmate matches.',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
  occupation: 'Student / Tech Entrepreneur',
  preferredZone: 'Rinchending (CST)',
  budget: 15000,
  language: 'en',
  notificationsEnabled: true,
  createdAt: '2026-01-15T00:00:00.000Z',
};

const PROFILE_COLUMNS =
  'id, full_name, phone_number, role, bio, avatar_url, occupation, preferred_zone, budget, gender, habits, created_at';

let hasWarnedMissingPublicProfilesView = false;

function avatarContentType(extension: string): string {
  switch (extension.toLowerCase()) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    default:
      return 'image/jpeg';
  }
}

export const AuthService = {
  /**
   * Smart Session Check: Checks if there is an active session stored locally or in Supabase
   */
  async checkSession(): Promise<UserProfile | null> {
    console.log('[Dwello-Auth Debug]: Initiating Smart Session Check...');
    try {
      const savedProfile = await StorageService.getSavedUserProfile();

      if (isSupabaseConfigured()) {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (session?.user) {
          console.log('[Dwello-Auth Debug]: Supabase session found for user ID:', session.user.id);
          const { data: profileRow, error: profileError } = await supabase
            .from('profiles')
            .select(PROFILE_COLUMNS)
            .eq('id', session.user.id)
            .maybeSingle();
          if (profileError) {
            console.warn('[Dwello-Auth Debug]: Using same-account cached profile after profile lookup failed:', profileError);
            const fallback =
              savedProfile?.id === session.user.id
                ? savedProfile
                : profileFromRow(session.user, {});
            await StorageService.setSavedUserProfile(fallback);
            return fallback;
          }

          const profile = profileFromRow(session.user, profileRow || {});
          await StorageService.setSavedUserProfile(profile);
          return profile;
        }
      }

      if (!isSupabaseConfigured()) {
        return savedProfile;
      }

      console.log('[Dwello-Auth Debug]: No active session found. Presenting Welcome / Authentication screen.');
      return null;
    } catch (error) {
      console.error('[Dwello-Error Debug]: Error during Smart Session Check:', error);
      return null;
    }
  },

  /**
   * Logs in a user with email and password
   */
  async login(email: string, pass: string): Promise<UserProfile> {
    console.log('[Dwello-Auth Debug]: Attempting login.');

    if (!validateEmail(email)) {
      throw new Error('Please enter a valid email address.');
    }
    if (!validatePassword(pass)) {
      throw new Error('Password must be at least 6 characters long.');
    }

    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: pass,
        });

        if (error) {
          const normalized = logBackendError('AuthService.login', error);
          const err = new Error(normalized.userFacingMessage);
          (err as any).code = normalized.code;
          (err as any).category = normalized.category;
          (err as any).status = normalized.status;
          throw err;
        }

        if (data.user) {
          const { data: profileRow, error: profileError } = await supabase
            .from('profiles')
            .select(PROFILE_COLUMNS)
            .eq('id', data.user.id)
            .maybeSingle();
          if (profileError) {
            console.warn('[Dwello-Auth Debug]: Profile lookup failed after login:', profileError);
            const cachedProfile = await StorageService.getSavedUserProfile();
            const fallback =
              cachedProfile?.id === data.user.id
                ? cachedProfile
                : profileFromRow(data.user, {});
            await StorageService.setSavedUserProfile(fallback);
            return fallback;
          }

          const profile = profileFromRow(data.user, profileRow || {});
          await StorageService.setSavedUserProfile(profile);
          console.log('[Dwello-Auth Debug]: Login successful.');
          return profile;
        }
      }

      throw new Error('Supabase client is not configured.');
    } catch (error: any) {
      console.warn('[Dwello-Auth Debug]: Login request failed.');
      throw error;
    }
  },

  /**
   * Registers a new user with strict 8-digit Bhutan phone validation
   */
  async signUp(
    fullName: string,
    phone: string,
    email: string,
    pass: string,
    role: UserRole = 'Tenant'
  ): Promise<UserProfile> {
    console.log('[Dwello-Auth Debug]: Registering account.');

    if (!fullName || fullName.trim().length < 2) {
      throw new Error('Please enter your full name.');
    }
    if (!validateBhutanPhone(phone)) {
      throw new Error('Please enter a valid 8-digit Bhutanese phone number starting with 17 or 77.');
    }
    if (!validateEmail(email)) {
      throw new Error('Please enter a valid email address.');
    }
    if (!validatePassword(pass)) {
      throw new Error('Password must be at least 6 characters.');
    }

    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: pass,
          options: {
            data: {
              full_name: fullName.trim(),
              phone_number: phone.trim(),
              role,
            },
          },
        });

        if (error) {
          const normalized = logBackendError('AuthService.signUp', error);
          const err = new Error(normalized.userFacingMessage);
          (err as any).code = normalized.code;
          (err as any).category = normalized.category;
          (err as any).status = normalized.status;
          throw err;
        }

        // When email confirmation is enabled, Supabase returns empty identities array for existing users
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          const normalized = logBackendError('AuthService.signUp:Duplicate', {
            message: 'User already registered',
            code: 'USER_ALREADY_EXISTS',
          });
          const err = new Error(normalized.userFacingMessage);
          (err as any).code = normalized.code;
          (err as any).category = normalized.category;
          throw err;
        }

        if (data.user) {
          const newProfile: UserProfile = {
            id: data.user.id,
            email: email.trim(),
            fullName: fullName.trim(),
            phoneNumber: phone.trim(),
            role,
            language: 'en',
            notificationsEnabled: true,
            createdAt: new Date().toISOString(),
          };

          // Upsert to remote profiles table
          try {
            await supabase.from('profiles').upsert({
              id: data.user.id,
              full_name: fullName.trim(),
              phone_number: phone.trim(),
              role,
              created_at: newProfile.createdAt,
            });
          } catch (pErr) {
            console.warn('[Dwello-Auth Debug]: Initial profile upsert error:', pErr);
          }

          await StorageService.setSavedUserProfile(newProfile);
          console.log('[Dwello-Auth Debug]: Account registration successful.');
          return newProfile;
        }
      }

      throw new Error('Supabase client is not configured.');
    } catch (error: any) {
      console.warn('[Dwello-Auth Debug]: Account registration request failed.');
      throw error;
    }
  },

  /**
   * Sends password reset link to registered email
   */
  async requestPasswordReset(email: string): Promise<boolean> {
    console.log('[Dwello-Auth Debug]: Requesting password reset.');
    if (!validateEmail(email)) {
      throw new Error('Please provide a valid registered email address.');
    }

    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: 'dwello://reset-password',
        });
        if (error) {
          logBackendError('AuthService.requestPasswordReset', error);
          throw error;
        }
      }
      console.log('[Dwello-Auth Debug]: Password reset request completed.');
      return true;
    } catch (error: any) {
      console.warn('[Dwello-Auth Debug]: Password reset request failed.');
      throw error;
    }
  },

  /**
   * Clears all session cache, auth tokens, and temporary stores to prevent cross-account leak
   */
  async purgeSessionAndCache(): Promise<void> {
    console.log('[Dwello-Auth Debug]: Purging all session cache, auth tokens, and temporary stores...');
    try {
      await StorageService.setSavedUserProfile(null);
      await AsyncStorage.multiRemove([
        'supabase.auth.token',
        '@dwello_auth_profile',
        '@dwello_local_notifications',
        '@dwello_user_hidden_listings',
        '@dwello_local_reports',
        '@dwello_local_appeals',
      ]);
      ModerationService.clearUserData();
      console.log('[Dwello-Auth Debug]: Cross-account cache purge completed.');
    } catch (error) {
      console.error('[Dwello-Error Debug]: Error purging session and cache:', error);
    }
  },

  /**
   * Logs out the active user, signs out of Supabase, and purges all local session keys
   */
  async logout(): Promise<void> {
    console.log('[Dwello-Auth Debug]: Terminating user session and logging out...');
    try {
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut();
      }
      await this.purgeSessionAndCache();
      console.log('[Dwello-Auth Debug]: Logout completed successfully.');
    } catch (error) {
      console.error('[Dwello-Error Debug]: Logout error:', error);
    }
  },

  async fetchPublicProfile(userId: string): Promise<PublicUserProfile | null> {
    if (
      !isSupabaseConfigured() ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
    ) {
      return null;
    }

    const { data, error } = await supabase
      .from('public_profiles')
      .select('id, full_name, phone_number, role, bio, avatar_url, occupation, preferred_zone, budget')
      .eq('id', userId)
      .maybeSingle();
    if (error?.code === 'PGRST205') {
      if (!hasWarnedMissingPublicProfilesView) {
        console.warn(
          '[Dwello-Profile Warning]: public_profiles is unavailable. Apply the profile sync migration to Supabase to enable live public profile details.'
        );
        hasWarnedMissingPublicProfilesView = true;
      }
      return null;
    }
    if (error) throw error;
    if (!data) return null;

    return publicProfileFromRow(data);
  },

  /**
   * Updates user profile fields and synchronizes with Supabase profiles table
   */
  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    console.log('[Dwello-Auth Debug]: Updating user profile.');
    let uploadedAvatarPath: string | null = null;
    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Profile updates require a connection to the account service.');
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user) throw new Error('Please sign in again before updating your profile.');

      const { data: profileRow, error: fetchError } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', session.user.id)
        .maybeSingle();
      if (fetchError) throw fetchError;

      const current = profileFromRow(
        session.user,
        profileRow || {}
      );
      let avatarUrl = updates.avatarUrl ?? current.avatarUrl;

      if (avatarUrl && !/^https?:\/\//i.test(avatarUrl)) {
        if (!/^(file|content):\/\//i.test(avatarUrl)) {
          throw new Error('Please select your profile photo again before saving.');
        }

        const file = new File(avatarUrl);
        const extension = file.extension.replace(/^\./, '').toLowerCase() || 'jpg';
        const allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']);
        if (!allowedExtensions.has(extension)) {
          throw new Error('Please choose a JPEG, PNG, WebP, or HEIC image.');
        }

        const path = `${session.user.id}/avatar-${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('profile-avatars')
          .upload(path, await file.arrayBuffer(), {
            contentType: avatarContentType(extension),
            cacheControl: '3600',
            upsert: false,
          });
        if (uploadError) throw uploadError;
        uploadedAvatarPath = path;
        const publicUrl = supabase.storage.from('profile-avatars').getPublicUrl(path).data.publicUrl;
        avatarUrl = `${publicUrl}${publicUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;
      }

      const updated: UserProfile = {
        ...current,
        ...updates,
        id: session.user.id,
        email: session.user.email || current.email,
        createdAt: current.createdAt || session.user.created_at,
        avatarUrl,
      };

      const { data: savedRow, error: saveError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: session.user.id,
            full_name: updated.fullName,
            phone_number: updated.phoneNumber,
            role: updated.role,
            bio: updated.bio || '',
            avatar_url: updated.avatarUrl || '',
            occupation: updated.occupation || '',
            preferred_zone: updated.preferredZone || '',
            budget: updated.budget ?? null,
            gender: updated.gender || null,
            habits: updated.habits || [],
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
        .select(PROFILE_COLUMNS)
        .single();
      if (saveError) throw saveError;
      if (savedRow.id !== session.user.id) {
        throw new Error('The saved profile did not match the signed-in account.');
      }

      const persistedProfile = profileFromRow(session.user, savedRow);
      await StorageService.setSavedUserProfile(persistedProfile);
      DatabaseService.updateListingsOwnerProfile(persistedProfile);
      console.log('[Dwello-Auth Debug]: User profile update confirmed by Supabase.');
      return persistedProfile;
    } catch (error) {
      if (uploadedAvatarPath) {
        const { error: cleanupError } = await supabase.storage
          .from('profile-avatars')
          .remove([uploadedAvatarPath]);
        if (cleanupError) {
          console.warn('[Dwello-Auth Debug]: Could not remove unreferenced profile image:', cleanupError);
        }
      }
      console.error('[Dwello-Error Debug]: Profile update failed:', error);
      throw error;
    }
  },
};
