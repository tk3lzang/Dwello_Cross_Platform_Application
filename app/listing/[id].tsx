/**
 * Listing details, advertiser actions, and direct contact options.
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DwelloColors } from '@/constants/Colors';
import { PhotoCarousel } from '@/components/PhotoCarousel';
import { ReportModal } from '@/components/ReportModal';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/context/AuthContext';
import { useWishlist } from '@/context/WishlistContext';
import { useListings } from '@/context/ListingsContext';
import { useDebug } from '@/context/DebugContext';
import { OfflineSyncService } from '@/services/offlineSync';
import { AuthService } from '@/services/auth';
import { DatabaseService } from '@/services/database';
import { formatNu } from '@/utils/splitter';
import { openWhatsAppChat, callPhoneNumber, shareRichListing } from '@/utils/linking';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { allListings, deleteListing } = useListings();
  const { showDebugBanner } = useDebug();

  /** Reactive listing lookup from in-memory context — zero async latency */
  const listing = allListings.find((item) => item.id === id) || null;
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Cache viewed listing for offline persistence
  useEffect(() => {
    if (listing) {
      OfflineSyncService.cacheViewedListing(listing);
    }
  }, [listing]);

  useEffect(() => {
    if (!listing?.ownerId) return;
    AuthService.fetchPublicProfile(listing.ownerId)
      .then((profile) => {
        if (profile) DatabaseService.updateListingsOwnerProfile(profile);
      })
      .catch((error) => {
        console.error('[Dwello-Profile Error]: Could not refresh the listing owner profile:', error);
      });
  }, [listing?.ownerId]);

  if (!listing) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={styles.errorTitle}>Listing Not Found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Return to Explore</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwner = !!user?.id && user.id === listing.ownerId;
  const ownerDisplayName = listing.ownerName || 'Dwello member';
  const saved = isWishlisted(listing.id);

  const handleShare = async () => {
    await shareRichListing({
      id: listing.id,
      title: listing.title,
      price: listing.price,
      zoneArea: listing.zoneArea,
      municipalRegion: listing.municipalRegion,
      imageUrl: listing.images?.[0],
    });
  };

  const handleDelete = () => {
    Alert.alert('Delete Listing', 'Are you sure you want to permanently delete this listing?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteListing(listing.id);
          showDebugBanner('info', 'Listing Deleted', 'Property removed permanently.');
          router.back();
        },
      },
    ]);
  };

  const handleWhatsAppContact = () => {
    const inquiryMessage = `Hello ${ownerDisplayName}, I saw your listing "${listing.title}" in ${listing.zoneArea} on Dwello Bhutan and would like to inquire about availability.`;
    openWhatsAppChat(listing.ownerPhone, inquiryMessage);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Photo Gallery with Pagination Dots */}
        <View style={styles.carouselContainer}>
          <PhotoCarousel images={listing.images} height={300} />

          {/* Floating Top Nav Overlay */}
          <View style={[styles.navOverlay, { top: insets.top + 2 }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.roundNavBtn}>
              <Ionicons name="arrow-back" size={20} color="#111827" />
            </TouchableOpacity>

            <View style={styles.navActionsRight}>
              <TouchableOpacity onPress={handleShare} style={styles.roundNavBtn}>
                <Ionicons name="share-social-outline" size={20} color="#111827" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => toggleWishlist(listing)}
                style={styles.roundNavBtn}>
                <Ionicons
                  name={saved ? 'heart' : 'heart-outline'}
                  size={20}
                  color={saved ? DwelloColors.primary : '#111827'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsReportModalOpen(true)}
                style={styles.roundNavBtn}>
                <Ionicons name="flag-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Content Body */}
        <View style={styles.body}>
          {/* Listing title and owner controls. */}
          <View style={styles.titleHeaderRow}>
            <View style={styles.titleWrapper}>
              <Text style={styles.title}>{listing.title}</Text>
              <Text style={styles.locationSub}>{listing.fullAddress}</Text>
            </View>

            {isOwner && (
              <View style={styles.ownerControlsRow}>
                <TouchableOpacity
                  onPress={() => {
                    router.push({
                      pathname: '/splitter',
                      params: { baseRent: listing.price.toString() },
                    });
                  }}
                  style={styles.ownerIconBtn}>
                  <Ionicons name="calculator-outline" size={18} color="#111827" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    showDebugBanner('info', 'Edit Listing', 'Opening listing editor...');
                  }}
                  style={styles.ownerIconBtn}>
                  <Ionicons name="pencil" size={18} color="#EF4444" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDelete} style={styles.ownerIconBtn}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Rent Price */}
          <View style={styles.priceRow}>
            <Text style={styles.rentLabel}>RENT</Text>
            <Text style={styles.priceValue}>{formatNu(listing.price)}</Text>
          </View>

          {/* Property Details Section */}
          <Text style={styles.sectionHeader}>Property Details</Text>
          <View style={styles.detailsChipsRow}>
            <View style={styles.detailChip}>
              <Ionicons name="business-outline" size={16} color="#4B5563" />
              <Text style={styles.detailChipText}>{listing.category}</Text>
            </View>
            <View style={styles.detailChip}>
              <Ionicons name="bed-outline" size={16} color="#4B5563" />
              <Text style={styles.detailChipText}>{listing.bhkType}</Text>
            </View>
            {listing.fairMarketPrice && (
              <View style={styles.fairMarketBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#059669" />
                <Text style={styles.fairMarketBadgeText}>Fair Market Price</Text>
              </View>
            )}
          </View>

          {/* Description */}
          <Text style={styles.sectionHeader}>Description</Text>
          <Text style={styles.descriptionText}>{listing.description}</Text>

          {/* Financial / Lease Specifications */}
          {(listing.securityDeposit || listing.leasePeriod) && (
            <View style={styles.leaseSpecsBox}>
              {listing.securityDeposit != null && listing.securityDeposit > 0 && (
                <Text style={styles.specLine}>
                  <Text style={styles.specBold}>Security Deposit: </Text>
                  {formatNu(listing.securityDeposit)}
                </Text>
              )}
              {listing.leasePeriod && (
                <Text style={styles.specLine}>
                  <Text style={styles.specBold}>Lease Period: </Text>
                  {listing.leasePeriod}
                </Text>
              )}
            </View>
          )}

          {/* Amenities */}
          <Text style={styles.sectionHeader}>Amenities</Text>
          <View style={styles.amenitiesGrid}>
            {(listing.amenities && listing.amenities.length > 0
              ? listing.amenities
              : ['Water Included', 'Parking']
            ).map((item, index) => (
              <View key={index} style={styles.amenityItem}>
                <Ionicons name="checkmark" size={16} color="#059669" />
                <Text style={styles.amenityText}>{item}</Text>
              </View>
            ))}
          </View>

          {/* Roommate / Lifestyle Preferences */}
          {listing.roommatePreferences && listing.roommatePreferences.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>Roommate & Tenant Preferences</Text>
              <View style={styles.preferencesGrid}>
                {listing.roommatePreferences.map((pref, idx) => (
                  <View key={idx} style={styles.preferenceChip}>
                    <Text style={styles.preferenceText}>{pref}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* House Rules */}
          <Text style={styles.sectionHeader}>House Rules</Text>
          <Text style={styles.rulesText}>
            Contact the advertiser directly via WhatsApp or phone call for house rules, gate closing times, and lease terms.
          </Text>

          {/* Report Listing Trigger */}
          <TouchableOpacity
            onPress={() => setIsReportModalOpen(true)}
            style={styles.reportListingRow}>
            <Ionicons name="flag-outline" size={16} color="#9CA3AF" />
            <Text style={styles.reportListingText}>Report this listing to moderators</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Contact details and actions. */}
      <View style={[styles.stickyContactDock, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TouchableOpacity
          onPress={() => {
            if (!listing.ownerId) return;
            console.log('[Dwello-Navigation Debug]: Navigating from listing to host profile:', ownerDisplayName);
            router.push({
              pathname: '/public-profile/[userId]' as any,
              params: {
                userId: listing.ownerId,
                ownerName: ownerDisplayName,
                ownerPhone: listing.ownerPhone,
                ownerRole: listing.ownerRole,
                ownerAvatar: listing.ownerAvatar,
              },
            });
          }}
          activeOpacity={0.7}
          style={styles.ownerInfoLeft}
          accessibilityLabel={`View ${ownerDisplayName}'s profile`}>
          <Avatar uri={listing.ownerAvatar} name={ownerDisplayName} size={44} />
          <View style={styles.ownerTextCol}>
            <Text style={styles.contactOwnerName}>{ownerDisplayName}</Text>
            <Text style={styles.contactOwnerRole}>{listing.ownerRole || 'Landlord / Host'}</Text>
            {listing.contactName && listing.contactName !== ownerDisplayName ? (
              <Text style={styles.contactOwnerRole}>Contact: {listing.contactName}</Text>
            ) : null}
          </View>
        </TouchableOpacity>

        <View style={styles.contactButtonsRow}>
          {/* Call Dialer Button */}
          <TouchableOpacity
            onPress={() => callPhoneNumber(listing.ownerPhone)}
            activeOpacity={0.85}
            style={styles.callCircleBtn}>
            <Ionicons name="call" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          {/* WhatsApp Button */}
          <TouchableOpacity
            onPress={handleWhatsAppContact}
            activeOpacity={0.85}
            style={styles.whatsAppCircleBtn}>
            <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Listing Report Modal */}
      <ReportModal
        visible={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        listingId={listing.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 95,
  },
  carouselContainer: {
    position: 'relative',
  },
  navOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  roundNavBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  navActionsRight: {
    flexDirection: 'row',
    gap: 8,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
  },
  titleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  titleWrapper: {
    flex: 1,
    marginRight: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  locationSub: {
    fontSize: 13,
    color: '#6B7280',
  },
  ownerControlsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ownerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceRow: {
    marginTop: 10,
    marginBottom: 20,
  },
  rentLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '900',
    color: DwelloColors.primary,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 18,
    marginBottom: 10,
  },
  detailsChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 6,
  },
  detailChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  fairMarketBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  fairMarketBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4B5563',
  },
  leaseSpecsBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  specLine: {
    fontSize: 13,
    color: '#374151',
    marginVertical: 2,
  },
  specBold: {
    fontWeight: '700',
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '45%',
  },
  amenityText: {
    fontSize: 13,
    color: '#374151',
  },
  preferencesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  preferenceChip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  preferenceText: {
    fontSize: 12,
    color: '#4338CA',
    fontWeight: '600',
  },
  rulesText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
  },
  reportListingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    gap: 6,
    paddingVertical: 10,
  },
  reportListingText: {
    fontSize: 13,
    color: '#9CA3AF',
    textDecorationLine: 'underline',
  },
  stickyContactDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 20,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  ownerInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  ownerAvatarInitial: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  initialText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4338CA',
  },
  ownerTextCol: {
    flex: 1,
  },
  contactOwnerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  contactOwnerRole: {
    fontSize: 12,
    color: '#6B7280',
  },
  contactButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  callCircleBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  whatsAppCircleBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: DwelloColors.whatsappGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 12,
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: DwelloColors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
