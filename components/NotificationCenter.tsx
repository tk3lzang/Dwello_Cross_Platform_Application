/**
 * Notification inbox with read, delete, and appeal actions.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Platform,
  ActivityIndicator,
  ViewStyle,
  StyleProp,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ReanimatedSwipeable, {
  SwipeableMethods,
  SwipeDirection,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ModerationService } from '@/services/moderationService';
import { ModerationNotification } from '@/types/moderation';
import { useAuth } from '@/context/AuthContext';
import { useDebug } from '@/context/DebugContext';
import { AppealFormModal } from './AppealFormModal';
import { DebugBanner } from './DebugBanner';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const BRAND_CORAL = '#FF3158';
const TEXT_DARK = '#202124';

// Action buttons revealed only during horizontal active swipe gestures
function SwipeLeftAction({
  progress,
  translation,
  onPress,
}: {
  progress: SharedValue<number>;
  translation: SharedValue<number>;
  onPress: () => void;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    // Only reveal when user actively drags rightwards
    const isSwiping = translation.value > 2;
    return {
      opacity: isSwiping
        ? interpolate(progress.value, [0, 0.25, 1], [0, 1, 1], Extrapolation.CLAMP)
        : 0,
      transform: [
        {
          translateX: interpolate(progress.value, [0, 1], [-85, 0], Extrapolation.CLAMP),
        },
      ],
    };
  });

  return (
    <Animated.View style={[styles.swipeReadAction, animatedStyle]}>
      <TouchableOpacity
        style={styles.actionTouchable}
        onPress={onPress}
        activeOpacity={0.85}>
        <View style={styles.actionContent}>
          <Ionicons name="checkmark-done" size={22} color="#FFFFFF" />
          <Text style={styles.actionText}>Read</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function SwipeRightAction({
  progress,
  translation,
  onPress,
}: {
  progress: SharedValue<number>;
  translation: SharedValue<number>;
  onPress: () => void;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    // Only reveal when user actively drags leftwards
    const isSwiping = translation.value < -2;
    return {
      opacity: isSwiping
        ? interpolate(progress.value, [0, 0.25, 1], [0, 1, 1], Extrapolation.CLAMP)
        : 0,
      transform: [
        {
          translateX: interpolate(progress.value, [0, 1], [85, 0], Extrapolation.CLAMP),
        },
      ],
    };
  });

  return (
    <Animated.View style={[styles.swipeDeleteAction, animatedStyle]}>
      <TouchableOpacity
        style={styles.actionTouchable}
        onPress={onPress}
        activeOpacity={0.85}>
        <View style={styles.actionContent}>
          <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
          <Text style={styles.actionText}>Delete</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

interface NotificationBellProps {
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  openToken?: string;
}

export function NotificationBell({
  color = '#111827',
  size = 22,
  style,
  openToken,
}: NotificationBellProps) {
  const { user } = useAuth();
  const userId = user?.id;
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  useEffect(() => {
    if (openToken) setIsDrawerOpen(true);
  }, [openToken]);

  const fetchUnread = useCallback(async () => {
    try {
      const count = await ModerationService.getUnreadCount(userId);
      setUnreadCount(count);
    } catch (e) {
      console.warn('[Dwello-Moderation Error]: Failed to fetch unread count:', e);
    }
  }, [userId]);

  useEffect(() => {
    fetchUnread();
    const unsubscribe = ModerationService.subscribe(() => {
      fetchUnread();
    });
    return () => unsubscribe();
  }, [fetchUnread]);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | null = null;
    if (userId) {
      ModerationService.subscribeToUserNotifications(userId)
        .then((stop) => {
          if (active) {
            unsubscribe = stop;
          } else {
            stop();
          }
        })
        .catch((error) => {
          console.error('[Dwello-Moderation Error]: Could not subscribe to user notifications:', error);
        });
    }
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [userId]);

  return (
    <>
      <TouchableOpacity
        onPress={() => setIsDrawerOpen(true)}
        style={[styles.bellContainer, style]}
        activeOpacity={0.7}
        accessibilityLabel={`Notifications, ${unreadCount} unread`}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="notifications-outline" size={size} color={color} />
        {unreadCount > 0 && (
          <View style={styles.badgePill}>
            <Text style={styles.badgeText}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <NotificationDrawer
        visible={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </>
  );
}

interface NotificationDrawerProps {
  visible: boolean;
  onClose: () => void;
}

export function NotificationDrawer({
  visible,
  onClose,
}: NotificationDrawerProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;
  const { showDebugBanner } = useDebug();

  const [notifications, setNotifications] = useState<ModerationNotification[]>([]);
  const [eligibleNotificationIds, setEligibleNotificationIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // References to open swipeables
  const swipeableRefs = useRef<Map<string, SwipeableMethods>>(new Map());

  // Embedded appeal modal state for notifications clicked directly
  const [appealModalListing, setAppealModalListing] = useState<{
    id: string;
    title: string;
    reportId: string;
  } | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const items = await ModerationService.getUserNotifications(userId);
      setNotifications(items);
      const eligibleItems = await Promise.all(
        items.map(async (item) => {
          if (item.type !== 'listing_flagged' && item.type !== 'listing_removed') return null;
          const reportId =
            item.report_id ||
            item.action_url?.match(/reportId=([^&]+)/)?.[1];
          if (!reportId) return null;
          const eligibility = await ModerationService.getAppealEligibility(reportId);
          return eligibility ? item.id : null;
        })
      );
      setEligibleNotificationIds(
        new Set(eligibleItems.filter((notificationId): notificationId is string => !!notificationId))
      );
    } catch (error) {
      console.error('[Dwello-Moderation Error]: Load notifications error:', error);
      showDebugBanner('error', 'Notification Error', 'Could not load notifications.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [userId, showDebugBanner]);

  useEffect(() => {
    if (visible) {
      loadNotifications();
    }
    const unsubscribe = ModerationService.subscribe(() => {
      if (visible) loadNotifications();
    });
    return () => unsubscribe();
  }, [visible, loadNotifications]);

  const handleMarkAllRead = async () => {
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      await ModerationService.markAllNotificationsRead(userId);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      showDebugBanner('info', 'All Caught Up', 'All notifications marked as read.');
    } catch (e) {
      console.error('[Dwello-Moderation Error]: Mark all read error:', e);
      showDebugBanner('error', 'Update Failed', 'Could not update notifications. Please try again.');
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await ModerationService.deleteNotification(id);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      showDebugBanner('info', 'Notification Dismissed', 'Notification removed.');
    } catch (error) {
      console.error('[Dwello-Moderation Error]: Delete notification error:', error);
      showDebugBanner('error', 'Update Failed', 'Could not remove notification.');
    }
  };

  const handleToggleRead = async (id: string) => {
    try {
      await ModerationService.markNotificationRead(id);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      const ref = swipeableRefs.current.get(id);
      ref?.close();
    } catch (error) {
      console.error('[Dwello-Moderation Error]: Mark notification read error:', error);
      showDebugBanner('error', 'Update Failed', 'Could not update notification.');
    }
  };

  const handleNotificationPress = async (item: ModerationNotification) => {
    try {
      // 1. Mark as read
      if (!item.read) {
        await ModerationService.markNotificationRead(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
        );
      }

      const isRemovalAlert = item.type === 'listing_flagged' || item.type === 'listing_removed';

      if (isRemovalAlert) {
        const reportId =
          item.report_id ||
          item.action_url?.match(/reportId=([^&]+)/)?.[1];
        const eligibility = reportId
          ? await ModerationService.getAppealEligibility(reportId)
          : null;
        if (!eligibility) {
          showDebugBanner('info', 'Appeal Unavailable', 'This moderation action is no longer eligible for an appeal.');
          return;
        }
        setAppealModalListing({
          id: eligibility.listing_id,
          title: eligibility.listing_title,
          reportId: eligibility.report_id,
        });
      } else {
        console.info('[Dwello-Notification]: Opened moderation update', {
          notificationId: item.id,
          listingId: item.target_id,
          reportId: item.report_id,
          appealId: item.appeal_id,
        });
        if (item.type === 'appeal_status' && item.target_id) {
          onClose();
          router.push({ pathname: '/listing/[id]', params: { id: item.target_id } });
        }
      }
    } catch (error) {
      console.error('[Dwello-Notification Routing Error]: Tap handling error:', error);
    }
  };

  const renderNotificationIcon = (type: ModerationNotification['type']) => {
    switch (type) {
      case 'listing_flagged':
      case 'listing_removed':
        return (
          <View style={[styles.typeIconContainer, { backgroundColor: '#FEE2E2' }]}>
            <Ionicons name="alert-circle" size={20} color="#DC2626" />
          </View>
        );
      case 'appeal_status':
      case 'appeal_approved':
        return (
          <View style={[styles.typeIconContainer, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="shield-checkmark" size={20} color="#2563EB" />
          </View>
        );
      case 'report_received':
      default:
        return (
          <View style={[styles.typeIconContainer, { backgroundColor: '#DEF7EC' }]}>
            <Ionicons name="checkmark-circle" size={20} color="#059669" />
          </View>
        );
    }
  };

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <>
      <Modal
        visible={visible && !appealModalListing}
        animationType="slide"
        onRequestClose={onClose}
        presentationStyle="fullScreen">
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
          <View style={[styles.fullPageContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            {/* Global Toast Portal */}
            <View pointerEvents="box-none" style={styles.modalToastContainer}>
              <DebugBanner insideModal />
            </View>

            {/* Notification inbox header. */}
            <View style={styles.fullPageHeader}>
              <TouchableOpacity
                onPress={onClose}
                style={styles.headerBackBtn}
                accessibilityLabel="Go back"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="arrow-back" size={24} color={TEXT_DARK} />
              </TouchableOpacity>

              <Text style={styles.fullPageTitle}>Notifications</Text>

              {hasUnread ? (
                <TouchableOpacity
                  onPress={handleMarkAllRead}
                  style={styles.markAllReadBtn}
                  activeOpacity={0.75}>
                  <Text style={styles.markAllReadText}>Mark all read</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ width: 80 }} />
              )}
            </View>

            {/* List Body */}
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={BRAND_CORAL} />
                <Text style={styles.loadingText}>Fetching notification updates...</Text>
              </View>
            ) : (
              <ScrollView
                style={styles.scrollList}
                contentContainerStyle={styles.scrollListContent}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => {
                      setRefreshing(true);
                      loadNotifications();
                    }}
                    tintColor={BRAND_CORAL}
                  />
                }
                showsVerticalScrollIndicator={false}>
                {notifications.length === 0 ? (
                  // Empty inbox state.
                  <View style={styles.emptyContainer}>
                    <View style={styles.emptyBellCircle}>
                      <Ionicons name="notifications-outline" size={44} color="#9CA3AF" />
                      <View style={styles.emptyZeroBadge}>
                        <Text style={styles.emptyZeroText}>0</Text>
                      </View>
                    </View>
                    <Text style={styles.emptyTitle}>You're all caught up!</Text>
                    <Text style={styles.emptySubtitle}>
                      No new alerts or moderation updates at this time.
                    </Text>
                  </View>
                ) : (
                  notifications.map((item) => {
                    const isRemovalAlert =
                      item.type === 'listing_flagged' || item.type === 'listing_removed';
                    return (
                      <View key={item.id} style={styles.swipeableWrapper}>
                        <ReanimatedSwipeable
                          ref={(ref) => {
                            if (ref) {
                              swipeableRefs.current.set(item.id, ref);
                            } else {
                              swipeableRefs.current.delete(item.id);
                            }
                          }}
                          friction={2}
                          leftThreshold={50}
                          rightThreshold={50}
                          dragOffsetFromLeft={15}
                          dragOffsetFromRight={-15}
                          overshootLeft={false}
                          overshootRight={false}
                          renderLeftActions={(progress, translation, swipeableMethods) => (
                            <SwipeLeftAction
                              progress={progress}
                              translation={translation}
                              onPress={() => {
                                swipeableMethods.close();
                                handleToggleRead(item.id);
                              }}
                            />
                          )}
                          renderRightActions={(progress, translation, swipeableMethods) => (
                            <SwipeRightAction
                              progress={progress}
                              translation={translation}
                              onPress={() => {
                                swipeableMethods.close();
                                handleDeleteNotification(item.id);
                              }}
                            />
                          )}
                          onSwipeableOpen={(direction) => {
                            if (direction === SwipeDirection.RIGHT) {
                              handleDeleteNotification(item.id);
                            } else if (direction === SwipeDirection.LEFT) {
                              handleToggleRead(item.id);
                            }
                          }}>
                          <TouchableOpacity
                            onPress={() => handleNotificationPress(item)}
                            style={[
                              styles.notificationCard,
                              !item.read && styles.notificationCardUnread,
                            ]}
                            activeOpacity={0.92}>
                            <View style={styles.cardHeaderRow}>
                              <View style={styles.iconAndTitle}>
                                {renderNotificationIcon(item.type)}
                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={[
                                      styles.cardTitle,
                                      !item.read && styles.cardTitleUnread,
                                    ]}>
                                    {item.title}
                                  </Text>
                                  <Text style={styles.cardTime}>
                                    {new Date(item.created_at).toLocaleString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </Text>
                                </View>
                              </View>
                              {!item.read && <View style={styles.unreadDot} />}
                            </View>

                            <Text style={styles.cardBody}>{item.body}</Text>

                            {/* Interactive Appeal Call to Action for Removal Alerts */}
                            {isRemovalAlert && eligibleNotificationIds.has(item.id) && (
                              <View style={styles.appealActionRow}>
                                <View style={styles.appealBadgePill}>
                                  <Ionicons
                                    name="shield-half"
                                    size={14}
                                    color="#DC2626"
                                    style={{ marginRight: 6 }}
                                  />
                                  <Text style={styles.appealBadgeText}>
                                    Tap to submit an appeal
                                  </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color="#DC2626" />
                              </View>
                            )}
                          </TouchableOpacity>
                        </ReanimatedSwipeable>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            )}
          </View>
        </GestureHandlerRootView>
      </Modal>

      {/* Embedded AppealFormModal if user taps removal alert inside drawer */}
      {appealModalListing && (
        <AppealFormModal
          visible={!!appealModalListing}
          listingId={appealModalListing.id}
          listingTitle={appealModalListing.title}
          reportId={appealModalListing.reportId}
          onClose={() => setAppealModalListing(null)}
          onAppealSubmitted={() => {
            setAppealModalListing(null);
            loadNotifications();
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  bellContainer: {
    padding: 6,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgePill: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: BRAND_CORAL,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },
  fullPageContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  fullPageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  headerBackBtn: {
    padding: 4,
    width: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  fullPageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT_DARK,
    textAlign: 'center',
  },
  markAllReadBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    minWidth: 80,
    alignItems: 'flex-end',
  },
  markAllReadText: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND_CORAL,
  },
  scrollList: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollListContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 120,
    paddingHorizontal: 32,
  },
  emptyBellCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    position: 'relative',
  },
  emptyZeroBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: '#9CA3AF',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F3F4F6',
  },
  emptyZeroText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_DARK,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  swipeableWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
      },
      android: { elevation: 1 },
    }),
  },
  notificationCardUnread: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  iconAndTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  typeIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  cardTitleUnread: {
    fontWeight: '800',
    color: TEXT_DARK,
  },
  cardTime: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BRAND_CORAL,
    marginLeft: 6,
    marginTop: 4,
  },
  cardBody: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginTop: 6,
  },
  appealActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  appealBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appealBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  actionTouchable: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeDeleteAction: {
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    width: 85,
    height: '100%',
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
  },
  swipeReadAction: {
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    width: 85,
    height: '100%',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  actionContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
