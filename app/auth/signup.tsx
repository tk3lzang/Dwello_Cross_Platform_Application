/**
 * Account Sign Up Screen
 * Section 1 of Dwello App Manual & UI Snapshot Fidelity.
 * Full Name, WhatsApp Phone Number (with Bhutan regex validation),
 * Email, and Password with visibility toggle.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DwelloColors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useDebug } from '@/context/DebugContext';
import { validateBhutanPhone } from '@/utils/validation';

export default function SignUpScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp } = useAuth();
  const { showDebugBanner } = useDebug();

  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async () => {
    console.log('[Dwello-Auth Debug]: Form submit: Sign Up with:', { fullName, phoneNumber, email });

    if (!fullName.trim()) {
      showDebugBanner('error', 'Validation Error', 'Please enter your full name.');
      return;
    }

    if (!validateBhutanPhone(phoneNumber)) {
      showDebugBanner(
        'error',
        'Invalid Phone Number',
        'Phone number must be an 8-digit Bhutanese number starting with 17 or 77.'
      );
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      showDebugBanner('error', 'Validation Error', 'Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      showDebugBanner('error', 'Validation Error', 'Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    try {
      await signUp(fullName.trim(), phoneNumber.trim(), email.trim(), password, 'Tenant');
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('[Dwello-Error Catch]: Sign up form error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace('/auth/welcome')}
          style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>

        {/* Title & Subtitle */}
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>
          Join Dwello to post listings, save favorites, and connect with real landlords and roommates.
        </Text>

        {/* Full Name Input */}
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor="#9CA3AF"
            value={fullName}
            onChangeText={setFullName}
          />
        </View>

        {/* WhatsApp Phone Number Input */}
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="WhatsApp Phone Number"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
          />
          <Text style={styles.subLabel}>
            Use an 8-digit Bhutanese number (starts with 17 or 77).
          </Text>
        </View>

        {/* Email Input */}
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        {/* Password Input with eye toggle */}
        <View style={[styles.passwordContainer, { marginBottom: 28 }]}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            placeholderTextColor="#9CA3AF"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeBtn}>
            <Ionicons
              name={showPassword ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color="#6B7280"
            />
          </TouchableOpacity>
        </View>

        {/* Create Account Primary Button */}
        <TouchableOpacity
          onPress={handleSignUp}
          disabled={isLoading}
          activeOpacity={0.88}
          style={styles.signUpBtn}>
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.signUpBtnText}>Create Account</Text>
          )}
        </TouchableOpacity>

        {/* Already have an account? Log in */}
        <TouchableOpacity
          onPress={() => router.push('/auth/login')}
          style={styles.loginLinkBtn}>
          <Text style={styles.loginPrompt}>
            Already have an account? <Text style={styles.loginBold}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 40,
  },
  backBtn: {
    marginBottom: 24,
    alignSelf: 'flex-start',
    padding: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 6,
    marginBottom: 32,
    lineHeight: 20,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  subLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
  },
  eyeBtn: {
    paddingHorizontal: 14,
  },
  signUpBtn: {
    backgroundColor: DwelloColors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
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
  signUpBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  loginLinkBtn: {
    alignSelf: 'center',
    marginTop: 24,
  },
  loginPrompt: {
    fontSize: 14,
    color: DwelloColors.primary,
    fontWeight: '600',
  },
  loginBold: {
    color: DwelloColors.primary,
    fontWeight: '700',
  },
});
