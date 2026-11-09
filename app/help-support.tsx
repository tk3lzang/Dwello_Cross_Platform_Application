/**
 * Support contact options for WhatsApp, phone, and email.
 */

import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DwelloColors } from '@/constants/Colors';
import {
  openWhatsAppChat,
  callPhoneNumber,
  OFFICIAL_DWELLO_HELPLINE,
} from '@/utils/linking';

export default function HelpSupportScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleWhatsAppSupport = () => {
    openWhatsAppChat(
      OFFICIAL_DWELLO_HELPLINE,
      'Hello Dwello Support, I need assistance regarding a property listing on the app.'
    );
  };

  const handleCallSupport = () => {
    callPhoneNumber(OFFICIAL_DWELLO_HELPLINE);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroBox}>
          <Ionicons name="help-buoy-outline" size={48} color={DwelloColors.primary} />
          <Text style={styles.heroTitle}>How can we assist you?</Text>
          <Text style={styles.heroSubtitle}>
            Our team in Rinchending & Thimphu is ready to help you with rental verification, flatmate safety, or app questions.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Contact Channels</Text>

        {/* WhatsApp Support */}
        <TouchableOpacity
          onPress={handleWhatsAppSupport}
          activeOpacity={0.88}
          style={styles.channelCard}>
          <View style={[styles.channelIcon, { backgroundColor: '#ECFDF5' }]}>
            <Ionicons name="logo-whatsapp" size={24} color={DwelloColors.whatsappGreen} />
          </View>
          <View style={styles.channelTextCol}>
            <Text style={styles.channelTitle}>WhatsApp Support</Text>
            <Text style={styles.channelDesc}>Direct messaging with customer care • +975 {OFFICIAL_DWELLO_HELPLINE}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Cellular Helpline */}
        <TouchableOpacity
          onPress={handleCallSupport}
          activeOpacity={0.88}
          style={styles.channelCard}>
          <View style={[styles.channelIcon, { backgroundColor: '#F3F4F6' }]}>
            <Ionicons name="call" size={22} color="#111827" />
          </View>
          <View style={styles.channelTextCol}>
            <Text style={styles.channelTitle}>Helpline Phone Call</Text>
            <Text style={styles.channelDesc}>Available 9:00 AM - 6:00 PM (BST) • {OFFICIAL_DWELLO_HELPLINE}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </TouchableOpacity>

        {/* FAQ Section */}
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

        <View style={styles.faqCard}>
          <Text style={styles.faqQuestion}>How do I report a fraudulent or already rented listing?</Text>
          <Text style={styles.faqAnswer}>
            Open any listing and tap the Flag icon in the top header or the "Report this listing" link at the bottom. Our moderation team reviews all flagged listings daily.
          </Text>
        </View>

        <View style={styles.faqCard}>
          <Text style={styles.faqQuestion}>Can I view saved properties without internet?</Text>
          <Text style={styles.faqAnswer}>
            Yes! Dwello includes offline resilience. Any listing you tap the Heart on is stored in local device memory and can be viewed anytime in your Wishlist tab.
          </Text>
        </View>

        <View style={styles.faqCard}>
          <Text style={styles.faqQuestion}>How does the Rent Splitter WhatsApp share work?</Text>
          <Text style={styles.faqAnswer}>
            The Rent & Expense Splitter divides base rent and utility bills by the number of roommates and automatically composes a message formatted for mBOB / BNBL transfers.
          </Text>
        </View>
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
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  heroBox: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginTop: 10,
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginTop: 16,
    marginBottom: 12,
  },
  channelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  channelIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  channelTextCol: {
    flex: 1,
  },
  channelTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  channelDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  faqCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  faqAnswer: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
});
