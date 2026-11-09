/**
 * AuthContext for Dwello Mobile
 * Manages user authentication state, smart session check, and persistent profile storage.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthService } from '@/services/auth';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { UserProfile, UserRole } from '@/types/auth';
import { useDebug } from './DebugContext';
import { normalizeBackendError } from '@/utils/backendError';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, pass: string) => Promise<UserProfile>;
  signUp: (name: string, phone: string, email: string, pass: string, role?: UserRole) => Promise<UserProfile>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<UserProfile>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { showDebugBanner } = useDebug();

  useEffect(() => {
    let isMounted = true;

    async function runSmartSessionCheck() {
      console.log('[Dwello-Auth Debug]: Running automated Smart Session Check...');
      try {
        const activeProfile = await AuthService.checkSession();
        if (isMounted) {
          setUser(activeProfile);
          if (activeProfile) {
            console.log('[Dwello-Auth Debug]: Smart session check restored an active profile.');
          }
        }
      } catch (err: any) {
        console.error('[Dwello-Error Debug]: Smart session check failure:', err);
        showDebugBanner('error', 'Session Check Failed', err.message || 'Unable to verify session.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    runSmartSessionCheck();

    // Listen for auth events (e.g. SIGNED_OUT from any part of app or remote trigger)
    let authSubscription: { unsubscribe: () => void } | null = null;
    if (isSupabaseConfigured()) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
        console.log(`[Dwello-Auth Debug]: Supabase onAuthStateChange event: ${event}`);
        if (event === 'SIGNED_OUT') {
          await AuthService.purgeSessionAndCache();
          if (isMounted) {
            setUser(null);
          }
        }
      });
      authSubscription = subscription;
    }

    return () => {
      isMounted = false;
      authSubscription?.unsubscribe();
    };
  }, []);

  const login = async (email: string, pass: string): Promise<UserProfile> => {
    setIsLoading(true);
    try {
      const profile = await AuthService.login(email, pass);
      setUser(profile);
      showDebugBanner('success', 'Logged In', `Welcome back, ${profile.fullName}!`);
      return profile;
    } catch (err: any) {
      const norm = normalizeBackendError(err);
      showDebugBanner(
        'error',
        norm.category === 'dns'
          ? 'DNS Connection Error'
          : norm.category === 'authentication'
          ? 'Authentication Notice'
          : 'Login Failed',
        norm.userFacingMessage || err.message || 'Login failed.'
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (
    name: string,
    phone: string,
    email: string,
    pass: string,
    role: UserRole = 'Tenant'
  ): Promise<UserProfile> => {
    setIsLoading(true);
    try {
      const profile = await AuthService.signUp(name, phone, email, pass, role);
      setUser(profile);
      showDebugBanner('success', 'Account Created', `Welcome to Dwello, ${profile.fullName}!`);
      return profile;
    } catch (err: any) {
      const norm = normalizeBackendError(err);
      showDebugBanner(
        'error',
        norm.category === 'dns'
          ? 'DNS Connection Error'
          : norm.category === 'authentication'
          ? 'Registration Notice'
          : 'Sign Up Failed',
        norm.userFacingMessage || err.message || 'Account registration failed.'
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await AuthService.logout();
      setUser(null);
      showDebugBanner('info', 'Logged Out', 'You have been safely signed out.');
    } catch (err: any) {
      showDebugBanner('error', 'Logout Error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const requestPasswordReset = async (email: string): Promise<boolean> => {
    try {
      const success = await AuthService.requestPasswordReset(email);
      if (success) {
        showDebugBanner(
          'success',
          'Password Reset Sent',
          'A password reset link has been dispatched to your email.'
        );
      }
      return success;
    } catch (err: any) {
      showDebugBanner('error', 'Reset Failed', err.message);
      return false;
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>): Promise<UserProfile> => {
    try {
      const updated = await AuthService.updateProfile(updates);
      setUser(updated);
      showDebugBanner('success', 'Profile Updated', 'Your profile details have been saved.');
      return updated;
    } catch (err: any) {
      showDebugBanner('error', 'Update Failed', err.message);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signUp,
        logout,
        requestPasswordReset,
        updateProfile,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
