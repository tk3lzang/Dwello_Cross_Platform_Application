/**
 * My Listings & Advertiser Dashboard Controls
 * Section 6 & 7 of Dwello App Manual.
 * Manage active and archived listings, update tenancy status to Rented, repost, and delete.
 * Real-time reactive updates without requiring manual pull-to-refresh.
 */

import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DwelloColors } from '@/constants/Colors';
import { ListingCard } from '@/components/ListingCard';
import { PropertyListing } from '@/types/listing';
import { useAuth } from '@/context/AuthContext';
import { useListings } from '@/context/ListingsContext';
import { useDebug } from '@/context/DebugContext';

export default function MyListingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { allListings, markAsRented, repostListing, deleteListing } = useListings();
  const { showDebugBanner } = useDebug();

  const [currentTab, setCurrentTab] = useState<'active' | 'archived'>('active');

  // Selected listing for management modal
  const [selectedListing, setSelectedListing] = useState<PropertyListing | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

  // Derive active and archived listings reactively from allListings
  const { activeListings, archivedListings } = useMemo(() => {
    const ownerId = user?.id || 'owner-tandin';
    const userItems = allListings.filter(
      (item) => item.ownerId === ownerId || item.ownerId === 'owner-tandin'
    );
    const active = userItems.filter((item) => item.status === 'active');
    const archived = userItems.filter((item) => item.status === 'rented' || item.status === 'archived');
    return { activeListings: active, archivedListings: archived };
  }, [allListings, user?.id]);

  const handleCardPress = (listing: PropertyListing) => {
    setSelectedListing(listing);
    setIsManageModalOpen(true);
  };

  const handleMarkAsRented = async () => {
    if (!selectedListing) return;
    console.log('[Dwello-DB Debug]: Action: Mark listing as rented:', selectedListing.id);
    try {
      await markAsRented(selectedListing.id);
      setIsManageModalOpen(false);
      showDebugBanner('info', 'Status Updated', 'Listing marked as rented and moved to Archived.');
    } catch (err: any) {
      showDebugBanner('error', 'Action Failed', err.message);
    }
  };

  const handleRepostListing = async () => {
    if (!selectedListing) return;
    console.log('[Dwello-DB Debug]: Action: Reposting listing:', selectedListing.id);
    try {
      await repostListing(selectedListing.id);
      setIsManageModalOpen(false);
      // Dark confirmation banner "Listing reposted" (Manual Page 15)
      showDebugBanner('success', 'Listing Reposted', 'Listing has returned to the public marketplace feed.');
    } catch (err: any) {
      showDebugBanner('error', 'Repost Failed', err.message);
    }
  };

  const handleDeletePermanently = async () => {
    if (!selectedListing) return;
    console.log('[Dwello-DB Debug]: Action: Delete permanently:', selectedListing.id);
    try {
      await deleteListing(selectedListing.id);
      setIsManageModalOpen(false);
      showDebugBanner('info', 'Deleted', 'Listing permanently deleted.');
    } catch (err: any) {
      showDebugBanner('error', 'Delete Failed', err.message);
    }
  };

  const currentList = currentTab === 'active' ? activeListings : archivedListings;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Listings</Text>
      </View>

      {/* Tabs Switcher: Active (N) and Archived (M) */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          onPress={() => setCurrentTab('active')}
          style={[styles.tabButton, currentTab === 'active' && styles.activeTabButton]}>
          <Text style={[styles.tabText, currentTab === 'active' && styles.activeTabText]}>
            Active ({activeListings.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setCurrentTab('archived')}
          style={[styles.tabButton, currentTab === 'archived' && styles.activeTabButton]}>
          <Text style={[styles.tabText, currentTab === 'archived' && styles.activeTabText]}>
            Archived ({archivedListings.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Body List */}
      <View style={styles.body}>
        <FlatList
          data={currentList}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.9} onPress={() => handleCardPress(item)}>
              <ListingCard
                listing={item}
                showCalculator={currentTab === 'active'}
                onCalculatorPress={(l) => {
                  router.push({
                    pathname: '/splitter',
                    params: { baseRent: l.price.toString() },
                  });
                }}
              />
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name={currentTab === 'active' ? 'business-outline' : 'archive-outline'}
                size={50}
                color="#D1D5DB"
              />
              <Text style={styles.emptyTitle}>
                {currentTab === 'active' ? 'No Active Listings' : 'No Archived Listings'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {currentTab === 'active'
                  ? 'Publish a flat or room using the central (+) button on the bottom bar.'
                  : 'Properties marked as rented will appear here.'}
              </Text>
            </View>
          }
        />
      </View>

      {/* Action / Management Bottom Sheet (Manual Page 13 & 15) */}
      <Modal
        visible={isManageModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsManageModalOpen(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsManageModalOpen(false)}>
          <View style={styles.bottomSheetCard} onStartShouldSetResponder={() => true}>
            <View style={styles.dragHandle} />

            <Text style={styles.sheetTitle} numberOfLines={1}>
              {selectedListing?.title}
            </Text>

            {currentTab === 'active' ? (
              // Active Sheet Options
              <View style={styles.sheetActions}>
                <TouchableOpacity
                  onPress={() => {
                    setIsManageModalOpen(false);
                    if (selectedListing) {
                      router.push({
                        pathname: '/listing/[id]',
                        params: { id: selectedListing.id },
                      });
                    }
                  }}
                  style={styles.actionRow}>
                  <Ionicons name="pencil-outline" size={20} color="#374151" style={styles.actionIcon} />
                  <Text style={styles.actionRowText}>Edit Listing</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleMarkAsRented}
                  activeOpacity={0.88}
                  style={styles.markRentedBtn}>
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.markRentedBtnText}>Mark as Rented</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleDeletePermanently}
                  style={styles.deleteActionRow}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" style={styles.actionIcon} />
                  <Text style={styles.deleteActionText}>Delete Permanently</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // Archived Sheet Options
              <View style={styles.sheetActions}>
                <View style={styles.archivedInfoBox}>
                  <Text style={styles.archivedInfoTitle}>ARCHIVED INFORMATION</Text>
                  <Text style={styles.archivedInfoText}>
                    This listing was marked as rented and is hidden from the marketplace.
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleRepostListing}
                  activeOpacity={0.88}
                  style={styles.repostBtn}>
                  <Ionicons name="arrow-undo" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.repostBtnText}>Repost Listing</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleDeletePermanently}
                  style={styles.deleteActionRow}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" style={styles.actionIcon} />
                  <Text style={styles.deleteActionText}>Delete Permanently</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    padding: 6,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomColor: DwelloColors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: DwelloColors.primary,
    fontWeight: '700',
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
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  bottomSheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  sheetActions: {
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
  },
  actionIcon: {
    marginRight: 8,
  },
  actionRowText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  markRentedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DwelloColors.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  markRentedBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  repostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DwelloColors.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  repostBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  archivedInfoBox: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  archivedInfoTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    marginBottom: 4,
  },
  archivedInfoText: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 16,
  },
  deleteActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  deleteActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
});
