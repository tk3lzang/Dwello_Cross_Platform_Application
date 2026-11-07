/**
 * RoommateCard Component
 * Specialized seeker / flatmate card matching Section 3 of the Dwello App Manual.
 * Includes: ROOM AVAILABLE badge, price tag, heart wishlist, lifestyle tags,
 * and a native share button (circular lavender pill at bottom-right of card body).
 */

import React from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DwelloColors } from '@/constants/Colors';
import { PropertyListing } from '@/types/listing';
import { useWishlist } from '@/context/WishlistContext';
import { formatNu } from '@/utils/splitter';
import { shareListingNative } from '@/utils/linking';

interface RoommateCardProps {
  listing: PropertyListing;
}

export function RoommateCard({ listing }: RoommateCardProps) {
  const router = useRouter();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const saved = isWishlisted(listing.id);

  const handlePress = () => {
    router.push({
      pathname: '/listing/[id]',
      params: { id: listing.id },
    });
  };

  const handleHeartPress = async (e: any) => {
    e.stopPropagation?.();
    await toggleWishlist(listing);
  };

  /** Share this roommate listing via the native OS share sheet */
  const handleShare = async (e: any) => {
    e.stopPropagation?.();
    await shareListingNative(
      listing.title,
      `Check out this ${listing.bhkType} shared room in ${listing.zoneArea}, ${listing.municipalRegion} for ${formatNu(listing.price)}/mo on Dwello!`
    );
  };

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={handlePress}
      style={styles.container}>
      {/* Visual Header */}
      <View style={styles.imageBox}>
        <Image
          source={{
            uri:
              listing.images && listing.images.length > 0
                ? listing.images[0]
                : 'https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=800&q=80',
          }}
          style={styles.image}
          resizeMode="cover"
        />

        <View style={styles.badge}>
          <Text style={styles.badgeText}>ROOM AVAILABLE</Text>
        </View>

        <TouchableOpacity
          onPress={handleHeartPress}
          activeOpacity={0.8}
          style={styles.heartButton}>
          <Ionicons
            name={saved ? 'heart' : 'heart-outline'}
            size={22}
            color={saved ? DwelloColors.primary : '#374151'}
          />
        </TouchableOpacity>

        <View style={styles.priceTag}>
          <Text style={styles.priceText}>
            {formatNu(listing.price)}
            <Text style={styles.pricePerMonth}> /mo</Text>
          </Text>
        </View>
      </View>

      {/* Info Body */}
      <View style={styles.body}>
        {/* Title row with share button aligned to right */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, { flex: 1, marginRight: 8 }]} numberOfLines={1}>
            {listing.title}
          </Text>
          {/* Native OS share button — circular lavender pill (matches screenshot) */}
          <TouchableOpacity
            onPress={handleShare}
            activeOpacity={0.8}
            style={styles.shareBtn}>
            <Ionicons name="share-social-outline" size={17} color="#6366F1" />
          </TouchableOpacity>
        </View>

        <View style={styles.locationRow}>
          <Ionicons name="location-sharp" size={14} color={DwelloColors.primary} />
          <Text style={styles.locationText} numberOfLines={1}>
            {listing.fullAddress || `${listing.zoneArea} — ${listing.municipalRegion}`}
          </Text>
        </View>

        <View style={styles.chipsRow}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>Shared Room</Text>
          </View>
          {listing.fairMarketPrice && (
            <View style={styles.fairMarketChip}>
              <Text style={styles.fairMarketText}>Fair market price</Text>
              <Ionicons
                name="information-circle-outline"
                size={13}
                color={DwelloColors.fairMarketText}
                style={{ marginLeft: 3 }}
              />
            </View>
          )}
        </View>

        {/* Roommate Lifestyle Tags */}
        <View style={styles.tagsContainer}>
          {(listing.roommatePreferences || [
            'Student Friendly',
            'Female Only',
            'Quiet / Study Environment',
          ]).map((tag, index) => (
            <View key={index} style={styles.tagBadge}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        {/* Roommate Host Profile row */}
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={(e) => {
            e.stopPropagation?.();
            console.log('[Dwello-Navigation Fix]: Navigating from roommate card host avatar to full-screen profile:', listing.ownerName);
            router.push({
              pathname: '/public-profile/[userId]' as any,
              params: {
                userId: listing.ownerId,
                ownerName: listing.ownerName,
                ownerPhone: listing.ownerPhone,
                ownerRole: listing.ownerRole || 'Roommate',
                ownerAvatar: listing.ownerAvatar || '',
              },
            });
          }}
          style={styles.hostRow}
          accessibilityLabel={`View ${listing.ownerName}'s profile`}>
          <View style={styles.hostAvatarCircle}>
            <Ionicons name="person-circle-outline" size={20} color="#6B7280" />
          </View>
          <Text style={styles.hostName}>{listing.ownerName}</Text>
          <Ionicons name="chevron-forward" size={13} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  imageBox: {
    height: 190,
    width: '100%',
    backgroundColor: '#F3F4F6',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: '#FF5A5F',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heartButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  priceTag: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  priceText: {
    fontSize: 15,
    fontWeight: '800',
    color: DwelloColors.textPrimary,
  },
  pricePerMonth: {
    fontSize: 12,
    fontWeight: '500',
    color: DwelloColors.textSecondary,
  },
  body: {
    padding: 16,
  },
  /** Title row: title takes flex=1, share button hugs the right */
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: DwelloColors.textPrimary,
  },
  /** Circular lavender share button — matches screenshot */
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    ...Platform.select({
      ios: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 13,
    color: DwelloColors.textSecondary,
    marginLeft: 4,
    flex: 1,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chipText: {
    fontSize: 12,
    color: DwelloColors.textSecondary,
    fontWeight: '600',
  },
  fairMarketChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DwelloColors.fairMarketBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: DwelloColors.fairMarketBorder,
  },
  fairMarketText: {
    fontSize: 11,
    color: DwelloColors.fairMarketText,
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tagText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 6,
  },
  hostAvatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hostName: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    flex: 1,
  },
});
