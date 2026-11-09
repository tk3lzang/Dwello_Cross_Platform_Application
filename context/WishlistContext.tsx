/**
 * Wishlist Context for Dwello Mobile
 * Provides offline-first favorite property saving backed by AsyncStorage.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { StorageService } from '@/services/storage';
import { OfflineSyncService } from '@/services/offlineSync';
import { PropertyListing } from '@/types/listing';
import { useAuth } from './AuthContext';
import { useDebug } from './DebugContext';
import { supabase, isSupabaseConfigured } from '@/services/supabase';

interface WishlistContextType {
  wishlistIds: string[];
  isWishlisted: (id: string) => boolean;
  toggleWishlist: (listing: PropertyListing) => Promise<boolean>;
  isLoading: boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { showDebugBanner } = useDebug();

  useEffect(() => {
    let isMounted = true;
    async function loadWishlist() {
      const currentUserId = user?.id;
      console.log(`[Dwello-DB Debug]: Loading user-scoped wishlist for user: ${currentUserId || 'guest'}`);
      try {
        // 1. Load locally cached wishlist IDs for current user
        const localIds = await StorageService.getWishlistIds(currentUserId);
        if (isMounted) {
          setWishlistIds(localIds);
        }

        // 2. Query Supabase wishlists table scoped to user_id
        if (isSupabaseConfigured() && currentUserId) {
          try {
            const { data, error } = await supabase
              .from('wishlists')
              .select('listing_id')
              .eq('user_id', currentUserId);

            if (!error && data && isMounted) {
              const remoteIds = data.map((row: { listing_id: string }) => row.listing_id);
              console.log(`[Dwello-DB Debug]: Synced ${remoteIds.length} remote wishlist items for ${currentUserId}`);
              setWishlistIds(remoteIds);
              await StorageService.saveWishlistIds(remoteIds, currentUserId);
            }
          } catch (supaErr) {
            console.warn('[Dwello-DB Debug]: Remote wishlist sync bypassed:', supaErr);
          }
        }
      } catch (error) {
        console.error('[Dwello-Error Debug]: Error loading wishlist:', error);
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
  }, [user?.id]);

  const isWishlisted = useCallback(
    (id: string): boolean => {
      return wishlistIds.includes(id);
    },
    [wishlistIds]
  );

  const toggleWishlist = async (listing: PropertyListing): Promise<boolean> => {
    const isCurrentlySaved = wishlistIds.includes(listing.id);
    const currentUserId = user?.id;
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
    await StorageService.saveWishlistIds(updatedIds, currentUserId);

    // Sync with remote Supabase wishlists table
    if (isSupabaseConfigured() && currentUserId) {
      try {
        if (isCurrentlySaved) {
          await supabase
            .from('wishlists')
            .delete()
            .eq('user_id', currentUserId)
            .eq('listing_id', listing.id);
        } else {
          await supabase
            .from('wishlists')
            .insert({ user_id: currentUserId, listing_id: listing.id });
        }
      } catch (dbErr) {
        console.warn('[Dwello-DB Debug]: Error mutating remote wishlist row:', dbErr);
      }
    }

    // Queue mutation for offline sync resilience
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

