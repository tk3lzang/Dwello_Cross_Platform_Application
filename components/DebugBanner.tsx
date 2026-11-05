/**
 * Modern In-App Toast & Feedback Banner Component
 * Matches the cohesive iOS / Material 3 design system of Dwello.
 * Displays as a floating, sleek dark pill/capsule below the status bar with auto-dismiss
 * and intuitive multi-directional Swipe-to-Dismiss gesture support (Swipe Up, Left, or Right).
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  PanResponder,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDebug } from '@/context/DebugContext';
import { Ionicons } from '@expo/vector-icons';

let bannerTimerId: ReturnType<typeof setTimeout> | null = null;
let isBannerDismissing = false;

export function DebugBanner() {
  const { banner, dismissBanner } = useDebug();
  const insets = useSafeAreaInsets();

  // Animated values for entrance, exit, and pan gestures
  const [translateY] = useState(() => new Animated.Value(-120));
  const [translateX] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(0));

  const handleDismiss = useCallback(
    (direction: 'up' | 'left' | 'right' | 'fade' = 'up') => {
      if (isBannerDismissing) return;
      isBannerDismissing = true;

      if (bannerTimerId) {
        clearTimeout(bannerTimerId);
        bannerTimerId = null;
      }

      let toY = -120;
      let toX = 0;

      if (direction === 'left') {
        toX = -400;
        toY = 0;
      } else if (direction === 'right') {
        toX = 400;
        toY = 0;
      }

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: toY,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: toX,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start(() => {
        dismissBanner();
        translateY.setValue(-120);
        translateX.setValue(0);
        opacity.setValue(0);
        isBannerDismissing = false;
      });
    },
    [translateY, translateX, opacity, dismissBanner]
  );

  // PanResponder to handle tactile Swipe-to-Dismiss gestures (Up, Left, Right)
  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dx, dy } = gestureState;
        return Math.abs(dx) > 6 || dy < -6;
      },
      onPanResponderGrant: () => {
        if (bannerTimerId) {
          clearTimeout(bannerTimerId);
          bannerTimerId = null;
        }
      },
      onPanResponderMove: (_, gestureState) => {
        const { dx, dy } = gestureState;
        translateX.setValue(dx);
        if (dy < 0) {
          translateY.setValue(dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, dy, vx, vy } = gestureState;

        // Swiped UP
        if (dy < -35 || vy < -0.5) {
          handleDismiss('up');
          return;
        }

        // Swiped RIGHT
        if (dx > 65 || vx > 0.5) {
          handleDismiss('right');
          return;
        }

        // Swiped LEFT
        if (dx < -65 || vx < -0.5) {
          handleDismiss('left');
          return;
        }

        // Reset if threshold wasn't met
        Animated.parallel([
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }),
        ]).start();

        // Resume auto-dismiss timeout
        bannerTimerId = setTimeout(() => {
          handleDismiss('up');
        }, 3000);
      },
    })
  );

  useEffect(() => {
    if (banner) {
      isBannerDismissing = false;
      translateX.setValue(0);

      // Slide down and fade in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 5,
          speed: 12,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after 3.2 seconds
      bannerTimerId = setTimeout(() => {
        handleDismiss('up');
      }, 3200);

      return () => {
        if (bannerTimerId) {
          clearTimeout(bannerTimerId);
          bannerTimerId = null;
        }
      };
    }
  }, [banner, translateY, translateX, opacity, handleDismiss]);

  if (!banner) return null;

  const getIconConfig = () => {
    switch (banner.type) {
      case 'error':
        return {
          icon: 'alert-circle' as const,
          color: '#EF4444',
          badgeBg: '#451A1A',
        };
      case 'warning':
        return {
          icon: 'warning' as const,
          color: '#F59E0B',
          badgeBg: '#452A10',
        };
      case 'info':
        return {
          icon: 'information-circle' as const,
          color: '#3B82F6',
          badgeBg: '#172554',
        };
      case 'success':
      default:
        return {
          icon: 'checkmark-circle' as const,
          color: '#10B981',
          badgeBg: '#064E3B',
        };
    }
  };

  const iconConfig = getIconConfig();

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.wrapper,
        {
          top: insets.top + (Platform.OS === 'ios' ? 6 : 12),
          transform: [{ translateY }, { translateX }],
          opacity,
        },
      ]}>
      <View style={styles.floatingCard}>
        {/* Accent Status Icon */}
        <View style={[styles.iconContainer, { backgroundColor: iconConfig.badgeBg }]}>
          <Ionicons name={iconConfig.icon} size={18} color={iconConfig.color} />
        </View>

        {/* Text Content */}
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {banner.title}
          </Text>
          <Text style={styles.message} numberOfLines={2}>
            {banner.message}
          </Text>
        </View>

        {/* Swipe / Dismiss Cue */}
        <TouchableOpacity
          onPress={() => handleDismiss('up')}
          style={styles.closeBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close" size={16} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 999999,
    alignItems: 'center',
  },
  floatingCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#1E293B',
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#334155',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.32,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  message: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 16,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    marginLeft: 8,
  },
});
