/**
 * ListingCard Component
 * Displays property card matching Dwello Android / iOS Material Design 3 guidelines
 * and UI Snapshot Fidelity.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DwelloColors } from '@/constants/Colors';
import { PropertyListing } from '@/types/listing';
import { useWishlist } from '@/context/WishlistContext';
import { formatNu } from '@/utils/splitter';

interface ListingCardProps {
  listing: PropertyListing;
  onCalculatorPress?: (listing: PropertyListing) => void;
  showCalculator?: boolean;
  /** Override the default navigate-to-detail press behaviour */
  onPress?: (listing: PropertyListing) => void;
}

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80';

export function ListingCard({
  listing,
  onCalculatorPress,
  showCalculator = false,
  onPress,
}: ListingCardProps) {
  const router = useRouter();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const saved = isWishlisted(listing.id);
  const [imageFailed, setImageFailed] = useState(false);

  const handleCardPress = () => {
    if (onPress) {
      onPress(listing);
    } else {
      router.push({
        pathname: '/listing/[id]',
        params: { id: listing.id },
      });
    }
  };

  const handleHeartPress = async (e: any) => {
    e.stopPropagation?.();
    await toggleWishlist(listing);
  };

  const isRented = listing.status === 'rented';

  const displayUri =
    !imageFailed && listing.images && listing.images.length > 0
      ? listing.images[0]
      : FALLBACK_IMAGE;

  const displayLocation =
    listing.fullAddress
      ? listing.fullAddress.replace(/ · /g, ' • ')
      : `${listing.zoneArea} • ${listing.municipalRegion}`;

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={handleCardPress}
      style={styles.cardContainer}>
      {/* Top Image Preview */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: displayUri }}
          onError={() => setImageFailed(true)}
          style={styles.image}
          resizeMode="cover"
        />

        {/* Category / Status Badge */}
        <View
          style={[
            styles.badge,
            listing.is_hidden
              ? styles.hiddenBadge
              : isRented
              ? styles.rentedBadge
              : listing.category === 'Full Flat'
              ? styles.fullFlatBadge
              : styles.sharedRoomBadge,
          ]}>
          <Text style={styles.badgeText}>
            {listing.is_hidden
              ? 'LISTING HIDDEN'
              : isRented
              ? 'RENTED'
              : listing.category === 'Full Flat'
              ? 'FULL FLAT'
              : 'ROOM AVAILABLE'}
          </Text>
        </View>

        {/* Favorite Heart Button */}
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

        {/* Rent Tag */}
        <View style={styles.priceTag}>
          <Text style={styles.priceText}>
            {formatNu(listing.price)}
            <Text style={styles.pricePerMonth}> /mo</Text>
          </Text>
        </View>

        {/* Optional Calculator Shortcut Button (from Manual page 12) */}
        {showCalculator && (
          <TouchableOpacity
            style={styles.calculatorShortcut}
            onPress={(e) => {
              e.stopPropagation?.();
              if (onCalculatorPress) {
                onCalculatorPress(listing);
              } else {
                router.push({
                  pathname: '/splitter',
                  params: { baseRent: listing.price.toString() },
                });
              }
            }}>
            <Ionicons name="calculator-outline" size={18} color="#111827" />
          </TouchableOpacity>
        )}
      </View>

      {/* Property Details */}
      <View style={styles.contentContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {listing.title}
        </Text>

        {/* Location row */}
        <View style={styles.locationRow}>
          <Ionicons name="location-sharp" size={15} color={DwelloColors.primary} />
          <Text style={styles.locationText} numberOfLines={1}>
            {displayLocation}
          </Text>
        </View>

        {/* Metadata Chips Row */}
        <View style={styles.chipsRow}>
          {listing.bhkType ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{listing.bhkType}</Text>
            </View>
          ) : null}
          <View style={styles.chip}>
            <Text style={styles.chipText}>
              {listing.category === 'Full Flat' ? 'Entire Flat' : 'Shared Room'}
            </Text>
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

        {/* Lifestyle tags if Shared Room */}
        {listing.roommatePreferences && listing.roommatePreferences.length > 0 && (
          <View style={styles.roommateChipsRow}>
            {listing.roommatePreferences.slice(0, 3).map((pref, i) => (
              <View key={i} style={styles.roommateChip}>
                <Text style={styles.roommateChipText}>{pref}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Host Avatar Row — tappable to open Public Profile */}
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => {
            console.log('[Dwello-Navigation Fix]: Navigating from listing card host avatar to full-screen profile:', listing.ownerName);
            router.push({
              pathname: '/public-profile/[userId]' as any,
              params: {
                userId: listing.ownerId,
                ownerName: listing.ownerName,
                ownerPhone: listing.ownerPhone,
                ownerRole: listing.ownerRole || 'Landlord / Host',
                ownerAvatar: listing.ownerAvatar || '',
              },
            });
          }}
          style={styles.hostRow}
          accessibilityLabel={`View ${listing.ownerName}'s profile`}>
          <View style={styles.hostAvatarCircle}>
            <Ionicons name="person-circle-outline" size={22} color="#6B7280" />
          </View>
          <Text style={styles.hostName}>{listing.ownerName}</Text>
          <Ionicons name="chevron-forward" size={13} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: DwelloColors.cardBackground,
    borderRadius: 20,
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
  imageContainer: {
    height: 205,
    width: '100%',
    position: 'relative',
    backgroundColor: '#E5E7EB',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: 14,
    left: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  fullFlatBadge: {
    backgroundColor: DwelloColors.primary,
  },
  sharedRoomBadge: {
    backgroundColor: '#FF5A5F',
  },
  hiddenBadge: {
    backgroundColor: '#DC2626',
  },
  rentedBadge: {
    backgroundColor: DwelloColors.rented,
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
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  priceTag: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '800',
    color: DwelloColors.textPrimary,
  },
  pricePerMonth: {
    fontSize: 12,
    fontWeight: '500',
    color: DwelloColors.textSecondary,
  },
  calculatorShortcut: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  contentContainer: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: DwelloColors.textPrimary,
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  locationText: {
    fontSize: 13,
    color: DwelloColors.textSecondary,
    marginLeft: 4,
    flex: 1,
    fontWeight: '500',
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: DwelloColors.fairMarketBorder,
  },
  fairMarketText: {
    fontSize: 11,
    color: DwelloColors.fairMarketText,
    fontWeight: '600',
  },
  roommateChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  roommateChip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roommateChipText: {
    fontSize: 11,
    color: '#4338CA',
    fontWeight: '500',
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
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
