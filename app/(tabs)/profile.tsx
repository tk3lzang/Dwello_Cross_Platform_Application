/**
 * User profile, account preferences, and app settings.
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { DwelloColors } from '@/constants/Colors';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/context/AuthContext';
import { useDebug } from '@/context/DebugContext';
import { StorageService } from '@/services/storage';
import { ensureMediaLibraryPermission, ensureCameraPermission } from '@/utils/permissions';
import { NotificationBell } from '@/components/NotificationCenter';
import { ModerationService } from '@/services/moderationService';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ openNotifications?: string }>();
  const { user, logout, updateProfile } = useAuth();
  const { showDebugBanner } = useDebug();

  const [notificationsEnabled, setNotificationsEnabled] = useState(
    user?.notificationsEnabled ?? true
  );
  const [language, setLanguage] = useState<'English' | 'Dzongkha'>('English');
  const [isModerator, setIsModerator] = useState(false);
  const [isAvatarUpdating, setIsAvatarUpdating] = useState(false);

  useEffect(() => {
    let active = true;
    setIsModerator(false);
    if (user?.id) {
      ModerationService.isCurrentUserModerator()
        .then((authorized) => {
          if (active) setIsModerator(authorized);
        })
        .catch((error) => {
          console.warn('[Dwello-Moderation Warning]: Could not verify moderator access:', error);
        });
    }
    return () => {
      active = false;
    };
  }, [user?.id]);

  const saveAvatar = async (uri: string) => {
    if (isAvatarUpdating) return;
    setIsAvatarUpdating(true);
    try {
      await updateProfile({ avatarUrl: uri });
      showDebugBanner('success', 'Profile Photo Updated', 'Your profile picture has been updated.');
    } catch (err: any) {
      showDebugBanner('error', 'Avatar Update Failed', err.message || 'Could not save your profile photo.');
    } finally {
      setIsAvatarUpdating(false);
    }
  };

  const handleAvatarPicker = () => {
    if (isAvatarUpdating) return;
    console.log('[Dwello-Auth Debug]: Initiating profile avatar picker...');
    Alert.alert('Update Profile Photo', 'Choose how you want to update your profile photo:', [
      {
        text: 'Choose from Library',
        onPress: async () => {
          const hasPermission = await ensureMediaLibraryPermission();
          if (!hasPermission) return;
          try {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
              const newUri = result.assets[0].uri;
              console.log('[Dwello-Auth Debug]: Saving selected profile photo.');
              await saveAvatar(newUri);
            }
          } catch (err: any) {
            console.error('[Dwello-Error Debug]: Avatar pick error:', err);
            showDebugBanner('error', 'Avatar Error', err.message || 'Could not select photo.');
          }
        },
      },
      {
        text: 'Take Photo',
        onPress: async () => {
          const hasPermission = await ensureCameraPermission();
          if (!hasPermission) return;
          try {
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
              const newUri = result.assets[0].uri;
              console.log('[Dwello-Auth Debug]: Saving captured profile photo.');
              await saveAvatar(newUri);
            }
          } catch (err: any) {
            console.error('[Dwello-Error Debug]: Camera capture error:', err);
            showDebugBanner('error', 'Camera Error', err.message || 'Could not capture photo.');
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleToggleNotifications = async (val: boolean) => {
    setNotificationsEnabled(val);
    await StorageService.setNotificationsEnabled(val);
    if (val) {
      showDebugBanner(
        'info',
        'Notifications Active',
        'You will receive notifications for new flatmate requests and property alerts.'
      );
    }
  };

  const handleLanguageToggle = () => {
    const nextLang = language === 'English' ? 'Dzongkha' : 'English';
    setLanguage(nextLang);
    showDebugBanner(
      'info',
      'Language Updated',
      `App language set to ${nextLang} (${nextLang === 'Dzongkha' ? 'རྫོང་ཁ' : 'English'}).`
    );
  };

  const handleLogoutPress = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of Dwello?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.push('/auth/login');
        },
      },
    ]);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <NotificationBell openToken={params.openNotifications} />
      </View>

      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Profile summary. */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Avatar uri={user?.avatarUrl} name={user?.fullName || 'Dwello User'} size={88} />
            <TouchableOpacity
              onPress={handleAvatarPicker}
              disabled={isAvatarUpdating}
              activeOpacity={0.8}
              style={styles.cameraBadge}>
              {isAvatarUpdating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.nameRow}>
            <Text style={styles.userName}>{user?.fullName || 'Add your name'}</Text>
            <TouchableOpacity
              onPress={() => router.push('/account-details')}
              style={styles.editPencil}>
              <Ionicons name="pencil" size={14} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <Text style={styles.userEmail}>{user?.email || 'No email registered'}</Text>

          <View style={styles.whatsappRow}>
            <Ionicons name="logo-whatsapp" size={14} color={DwelloColors.whatsappGreen} />
            <Text style={styles.whatsappNumber}>
              {user?.phoneNumber || 'Add WhatsApp number'}
            </Text>
          </View>

          {/* User Bio / Placeholder for Clean Slate */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/account-details')}
            style={styles.bioContainer}>
            <Text
              style={[
                styles.bioText,
                !user?.bio && styles.placeholderBioText,
              ]}>
              {user?.bio && user.bio.trim().length > 0
                ? user.bio
                : 'Add a bio & lifestyle preferences'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.memberSince}>
            {user?.createdAt
              ? `Member since ${new Date(user.createdAt).getFullYear()}`
              : 'New Member'}
          </Text>
        </View>

        {/* Settings Title */}
        <Text style={styles.settingsHeader}>Settings</Text>

        <View style={styles.settingsMenu}>
          {/* Account Details & WhatsApp */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => router.push('/account-details')}>
            <View style={styles.menuLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="id-card-outline" size={18} color="#111827" />
              </View>
              <Text style={styles.menuLabel}>Account Details & WhatsApp</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Advertiser listing management. */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => router.push('/my-listings')}>
            <View style={styles.menuLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="home-outline" size={18} color="#111827" />
              </View>
              <Text style={styles.menuLabel}>My Listings</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Rent & Expense Splitter Tool */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => router.push('/splitter')}>
            <View style={styles.menuLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="calculator-outline" size={18} color="#111827" />
              </View>
              <Text style={styles.menuLabel}>Rent & Expense Splitter</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Language Selection */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={handleLanguageToggle}>
            <View style={styles.menuLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="globe-outline" size={18} color="#111827" />
              </View>
              <Text style={styles.menuLabel}>Language</Text>
            </View>
            <View style={styles.menuRightValue}>
              <Text style={styles.valueText}>{language}</Text>
            </View>
          </TouchableOpacity>

          {/* Notifications Toggle */}
          <View style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="notifications-outline" size={18} color="#111827" />
              </View>
              <Text style={styles.menuLabel}>Notifications</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: '#D1D5DB', true: DwelloColors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Privacy & Security */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => {
              Alert.alert(
                'Privacy & Security',
                'Dwello adheres to Royal University of Bhutan student data privacy standards. All passwords and contact details are encrypted.'
              );
            }}>
            <View style={styles.menuLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#111827" />
              </View>
              <Text style={styles.menuLabel}>Privacy & Security</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Support contact options. */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => router.push('/help-support')}>
            <View style={styles.menuLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="help-circle-outline" size={18} color="#111827" />
              </View>
              <Text style={styles.menuLabel}>Help & Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          {isModerator && (
            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: '#FFFBEB' }]}
              activeOpacity={0.7}
              onPress={() => router.push('/admin-moderation')}>
              <View style={styles.menuLeft}>
                <View style={[styles.iconCircle, { backgroundColor: '#FDE68A' }]}>
                  <Ionicons name="shield-checkmark" size={18} color="#B45309" />
                </View>
                <Text style={[styles.menuLabel, { color: '#B45309', fontWeight: '700' }]}>
                  Moderation Panel
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#B45309" />
            </TouchableOpacity>
          )}
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          onPress={handleLogoutPress}
          activeOpacity={0.85}
          style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={18} color="#EF4444" style={{ marginRight: 6 }} />
          <Text style={styles.logoutText}>Sign Out</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  scrollBody: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 5,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E5E7EB',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#111827',
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  editPencil: {
    padding: 2,
  },
  userEmail: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  whatsappRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
    marginBottom: 10,
  },
  whatsappNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  bioContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  bioText: {
    fontSize: 13,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 18,
  },
  placeholderBioText: {
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  memberSince: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  settingsHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginTop: 24,
    marginBottom: 12,
    marginLeft: 4,
  },
  settingsMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  menuRightValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
});
