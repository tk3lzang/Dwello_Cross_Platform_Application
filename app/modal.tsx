/**
 * Dwello Info & About Modal
 */

import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DwelloColors } from '@/constants/Colors';

export default function InfoModal() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>About Dwello</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.badgeRow}>
          <Text style={styles.badge}>CTE308 Mobile Application Development</Text>
        </View>

        <Text style={styles.title}>Dwello: Urban Rental & Flatmate Discovery</Text>
        <Text style={styles.author}>Developed by Tandin Kelzang (02240180)</Text>
        <Text style={styles.org}>
          Royal University of Bhutan, College of Science and Technology (CST)
        </Text>

        <View style={styles.separator} />

        <Text style={styles.sectionHeader}>Mission & Purpose</Text>
        <Text style={styles.bodyText}>
          Finding rental housing in Bhutan's urban centers like Thimphu, Phuentsholing, and Paro has historically been fragmented across Facebook groups, WhatsApp threads, and street placards.
        </Text>
        <Text style={styles.bodyText}>
          Dwello provides a centralized discovery platform tailored for university students and young professionals—featuring dual Explore marketplace feeds, interactive Google Maps location discovery, offline-resilient wishlists, and an itemized Rent & Expense Splitter with direct WhatsApp reminder generation.
        </Text>

        <View style={styles.featureBox}>
          <Text style={styles.featureBoxTitle}>Key Architecture Highlights</Text>
          <Text style={styles.featurePoint}>• Cross-platform React Native & Expo SDK 58</Text>
          <Text style={styles.featurePoint}>• Supabase PostgreSQL backend & authentication</Text>
          <Text style={styles.featurePoint}>• Strict Bhutanese 8-digit phone validation (17 / 77)</Text>
          <Text style={styles.featurePoint}>• Offline-first SQLite/AsyncStorage persistence</Text>
          <Text style={styles.featurePoint}>• WhatsApp intent integration (whatsapp://send)</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  badgeRow: {
    marginBottom: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: DwelloColors.primaryLight,
    color: DwelloColors.primary,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  author: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
  },
  org: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 18,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 12,
  },
  featureBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 14,
  },
  featureBoxTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  featurePoint: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
    marginVertical: 2,
  },
});
