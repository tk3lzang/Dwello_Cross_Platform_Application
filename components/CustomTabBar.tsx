/**
 * Custom Bottom Tab Bar with elevated Center Coral Plus (+) Action Button
 * Matches the official Dwello mobile interface layout.
 */

import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DwelloColors } from '@/constants/Colors';

export interface CustomTabBarProps {
  state: any;
  descriptors: any;
  navigation?: any;
  [key: string]: any;
}

export function CustomTabBar({ state, descriptors, navigation }: CustomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.tabBarWrapper, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.tabBarInner}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation?.emit
              ? navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                })
              : { defaultPrevented: false };

            if (!isFocused && !event.defaultPrevented) {
              if (navigation?.navigate) {
                navigation.navigate(route.name);
              } else {
                if (route.name === 'index') {
                  router.push('/(tabs)');
                } else {
                  router.push(`/(tabs)/${route.name}` as any);
                }
              }
            }
          };

          // Render Elevated Coral Plus (+) Button for center route ('post')
          if (route.name === 'post') {
            return (
              <View key={route.key} style={styles.centerButtonContainer}>
                <TouchableOpacity
                  onPress={onPress}
                  activeOpacity={0.85}
                  style={styles.floatingCenterBtn}>
                  <Ionicons name="add" size={32} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            );
          }

          let iconName: keyof typeof Ionicons.glyphMap = 'search';
          let label = 'Explore';

          if (route.name === 'index') {
            iconName = isFocused ? 'search' : 'search-outline';
            label = 'Explore';
          } else if (route.name === 'roommates') {
            iconName = isFocused ? 'people' : 'people-outline';
            label = 'Roommates';
          } else if (route.name === 'saved') {
            iconName = isFocused ? 'heart' : 'heart-outline';
            label = 'Saved';
          } else if (route.name === 'profile') {
            iconName = isFocused ? 'person' : 'person-outline';
            label = 'Profile';
          }

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              style={styles.tabItem}>
              <Ionicons
                name={iconName}
                size={22}
                color={isFocused ? DwelloColors.primary : '#9CA3AF'}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: isFocused ? DwelloColors.primary : '#9CA3AF' },
                ]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    backgroundColor: '#FFF5F6',
    borderTopWidth: 1,
    borderTopColor: '#FFE4E8',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tabBarInner: {
    flexDirection: 'row',
    height: 56,
    alignItems: 'center',
    justifyContent: 'space-around',
    position: 'relative',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
  },
  centerButtonContainer: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingCenterBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: DwelloColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    top: -16,
    shadowColor: DwelloColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
});
