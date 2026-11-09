/**
 * Offline Synchronization & Local Storage Caching Service
 * Manages offline mutation queue, network state detection via NetInfo,
 * and automatic background synchronization to Supabase upon reconnection.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { supabase, isSupabaseConfigured } from './supabase';
import { PropertyListing } from '@/types/listing';
import { listingFromDatabase, listingToDatabase } from './listingMapper';

export type OfflineActionType =
  | 'TOGGLE_FAVORITE'
  | 'CREATE_LISTING'
  | 'UPDATE_LISTING_STATUS'
  | 'UPDATE_LISTING'
  | 'DELETE_LISTING'
  | 'SUBMIT_REPORT';

export interface QueuedOfflineAction {
  id: string;
  type: OfflineActionType;
  payload: any;
  timestamp: string;
}

const STORAGE_KEYS = {
  OFFLINE_QUEUE: '@dwello_offline_action_queue',
  VIEWED_LISTINGS: '@dwello_viewed_listings',
  CACHED_FAVORITES: '@dwello_cached_favorites',
  SEARCH_CACHE: '@dwello_search_cache',
};

let isOnline = true;
let isSyncing = false;
type SyncListener = (pendingCount: number, isOnline: boolean) => void;
const syncListeners: Set<SyncListener> = new Set();

function notifySyncListeners(pendingCount: number) {
  syncListeners.forEach((listener) => {
    try {
      listener(pendingCount, isOnline);
    } catch (e) {
      console.error('[Dwello-OfflineSync Debug]: Listener callback error:', e);
    }
  });
}

export const OfflineSyncService = {
  /**
   * Subscribe to network and queue state updates
   */
  subscribe(listener: SyncListener): () => void {
    syncListeners.add(listener);
    return () => syncListeners.delete(listener);
  },

  /**
   * Get current online status
   */
  getIsOnline(): boolean {
    return isOnline;
  },

  /**
   * Initializes network monitoring and processes pending queue if online
   */
  init(): () => void {
    console.log('[Dwello-OfflineSync Debug]: Initializing OfflineSyncService and NetInfo listener...');

    // Initial check
    NetInfo.fetch().then((state: NetInfoState) => {
      isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      console.log(`[Dwello-OfflineSync Debug]: Initial network status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
      if (isOnline) {
        OfflineSyncService.syncPendingActions();
      }
    });

    // Subscribe to network transitions
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const nowOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      const transitionedToOnline = !isOnline && nowOnline;
      isOnline = nowOnline;

      console.log(`[Dwello-OfflineSync Debug]: Network state changed -> ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

      if (transitionedToOnline) {
        console.log('[Dwello-OfflineSync Debug]: Connection restored! Triggering background sync...');
        OfflineSyncService.syncPendingActions();
      }
    });

    return unsubscribe;
  },

  /**
   * Retrieves pending offline actions from AsyncStorage
   */
  async getQueue(): Promise<QueuedOfflineAction[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('[Dwello-OfflineSync Debug]: Failed to read offline queue:', e);
      return [];
    }
  },

  /**
   * Enqueues a mutation when device is offline or when immediate remote write fails
   */
  async enqueueAction(type: OfflineActionType, payload: any): Promise<void> {
    const action: QueuedOfflineAction = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type,
      payload,
      timestamp: new Date().toISOString(),
    };

    console.log(`[Dwello-OfflineSync Debug]: Enqueueing offline action: ${type}`, action.id);
    try {
      const currentQueue = await OfflineSyncService.getQueue();
      const updatedQueue = [...currentQueue, action];
      await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(updatedQueue));
      notifySyncListeners(updatedQueue.length);

      // If online right now, attempt immediate background flush
      if (isOnline) {
        OfflineSyncService.syncPendingActions();
      }
    } catch (e) {
      console.error('[Dwello-OfflineSync Debug]: Error saving queued action:', e);
    }
  },

  /**
   * Flushes and processes the offline queue in background, syncing to Supabase
   */
  async syncPendingActions(): Promise<void> {
    if (isSyncing) return;
    if (!isOnline || !isSupabaseConfigured()) {
      const q = await OfflineSyncService.getQueue();
      notifySyncListeners(q.length);
      return;
    }

    isSyncing = true;
    console.log('[Dwello-OfflineSync Debug]: Starting background sync to Supabase...');

    try {
      const queue = await OfflineSyncService.getQueue();
      if (queue.length === 0) {
        console.log('[Dwello-OfflineSync Debug]: No pending offline actions to sync.');
        isSyncing = false;
        notifySyncListeners(0);
        return;
      }

      console.log(`[Dwello-OfflineSync Debug]: Processing ${queue.length} pending offline mutations...`);
      const remaining: QueuedOfflineAction[] = [];

      for (const action of queue) {
        try {
          console.log(`[Dwello-OfflineSync Debug]: Syncing item ${action.id} (${action.type})...`);
          switch (action.type) {
            case 'CREATE_LISTING': {
              const listing = listingFromDatabase(action.payload as Record<string, unknown>);
              const { error } = await supabase.from('listings').insert([listingToDatabase(listing)]);
              if (error) throw error;
              break;
            }
            case 'UPDATE_LISTING_STATUS': {
              const { id, status } = action.payload;
              const { error } = await supabase
                .from('listings')
                .update({ status, updated_at: new Date().toISOString() })
                .eq('id', id);
              if (error) throw error;
              break;
            }
            case 'UPDATE_LISTING': {
              const { id, updates } = action.payload;
              const { error } = await supabase
                .from('listings')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id);
              if (error) throw error;
              break;
            }
            case 'DELETE_LISTING': {
              const { id } = action.payload;
              const { error } = await supabase.from('listings').delete().eq('id', id);
              if (error) throw error;
              break;
            }
            case 'SUBMIT_REPORT': {
              console.warn(
                `[Dwello-OfflineSync Warning]: Discarding obsolete report queue item ${action.id}; reports must be resubmitted while signed in so the authenticated RPC can assign the reporter.`
              );
              break;
            }
            case 'TOGGLE_FAVORITE': {
              const { listingId, isSaved, userId } = action.payload;
              if (userId) {
                if (isSaved) {
                  await supabase.from('wishlists').upsert({ user_id: userId, listing_id: listingId });
                } else {
                  await supabase.from('wishlists').delete().eq('user_id', userId).eq('listing_id', listingId);
                }
              }
              break;
            }
          }
          console.log(`[Dwello-OfflineSync Debug]: Successfully synced ${action.id}`);
        } catch (itemError) {
          console.warn(`[Dwello-OfflineSync Debug]: Failed to sync action ${action.id}, retaining in queue:`, itemError);
          remaining.push(action);
        }
      }

      await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(remaining));
      console.log(`[Dwello-OfflineSync Debug]: Sync complete. Remaining in queue: ${remaining.length}`);
      notifySyncListeners(remaining.length);
    } catch (e) {
      console.error('[Dwello-OfflineSync Debug]: Background sync encountered error:', e);
    } finally {
      isSyncing = false;
    }
  },

  // -------------------------------------------------------------
  // Offline Data Caching: Viewed listings, Search Results, Favorites
  // -------------------------------------------------------------

  /**
   * Cache a listing viewed by the user for offline access
   */
  async cacheViewedListing(listing: PropertyListing): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.VIEWED_LISTINGS);
      const existing: PropertyListing[] = raw ? JSON.parse(raw) : [];
      const filtered = existing.filter((item) => item.id !== listing.id);
      const updated = [listing, ...filtered].slice(0, 50); // Keep 50 most recent
      await AsyncStorage.setItem(STORAGE_KEYS.VIEWED_LISTINGS, JSON.stringify(updated));
      console.log(`[Dwello-OfflineSync Debug]: Cached viewed listing "${listing.title}" for offline use.`);
    } catch (e) {
      console.error('[Dwello-OfflineSync Debug]: Error caching viewed listing:', e);
    }
  },

  /**
   * Retrieve all viewed listings cached offline
   */
  async getViewedListings(): Promise<PropertyListing[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.VIEWED_LISTINGS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('[Dwello-OfflineSync Debug]: Error retrieving viewed listings:', e);
      return [];
    }
  },

  /**
   * Cache search results to disk
   */
  async cacheSearchResults(query: string, results: PropertyListing[]): Promise<void> {
    if (!query || query.trim().length === 0) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.SEARCH_CACHE);
      const cache: Record<string, PropertyListing[]> = raw ? JSON.parse(raw) : {};
      cache[query.trim().toLowerCase()] = results;
      await AsyncStorage.setItem(STORAGE_KEYS.SEARCH_CACHE, JSON.stringify(cache));
      console.log(`[Dwello-OfflineSync Debug]: Cached ${results.length} search results for "${query}"`);
    } catch (e) {
      console.error('[Dwello-OfflineSync Debug]: Error caching search results:', e);
    }
  },

  /**
   * Get cached search results for query
   */
  async getCachedSearchResults(query: string): Promise<PropertyListing[] | null> {
    if (!query) return null;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.SEARCH_CACHE);
      if (!raw) return null;
      const cache: Record<string, PropertyListing[]> = JSON.parse(raw);
      return cache[query.trim().toLowerCase()] || null;
    } catch (e) {
      console.error('[Dwello-OfflineSync Debug]: Error reading search cache:', e);
      return null;
    }
  },

  /**
   * Cache full favorited listing cards for offline viewing
   */
  async cacheFavorites(favorites: PropertyListing[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CACHED_FAVORITES, JSON.stringify(favorites));
      console.log(`[Dwello-OfflineSync Debug]: Saved ${favorites.length} favorited listing objects for offline reference.`);
    } catch (e) {
      console.error('[Dwello-OfflineSync Debug]: Error caching favorites:', e);
    }
  },

  /**
   * Retrieve cached favorited listings
   */
  async getCachedFavorites(): Promise<PropertyListing[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_FAVORITES);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('[Dwello-OfflineSync Debug]: Error reading cached favorites:', e);
      return [];
    }
  },
};
