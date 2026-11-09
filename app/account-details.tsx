/**
 * Profile editor for contact details and housing preferences.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DwelloColors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useDebug } from '@/context/DebugContext';
import { validateBhutanPhone } from '@/utils/validation';
import { UserRole } from '@/types/auth';

const ROLES: UserRole[] = ['Tenant', 'Student', 'Landlord'];
const GENDERS: ('Male' | 'Female' | 'Other')[] = ['Male', 'Female', 'Other'];

export default function AccountDetailsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updateProfile } = useAuth();
  const { showDebugBanner } = useDebug();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [role, setRole] = useState<UserRole>(user?.role || 'Tenant');
  const [bio, setBio] = useState(user?.bio || '');
  const [occupation, setOccupation] = useState(user?.occupation || '');
  const [preferredZone, setPreferredZone] = useState(user?.preferredZone || '');
  const [budget, setBudget] = useState(user?.budget ? user.budget.toString() : '');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>(user?.gender || 'Male');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    console.log('[Dwello-Auth Debug]: Validating and updating profile details...');

    if (!fullName.trim()) {
      showDebugBanner('error', 'Validation Error', 'Full Name cannot be empty.');
      return;
    }

    if (!validateBhutanPhone(phoneNumber)) {
      showDebugBanner(
        'error',
        'Invalid Phone',
        'Phone number must be an 8-digit Bhutanese number starting with 17 or 77.'
      );
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        role,
        bio: bio.trim(),
        occupation: occupation.trim(),
        preferredZone: preferredZone.trim(),
        budget: budget ? parseFloat(budget) || 0 : undefined,
        gender,
      });

      showDebugBanner('success', 'Profile Saved', 'Your account details have been updated.');
      router.back();
    } catch (err: any) {
      console.error('[Dwello-Error Debug]: Profile update failed:', err);
      showDebugBanner('error', 'Update Failed', err.message || 'Could not save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        {/* Full Name */}
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Enter your full name"
        />

        {/* WhatsApp Phone Number */}
        <Text style={styles.label}>WhatsApp Phone Number (Bhutan 8-digit)</Text>
        <TextInput
          style={styles.input}
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
          placeholder="17xxxxxx or 77xxxxxx"
        />

        {/* Email Address (Read-only) */}
        <Text style={styles.label}>Email Address</Text>
        <TextInput
          style={[styles.input, styles.disabledInput]}
          value={user?.email || 'No email registered'}
          editable={false}
        />

        {/* Role Selector */}
        <Text style={styles.label}>Primary Role</Text>
        <View style={styles.chipRow}>
          {ROLES.map((r) => {
            const active = role === r;
            return (
              <TouchableOpacity
                key={r}
                onPress={() => setRole(r)}
                style={[styles.chip, active && styles.activeChip]}>
                <Text style={[styles.chipText, active && styles.activeChipText]}>{r}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Occupation */}
        <Text style={styles.label}>Occupation / Study Field</Text>
        <TextInput
          style={styles.input}
          value={occupation}
          onChangeText={setOccupation}
          placeholder="e.g., IT Student at CST, Civil Engineer"
        />

        {/* Preferred Municipal Zone */}
        <Text style={styles.label}>Preferred Municipal Zone</Text>
        <TextInput
          style={styles.input}
          value={preferredZone}
          onChangeText={setPreferredZone}
          placeholder="e.g., Rinchending, Motithang, Babesa"
        />

        {/* Monthly Budget */}
        <Text style={styles.label}>Maximum Monthly Budget (Nu.)</Text>
        <TextInput
          style={styles.input}
          value={budget}
          onChangeText={setBudget}
          keyboardType="numeric"
          placeholder="e.g., 10000"
        />

        {/* Gender */}
        <Text style={styles.label}>Gender</Text>
        <View style={styles.chipRow}>
          {GENDERS.map((g) => {
            const active = gender === g;
            return (
              <TouchableOpacity
                key={g}
                onPress={() => setGender(g)}
                style={[styles.chip, active && styles.activeChip]}>
                <Text style={[styles.chipText, active && styles.activeChipText]}>{g}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Bio */}
        <Text style={styles.label}>Bio & Roommate Preferences</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={4}
          placeholder="Share a short introduction about your lifestyle, cleanliness, and study habits..."
        />

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.88}
          style={styles.saveBtn}>
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Save Account Details</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#111827',
  },
  disabledInput: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  activeChip: {
    backgroundColor: DwelloColors.primary,
    borderColor: DwelloColors.primary,
  },
  chipText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  activeChipText: {
    color: '#FFFFFF',
  },
  saveBtn: {
    backgroundColor: DwelloColors.primary,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 28,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
