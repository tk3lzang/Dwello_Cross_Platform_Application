/**
 * Database & Listings Service for Dwello
 * Supports Supabase PostgreSQL integration with offline-resilient local cache fallback.
 */

import { INITIAL_SEED_LISTINGS } from '@/constants/BhutanData';
import { ListingFilterState, PropertyListing, ReportListingPayload } from '@/types/listing';
import { OfflineSyncService } from './offlineSync';
import { StorageService } from './storage';
import { isSupabaseConfigured, supabase } from './supabase';

let memoryListings: PropertyListing[] = [...INITIAL_SEED_LISTINGS];
let memoryReports: ReportListingPayload[] = [];
type ChangeListener = (listings: PropertyListing[]) => void;
const listeners: Set<ChangeListener> = new Set();

function notifyListeners() {
  console.log(`[Dwello-DB Debug]: Notifying ${listeners.size} active UI listeners of state mutation.`);
  listeners.forEach((listener) => {
    try {
      listener([...memoryListings]);
    } catch (e) {
      console.error('[Dwello-Error Debug]: Listener notification failed:', e);
    }
  });
}

export const DatabaseService = {
  /**
   * Subscribe to real-time listing updates across all app screens
   */
  subscribe(listener: ChangeListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /**
   * Gets current in-memory listings immediately without asynchronous overhead
   */
  getAllListingsSync(): PropertyListing[] {
    return [...memoryListings];
  },

  /**
   * Initializes local listing cache from disk or initial seeds
   */
  async initialize(): Promise<void> {
    console.log('[Dwello-DB Debug]: Initializing database service listings...');
    try {
      const cached = await StorageService.getCachedListings();
      if (cached && cached.length > 0) {
        const cachedIds = new Set(cached.map((c) => c.id));
        const missingSeeds = INITIAL_SEED_LISTINGS.filter((seed) => !cachedIds.has(seed.id));
        const updatedCached = cached.map((item) => {
          const seedMatch = INITIAL_SEED_LISTINGS.find((s) => s.id === item.id);
          if (seedMatch && (item.title.length <= 2 || item.title === 'k' || item.title === 'w')) {
            return { ...item, title: seedMatch.title, fullAddress: seedMatch.fullAddress };
          }
          return item;
        });
        memoryListings = [...updatedCached, ...missingSeeds];
        await StorageService.setCachedListings(memoryListings);
        console.log(`[Dwello-DB Debug]: Loaded ${memoryListings.length} listings from offline storage.`);
      } else {
        await StorageService.setCachedListings(INITIAL_SEED_LISTINGS);
        memoryListings = [...INITIAL_SEED_LISTINGS];
        console.log('[Dwello-DB Debug]: Seeded initial Bhutan rental listings.');
      }
      notifyListeners();
    } catch (error) {
      console.error('[Dwello-Error Debug]: Database initialization error:', error);
    }
  },

  /**
   * Fetches property listings applying search queries and filters.
   * Employs cache-first strategy with optional remote synchronization.
   *
   * @param filters ListingFilterState criteria
   * @returns Array of PropertyListing
   */
  async fetchListings(filters?: Partial<ListingFilterState>): Promise<PropertyListing[]> {
    console.log('[Dwello-DB Debug]: Fetching listings with filter payload:', filters);

    try {
      // 1. If live Supabase is configured, attempt remote query with a short timeout
      if (isSupabaseConfigured()) {
        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Network request timed out')), 2500)
          );

          let query = supabase
            .from('listings')
            .select('*')
            .order('created_at', { ascending: false });

          if (filters?.category && filters.category !== 'All') {
            query = query.eq('category', filters.category);
          }
          if (filters?.municipalRegion) {
            query = query.eq('municipal_region', filters.municipalRegion);
          }
          if (filters?.maxRent && filters.maxRent > 0) {
            query = query.lte('price', filters.maxRent);
          }

          const response = await Promise.race([query, timeoutPromise]) as any;
          if (response?.data && response.data.length > 0) {
            console.log(`[Dwello-DB Debug]: Successfully fetched ${response.data.length} listings from Supabase.`);
            memoryListings = response.data;
            await StorageService.setCachedListings(memoryListings);
          }
        } catch (supabaseError) {
          console.log('[Dwello-DB Debug]: Remote fetch bypassed, seamlessly using local storage resilience:', supabaseError);
        }
      }

      // 2. High-speed local filtering logic
      let result = [...memoryListings];

      // Filter by category: 'Full Flat' or 'Shared Room'
      if (filters?.category && filters.category !== 'All') {
        result = result.filter((item) => item.category === filters.category);
      }

      // Filter by status (public explore shows active listings not under scam/moderation review)
      result = result.filter((item) => item.status === 'active' && !item.isFlaggedUnderReview);

      // Comprehensive search query matching title, area, region, description, bhk
      if (filters?.searchQuery && filters.searchQuery.trim().length > 0) {
        const queryTerms = filters.searchQuery.toLowerCase().trim().split(/\s+/);
        result = result.filter((item) => {
          const searchable = `${item.title} ${item.zoneArea} ${item.municipalRegion} ${item.bhkType} ${item.description} ${(item.amenities || []).join(' ')}`.toLowerCase();
          return queryTerms.every((term) => searchable.includes(term));
        });
      }

      // Filter by municipal region
      if (filters?.municipalRegion && filters.municipalRegion.trim().length > 0) {
        result = result.filter(
          (item) => item.municipalRegion.toLowerCase() === filters.municipalRegion?.toLowerCase()
        );
      }

      // Filter by zone area
      if (filters?.zoneArea && filters.zoneArea.trim().length > 0) {
        result = result.filter((item) =>
          item.zoneArea.toLowerCase().includes(filters.zoneArea!.toLowerCase())
        );
      }

      // Filter by max rent
      const maxRent = filters?.maxRent;
      if (maxRent && maxRent > 0) {
        result = result.filter((item) => item.price <= maxRent);
      }

      // Filter by BHK Type
      if (filters?.bhkType && filters.bhkType !== 'Any') {
        result = result.filter((item) => item.bhkType === filters.bhkType);
      }

      // Filter by amenities
      const activeAmenities = filters?.amenities;
      if (activeAmenities && activeAmenities.length > 0) {
        result = result.filter((item) =>
          activeAmenities.every((amenity) => item.amenities?.includes(amenity))
        );
      }

      // Filter by roommate lifestyle preferences
      const activePrefs = filters?.roommatePreferences;
      if (activePrefs && activePrefs.length > 0) {
        result = result.filter((item) =>
          activePrefs.some((pref) => item.roommatePreferences?.includes(pref))
        );
      }

      // Sort results
      if (filters?.sortBy === 'Price: Low to High') {
        result.sort((a, b) => a.price - b.price);
      } else if (filters?.sortBy === 'Price: High to Low') {
        result.sort((a, b) => b.price - a.price);
      } else if (filters?.sortBy === 'Best Value') {
        result.sort((a, b) => (b.fairMarketPrice ? 1 : 0) - (a.fairMarketPrice ? 1 : 0));
      } else {
        // Newest default
        result.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }

      console.log(`[Dwello-DB Debug]: Filtered results count: ${result.length}`);
      if (filters?.searchQuery && filters.searchQuery.trim().length > 0) {
        OfflineSyncService.cacheSearchResults(filters.searchQuery, result);
      }
      return result;
    } catch (error) {
      console.error('[Dwello-Error Debug]: Error in fetchListings:', error);
      // Even if anything fails, return available memory listings
      return memoryListings.filter((i) => i.status === 'active');
    }
  },

  /**
   * Fetches single listing by ID
   */
  async fetchListingById(id: string): Promise<PropertyListing | null> {
    console.log(`[Dwello-DB Debug]: Fetching listing details for ID: ${id}`);
    try {
      const match = memoryListings.find((item) => item.id === id);
      return match || null;
    } catch (error) {
      console.error('[Dwello-Error Debug]: Error in fetchListingById:', error);
      return null;
    }
  },

  /**
   * Creates a new property listing (Owner CRUD flow)
   */
  async createListing(
    listingData: Omit<PropertyListing, 'id' | 'createdAt' | 'updatedAt' | 'status'>
  ): Promise<PropertyListing> {
    console.log('[Dwello-DB Debug]: Creating new listing:', listingData.title);
    try {
      const newListing: PropertyListing = {
        ...listingData,
        id: `prop-${Date.now()}`,
        status: 'active',
        fairMarketPrice: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      memoryListings = [newListing, ...memoryListings];
      await StorageService.setCachedListings(memoryListings);
      notifyListeners();

      if (isSupabaseConfigured()) {
        try {
          const { error } = await supabase.from('listings').insert([newListing]);
          if (error) throw error;
          console.log('[Dwello-Listings Debug]: New listing persisted to Supabase.');
        } catch (supaErr) {
          console.warn('[Dwello-OfflineSync Debug]: Offline/Supabase error. Enqueueing create action:', supaErr);
          await OfflineSyncService.enqueueAction('CREATE_LISTING', newListing);
        }
      }

      console.log('[Dwello-DB Debug]: Listing created successfully with ID:', newListing.id);
      return newListing;
    } catch (error) {
      console.error('[Dwello-Error Debug]: Failed to create listing:', error);
      throw error;
    }
  },

  /**
   * Updates an existing listing
   */
  async updateListing(
    id: string,
    updates: Partial<PropertyListing>
  ): Promise<PropertyListing> {
    console.log(`[Dwello-DB Debug]: Updating listing ID ${id}`);
    try {
      const index = memoryListings.findIndex((item) => item.id === id);
      if (index === -1) {
        throw new Error(`Listing with ID ${id} not found.`);
      }

      const updated = {
        ...memoryListings[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      memoryListings[index] = updated;
      await StorageService.setCachedListings(memoryListings);
      notifyListeners();

      console.log('[Dwello-DB Debug]: Listing updated successfully.');
      return updated;
    } catch (error) {
      console.error('[Dwello-Error Debug]: Error updating listing:', error);
      throw error;
    }
  },

  /**
   * Updates tenancy status to 'rented' (Moves to archived)
   */
  async markAsRented(id: string): Promise<boolean> {
    console.log(`[Dwello-Listings Debug]: Marking listing ${id} as rented...`);
    try {
      const target = memoryListings.find((item) => item.id === id);
      if (target) {
        target.status = 'rented';
        target.updatedAt = new Date().toISOString();
        await StorageService.setCachedListings(memoryListings);
        notifyListeners();

        // Supabase database mutation with offline queue fallback
        if (isSupabaseConfigured()) {
          try {
            const { error } = await supabase
              .from('listings')
              .update({ status: 'rented', updated_at: target.updatedAt })
              .eq('id', id);
            if (error) throw error;
            console.log(`[Dwello-Listings Debug]: Successfully updated listing ${id} to rented on Supabase.`);
          } catch (supaErr) {
            console.warn('[Dwello-OfflineSync Debug]: Offline - enqueueing markAsRented:', supaErr);
            await OfflineSyncService.enqueueAction('UPDATE_LISTING_STATUS', { id, status: 'rented' });
          }
        }

        console.log(`[Dwello-Listings Debug]: Listing ${id} is now RENTED.`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Dwello-Error Debug]: Error marking as rented:', error);
      return false;
    }
  },

  /**
   * Reposts an archived listing back to active public marketplace
   */
  async repostListing(id: string): Promise<boolean> {
    console.log(`[Dwello-Listings Debug]: Reposting listing ${id} back to active marketplace...`);
    try {
      const target = memoryListings.find((item) => item.id === id);
      if (target) {
        target.status = 'active';
        target.updatedAt = new Date().toISOString();
        await StorageService.setCachedListings(memoryListings);
        notifyListeners();

        // Supabase database mutation with offline queue fallback
        if (isSupabaseConfigured()) {
          try {
            const { error } = await supabase
              .from('listings')
              .update({ status: 'active', updated_at: target.updatedAt })
              .eq('id', id);
            if (error) throw error;
            console.log(`[Dwello-Listings Debug]: Successfully reposted listing ${id} on Supabase.`);
          } catch (supaErr) {
            console.warn('[Dwello-OfflineSync Debug]: Offline - enqueueing repostListing:', supaErr);
            await OfflineSyncService.enqueueAction('UPDATE_LISTING_STATUS', { id, status: 'active' });
          }
        }

        console.log(`[Dwello-Listings Debug]: Listing ${id} reposted successfully.`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Dwello-Error Debug]: Error reposting listing:', error);
      return false;
    }
  },

  /**
   * Permanently deletes a listing
   */
  async deleteListing(id: string): Promise<boolean> {
    console.log(`[Dwello-Listings Debug]: Permanently deleting listing ${id}`);
    try {
      memoryListings = memoryListings.filter((item) => item.id !== id);
      await StorageService.setCachedListings(memoryListings);
      notifyListeners();

      // Supabase database mutation with offline queue fallback
      if (isSupabaseConfigured()) {
        try {
          const { error } = await supabase.from('listings').delete().eq('id', id);
          if (error) throw error;
          console.log(`[Dwello-Listings Debug]: Listing ${id} deleted on Supabase.`);
        } catch (supaErr) {
          console.warn('[Dwello-OfflineSync Debug]: Offline - enqueueing deleteListing:', supaErr);
          await OfflineSyncService.enqueueAction('DELETE_LISTING', { id });
        }
      }

      console.log(`[Dwello-Listings Debug]: Listing ${id} permanently removed.`);
      return true;
    } catch (error) {
      console.error('[Dwello-Error Debug]: Error deleting listing:', error);
      return false;
    }
  },

  /**
   * Fetches active and archived listings owned by a specific user
   */
  async fetchUserListings(
    userId: string
  ): Promise<{ active: PropertyListing[]; archived: PropertyListing[] }> {
    console.log(`[Dwello-DB Debug]: Fetching listings for owner: ${userId}`);
    try {
      const userListings = memoryListings.filter(
        (item) => item.ownerId === userId || item.ownerId === 'owner-tandin'
      );

      const active = userListings.filter((item) => item.status === 'active');
      const archived = userListings.filter((item) => item.status === 'rented' || item.status === 'archived');

      console.log(`[Dwello-DB Debug]: Found ${active.length} active and ${archived.length} archived listings.`);
      return { active, archived };
    } catch (error) {
      console.error('[Dwello-Error Debug]: Error fetching user listings:', error);
      return { active: [], archived: [] };
    }
  },

  /**
   * Submits a listing moderation report to Supabase or logs locally
   * Tracks status: pending, reviewed, actioned.
   * Auto-flags listings exceeding report threshold or flagged as Scam / Fraud.
   */
  async reportListing(payload: ReportListingPayload): Promise<boolean> {
    console.log('[Dwello-Moderation Debug]: Submitting listing report with status tracking:', payload);
    try {
      const fullReport: ReportListingPayload = {
        ...payload,
        id: payload.id || `rep-${Date.now()}`,
        status: payload.status || 'pending',
        createdAt: payload.createdAt || new Date().toISOString(),
        appealStatus: 'none',
      };

      memoryReports.push(fullReport);

      // Check listing threshold & flag temporarily to protect marketplace
      const target = memoryListings.find((item) => item.id === payload.listingId);
      if (target) {
        target.reportCount = (target.reportCount || 0) + 1;
        // Scam / Fraud reports or >= 2 reports trigger temporary review hold & owner appeal window
        if (payload.reason === 'Scam / Fraud' || target.reportCount >= 2) {
          target.isFlaggedUnderReview = true;
          target.appealWindowOpen = true;
          console.log(`[Dwello-Moderation Debug]: Listing ${target.id} flagged under review (Total reports: ${target.reportCount}). Appeal window open.`);
        }
        await StorageService.setCachedListings(memoryListings);
        notifyListeners();
      }

      if (isSupabaseConfigured()) {
        try {
          const { error } = await supabase.from('reports').insert([fullReport]);
          if (error) throw error;
          console.log(`[Dwello-Moderation Debug]: Report for listing ${payload.listingId} persisted to Supabase with status ${fullReport.status}.`);
        } catch (err) {
          console.warn('[Dwello-OfflineSync Debug]: Offline - enqueueing report submission:', err);
          await OfflineSyncService.enqueueAction('SUBMIT_REPORT', fullReport);
        }
      }
      return true;
    } catch (error) {
      console.error('[Dwello-Error Debug]: Failed to submit report:', error);
      return false;
    }
  },

  /**
   * Submits counter-evidence / appeal for a flagged listing
   */
  async submitAppeal(listingId: string, appealNotes: string): Promise<boolean> {
    console.log(`[Dwello-Moderation Debug]: Owner submitting appeal for listing ${listingId}:`, appealNotes);
    try {
      const target = memoryListings.find((item) => item.id === listingId);
      if (target) {
        target.appealSubmitted = true;
        target.appealNotes = appealNotes;
        target.isFlaggedUnderReview = false; // Restored upon appeal submission pending final review
        await StorageService.setCachedListings(memoryListings);
        notifyListeners();
      }

      // Update memory reports for this listing
      memoryReports = memoryReports.map((r) =>
        r.listingId === listingId
          ? { ...r, appealNotes, appealStatus: 'pending', status: 'reviewed' }
          : r
      );

      if (isSupabaseConfigured()) {
        try {
          await supabase
            .from('reports')
            .update({ status: 'reviewed', appeal_notes: appealNotes })
            .eq('listing_id', listingId);
        } catch (supaErr) {
          console.warn('[Dwello-OfflineSync Debug]: Supabase appeal update queued:', supaErr);
        }
      }

      console.log(`[Dwello-Moderation Debug]: Appeal for listing ${listingId} submitted successfully.`);
      return true;
    } catch (error) {
      console.error('[Dwello-Error Debug]: Appeal submission failed:', error);
      return false;
    }
  },

  /**
   * Sets whether a listing is hidden by admin moderation
   */
  async setListingHiddenStatus(listingId: string, isHidden: boolean): Promise<boolean> {
    console.log(`[Dwello-DB Debug]: Setting listing ${listingId} is_hidden = ${isHidden}`);
    try {
      const target = memoryListings.find((item) => item.id === listingId);
      if (target) {
        target.is_hidden = isHidden;
        await StorageService.setCachedListings(memoryListings);
        notifyListeners();
      }
      return true;
    } catch (e) {
      console.error('[Dwello-Error Debug]: setListingHiddenStatus failed:', e);
      return false;
    }
  },

  /**
   * Retrieves reports for a listing
   */
  getListingReports(listingId: string): ReportListingPayload[] {
    return memoryReports.filter((r) => r.listingId === listingId);
  },
};
