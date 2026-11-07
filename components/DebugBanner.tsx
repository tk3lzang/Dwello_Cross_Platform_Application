/**
 * Sleek Apple-Style Toaster Notification Component
 * Features dark pill capsule design, haptic feedback via expo-haptics,
 * spring entrance/exit physics via react-native-reanimated,
 * and intuitive multi-directional Swipe-to-Dismiss gestures (Up, Left, Right).
 */

import React, { useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  PanResponder,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDebug } from '@/context/DebugContext';

export function DebugBanner({ insideModal = false }: { insideModal?: boolean }) {
  const { banner, dismissBanner } = useDebug();
  const insets = useSafeAreaInsets();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const translateY = useSharedValue(-120);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleDismiss = useCallback(
    (direction: 'up' | 'left' | 'right' = 'up') => {
      console.log(`[Dwello-Toast Portal]: Dismissing toast (direction: ${direction}${insideModal ? ', inside modal' : ''})`);
      clearTimer();

      let targetX = 0;
      let targetY = -120;
      if (direction === 'left') targetX = -400;
      if (direction === 'right') targetX = 400;

      translateX.value = withTiming(targetX, { duration: 180 });
      translateY.value = withTiming(targetY, { duration: 180 });
      opacity.value = withTiming(0, { duration: 160 }, () => {
        runOnJS(dismissBanner)();
      });
    },
    [clearTimer, dismissBanner, translateX, translateY, opacity, insideModal]
  );

  const handleDismissRef = useRef(handleDismiss);
  useEffect(() => {
    handleDismissRef.current = handleDismiss;
  }, [handleDismiss]);

  const [panResponder] = React.useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dx, dy } = gestureState;
        return Math.abs(dx) > 6 || dy < -6;
      },
      onPanResponderGrant: () => {
        clearTimer();
      },
      onPanResponderMove: (_, gestureState) => {
        translateX.value = gestureState.dx;
        if (gestureState.dy < 0) {
          translateY.value = gestureState.dy;
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, dy, vx, vy } = gestureState;

        // Multi-directional swipe dismiss checks: Up, Left, or Right
        if (dy < -30 || vy < -0.4) {
          handleDismissRef.current('up');
          return;
        }
        if (dx > 50 || vx > 0.4) {
          handleDismissRef.current('right');
          return;
        }
        if (dx < -50 || vx < -0.4) {
          handleDismissRef.current('left');
          return;
        }

        // Spring back smoothly if threshold wasn't reached
        translateX.value = withSpring(0, { damping: 15, stiffness: 150 });
        translateY.value = withSpring(0, { damping: 15, stiffness: 150 });

        // Resume 3-second auto-dismiss
        timerRef.current = setTimeout(() => {
          handleDismissRef.current('up');
        }, 3000);
      },
    })
  );

  useEffect(() => {
    if (banner) {
      console.log(`[Dwello-Toast Portal]: Displaying toast${insideModal ? ' inside native modal' : ' in root portal'}: "${banner.title || banner.message}" (type: ${banner.type})`);
      clearTimer();

      // Trigger subtle haptic feedback on banner appearance
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      } catch (err) {
        console.log('[Dwello-Toast Portal]: Haptics unavailable on platform:', err);
      }

      translateX.value = 0;
      translateY.value = -120;
      opacity.value = 0;

      // Spring entrance
      translateY.value = withSpring(0, {
        damping: 15,
        stiffness: 140,
        mass: 0.8,
      });
      opacity.value = withTiming(1, { duration: 180 });

      // 3-second auto-dismiss timeout
      timerRef.current = setTimeout(() => {
        handleDismiss('up');
      }, 3000);

      return () => {
        clearTimer();
      };
    }
  }, [banner, handleDismiss, clearTimer, translateX, translateY, opacity, insideModal]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
    ],
    opacity: opacity.value,
  }));

  if (!banner) return null;

  // Primary label display
  const primaryText = banner.title || banner.message;
  const secondaryText =
    banner.message && banner.message !== banner.title ? banner.message : null;

  return (
    <Animated.View
      pointerEvents="box-none"
      {...panResponder.panHandlers}
      style={[
        styles.wrapper,
        { top: insets.top + (Platform.OS === 'ios' ? 8 : 14) },
        animatedStyle,
      ]}>
      <View style={styles.darkPill} pointerEvents="auto">
        <Text style={styles.pillText} numberOfLines={1}>
          {primaryText}
        </Text>
        {secondaryText && (
          <Text style={styles.pillSubtext} numberOfLines={2}>
            {secondaryText}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99999,
    elevation: 9999,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  darkPill: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#262626',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
  pillSubtext: {
    fontSize: 12,
    color: '#D1D5DB',
    lineHeight: 16,
    marginTop: 2,
  },
});
