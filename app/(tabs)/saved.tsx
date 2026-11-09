/**
 * Saved listings backed by the local wishlist.
 */

import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DwelloColors } from '@/constants/Colors';
import { ListingCard } from '@/components/ListingCard';
import { useWishlist } from '@/context/WishlistContext';
import { useListings } from '@/context/ListingsContext';

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { wishlistIds } = useWishlist();
  const { allListings } = useListings();

  // Instant reactive match with zero loading latency
  const savedListings = useMemo(() => {
    return allListings.filter((item) => wishlistIds.includes(item.id));
  }, [allListings, wishlistIds]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Wishlist header. */}
      <View style={styles.header}>
        <Text style={styles.title}>Wishlist</Text>
        <Text style={styles.subtitle}>Saved on this device — available offline</Text>
      </View>

      {/* Main Body */}
      <View style={styles.body}>
        <FlatList
          data={savedListings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ListingCard listing={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="heart-outline" size={54} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No saved listings yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap the heart icon on any flat or shared room card to save it for offline reference.
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)')}
                style={styles.exploreBtn}
                activeOpacity={0.88}>
                <Text style={styles.exploreBtnText}>Explore Properties</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
  },
  body: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 70,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  exploreBtn: {
    marginTop: 20,
    backgroundColor: DwelloColors.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 22,
  },
  exploreBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
