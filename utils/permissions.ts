/**
 * Device Media & Camera Permission Handling Utility
 * Ensures explicit permission requests before accessing camera or photo library.
 * Provides user-friendly alerts with direct device settings redirection.
 */

import { Alert, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/**
 * Ensures media library (photo gallery) read permissions.
 * Checks current status first to avoid redundant system prompts.
 * Prompts with styled Alert directing to device Settings if denied.
 */
export async function ensureMediaLibraryPermission(): Promise<boolean> {
  console.log('[Dwello-Permissions Debug]: Verifying media library permission...');
  try {
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (current.granted) {
      console.log('[Dwello-Permissions Debug]: Media library permission already granted.');
      return true;
    }

    // If permission has not been determined or can be requested
    if (current.canAskAgain) {
      console.log('[Dwello-Permissions Debug]: Requesting media library permission from user...');
      const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (requested.granted) {
        console.log('[Dwello-Permissions Debug]: Media library permission granted by user.');
        return true;
      }
    }

    // Permission denied or permanently denied
    console.warn('[Dwello-Permissions Debug]: Media library permission denied.');
    Alert.alert(
      'Photo Library Access Required',
      'Dwello needs access to your photos to upload profile avatars and property pictures. Please enable Photo Library access in your device settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            if (Platform.OS !== 'web') {
              Linking.openSettings().catch((err) =>
                console.error('[Dwello-Permissions Debug]: Failed to open settings:', err)
              );
            }
          },
        },
      ]
    );
    return false;
  } catch (error) {
    console.error('[Dwello-Permissions Debug]: Media library permission check error:', error);
    return false;
  }
}

/**
 * Ensures device camera permissions for taking photos.
 * Checks current status first to avoid redundant prompts.
 * Prompts with styled Alert directing to device Settings if denied.
 */
export async function ensureCameraPermission(): Promise<boolean> {
  console.log('[Dwello-Permissions Debug]: Verifying camera permission...');
  try {
    const current = await ImagePicker.getCameraPermissionsAsync();
    if (current.granted) {
      console.log('[Dwello-Permissions Debug]: Camera permission already granted.');
      return true;
    }

    if (current.canAskAgain) {
      console.log('[Dwello-Permissions Debug]: Requesting camera permission from user...');
      const requested = await ImagePicker.requestCameraPermissionsAsync();
      if (requested.granted) {
        console.log('[Dwello-Permissions Debug]: Camera permission granted by user.');
        return true;
      }
    }

    console.warn('[Dwello-Permissions Debug]: Camera permission denied.');
    Alert.alert(
      'Camera Access Required',
      'Dwello needs camera access to let you capture property and profile photos directly. Please enable Camera permissions in your device settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            if (Platform.OS !== 'web') {
              Linking.openSettings().catch((err) =>
                console.error('[Dwello-Permissions Debug]: Failed to open settings:', err)
              );
            }
          },
        },
      ]
    );
    return false;
  } catch (error) {
    console.error('[Dwello-Permissions Debug]: Camera permission check error:', error);
    return false;
  }
}
