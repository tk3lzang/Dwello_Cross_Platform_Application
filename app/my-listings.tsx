/**
 * Advertiser dashboard for active and archived listings.
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  Platform,
  Animated,
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
import { DebugBanner } from '@/components/DebugBanner';

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
  const [isConfirmRentedModalOpen, setIsConfirmRentedModalOpen] = useState(false);
  const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
  // Animated translateY for the bottom sheet card to slide up independently of the static backdrop
  const sheetTranslateY = useRef(new Animated.Value(320)).current;

  // Derive active and archived listings reactively from allListings strictly scoped to current user
  const { activeListings, archivedListings } = useMemo(() => {
    const ownerId = user?.id;
    if (!ownerId) {
      return { activeListings: [], archivedListings: [] };
    }
    const userItems = allListings.filter((item) => item.ownerId === ownerId);
    const active = userItems.filter((item) => item.status === 'active' && !item.is_archived);
    const archived = userItems.filter(
      (item) => item.status === 'rented' || item.status === 'archived' || item.is_archived
    );
    return { activeListings: active, archivedListings: archived };
  }, [allListings, user?.id]);

  const handleCardPress = (listing: PropertyListing) => {
    setSelectedListing(listing);
    setIsManageModalOpen(true);
    sheetTranslateY.setValue(320);
    Animated.spring(sheetTranslateY, {
      toValue: 0,
      damping: 18,
      stiffness: 140,
      useNativeDriver: true,
    }).start();
  };

  const closeManageModal = (callback?: () => void) => {
    Animated.timing(sheetTranslateY, {
      toValue: 320,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setIsManageModalOpen(false);
      callback?.();
    });
  };

  const handlePromptMarkAsRented = () => {
    closeManageModal(() => {
      setIsConfirmRentedModalOpen(true);
    });
  };

  const handleConfirmMarkAsRented = async () => {
    if (!selectedListing) return;
    console.log('[Dwello-DB Debug]: Action: Confirm Mark listing as rented:', selectedListing.id);
    try {
      await markAsRented(selectedListing.id);
      setIsConfirmRentedModalOpen(false);
      setSelectedListing(null);
      // Auto-switch to Archived tab so user sees the card move
      setCurrentTab('archived');
      showDebugBanner('info', 'Marked as Rented', 'Listing moved to Archived and hidden from marketplace.');
    } catch (err: any) {
      showDebugBanner('error', 'Action Failed', err.message);
    }
  };

  const handleRepostListing = async () => {
    if (!selectedListing) return;
    console.log('[Dwello-DB Debug]: Action: Reposting listing:', selectedListing.id);
    try {
      await repostListing(selectedListing.id);
      closeManageModal(() => {
        setSelectedListing(null);
        // Auto-switch to Active tab so user sees the reposted card
        setCurrentTab('active');
        showDebugBanner('success', 'Listing Reposted', 'Now visible to all users in the marketplace.');
      });
    } catch (err: any) {
      showDebugBanner('error', 'Repost Failed', err.message);
    }
  };

  const handlePromptDelete = () => {
    closeManageModal(() => {
      setIsConfirmDeleteModalOpen(true);
    });
  };

  const handleConfirmDelete = async () => {
    if (!selectedListing) return;
    console.log('[Dwello-DB Debug]: Action: Delete permanently confirmed:', selectedListing.id);
    try {
      await deleteListing(selectedListing.id);
      setIsConfirmDeleteModalOpen(false);
      setSelectedListing(null);
      showDebugBanner('info', 'Deleted', 'Listing permanently deleted.');
    } catch (err: any) {
      showDebugBanner('error', 'Delete Failed', err.message);
    }
  };

  const handleDeletePermanently = () => handlePromptDelete();

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
            <View style={styles.cardItemWrapper}>
              <ListingCard
                listing={item}
                onPress={handleCardPress}
                showCalculator={currentTab === 'archived'}
                onCalculatorPress={(l) => {
                  router.push({
                    pathname: '/splitter',
                    params: { baseRent: l.price.toString() },
                  });
                }}
              />
              {item.is_hidden && (
                <View style={styles.hiddenModerationCard}>
                  <View style={styles.hiddenModerationRow}>
                    <View style={styles.hiddenModerationBadge}>
                      <Ionicons name="eye-off" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                      <Text style={styles.hiddenModerationBadgeText}>Listing Hidden</Text>
                    </View>
                    <Text style={styles.hiddenModerationText} numberOfLines={1}>
                      Hidden from marketplace due to reports
                    </Text>
                  </View>
                  <Text style={styles.hiddenModerationText}>
                    Open the moderation notification to review the outcome or appeal.
                  </Text>
                </View>
              )}
            </View>
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

      {/* Listing management actions. */}
      <Modal
        visible={isManageModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => closeManageModal()}>
        <View pointerEvents="box-none" style={styles.modalToastContainer}>
          <DebugBanner insideModal />
        </View>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => closeManageModal()}>
          <Animated.View
            style={[
              styles.bottomSheetCard,
              { transform: [{ translateY: sheetTranslateY }] },
            ]}
            onStartShouldSetResponder={() => true}>
            <View style={styles.dragHandle} />

            <Text style={styles.sheetTitle} numberOfLines={1}>
              {selectedListing?.title}
            </Text>

            {selectedListing?.status === 'active' ? (
              // Active Sheet Options
              <View style={styles.sheetActions}>
                <TouchableOpacity
                  onPress={() => {
                    closeManageModal(() => {
                      if (selectedListing) {
                        router.push({
                          pathname: '/listing/[id]',
                          params: { id: selectedListing.id },
                        });
                      }
                    });
                  }}
                  style={styles.actionRow}>
                  <Ionicons name="pencil-outline" size={20} color="#374151" style={styles.actionIcon} />
                  <Text style={styles.actionRowText}>Edit Listing</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handlePromptMarkAsRented}
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
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Confirmation Modal for Mark as Rented */}
      <Modal
        visible={isConfirmRentedModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsConfirmRentedModalOpen(false)}>
        <TouchableOpacity
          style={styles.confirmModalOverlay}
          activeOpacity={1}
          onPress={() => setIsConfirmRentedModalOpen(false)}>
          <View style={styles.confirmModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.confirmIconContainer}>
              <Ionicons name="checkmark-done-circle" size={40} color={DwelloColors.primary} />
            </View>
            <Text style={styles.confirmModalTitle}>Mark as Rented?</Text>
            <Text style={styles.confirmModalDescription}>
              This listing will be hidden from the public marketplace and moved to your Archived listings.
            </Text>
            <View style={styles.confirmButtonsRow}>
              <TouchableOpacity
                onPress={() => setIsConfirmRentedModalOpen(false)}
                style={styles.confirmCancelBtn}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmMarkAsRented}
                activeOpacity={0.88}
                style={styles.confirmActionBtn}>
                <Text style={styles.confirmActionText}>Mark as Rented</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Confirmation Modal for Permanent Delete */}
      <Modal
        visible={isConfirmDeleteModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsConfirmDeleteModalOpen(false)}>
        <TouchableOpacity
          style={styles.confirmModalOverlay}
          activeOpacity={1}
          onPress={() => setIsConfirmDeleteModalOpen(false)}>
          <View style={styles.confirmModalCard} onStartShouldSetResponder={() => true}>
            <View style={[styles.confirmIconContainer, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="trash-outline" size={36} color="#EF4444" />
            </View>
            <Text style={styles.confirmModalTitle}>Delete Permanently?</Text>
            <Text style={styles.confirmModalDescription}>
              This listing will be permanently removed and cannot be recovered. Are you sure?
            </Text>
            <View style={styles.confirmButtonsRow}>
              <TouchableOpacity
                onPress={() => setIsConfirmDeleteModalOpen(false)}
                style={styles.confirmCancelBtn}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmDelete}
                activeOpacity={0.88}
                style={[styles.confirmActionBtn, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.confirmActionText}>Delete</Text>
              </TouchableOpacity>
            </View>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
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
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
    textAlign: 'center',
  },
  sheetActions: {
    gap: 10,
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
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  confirmIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF0F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  confirmModalDescription: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    marginBottom: 20,
  },
  confirmButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
  },
  confirmActionBtn: {
    flex: 1,
    backgroundColor: DwelloColors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  moderationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    padding: 12,
  },
  moderationBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
  },
  moderationBannerSubtitle: {
    fontSize: 11,
    color: '#B91C1C',
    marginTop: 2,
  },
  appealBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  appealBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  modalToastContainer: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 99999,
    elevation: 9999,
    pointerEvents: 'box-none',
  },
  cardItemWrapper: {
    marginBottom: 8,
  },
  hiddenModerationCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: -8,
    marginBottom: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  hiddenModerationRow: {
    flex: 1,
  },
  hiddenModerationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  hiddenModerationBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.3,
  },
  hiddenModerationText: {
    fontSize: 11,
    color: '#7F1D1D',
  },
});
