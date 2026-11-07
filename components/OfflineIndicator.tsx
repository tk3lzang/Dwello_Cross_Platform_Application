/**
 * OfflineIndicator Component
 * Displays a subtle banner when network connectivity is unavailable.
 * Uses NetInfo via OfflineSyncService subscription to track state.
 * [Dwello-OfflineSync Debug] namespaced.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OfflineSyncService } from '@/services/offlineSync';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-60);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Subscribe to offline sync service state changes
    const unsubscribe = OfflineSyncService.subscribe((pending, online) => {
      console.log(`[Dwello-OfflineSync Debug]: OfflineIndicator state update — online: ${online}, pending: ${pending}`);
      setIsOffline(!online);
      setPendingCount(pending);
    });

    // Check initial state
    const initialOnline = OfflineSyncService.getIsOnline();
    setIsOffline(!initialOnline);

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isOffline) {
      translateY.value = withSpring(0, { damping: 14, stiffness: 120 });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withTiming(-60, { duration: 180 });
      opacity.value = withTiming(0, { duration: 160 });
    }
  }, [isOffline, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!isOffline) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrapper,
        { top: insets.top + (Platform.OS === 'ios' ? 54 : 60) },
        animatedStyle,
      ]}>
      <View style={styles.banner}>
        <Ionicons name="cloud-offline-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
        <Text style={styles.bannerText}>
          {pendingCount > 0
            ? `Offline — ${pendingCount} action${pendingCount !== 1 ? 's' : ''} pending sync`
            : 'You are offline — browsing cached listings'}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9998,
    alignItems: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    width: '100%',
    maxWidth: 420,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
      android: { elevation: 5 },
    }),
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
});
