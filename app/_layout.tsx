/**
 * Root Application Layout
 * Provides global state contexts (Debug, Auth, Wishlist, Listings),
 * SafeAreaProvider, professional animated startup splash screen,
 * deep link store routing handlers, and smart auth navigation gating.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { StyleSheet, Text, Animated } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DebugProvider } from '@/context/DebugContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { ListingsProvider } from '@/context/ListingsContext';
import { DebugBanner } from '@/components/DebugBanner';
import { DatabaseService } from '@/services/database';
import { DwelloLogo } from '@/components/DwelloLogo';
import { DwelloColors } from '@/constants/Colors';

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

export default function RootLayout() {
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashOpacity] = useState(() => new Animated.Value(1));

  const handleAppReady = useCallback(() => {
    // Smooth fade out of animated startup splash
    Animated.timing(splashOpacity, {
      toValue: 0,
      duration: 420,
      useNativeDriver: true,
    }).start(() => {
      setSplashVisible(false);
    });
  }, [splashOpacity]);

  useEffect(() => {
    async function prepareApp() {
      console.log('[Dwello-DB Debug]: Bootstrapping Dwello Mobile Application...');
      try {
        await DatabaseService.initialize();
      } catch (e) {
        console.error('[Dwello-Error Catch]: Error during app bootstrap initialization:', e);
      } finally {
        await SplashScreen.hideAsync();
      }
    }

    prepareApp();
  }, []);

  return (
    <SafeAreaProvider>
      <DebugProvider>
        <AuthProvider>
          <WishlistProvider>
            <ListingsProvider>
              <StatusBar style="dark" />
              <DebugBanner />
              <AuthNavigationWatcher onReady={handleAppReady} />
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
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
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
              </Stack>

              {/* Startup Animated Splash Overlay with Dwello house & coral pin logo */}
              {splashVisible && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.animatedSplashOverlay,
                    { opacity: splashOpacity },
                  ]}>
                  <DwelloLogo
                    size={110}
                    houseColor={DwelloColors.primary}
                    pinColor="#FFFFFF"
                    innerDotColor={DwelloColors.primary}
                  />
                  <Text style={styles.splashTitle}>Dwello.</Text>
                  <Text style={styles.splashSubtitle}>Find your home in Bhutan</Text>
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
  splashTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: '#111827',
    marginTop: 18,
    letterSpacing: -0.5,
  },
  splashSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 6,
    fontWeight: '500',
  },
});
