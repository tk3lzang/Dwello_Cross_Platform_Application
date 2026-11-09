/**
 * Welcome screen with sign-up and login entry points.
 */

import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { DwelloColors } from '@/constants/Colors';
import { DwelloLogo } from '@/components/DwelloLogo';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Center Branding Section */}
      <View style={styles.centerContainer}>
        <DwelloLogo size={96} houseColor={DwelloColors.primary} pinColor="#FFFFFF" innerDotColor={DwelloColors.primary} />
        
        <Text style={styles.brandTitle}>Dwello.</Text>
        
        <Text style={styles.tagline}>
          Find your next flat or flatmate in Thimphu, Phuentsholing and Paro — without the group-chat chaos.
        </Text>
      </View>

      {/* Bottom Action Sheet Card - Extends cleanly to bottom screen edge */}
      <View style={[styles.bottomCard, { paddingBottom: Math.max(insets.bottom + 14, 28) }]}>
        {/* Municipal Zone Badge */}
        <View style={styles.zoneChip}>
          <Text style={styles.zoneChipText}>
            📍 Thimphu • Phuentsholing • Paro
          </Text>
        </View>

        {/* Primary: Create Account */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => router.push('/auth/signup')}
          style={styles.createAccountBtn}>
          <Text style={styles.createAccountBtnText}>Create Account</Text>
        </TouchableOpacity>

        {/* Secondary: Log In */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => router.push('/auth/login')}
          style={styles.loginBtn}>
          <Text style={styles.loginBtnText}>Log In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#111827',
    marginTop: 20,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 12,
    maxWidth: 320,
  },
  bottomCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  zoneChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'center',
    marginBottom: 20,
  },
  zoneChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },
  createAccountBtn: {
    backgroundColor: DwelloColors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: DwelloColors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  createAccountBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  loginBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  loginBtnText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
});
