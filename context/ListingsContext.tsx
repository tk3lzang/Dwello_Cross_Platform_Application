/**
 * Listings Context for Dwello Mobile
 * Provides reactive real-time state for all listings across the app.
 * Guarantees that any creation, tenancy status change (mark as rented), reposting,
 * or deletion instantly reflects across all screens without requiring manual pull-to-refresh.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { DatabaseService } from '@/services/database';
import { PropertyListing, ListingFilterState } from '@/types/listing';

interface ListingsContextType {
  allListings: PropertyListing[];
  isLoading: boolean;
  refreshListings: () => Promise<void>;
  createListing: (data: Omit<PropertyListing, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => Promise<PropertyListing>;
  markAsRented: (id: string) => Promise<boolean>;
  repostListing: (id: string) => Promise<boolean>;
  deleteListing: (id: string) => Promise<boolean>;
  filterListings: (filters: Partial<ListingFilterState>) => PropertyListing[];
}

const ListingsContext = createContext<ListingsContextType | undefined>(undefined);

export function ListingsProvider({ children }: { children: ReactNode }) {
  const [allListings, setAllListings] = useState<PropertyListing[]>(() => DatabaseService.getAllListingsSync());
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    // 1. Subscribe to instant real-time changes from DatabaseService
    const unsubscribe = DatabaseService.subscribe((updated) => {
      console.log(`[Dwello-DB Debug]: ListingsContext received instant reactive update. Total listings: ${updated.length}`);
      setAllListings(updated);
    });

    // 2. Initial load from database/storage
    DatabaseService.initialize().then(() => {
      setAllListings(DatabaseService.getAllListingsSync());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const refreshListings = useCallback(async () => {
    setIsLoading(true);
    try {
      await DatabaseService.initialize();
      setAllListings(DatabaseService.getAllListingsSync());
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createListing = useCallback(
    async (data: Omit<PropertyListing, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
      const created = await DatabaseService.createListing(data);
      // Immediately update local state
      setAllListings(DatabaseService.getAllListingsSync());
      return created;
    },
    []
  );

  const markAsRented = useCallback(async (id: string) => {
    const success = await DatabaseService.markAsRented(id);
    if (success) {
      setAllListings(DatabaseService.getAllListingsSync());
    }
    return success;
  }, []);

  const repostListing = useCallback(async (id: string) => {
    const success = await DatabaseService.repostListing(id);
    if (success) {
      setAllListings(DatabaseService.getAllListingsSync());
    }
    return success;
  }, []);

  const deleteListing = useCallback(async (id: string) => {
    const success = await DatabaseService.deleteListing(id);
    if (success) {
      setAllListings(DatabaseService.getAllListingsSync());
    }
    return success;
  }, []);

  /**
   * High-speed synchronous filtering helper for immediate UI responses
   */
  const filterListings = useCallback(
    (filters: Partial<ListingFilterState>): PropertyListing[] => {
      let result = [...allListings];

      // Category
      if (filters.category && filters.category !== 'All') {
        result = result.filter((item) => item.category === filters.category);
      }

      // Status
      result = result.filter((item) => item.status === 'active');

      // Search Query
      if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
        const terms = filters.searchQuery.toLowerCase().trim().split(/\s+/);
        result = result.filter((item) => {
          const searchable = `${item.title} ${item.zoneArea} ${item.municipalRegion} ${item.fullAddress || ''} ${item.bhkType} ${item.description} ${(item.amenities || []).join(' ')}`.toLowerCase();
          return terms.every((term) => searchable.includes(term));
        });
      }

      // Municipal Region
      if (filters.municipalRegion && filters.municipalRegion.trim().length > 0) {
        result = result.filter(
          (item) => item.municipalRegion.toLowerCase() === filters.municipalRegion?.toLowerCase()
        );
      }

      // Zone Area
      if (filters.zoneArea && filters.zoneArea.trim().length > 0) {
        result = result.filter((item) =>
          item.zoneArea.toLowerCase().includes(filters.zoneArea!.toLowerCase())
        );
      }

      // Max Rent
      if (filters.maxRent && filters.maxRent > 0) {
        result = result.filter((item) => item.price <= filters.maxRent!);
      }

      // BHK Type
      if (filters.bhkType && filters.bhkType !== 'Any') {
        result = result.filter((item) => item.bhkType === filters.bhkType);
      }

      // Amenities
      if (filters.amenities && filters.amenities.length > 0) {
        result = result.filter((item) =>
          filters.amenities!.every((a) => item.amenities?.includes(a))
        );
      }

      // Roommate Lifestyle Preferences
      if (filters.roommatePreferences && filters.roommatePreferences.length > 0) {
        result = result.filter((item) =>
          filters.roommatePreferences!.some((pref) => item.roommatePreferences?.includes(pref))
        );
      }

      // Sort
      if (filters.sortBy === 'Price: Low to High') {
        result.sort((a, b) => a.price - b.price);
      } else if (filters.sortBy === 'Price: High to Low') {
        result.sort((a, b) => b.price - a.price);
      } else if (filters.sortBy === 'Best Value') {
        result.sort((a, b) => (b.fairMarketPrice ? 1 : 0) - (a.fairMarketPrice ? 1 : 0));
      } else {
        result.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }

      return result;
    },
    [allListings]
  );

  return (
    <ListingsContext.Provider
      value={{
        allListings,
        isLoading,
        refreshListings,
        createListing,
        markAsRented,
        repostListing,
        deleteListing,
        filterListings,
      }}>
      {children}
    </ListingsContext.Provider>
  );
}

export function useListings() {
  const context = useContext(ListingsContext);
  if (!context) {
    throw new Error('useListings must be used within a ListingsProvider');
  }
  return context;
}

