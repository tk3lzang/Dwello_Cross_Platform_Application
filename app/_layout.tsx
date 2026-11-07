/**
 * Root Application Layout
 * Provides global state contexts (Debug, Auth, Wishlist, Listings),
 * SafeAreaProvider, professional animated startup splash screen,
 * deep link store routing handlers, and smart auth navigation gating.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { StyleSheet, View, Animated, Easing } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DebugProvider, useDebug } from '@/context/DebugContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { ListingsProvider } from '@/context/ListingsContext';
import { DebugBanner } from '@/components/DebugBanner';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { DatabaseService } from '@/services/database';
import { OfflineSyncService } from '@/services/offlineSync';
import { DwelloLogo } from '@/components/DwelloLogo';

SplashScreen.preventAutoHideAsync();

/**
 * Controller to guard routes based on authentication status and handle incoming deep links.
 */
function AuthNavigationWatcher({ onReady }: { onReady: () => void }) {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const hasTriggeredReady = useRef(false);

  // 1. Deep Link Handler (dwello://listing/[id] and https://dwello.app/listing/[id])
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      console.log('[Dwello-DeepLink Debug]: Incoming deep link received:', event.url);
      try {
        const parsed = Linking.parse(event.url);
        let targetId = '';

        if (parsed.path) {
          const match = parsed.path.match(/listing\/([a-zA-Z0-9_\-]+)/);
          if (match && match[1]) {
            targetId = match[1];
          }
        }
        if (!targetId && parsed.hostname === 'listing' && parsed.path) {
          targetId = parsed.path.replace(/^\//, '').split('/')[0];
        }
        if (!targetId && parsed.queryParams && parsed.queryParams.id) {
          targetId = String(parsed.queryParams.id);
        }

        if (targetId) {
          console.log('[Dwello-DeepLink Debug]: Routing directly to target listing ID:', targetId);
          router.push({
            pathname: '/listing/[id]',
            params: { id: targetId },
          });
        }
      } catch (err) {
        console.error('[Dwello-Error Catch]: Deep link parse failure:', err);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, [router]);

  // 2. Auth Session Navigation Guard
  useEffect(() => {
    if (isLoading) return;

    if (!hasTriggeredReady.current) {
      hasTriggeredReady.current = true;
      onReady();
    }

    const inAuthGroup = segments[0] === 'auth';

    if (!user && !inAuthGroup) {
      console.log('[Dwello-Auth Debug]: Unauthenticated user detected, routing to Welcome Screen');
      router.replace('/auth/welcome');
    } else if (user && inAuthGroup) {
      console.log('[Dwello-Auth Debug]: Authenticated user detected, routing to Explore Marketplace');
      router.replace('/(tabs)');
    }
  }, [user, isLoading, segments, router, onReady]);

  return null;
}

/**
 * Global Root Toast Portal
 * Renders toast notifications in the foreground above all screens, cards, and bottom sheets.
 * Styled with zIndex: 99999, elevation: 9999, pointerEvents: 'box-none'.
 * [Dwello-Toast Portal]
 */
function ToastPortal() {
  const { banner } = useDebug();

  useEffect(() => {
    if (banner) {
      console.log(`[Dwello-Toast Portal]: Toast mounted at root portal level (${banner.type.toUpperCase()}): "${banner.title || banner.message}"`);
    }
  }, [banner]);

  return (
    <View pointerEvents="box-none" style={styles.toastPortalHost}>
      <DebugBanner />
    </View>
  );
}

export default function RootLayout() {
  const [splashVisible, setSplashVisible] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;

  // Premium Apple-inspired coordinated entrance animation values
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.92)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkTranslateY = useRef(new Animated.Value(14)).current;

  // Synchronization refs for multi-stage splash lifecycle
  const appMountedAt = useRef<number>(0);
  const isAppPrepared = useRef(false);
  const isAuthChecked = useRef(false);
  const splashHiddenRef = useRef(false);

  // Coordinated entrance animation sequence
  useEffect(() => {
    if (appMountedAt.current === 0) {
      appMountedAt.current = Date.now();
    }

    // 1. Logo entrance: Fade in from 0 opacity & scale from 0.92 to 1.0 (Duration: 1000ms, smooth cubic ease)
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Wordmark entrance: Begins ~450ms after logo animation starts, fades in & floats upwards (Duration: 700ms)
    const wordmarkTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(wordmarkOpacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(wordmarkTranslateY, {
          toValue: 0,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, 450);

    return () => clearTimeout(wordmarkTimer);
  }, [logoOpacity, logoScale, wordmarkOpacity, wordmarkTranslateY]);

  const attemptSplashDismissal = useCallback(async () => {
    if (!isAppPrepared.current || !isAuthChecked.current) {
      return;
    }

    const elapsed = appMountedAt.current > 0 ? Date.now() - appMountedAt.current : 1800;
    const remaining = Math.max(0, 1800 - elapsed);
    if (remaining > 0) {
      console.log(`[Dwello-Splash Fix]: Holding splash for remaining ${remaining}ms to satisfy 1800ms threshold`);
      await new Promise<void>((resolve) => setTimeout(resolve, remaining));
    }

    if (!splashHiddenRef.current) {
      splashHiddenRef.current = true;
      console.log('[Dwello-Splash Fix]: All bootstrap & auth checks complete + 1800ms elapsed. Hiding native splash.');
      await SplashScreen.hideAsync().catch((err) =>
        console.warn('[Dwello-Splash Fix]: hideAsync warning:', err)
      );
    }

    // Smooth transition exit when app initialization & auth check are completed
    console.log('[Dwello-Splash Fix]: App ready — beginning animated splash fade-out');
    Animated.timing(splashOpacity, {
      toValue: 0,
      duration: 400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setSplashVisible(false);
    });
  }, [appMountedAt, splashOpacity]);

  const handleAuthReady = useCallback(() => {
    console.log('[Dwello-Splash Fix]: Supabase auth session check completed.');
    isAuthChecked.current = true;
    attemptSplashDismissal();
  }, [attemptSplashDismissal]);

  useEffect(() => {
    let safetyTimer: ReturnType<typeof setTimeout>;

    async function prepareApp() {
      console.log('[Dwello-Splash Fix]: Bootstrapping Dwello Mobile Application...');
      try {
        OfflineSyncService.init();
        await DatabaseService.initialize();
      } catch (e) {
        console.error('[Dwello-Error Catch]: Error during app bootstrap initialization:', e);
      } finally {
        isAppPrepared.current = true;
        attemptSplashDismissal();
      }

      // Safeguard: Ensure animated splash exits even if remote network auth hangs indefinitely
      safetyTimer = setTimeout(() => {
        console.log('[Dwello-Splash Fix]: Safety timer triggered (5500ms) — forcing splash exit');
        isAppPrepared.current = true;
        isAuthChecked.current = true;
        attemptSplashDismissal();
      }, 5500);
    }

    prepareApp();

    return () => {
      if (safetyTimer) clearTimeout(safetyTimer);
    };
  }, [attemptSplashDismissal]);

  return (
    <SafeAreaProvider>
      <DebugProvider>
        <AuthProvider>
          <WishlistProvider>
            <ListingsProvider>
              <StatusBar style="dark" />
              <AuthNavigationWatcher onReady={handleAuthReady} />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: '#FFFFFF' },
                }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="auth/welcome"
                  options={{
                    headerShown: false,
                    gestureEnabled: false,
                  }}
                />
                <Stack.Screen
                  name="auth/login"
                  options={{
                    headerShown: false,
                    gestureEnabled: false,
                  }}
                />
                <Stack.Screen
                  name="auth/signup"
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="listing/[id]"
                  options={{
                    headerShown: false,
                    presentation: 'card',
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="my-listings"
                  options={{
                    headerShown: false,
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="account-details"
                  options={{
                    headerShown: false,
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="splitter"
                  options={{
                    headerShown: false,
                    presentation: 'modal',
                  }}
                />
                <Stack.Screen
                  name="help-support"
                  options={{
                    headerShown: false,
                    presentation: 'modal',
                  }}
                />
                <Stack.Screen
                  name="modal"
                  options={{
                    headerShown: false,
                    presentation: 'modal',
                  }}
                />
                <Stack.Screen
                  name="public-profile/[userId]"
                  options={{
                    headerShown: false,
                    presentation: 'card',
                    animation: 'slide_from_right',
                  }}
                />
              </Stack>

              {/* Global Toast Portal — rendered above React Navigation stack and active UI */}
              <ToastPortal />

              {/* Offline Indicator — positioned in normal view hierarchy below modals */}
              <View pointerEvents="box-none" style={styles.offlinePortal}>
                <OfflineIndicator />
              </View>

              {/* Startup Animated Splash Overlay with Dwello house & coral pin logo (Module 3) */}
              {splashVisible && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.animatedSplashOverlay,
                    { opacity: splashOpacity },
                  ]}>
                  <View style={styles.splashContent}>
                    <Animated.View
                      style={{
                        opacity: logoOpacity,
                        transform: [{ scale: logoScale }],
                      }}>
                      <DwelloLogo
                        size={96}
                        houseColor="#FF3158"
                        pinColor="#FFFFFF"
                        innerDotColor="#FF3158"
                      />
                    </Animated.View>

                    <Animated.Text
                      style={[
                        styles.splashWordmark,
                        {
                          opacity: wordmarkOpacity,
                          transform: [{ translateY: wordmarkTranslateY }],
                        },
                      ]}>
                      DWELLO
                    </Animated.Text>
                  </View>
                </Animated.View>
              )}
            </ListingsProvider>
          </WishlistProvider>
        </AuthProvider>
      </DebugProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  offlinePortal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999,
    pointerEvents: 'box-none',
  },
  toastPortalHost: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 99999,
    elevation: 9999,
    pointerEvents: 'box-none',
  },
  animatedSplashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999999,
  },
  splashContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashWordmark: {
    fontSize: 28,
    fontWeight: '600',
    color: '#202124',
    letterSpacing: 4.5,
    marginTop: 24,
  },
});
