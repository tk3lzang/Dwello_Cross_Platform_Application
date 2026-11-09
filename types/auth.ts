/**
 * Authentication and User Profile Types for Dwello Mobile
 */

export type UserRole = 'Tenant' | 'Landlord' | 'Student';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string; // 8-digit Bhutan number (17xxxxxx or 77xxxxxx)
  role: UserRole;
  bio?: string;
  avatarUrl?: string;
  occupation?: string;
  preferredZone?: string;
  budget?: number;
  gender?: 'Male' | 'Female' | 'Other';
  habits?: string[];
  language: 'en' | 'dz'; // English or Dzongkha
  notificationsEnabled: boolean;
  createdAt: string;
}

export interface PublicUserProfile {
  id: string;
  fullName: string;
  phoneNumber: string;
  role: UserRole;
  bio: string;
  avatarUrl: string;
  occupation: string;
  preferredZone: string;
  budget?: number;
}

export interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}
