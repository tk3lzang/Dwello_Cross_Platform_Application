/**
 * Local Offline Storage Service for Dwello
 * Powered by @react-native-async-storage/async-storage.
 * Ensures offline resilience for wishlists, listings cache, and user sessions.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { PropertyListing } from '@/types/listing';
import { UserProfile } from '@/types/auth';

const KEYS = {
  WISHLIST_IDS: '@dwello_wishlist_ids',
  OFFLINE_LISTINGS: '@dwello_offline_listings',
  AUTH_PROFILE: '@dwello_auth_profile',
  APP_LANGUAGE: '@dwello_app_language',
  NOTIFICATIONS_ENABLED: '@dwello_notifications_enabled',
};

export const StorageService = {
  /**
   * Retrieves array of saved wishlist listing IDs
   */
  async getWishlistIds(): Promise<string[]> {
    console.log('[Dwello-DB Debug]: Fetching wishlist IDs from offline storage...');
    try {
      const raw = await AsyncStorage.getItem(KEYS.WISHLIST_IDS);
      const parsed = raw ? JSON.parse(raw) : [];
      console.log(`[Dwello-DB Debug]: Retrieved ${parsed.length} saved wishlist items from disk.`);
      return parsed;
    } catch (error) {
      console.error('[Dwello-Error Debug]: Error reading wishlist from AsyncStorage:', error);
      return [];
    }
  },

  /**
   * Persists array of wishlist IDs
   */
  async saveWishlistIds(ids: string[]): Promise<void> {
    console.log(`[Dwello-DB Debug]: Storing ${ids.length} wishlist IDs to offline storage`);
    try {
      await AsyncStorage.setItem(KEYS.WISHLIST_IDS, JSON.stringify(ids));
    } catch (error) {
      console.error('[Dwello-Error Debug]: Error saving wishlist IDs:', error);
    }
  },

  /**
   * Caches active listings for offline browsing resilience
   */
  async getCachedListings(): Promise<PropertyListing[]> {
    console.log('[Dwello-DB Debug]: Attempting to read cached listings for offline resilience...');
    try {
      const raw = await AsyncStorage.getItem(KEYS.OFFLINE_LISTINGS);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      console.error('[Dwello-Error Debug]: Error reading cached listings:', error);
      return [];
    }
  },

  /**
   * Saves updated listings into offline disk cache
   */
  async setCachedListings(listings: PropertyListing[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.OFFLINE_LISTINGS, JSON.stringify(listings));
      console.log(`[Dwello-DB Debug]: Successfully cached ${listings.length} listings offline.`);
    } catch (error) {
      console.error('[Dwello-Error Debug]: Error caching listings offline:', error);
    }
  },

  /**
   * Stores user profile locally for persistent session check
   */
  async getSavedUserProfile(): Promise<UserProfile | null> {
    console.log('[Dwello-Auth Debug]: Retrieving persistent local session profile...');
    try {
      const raw = await AsyncStorage.getItem(KEYS.AUTH_PROFILE);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error('[Dwello-Error Debug]: Error loading saved profile:', error);
      return null;
    }
  },

  async setSavedUserProfile(profile: UserProfile | null): Promise<void> {
    try {
      if (profile) {
        await AsyncStorage.setItem(KEYS.AUTH_PROFILE, JSON.stringify(profile));
        console.log('[Dwello-Auth Debug]: Persisted user session to local storage for:', profile.email);
      } else {
        await AsyncStorage.removeItem(KEYS.AUTH_PROFILE);
        console.log('[Dwello-Auth Debug]: Cleared persistent user session from local storage.');
      }
    } catch (error) {
      console.error('[Dwello-Error Debug]: Error persisting user profile:', error);
    }
  },

  async getAppLanguage(): Promise<'en' | 'dz'> {
    try {
      const lang = await AsyncStorage.getItem(KEYS.APP_LANGUAGE);
      return lang === 'dz' ? 'dz' : 'en';
    } catch {
      return 'en';
    }
  },

  async setAppLanguage(lang: 'en' | 'dz'): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.APP_LANGUAGE, lang);
    } catch (error) {
      console.error('[Dwello-Error Debug]: Failed to save language setting:', error);
    }
  },

  async getNotificationsEnabled(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(KEYS.NOTIFICATIONS_ENABLED);
      return val !== 'false';
    } catch {
      return true;
    }
  },

  async setNotificationsEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.NOTIFICATIONS_ENABLED, enabled ? 'true' : 'false');
    } catch (error) {
      console.error('[Dwello-Error Debug]: Failed to save notification setting:', error);
    }
  },
};

