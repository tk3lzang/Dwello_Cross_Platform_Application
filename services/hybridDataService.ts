/**
 * Coordinates listing data between Supabase, in-memory state, and local storage.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { StorageService } from './storage';
import { OfflineSyncService } from './offlineSync';
import { NewPropertyListing, PropertyListing, ListingFilterState } from '@/types/listing';
import { INITIAL_SEED_LISTINGS } from '@/constants/BhutanData';
import { logBackendError } from '@/utils/backendError';
import { listingFromDatabase, listingToDatabase } from './listingMapper';
import { UserProfile } from '@/types/auth';

type ListingsChangeListener = (listings: PropertyListing[]) => void;

let inMemoryListings: PropertyListing[] = [...INITIAL_SEED_LISTINGS];
const listeners: Set<ListingsChangeListener> = new Set();
let isInitialized = false;
let hasWarnedMissingPublicProfilesView = false;

function isMissingPublicProfilesView(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'PGRST205'
  );
}

function notifyListeners() {
  const snapshot = [...inMemoryListings];
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (err) {
      console.warn('[Dwello-HybridData Error]: Listener notification error:', err);
    }
  });
}

// Accept PromiseLike<T> so Supabase PostgrestFilterBuilder (thenable but not full Promise) works
function withTimeout<T>(queryPromise: PromiseLike<T>, timeoutMs: number = 3500): Promise<T> {
  return Promise.race([
    Promise.resolve(queryPromise),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

export const HybridDataService = {
  /**
   * Subscribe to real-time listing updates across all app screens
   */
  subscribe(listener: ListingsChangeListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /**
   * Gets in-memory listings synchronously (0ms UI latency)
   */
  getAllListingsSync(): PropertyListing[] {
    return [...inMemoryListings];
  },

  updateListingsOwnerProfile(profile: Pick<UserProfile, 'id' | 'fullName' | 'avatarUrl'>): void {
    let changed = false;
    inMemoryListings = inMemoryListings.map((listing) => {
      if (listing.ownerId !== profile.id) return listing;
      changed = true;
      return {
        ...listing,
        ownerName: profile.fullName || 'Dwello member',
        ownerAvatar: profile.avatarUrl || undefined,
      };
    });

    if (changed) {
      StorageService.setCachedListings(inMemoryListings);
      notifyListeners();
    }
  },

  /**
   * Synchronizes remote Supabase records into local in-memory state
   */
  syncRemoteListings(remoteListings: PropertyListing[]): void {
    if (!remoteListings || remoteListings.length === 0) return;

    const remoteMap = new Map(remoteListings.map((item) => [item.id, item]));
    // Retain newly created local listings that have not yet appeared in remote query
    const localPending = inMemoryListings.filter((local) => !remoteMap.has(local.id) && local.id.startsWith('prop-'));

    inMemoryListings = [...localPending, ...remoteListings];
    StorageService.setCachedListings(inMemoryListings);
    notifyListeners();
  },

  /**
   * Initializes data from local disk cache, then triggers non-blocking cloud refresh
   */
  async initialize(): Promise<void> {
    if (isInitialized) return;
    console.log('[Dwello-HybridData Debug]: Initializing HybridDataService...');

    try {
      // 1. Immediately hydrate from AsyncStorage for instant offline boot
      const cached = (await StorageService.getCachedListings()).map((item) =>
        listingFromDatabase(item as unknown as Record<string, unknown>)
      );
      if (cached && cached.length > 0) {
        const cachedIds = new Set(cached.map((c) => c.id));
        const missingSeeds = INITIAL_SEED_LISTINGS.filter((seed) => !cachedIds.has(seed.id));
        inMemoryListings = [...cached, ...missingSeeds];
      } else {
        inMemoryListings = [...INITIAL_SEED_LISTINGS];
        await StorageService.setCachedListings(inMemoryListings);
      }
      notifyListeners();
      isInitialized = true;

      // 2. Cloud-first background synchronization with live Supabase
      if (isSupabaseConfigured()) {
        this.refreshFromCloud().catch((cloudErr) => {
          console.log('[Dwello-HybridData Debug]: Background cloud refresh deferred (offline resilience active):', cloudErr?.message);
        });
      }
    } catch (error) {
      console.error('[Dwello-HybridData Error]: Initialization error:', error);
      inMemoryListings = [...INITIAL_SEED_LISTINGS];
      notifyListeners();
      isInitialized = true;
    }
  },

  /**
   * Cloud sync helper: fetches from Supabase and merges into cache
   */
  async refreshFromCloud(): Promise<PropertyListing[]> {
    if (!isSupabaseConfigured()) {
      return [...inMemoryListings];
    }

    try {
      console.log('[Dwello-HybridData Debug]: Fetching fresh listings from Supabase...');
      const queryPromise = supabase
        .from('listings')
        .select('*')
        .order('created_at', { ascending: false });

      const response = await withTimeout(queryPromise, 4000);
      if (response && (response as any).data && (response as any).data.length > 0) {
        const cloudData = ((response as any).data as Record<string, unknown>[]).map(listingFromDatabase);
        console.log(`[Dwello-HybridData Debug]: Successfully retrieved ${cloudData.length} listings from live cloud.`);
        this.syncRemoteListings(await this.attachOwnerProfiles(cloudData));
        return [...inMemoryListings];
      }
    } catch (err: any) {
      logBackendError('HybridDataService.refreshFromCloud', err);
    }
    return [...inMemoryListings];
  },

  async attachOwnerProfiles(listings: PropertyListing[]): Promise<PropertyListing[]> {
    if (!isSupabaseConfigured()) return listings;

    const ownerIds = [...new Set(listings.map((listing) => listing.ownerId))]
      .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
    if (ownerIds.length === 0) return listings;

    try {
      const { data, error } = await supabase
        .from('public_profiles')
        .select('id, full_name, avatar_url')
        .in('id', ownerIds);
      if (error) throw error;

      const profiles = new Map(
        (data || []).map((profile) => [
          profile.id,
          {
            fullName: profile.full_name,
            avatarUrl: profile.avatar_url,
          },
        ])
      );
      const ownerIdSet = new Set(ownerIds);

      return listings.map((listing) => {
        const profile = profiles.get(listing.ownerId);
        if (!ownerIdSet.has(listing.ownerId)) return listing;
        return {
          ...listing,
          ownerName: profile?.fullName || 'Dwello member',
          ownerAvatar: profile?.avatarUrl || undefined,
        };
      });
    } catch (error) {
      if (isMissingPublicProfilesView(error)) {
        if (!hasWarnedMissingPublicProfilesView) {
          console.warn(
            '[Dwello-HybridData Warning]: public_profiles is unavailable. Apply the profile sync migration to Supabase to enable live listing owner details.'
          );
          hasWarnedMissingPublicProfilesView = true;
        }
      } else {
        logBackendError('HybridDataService.attachOwnerProfiles', error);
      }
      return listings;
    }
  },

  /**
   * High-speed filtered listings query with cloud-first sync and local fallback
   */
  async fetchListings(filters?: Partial<ListingFilterState>): Promise<PropertyListing[]> {
    console.log('[Dwello-HybridData Debug]: fetchListings called with filters:', filters);
    await this.initialize();

    // Trigger non-blocking cloud refresh in the background
    if (isSupabaseConfigured()) {
      this.refreshFromCloud().catch(() => {});
    }

    return this.applyFilters(inMemoryListings, filters);
  },

  /**
   * Synchronous filtering helper
   */
  applyFilters(listings: PropertyListing[], filters?: Partial<ListingFilterState>): PropertyListing[] {
    let result = [...listings];

    // Filter by Category
    if (filters?.category && filters.category !== 'All') {
      result = result.filter((item) => item.category === filters.category);
    }

    // Filter by status (public explore shows active listings not under review, hidden, or archived)
    result = result.filter(
      (item) => item.status === 'active' && !item.isFlaggedUnderReview && !item.is_hidden && !item.is_archived
    );

    // Search query matching
    if (filters?.searchQuery && filters.searchQuery.trim().length > 0) {
      const queryTerms = filters.searchQuery.toLowerCase().trim().split(/\s+/);
      result = result.filter((item) => {
        const searchable = `${item.title} ${item.zoneArea} ${item.municipalRegion} ${item.bhkType} ${item.description} ${(item.amenities || []).join(' ')}`.toLowerCase();
        return queryTerms.every((term) => searchable.includes(term));
      });
    }

    // Municipal Region
    if (filters?.municipalRegion && filters.municipalRegion.trim().length > 0) {
      result = result.filter(
        (item) => item.municipalRegion.toLowerCase() === filters.municipalRegion?.toLowerCase()
      );
    }

    // Zone Area
    if (filters?.zoneArea && filters.zoneArea.trim().length > 0) {
      result = result.filter((item) =>
        item.zoneArea.toLowerCase().includes(filters.zoneArea!.toLowerCase())
      );
    }

    // Max Rent
    const maxRent = filters?.maxRent;
    if (maxRent && maxRent > 0) {
      result = result.filter((item) => item.price <= maxRent);
    }

    // BHK Type
    if (filters?.bhkType && filters.bhkType !== 'Any') {
      result = result.filter((item) => item.bhkType === filters.bhkType);
    }

    // Amenities
    const activeAmenities = filters?.amenities;
    if (activeAmenities && activeAmenities.length > 0) {
      result = result.filter((item) =>
        activeAmenities.every((amenity) => item.amenities?.includes(amenity))
      );
    }

    // Roommate Preferences
    const activePrefs = filters?.roommatePreferences;
    if (activePrefs && activePrefs.length > 0) {
      result = result.filter((item) =>
        activePrefs.some((pref) => item.roommatePreferences?.includes(pref))
      );
    }

    // Sorting
    if (filters?.sortBy === 'Price: Low to High') {
      result.sort((a, b) => a.price - b.price);
    } else if (filters?.sortBy === 'Price: High to Low') {
      result.sort((a, b) => b.price - a.price);
    } else if (filters?.sortBy === 'Best Value') {
      result.sort((a, b) => (b.fairMarketPrice ? 1 : 0) - (a.fairMarketPrice ? 1 : 0));
    } else {
      result.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    return result;
  },

  /**
   * Creates a new property listing with immediate local persistence and background cloud sync
   */
  async createListing(
    listingData: NewPropertyListing,
    authenticatedUser: Pick<UserProfile, 'id' | 'fullName' | 'avatarUrl'>
  ): Promise<PropertyListing> {
    if (!authenticatedUser.id.trim()) {
      throw new Error('An authenticated user is required to create a listing.');
    }
    if (!isSupabaseConfigured()) {
      throw new Error('Unable to verify your account. Please try again when connected.');
    }
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session?.user?.id) {
      throw new Error('Your sign-in session has expired. Please sign in again.');
    }
    if (session.user.id !== authenticatedUser.id) {
      throw new Error('Your account changed. Please try publishing the listing again.');
    }
    const ownerId = session.user.id;

    console.log('[Dwello-HybridData Debug]: Creating new listing with immediate local response:', listingData.title);

    const newListing: PropertyListing = {
      ...listingData,
      id: `prop-${Date.now()}`,
      ownerId,
      ownerName: authenticatedUser.fullName.trim() || 'Dwello member',
      ownerAvatar: authenticatedUser.avatarUrl,
      status: 'active',
      fairMarketPrice: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Immediate Local Persistence
    inMemoryListings = [newListing, ...inMemoryListings];
    await StorageService.setCachedListings(inMemoryListings);
    notifyListeners();

    // 2. Cloud synchronization with timeout and retry fallback
    if (isSupabaseConfigured()) {
      try {
        console.log('[Dwello-HybridData Debug]: Attempting to persist listing to live Supabase...');
        const insertPromise = supabase.from('listings').insert([listingToDatabase(newListing)]);

        const result = await withTimeout(insertPromise, 4000);
        if ((result as any)?.error) {
          throw (result as any).error;
        }
        console.log('[Dwello-HybridData Debug]: Listing successfully confirmed on live Supabase cloud.');
      } catch (cloudErr: any) {
        logBackendError('HybridDataService.createListing', cloudErr);
        await OfflineSyncService.enqueueAction('CREATE_LISTING', newListing);
      }
    }

    return newListing;
  },

  /**
   * Updates an existing listing locally and remotely
   */
  async updateListing(id: string, updates: Partial<PropertyListing>): Promise<PropertyListing> {
    const index = inMemoryListings.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error(`Listing with ID ${id} not found.`);
    }

    const updated: PropertyListing = {
      ...inMemoryListings[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    inMemoryListings[index] = updated;
    await StorageService.setCachedListings(inMemoryListings);
    notifyListeners();

    if (isSupabaseConfigured()) {
      try {
        await withTimeout(
          supabase.from('listings').update({ ...updates, updated_at: updated.updatedAt }).eq('id', id),
          3000
        );
      } catch (supaErr) {
        console.warn('[Dwello-HybridData Debug]: Cloud update deferred to offline queue:', supaErr);
        await OfflineSyncService.enqueueAction('UPDATE_LISTING', { id, updates });
      }
    }

    return updated;
  },

  /**
   * Marks a listing as rented (archived)
   */
  async markAsRented(id: string): Promise<boolean> {
    console.log(`[Dwello-HybridData Debug]: Marking listing ${id} as rented...`);
    const target = inMemoryListings.find((item) => item.id === id);
    if (!target) return false;

    target.status = 'rented';
    target.is_archived = true;
    target.updatedAt = new Date().toISOString();

    await StorageService.setCachedListings(inMemoryListings);
    notifyListeners();

    if (isSupabaseConfigured()) {
      try {
        await withTimeout(
          supabase
            .from('listings')
            .update({ status: 'rented', is_archived: true, updated_at: target.updatedAt })
            .eq('id', id),
          3000
        );
      } catch (supaErr) {
        console.warn('[Dwello-HybridData Debug]: Offline queueing markAsRented:', supaErr);
        await OfflineSyncService.enqueueAction('UPDATE_LISTING_STATUS', { id, status: 'rented', is_archived: true });
      }
    }

    return true;
  },

  /**
   * Reposts an archived listing back to active public marketplace
   */
  async repostListing(id: string): Promise<boolean> {
    console.log(`[Dwello-HybridData Debug]: Reposting listing ${id} back to active marketplace...`);
    const target = inMemoryListings.find((item) => item.id === id);
    if (!target) return false;

    target.status = 'active';
    target.is_archived = false;
    target.updatedAt = new Date().toISOString();

    await StorageService.setCachedListings(inMemoryListings);
    notifyListeners();

    if (isSupabaseConfigured()) {
      try {
        await withTimeout(
          supabase
            .from('listings')
            .update({ status: 'active', is_archived: false, updated_at: target.updatedAt })
            .eq('id', id),
          3000
        );
      } catch (supaErr) {
        console.warn('[Dwello-HybridData Debug]: Offline queueing repostListing:', supaErr);
        await OfflineSyncService.enqueueAction('UPDATE_LISTING_STATUS', { id, status: 'active', is_archived: false });
      }
    }

    return true;
  },

  /**
   * Deletes a listing
   */
  async deleteListing(id: string): Promise<boolean> {
    console.log(`[Dwello-HybridData Debug]: Deleting listing ${id}...`);
    inMemoryListings = inMemoryListings.filter((item) => item.id !== id);
    await StorageService.setCachedListings(inMemoryListings);
    notifyListeners();

    if (isSupabaseConfigured()) {
      try {
        await withTimeout(supabase.from('listings').delete().eq('id', id), 3000);
      } catch (supaErr) {
        console.warn('[Dwello-HybridData Debug]: Offline queueing deleteListing:', supaErr);
        await OfflineSyncService.enqueueAction('DELETE_LISTING', { id });
      }
    }

    return true;
  },

  /**
   * Fetches single listing by ID
   */
  async fetchListingById(id: string): Promise<PropertyListing | null> {
    const match = inMemoryListings.find((item) => item.id === id);
    if (match) return match;

    if (isSupabaseConfigured()) {
      try {
        const result = (await withTimeout(
          supabase.from('listings').select('*').eq('id', id).maybeSingle(),
          3000
        )) as any;
        if (!result?.error && result?.data) {
          return listingFromDatabase(result.data as Record<string, unknown>);
        }
      } catch (e) {
        logBackendError('HybridDataService.fetchListingById', e);
      }
    }

    return null;
  },

  /**
   * Fetches active and archived listings owned by a specific user
   */
  async fetchUserListings(
    userId: string
  ): Promise<{ active: PropertyListing[]; archived: PropertyListing[] }> {
    console.log(`[Dwello-HybridData Debug]: Fetching listings for owner: ${userId}`);
    await this.initialize();
    try {
      const userListings = inMemoryListings.filter((item) => item.ownerId === userId);
      const active = userListings.filter((item) => item.status === 'active' && !item.is_archived);
      const archived = userListings.filter((item) => item.status === 'rented' || item.status === 'archived' || item.is_archived);
      return { active, archived };
    } catch (error) {
      console.error('[Dwello-HybridData Error]: Error fetching user listings:', error);
      return { active: [], archived: [] };
    }
  },

  /**
   * Sets whether a listing is hidden by admin moderation
   */
  async setListingHiddenStatus(listingId: string, isHidden: boolean): Promise<boolean> {
    console.log(`[Dwello-HybridData Debug]: Setting listing ${listingId} is_hidden = ${isHidden}`);
    try {
      const target = inMemoryListings.find((item) => item.id === listingId);
      if (target) {
        target.is_hidden = isHidden;
        await StorageService.setCachedListings(inMemoryListings);
        notifyListeners();
      }
      return true;
    } catch (e) {
      console.error('[Dwello-HybridData Error]: setListingHiddenStatus failed:', e);
      return false;
    }
  },
};
