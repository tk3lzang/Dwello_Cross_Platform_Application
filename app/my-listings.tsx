/**
 * My Listings & Advertiser Dashboard Controls
 * Section 6 & 7 of Dwello App Manual.
 * Manage active and archived listings, update tenancy status to Rented, repost, and delete.
 * Real-time reactive updates without requiring manual pull-to-refresh.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  Platform,
  Animated,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DwelloColors } from '@/constants/Colors';
import { ListingCard } from '@/components/ListingCard';
import { PropertyListing } from '@/types/listing';
import { useAuth } from '@/context/AuthContext';
import { useListings } from '@/context/ListingsContext';
import { useDebug } from '@/context/DebugContext';
import { DatabaseService } from '@/services/database';
import { DebugBanner } from '@/components/DebugBanner';
import { AppealFormModal } from '@/components/AppealFormModal';

export default function MyListingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { allListings, markAsRented, repostListing, deleteListing } = useListings();
  const { showDebugBanner } = useDebug();
  const params = useLocalSearchParams<{ appealListingId?: string }>();

  const [currentTab, setCurrentTab] = useState<'active' | 'archived'>('active');

  // Selected listing for management modal
  const [selectedListing, setSelectedListing] = useState<PropertyListing | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isConfirmRentedModalOpen, setIsConfirmRentedModalOpen] = useState(false);
  const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
  const [isAppealModalOpen, setIsAppealModalOpen] = useState(false);
  const [appealNotes, setAppealNotes] = useState('');
  const [appealListingTarget, setAppealListingTarget] = useState<PropertyListing | null>(null);
  const [selectedAppealListing, setSelectedAppealListing] = useState<PropertyListing | null>(null);

  // Deep-link direct launch of Appeal Form Modal from background push notifications
  useEffect(() => {
    if (params.appealListingId && allListings.length > 0) {
      const match = allListings.find((item) => item.id === params.appealListingId);
      if (match) {
        setSelectedAppealListing(match);
      } else {
        // Fallback target with matching listing ID
        setSelectedAppealListing({
          id: params.appealListingId,
          title: 'Reported Property Listing',
          category: 'Full Flat',
          price: 13500,
          bhkType: '2BHK',
          municipalRegion: 'Thimphu',
          zoneArea: 'Norzin Lam',
          fullAddress: 'Norzin Lam, Thimphu',
          latitude: 27.4712,
          longitude: 89.6339,
          images: [],
          amenities: [],
          description: 'Dwello rental property',
          status: 'active',
          ownerId: user?.id || 'owner-tandin',
          ownerName: 'Tandin Kelzang',
          ownerPhone: '17123456',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          is_hidden: true,
          appealWindowOpen: true,
        });
      }
    }
  }, [params.appealListingId, allListings, user?.id]);

  // Animated translateY for the bottom sheet card to slide up independently of the static backdrop
  const sheetTranslateY = useRef(new Animated.Value(320)).current;

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

  const handleOpenAppeal = (listing: PropertyListing) => {
    setAppealListingTarget(listing);
    setAppealNotes('');
    setIsAppealModalOpen(true);
  };

  const handleSubmitAppeal = async () => {
    if (!appealListingTarget) return;
    if (!appealNotes.trim()) {
      showDebugBanner('warning', 'Appeal Details Required', 'Please provide explanation or counter-evidence.');
      return;
    }
    console.log('[Dwello-Moderation Debug]: Submitting owner counter-evidence for:', appealListingTarget.id);
    try {
      await DatabaseService.submitAppeal(appealListingTarget.id, appealNotes.trim());
      setIsAppealModalOpen(false);
      setAppealListingTarget(null);
      showDebugBanner(
        'success',
        'Appeal Submitted',
        'Your counter-evidence has been received. Our moderation team will review it.'
      );
    } catch (e: any) {
      showDebugBanner('error', 'Appeal Failed', e.message);
    }
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
                  <TouchableOpacity
                    style={styles.appealActionBtn}
                    activeOpacity={0.85}
                    onPress={() => setSelectedAppealListing(item)}>
                    <Ionicons name="shield-half" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.appealActionBtnText}>Apply for Appeal</Text>
                  </TouchableOpacity>
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

      {/* Action / Management Bottom Sheet (Manual Page 13 & 15) */}
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
                {selectedListing?.is_hidden && (
                  <TouchableOpacity
                    onPress={() => {
                      const target = selectedListing;
                      closeManageModal(() => {
                        if (target) setSelectedAppealListing(target);
                      });
                    }}
                    style={[styles.actionRow, { backgroundColor: '#FEF2F2' }]}>
                    <Ionicons name="shield-half" size={20} color="#DC2626" style={styles.actionIcon} />
                    <Text style={[styles.actionRowText, { color: '#DC2626', fontWeight: '700' }]}>
                      Apply for Appeal (Listing Hidden)
                    </Text>
                  </TouchableOpacity>
                )}

                {selectedListing?.appealWindowOpen && !selectedListing?.is_hidden && (
                  <TouchableOpacity
                    onPress={() => {
                      closeManageModal(() => {
                        if (selectedListing) handleOpenAppeal(selectedListing);
                      });
                    }}
                    style={[styles.actionRow, { backgroundColor: '#FEF2F2' }]}>
                    <Ionicons name="shield-checkmark-outline" size={20} color="#DC2626" style={styles.actionIcon} />
                    <Text style={[styles.actionRowText, { color: '#DC2626', fontWeight: '700' }]}>
                      Submit Appeal / Counter-Evidence
                    </Text>
                  </TouchableOpacity>
                )}

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

      {/* Appeal & Counter-Evidence Submission Modal */}
      <Modal
        visible={isAppealModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAppealModalOpen(false)}>
        <View pointerEvents="box-none" style={styles.modalToastContainer}>
          <DebugBanner insideModal />
        </View>
        <TouchableOpacity
          style={styles.confirmModalOverlay}
          activeOpacity={1}
          onPress={() => setIsAppealModalOpen(false)}>
          <View style={[styles.confirmModalCard, { maxWidth: 400 }]} onStartShouldSetResponder={() => true}>
            <View style={[styles.confirmIconContainer, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="shield-checkmark" size={32} color="#D97706" />
            </View>
            <Text style={styles.confirmModalTitle}>Submit Listing Appeal</Text>
            <Text style={styles.confirmModalDescription}>
              Provide explanation, lease documentation, or counter-evidence to verify your listing and restore public visibility.
            </Text>
            <TextInput
              style={styles.appealInput}
              placeholder="State why this listing is accurate and compliant with Dwello community standards..."
              placeholderTextColor="#9CA3AF"
              value={appealNotes}
              onChangeText={setAppealNotes}
              multiline
              numberOfLines={4}
            />
            <View style={styles.confirmButtonsRow}>
              <TouchableOpacity
                onPress={() => setIsAppealModalOpen(false)}
                style={styles.confirmCancelBtn}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmitAppeal}
                activeOpacity={0.88}
                style={[styles.confirmActionBtn, { backgroundColor: DwelloColors.primary }]}>
                <Text style={styles.confirmActionText}>Submit Appeal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Host Appeal Modal (Directive Module 3 & 4) */}
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
  appealInput: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#111827',
    textAlignVertical: 'top',
    marginBottom: 16,
    minHeight: 80,
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
  appealActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  appealActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
