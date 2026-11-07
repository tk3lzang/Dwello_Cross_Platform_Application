/**
 * Wishlist Context for Dwello Mobile
 * Provides offline-first favorite property saving backed by AsyncStorage.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { StorageService } from '@/services/storage';
import { OfflineSyncService } from '@/services/offlineSync';
import { PropertyListing } from '@/types/listing';
import { useDebug } from './DebugContext';

interface WishlistContextType {
  wishlistIds: string[];
  isWishlisted: (id: string) => boolean;
  toggleWishlist: (listing: PropertyListing) => Promise<boolean>;
  isLoading: boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { showDebugBanner } = useDebug();

  useEffect(() => {
    let isMounted = true;
    async function loadWishlist() {
      console.log('[Dwello-DB Debug]: Loading offline wishlist IDs from disk...');
      try {
        const ids = await StorageService.getWishlistIds();
        if (isMounted) {
          setWishlistIds(ids);
          console.log(`[Dwello-DB Debug]: Successfully initialized ${ids.length} wishlist items.`);
        }
      } catch (error) {
        console.error('[Dwello-Error Debug]: Error loading offline wishlist:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadWishlist();

    return () => {
      isMounted = false;
    };
  }, []);

  const isWishlisted = (id: string): boolean => {
    return wishlistIds.includes(id);
  };

  const toggleWishlist = async (listing: PropertyListing): Promise<boolean> => {
    const isCurrentlySaved = wishlistIds.includes(listing.id);
    console.log(`[Dwello-DB Debug]: Toggling wishlist for "${listing.title}". Currently saved:`, isCurrentlySaved);

    let updatedIds: string[];
    if (isCurrentlySaved) {
      updatedIds = wishlistIds.filter((id) => id !== listing.id);
      showDebugBanner('info', 'Wishlist Updated', `"${listing.title}" removed from saved items.`);
    } else {
      updatedIds = [...wishlistIds, listing.id];
      showDebugBanner('success', 'Saved Offline', `"${listing.title}" saved! Available offline.`);
    }

    setWishlistIds(updatedIds);
    await StorageService.saveWishlistIds(updatedIds);

    // Queue mutation for Supabase background sync & cache listing offline
    await OfflineSyncService.enqueueAction('TOGGLE_FAVORITE', {
      listingId: listing.id,
      isSaved: !isCurrentlySaved,
    });
    return !isCurrentlySaved;
  };

  return (
    <WishlistContext.Provider
      value={{
        wishlistIds,
        isWishlisted,
        toggleWishlist,
        isLoading,
      }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}

