/**
 * Public Profile Feed View
 * Displays another user's public profile inspired by LinkedIn / Airbnb host profiles.
 * Shows cover banner, user bio, lifestyle preferences, verification badges,
 * and a grid/list of their active property posts or roommate requests.
 *
 * [Dwello-ProfileFeed Debug] namespaced logging.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DwelloColors } from '@/constants/Colors';
import { Avatar } from '@/components/Avatar';
import { ListingCard } from '@/components/ListingCard';
import { useListings } from '@/context/ListingsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { StorageService } from '@/services/storage';
import { openWhatsAppChat } from '@/utils/linking';
import { useDebug } from '@/context/DebugContext';
import { NotificationBell } from '@/components/NotificationCenter';
import { AppealFormModal } from '@/components/AppealFormModal';
import { PropertyListing } from '@/types/listing';

// Lifestyle preference icons mapping
const PREF_ICONS: Record<string, string> = {
  'Student Friendly': 'school-outline',
  'Quiet / Study Environment': 'library-outline',
  'Non-Smoker': 'ban-outline',
  'Female Only': 'woman-outline',
  'Male Only': 'man-outline',
  'Pet Friendly': 'paw-outline',
  'Working Professional': 'briefcase-outline',
  'Vegetarian Only': 'leaf-outline',
};

export default function PublicProfileScreen() {
  const { userId, ownerName, ownerPhone, ownerRole, ownerAvatar } =
    useLocalSearchParams<{
      userId: string;
      ownerName?: string;
      ownerPhone?: string;
      ownerRole?: string;
      ownerAvatar?: string;
    }>();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { allListings } = useListings();
  const { user } = useAuth();
  const { showDebugBanner } = useDebug();
  const [isContactLoading, setIsContactLoading] = useState(false);
  const [selectedAppealListing, setSelectedAppealListing] = useState<PropertyListing | null>(null);

  // Live synchronized profile state hooks (Module 1B)
  const [liveAvatar, setLiveAvatar] = useState<string | undefined>(ownerAvatar);
  const [liveBio, setLiveBio] = useState<string>('');
  const [liveName, setLiveName] = useState<string>(ownerName || '');
  const [livePhone, setLivePhone] = useState<string>(ownerPhone || '');
  const [liveRole, setLiveRole] = useState<string>(ownerRole || '');

  // Synchronize live user profile data in real-time from account / database
  useEffect(() => {
    let isMounted = true;

    async function syncUserProfile() {
      console.log('[Dwello-ProfileFeed Debug]: Synchronizing live profile data for:', userId, ownerName);
      try {
        // 1. Sync from active AuthContext user session if viewing own profile
        const isSelf = user && (user.id === userId || user.fullName === ownerName || !userId);
        if (isSelf && user && isMounted) {
          if (user.avatarUrl) setLiveAvatar(user.avatarUrl);
          if (user.bio) setLiveBio(user.bio);
          if (user.fullName) setLiveName(user.fullName);
          if (user.phoneNumber) setLivePhone(user.phoneNumber);
          if (user.role) setLiveRole(user.role);
        }

        // 2. Sync from local persistent disk storage
        const savedProfile = await StorageService.getSavedUserProfile();
        if (savedProfile && (savedProfile.id === userId || savedProfile.fullName === ownerName) && isMounted) {
          if (savedProfile.avatarUrl) setLiveAvatar(savedProfile.avatarUrl);
          if (savedProfile.bio) setLiveBio(savedProfile.bio);
          if (savedProfile.fullName) setLiveName(savedProfile.fullName);
          if (savedProfile.phoneNumber) setLivePhone(savedProfile.phoneNumber);
          if (savedProfile.role) setLiveRole(savedProfile.role);
        }

        // 3. Sync from remote Supabase profiles table if online
        if (isSupabaseConfigured() && userId) {
          const { data, error } = await supabase
            .from('profiles')
            .select('avatar_url, bio, full_name, phone_number, role')
            .eq('id', userId)
            .maybeSingle();

          if (data && !error && isMounted) {
            console.log('[Dwello-ProfileFeed Debug]: Supabase profile synced for:', userId);
            if (data.avatar_url) setLiveAvatar(data.avatar_url);
            if (data.bio) setLiveBio(data.bio);
            if (data.full_name) setLiveName(data.full_name);
            if (data.phone_number) setLivePhone(data.phone_number);
            if (data.role) setLiveRole(data.role);
          }
        }
      } catch (err) {
        console.warn('[Dwello-ProfileFeed Debug]: Profile sync error:', err);
      }
    }

    syncUserProfile();

    return () => {
      isMounted = false;
    };
  }, [userId, ownerName, user]);

  const displayName = liveName || ownerName || 'Dorji Wangchuk';
  const displayRole = liveRole || ownerRole || 'Landlord / Host';
  const displayPhone = livePhone || ownerPhone || '';
  const displayAvatar = liveAvatar || ownerAvatar;
  const displayBio =
    liveBio && liveBio.trim().length > 0
      ? liveBio.trim()
      : 'Verified property host on Dwello. Listings are professionally managed and accurately described. Contact via WhatsApp for enquiries.';

  console.log('[Dwello-Navigation Fix]: Loaded full-screen UserProfile page for userId:', userId, 'name:', displayName);

  // Collect all active listings from this owner
  const ownerListings = useMemo(() => {
    if (!userId) return [];
    return allListings.filter(
      (item) => (item.ownerId === userId || item.ownerName === ownerName || item.ownerName === liveName) && item.status === 'active'
    );
  }, [allListings, userId, ownerName, liveName]);

  // Collect all lifestyle preference tags from their listings (for profile display)
  const allPreferences = useMemo(() => {
    const prefSet = new Set<string>();
    ownerListings.forEach((listing) => {
      (listing.roommatePreferences || []).forEach((pref) => prefSet.add(pref));
    });
    return Array.from(prefSet);
  }, [ownerListings]);

  const handleWhatsAppContact = async () => {
    if (!displayPhone) {
      showDebugBanner('warning', 'No Contact', 'This host has not provided a WhatsApp number.');
      return;
    }
    console.log('[Dwello-ProfileFeed Debug]: Initiating WhatsApp contact for', displayName);
    setIsContactLoading(true);
    try {
      const success = await openWhatsAppChat(
        displayPhone,
        `Hi ${displayName || 'there'}, I found your profile on Dwello and I am interested in your property listings. Could you share more details? Thank you!`
      );
      if (!success) {
        showDebugBanner('warning', 'WhatsApp unavailable', 'Could not open WhatsApp for this number.');
      }
    } finally {
      setIsContactLoading(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header strictly "User Profile" */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>User Profile</Text>
        <NotificationBell
          onOpenAppeal={(listingId, listingTitle) => {
            setSelectedAppealListing({ id: listingId, title: listingTitle || 'Property Listing' } as any);
          }}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>

        {/* Profile Identity Card (Without solid red banner) */}
        <View style={styles.identityCard}>
          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            <Avatar
              uri={displayAvatar}
              name={displayName}
              size={80}
            />
            {/* Verified Badge */}
            <View style={styles.verifiedBadge} accessibilityLabel="Verified host">
              <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
            </View>
          </View>

          <Text style={styles.profileName}>{displayName}</Text>

          <View style={styles.roleRow}>
            <Ionicons name="briefcase-outline" size={13} color="#6B7280" />
            <Text style={styles.roleText}>{displayRole}</Text>
          </View>

          {/* Verification Badges */}
          <View style={styles.badgesRow}>
            <View style={styles.verifiedInfoBadge}>
              <Ionicons name="shield-checkmark-outline" size={13} color={DwelloColors.success} />
              <Text style={styles.verifiedBadgeText}>ID Verified</Text>
            </View>
            <View style={styles.verifiedInfoBadge}>
              <Ionicons name="phone-portrait-outline" size={13} color={DwelloColors.info} />
              <Text style={styles.verifiedBadgeText}>Phone Verified</Text>
            </View>
            {ownerListings.length > 0 && (
              <View style={styles.verifiedInfoBadge}>
                <Ionicons name="home-outline" size={13} color={DwelloColors.primary} />
                <Text style={styles.verifiedBadgeText}>{ownerListings.length} Listing{ownerListings.length !== 1 ? 's' : ''}</Text>
              </View>
            )}
          </View>

          {/* Bio text synced from live account / database */}
          <View style={styles.bioSection}>
            <Text style={styles.bioText}>
              {displayBio}
            </Text>
          </View>

          {/* Contact via WhatsApp CTA */}
          {displayPhone ? (
            <TouchableOpacity
              onPress={handleWhatsAppContact}
              activeOpacity={0.88}
              disabled={isContactLoading}
              style={styles.whatsappBtn}
              accessibilityLabel={`Contact ${displayName} on WhatsApp`}>
              {isContactLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.whatsappBtnText}>Contact on WhatsApp</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Lifestyle Preferences Section */}
        {allPreferences.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Lifestyle & Preferences</Text>
            <View style={styles.prefsGrid}>
              {allPreferences.map((pref) => (
                <View key={pref} style={styles.prefChip}>
                  <Ionicons
                    name={(PREF_ICONS[pref] as any) || 'checkmark-circle-outline'}
                    size={14}
                    color={DwelloColors.primary}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.prefChipText}>{pref}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Active Property Listings */}
        <View style={styles.listingsSection}>
          <Text style={styles.sectionTitle}>
            Active Listings ({ownerListings.length})
          </Text>

          {ownerListings.length === 0 ? (
            <View style={styles.emptyListings}>
              <Ionicons name="home-outline" size={36} color="#D1D5DB" />
              <Text style={styles.emptyListingsText}>No active listings at this time.</Text>
            </View>
          ) : (
            ownerListings.map((listing) => (
              <View key={listing.id} style={{ marginBottom: 12 }}>
                <ListingCard listing={listing} />
                {listing.is_hidden && (
                  <TouchableOpacity
                    style={styles.appealListingBanner}
                    activeOpacity={0.85}
                    onPress={() => setSelectedAppealListing(listing)}>
                    <View style={styles.appealListingBadge}>
                      <Ionicons name="eye-off" size={13} color="#DC2626" style={{ marginRight: 4 }} />
                      <Text style={styles.appealListingBadgeText}>Listing Hidden</Text>
                    </View>
                    <Text style={styles.appealListingActionText}>Tap to Appeal</Text>
                    <Ionicons name="chevron-forward" size={14} color="#B91C1C" />
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>

        {/* Trust & Safety Note */}
        <View style={styles.trustNote}>
          <Ionicons name="information-circle-outline" size={14} color="#6B7280" style={{ marginRight: 6 }} />
          <Text style={styles.trustNoteText}>
            Listings on Dwello are verified by our community moderation team. Always visit the property before making any payment.
          </Text>
        </View>
      </ScrollView>

      {/* Appeal Request Form Modal */}
      {selectedAppealListing && (
        <AppealFormModal
          visible={!!selectedAppealListing}
          listingId={selectedAppealListing.id}
          listingTitle={selectedAppealListing.title}
          onClose={() => setSelectedAppealListing(null)}
          onAppealSubmitted={() => setSelectedAppealListing(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    padding: 6,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  scrollContent: {
    paddingBottom: 60,
  },
  identityCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 10,
    marginTop: -4,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: DwelloColors.success,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    marginBottom: 12,
  },
  roleText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 14,
  },
  verifiedInfoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  bioSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    width: '100%',
  },
  bioText: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 19,
    textAlign: 'center',
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DwelloColors.whatsappGreen,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    width: '100%',
    minHeight: 44,
    ...Platform.select({
      ios: {
        shadowColor: DwelloColors.whatsappGreen,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
      },
      android: { elevation: 3 },
    }),
  },
  whatsappBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  prefsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  prefChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DwelloColors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: DwelloColors.primaryBorder,
  },
  prefChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: DwelloColors.primary,
  },
  listingsSection: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  emptyListings: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyListingsText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 10,
  },
  trustNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
  },
  trustNoteText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
    lineHeight: 17,
  },
  appealListingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: -8,
  },
  appealListingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  appealListingBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
  },
  appealListingActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B91C1C',
    flex: 1,
    marginLeft: 8,
  },
});
