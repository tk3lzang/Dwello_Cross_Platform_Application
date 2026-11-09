/**
 * Dynamic User Avatar Component
 * Displays user photo if uploaded and valid; otherwise renders a clean circular badge
 * with the user's name initials (e.g., "TK", "KD") over brand coral or background.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Image, StyleProp, ViewStyle } from 'react-native';
import { DwelloColors } from '@/constants/Colors';

interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: number;
  backgroundColor?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Extracts 1-2 uppercase initials from a name string (e.g. "Tandin Kelzang" -> "TK")
 */
export function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return 'D';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  uri,
  name,
  size = 48,
  backgroundColor = '#FFE4E8',
  textColor = DwelloColors.primary,
  style,
}: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = getInitials(name);
  const fontSize = Math.round(size * 0.4);

  useEffect(() => {
    setImageFailed(false);
  }, [uri]);

  const hasValidUri = Boolean(uri && uri.trim() && !imageFailed && !uri.includes('photo-1534528741775-53994a69daeb'));

  if (hasValidUri && uri) {
    return (
      <View
        style={[
          styles.container,
          { width: size, height: size, borderRadius: size / 2 },
          style,
        ]}>
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setImageFailed(true)}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
        },
        style,
      ]}>
      <Text style={[styles.initialsText, { fontSize, color: textColor }]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  initialsText: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
