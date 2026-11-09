/**
 * Login and password-recovery screen.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DwelloColors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useDebug } from '@/context/DebugContext';
import { normalizeBackendError } from '@/utils/backendError';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login, requestPasswordReset } = useAuth();
  const { showDebugBanner } = useDebug();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Forgot Password Dialog Modal
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleLogin = async () => {
    console.log('[Dwello-Auth Debug]: Form submit: Log In.');
    setIsLoading(true);
    setAuthError(null);
    try {
      await login(email, password);
      router.replace('/(tabs)');
    } catch (err) {
      setAuthError(normalizeBackendError(err).userFacingMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendResetLink = async () => {
    const targetEmail = (resetEmail || email).trim();
    console.log('[Dwello-Auth Debug]: Triggering password reset email.');

    if (!targetEmail) {
      showDebugBanner('error', 'Email Required', 'Please enter your registered email address.');
      return;
    }

    setIsSendingReset(true);
    try {
      const ok = await requestPasswordReset(targetEmail);
      if (ok) {
        setIsForgotModalOpen(false);
        showDebugBanner(
          'success',
          'Password Reset',
          'Password reset instructions sent to your email.'
        );
      }
    } catch (err: any) {
      showDebugBanner(
        'error',
        'Reset Failed',
        normalizeBackendError(err).userFacingMessage
      );
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Back Button if coming from Welcome */}
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace('/auth/welcome')}
          style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>

        {/* Header Title */}
        <Text style={styles.title}>Log In</Text>
        <Text style={styles.subtitle}>Welcome back to Dwello.</Text>

        {authError && (
          <View style={styles.authErrorBox} accessibilityRole="alert">
            <Text style={styles.authErrorText}>{authError}</Text>
          </View>
        )}

        {/* Email Field */}
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setAuthError(null);
            }}
          />
        </View>

        {/* Password Field with Eye Toggle */}
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            placeholderTextColor="#9CA3AF"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setAuthError(null);
            }}
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

        {/* Forgot Password Link directly below password field */}
        <TouchableOpacity
          onPress={() => {
            setResetEmail(email);
            setIsForgotModalOpen(true);
          }}
          style={styles.forgotBtn}>
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </TouchableOpacity>

        {/* Main Log In Button */}
        <TouchableOpacity
          onPress={handleLogin}
          disabled={isLoading}
          activeOpacity={0.88}
          style={styles.loginBtn}>
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.loginBtnText}>Log In</Text>
          )}
        </TouchableOpacity>

        {/* New here? Create an account link */}
        <TouchableOpacity
          onPress={() => router.push('/auth/signup')}
          style={styles.signupLinkBtn}>
          <Text style={styles.signupPrompt}>
            New here? <Text style={styles.signupBold}>Create an account</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Password recovery dialog. */}
      <Modal
        visible={isForgotModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsForgotModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <Text style={styles.modalDesc}>
              Enter your registered email address to receive a secure recovery link.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="name@rub.edu.bt"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              value={resetEmail}
              onChangeText={setResetEmail}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => setIsForgotModalOpen(false)}
                style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSendResetLink}
                disabled={isSendingReset}
                style={styles.sendResetBtn}>
                {isSendingReset ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.sendResetBtnText}>Send Reset Link</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  backBtn: {
    position: 'absolute',
    top: 20,
    left: 24,
    padding: 8,
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
  },
  inputWrapper: {
    marginBottom: 16,
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
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: 12,
    marginBottom: 28,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    color: DwelloColors.primary,
  },
  loginBtn: {
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
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  signupLinkBtn: {
    alignSelf: 'center',
    marginTop: 24,
  },
  signupPrompt: {
    fontSize: 14,
    color: DwelloColors.primary,
    fontWeight: '600',
  },
  signupBold: {
    color: DwelloColors.primary,
    fontWeight: '700',
  },
  authErrorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  authErrorText: {
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    width: '100%',
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  modalDesc: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  sendResetBtn: {
    flex: 1,
    backgroundColor: DwelloColors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  sendResetBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
