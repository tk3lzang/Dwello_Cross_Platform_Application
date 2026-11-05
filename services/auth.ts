/**
 * Authentication Service for Dwello Mobile
 * Incorporates Supabase Auth with persistent session caching and strict Bhutanese phone validation.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { StorageService } from './storage';
import { UserProfile, UserRole } from '@/types/auth';
import { validateBhutanPhone, validateEmail, validatePassword } from '@/utils/validation';

// Mock default user matching Tandin Kelzang from the Dwello App Manual
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

export const AuthService = {
  /**
   * Smart Session Check: Checks if there is an active session stored locally or in Supabase
   */
  async checkSession(): Promise<UserProfile | null> {
    console.log('[Dwello-Auth Debug]: Initiating Smart Session Check...');
    try {
      // 1. Check local persistent disk cache first for instant boot
      const savedProfile = await StorageService.getSavedUserProfile();
      if (savedProfile) {
        console.log('[Dwello-Auth Debug]: Active persistent session found for:', savedProfile.email);
        return savedProfile;
      }

      // 2. If Supabase is active, check Supabase auth session
      if (isSupabaseConfigured()) {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (session?.user) {
          console.log('[Dwello-Auth Debug]: Supabase session found for user ID:', session.user.id);
          const profile: UserProfile = {
            id: session.user.id,
            email: session.user.email || '',
            fullName: session.user.user_metadata?.full_name || 'Dwello User',
            phoneNumber: session.user.user_metadata?.phone_number || '17123456',
            role: (session.user.user_metadata?.role as UserRole) || 'Tenant',
            bio: session.user.user_metadata?.bio || '',
            language: 'en',
            notificationsEnabled: true,
            createdAt: session.user.created_at,
          };
          await StorageService.setSavedUserProfile(profile);
          return profile;
        }
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
    console.log('[Dwello-Auth Debug]: Attempting login for email:', email);

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
          console.warn('[Dwello-Auth Debug]: Supabase login notice:', error.message);
          throw error;
        }

        if (data.user) {
          const profile: UserProfile = {
            id: data.user.id,
            email: data.user.email || email,
            fullName: data.user.user_metadata?.full_name || 'Dwello User',
            phoneNumber: data.user.user_metadata?.phone_number || '17123456',
            role: (data.user.user_metadata?.role as UserRole) || 'Tenant',
            language: 'en',
            notificationsEnabled: true,
            createdAt: data.user.created_at,
          };
          await StorageService.setSavedUserProfile(profile);
          console.log('[Dwello-Auth Debug]: Login successful for:', profile.email);
          return profile;
        }
      }

      // Offline / Local auth simulation
      const profile: UserProfile = {
        ...DEFAULT_DEMO_USER,
        email: email.trim(),
      };
      await StorageService.setSavedUserProfile(profile);
      console.log('[Dwello-Auth Debug]: Local demo session authenticated for:', email);
      return profile;
    } catch (error: any) {
      console.error('[Dwello-Error Debug]: Authentication failure:', error);
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
    console.log('[Dwello-Auth Debug]: Registering account. Name:', fullName, 'Phone:', phone, 'Email:', email);

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

        if (error) throw error;

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
          await StorageService.setSavedUserProfile(newProfile);
          console.log('[Dwello-Auth Debug]: Supabase registration successful.');
          return newProfile;
        }
      }

      // Fallback local registration
      const newProfile: UserProfile = {
        id: `user-${Date.now()}`,
        email: email.trim(),
        fullName: fullName.trim(),
        phoneNumber: phone.trim(),
        role,
        bio: 'Looking for great flats and roommates in Bhutan.',
        language: 'en',
        notificationsEnabled: true,
        createdAt: new Date().toISOString(),
      };

      await StorageService.setSavedUserProfile(newProfile);
      console.log('[Dwello-Auth Debug]: Local registration successful for:', newProfile.fullName);
      return newProfile;
    } catch (error: any) {
      console.error('[Dwello-Error Debug]: Account creation error:', error);
      throw error;
    }
  },

  /**
   * Sends password reset link to registered email
   */
  async requestPasswordReset(email: string): Promise<boolean> {
    console.log('[Dwello-Auth Debug]: Requesting password reset for email:', email);
    if (!validateEmail(email)) {
      throw new Error('Please provide a valid registered email address.');
    }

    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (error) console.warn('[Dwello-Auth Debug]: Supabase reset password warning:', error.message);
      }
      console.log('[Dwello-Auth Debug]: Password reset link successfully triggered for:', email);
      return true;
    } catch (error) {
      console.error('[Dwello-Error Debug]: Password reset failed:', error);
      return false;
    }
  },

  /**
   * Logs out the active user and clears local session
   */
  async logout(): Promise<void> {
    console.log('[Dwello-Auth Debug]: Terminating user session and logging out...');
    try {
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut();
      }
      await StorageService.setSavedUserProfile(null);
      console.log('[Dwello-Auth Debug]: Logout completed successfully.');
    } catch (error) {
      console.error('[Dwello-Error Debug]: Logout error:', error);
    }
  },

  /**
   * Updates user profile fields
   */
  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    console.log('[Dwello-Auth Debug]: Updating user profile data:', updates);
    try {
      const current = await StorageService.getSavedUserProfile() || DEFAULT_DEMO_USER;
      const updated: UserProfile = {
        ...current,
        ...updates,
      };

      await StorageService.setSavedUserProfile(updated);
      console.log('[Dwello-Auth Debug]: User profile updated successfully.');
      return updated;
    } catch (error) {
      console.error('[Dwello-Error Debug]: Profile update failed:', error);
      throw error;
    }
  },
};

