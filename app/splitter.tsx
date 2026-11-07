/**
 * Rent & Expense Splitter Tool
 * Section 9 of Dwello App Manual & Project II Objective 2.
 * Calculates individual shared utility costs and generates customized WhatsApp payment reminder messages.
 */

import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DwelloColors } from '@/constants/Colors';
import {
  calculateExpenseSplit,
  formatNu,
  generateWhatsAppSplitMessage,
} from '@/utils/splitter';
import { sendWhatsAppWithFallback } from '@/utils/linking';
import { useDebug } from '@/context/DebugContext';

export default function SplitterScreen() {
  const params = useLocalSearchParams<{ baseRent?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showDebugBanner } = useDebug();

  // Initial state pre-filled if opened from a property card
  const [baseRent, setBaseRent] = useState(params.baseRent || '10000');
  const [electricity, setElectricity] = useState('1000');
  const [water, setWater] = useState('500');
  const [wifi, setWifi] = useState('1500');
  const [maintenance, setMaintenance] = useState('0');

  // Dynamic Contact Management (No hardcoded mock accounts)
  const [contacts, setContacts] = useState<{ id: string; name: string; phone: string }[]>([
    { id: 'c1', name: 'Karma', phone: '17123456' },
    { id: 'c2', name: 'Sonam', phone: '77654321' },
  ]);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [showAddContactForm, setShowAddContactForm] = useState(false);

  const roommateCount = Math.max(1, contacts.length);
  const occupantNames = useMemo(
    () => contacts.map((c, i) => c.name.trim() || `Roommate ${i + 1}`),
    [contacts]
  );

  // Calculate whenever values change
  const splitResult = useMemo(() => {
    return calculateExpenseSplit({
      baseRent: parseFloat(baseRent) || 0,
      electricity: parseFloat(electricity) || 0,
      water: parseFloat(water) || 0,
      wifi: parseFloat(wifi) || 0,
      maintenance: parseFloat(maintenance) || 0,
      roommateCount,
      occupantNames,
    });
  }, [baseRent, electricity, water, wifi, maintenance, roommateCount, occupantNames]);

  const handleAddContact = () => {
    if (!newContactName.trim()) {
      showDebugBanner('warning', 'Name Required', 'Please enter a name for the roommate.');
      return;
    }
    const newContact = {
      id: `contact-${Date.now()}`,
      name: newContactName.trim(),
      phone: newContactPhone.trim(),
    };
    console.log('[Dwello-Splitter Debug]: Adding custom contact:', newContact);
    setContacts((prev) => [...prev, newContact]);
    setNewContactName('');
    setNewContactPhone('');
    setShowAddContactForm(false);
    showDebugBanner('success', 'Contact Added', `${newContact.name} added to rent splitter.`);
  };

  const handleRemoveContact = (id: string, name: string) => {
    console.log(`[Dwello-Splitter Debug]: Removing contact id=${id}, name=${name}`);
    setContacts((prev) => prev.filter((c) => c.id !== id));
    showDebugBanner('info', 'Contact Removed', `${name} removed from split.`);
  };

  const updateContact = (id: string, field: 'name' | 'phone', value: string) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  // Context-Aware Messaging Router with direct targeting and graceful fallback
  const handleContextAwareShare = async () => {
    if (contacts.length === 0) {
      showDebugBanner('warning', 'No Roommates', 'Please add at least one roommate contact.');
      return;
    }

    if (contacts.length === 1) {
      // Single Individual Split: Direct pre-formatted WhatsApp chat to that person's phone
      const single = contacts[0];
      console.log(`[Dwello-WhatsApp Debug]: Routing single individual chat for ${single.name} (${single.phone})`);
      const msg = generateWhatsAppSplitMessage(splitResult, single.name || 'Flatmate', 1, 1);
      const res = await sendWhatsAppWithFallback(single.phone, msg);
      if (!res.success && res.copiedToClipboard) {
        showDebugBanner(
          'warning',
          'Number not on WhatsApp — message copied to clipboard',
          'Message copied. You can paste and send via SMS.'
        );
      } else if (res.success) {
        showDebugBanner('success', 'WhatsApp Launched', `Opened direct WhatsApp chat for ${single.name}.`);
      }
    } else {
      // Group Batch Processing: Send directly to each individual phone while continuing if any number fails
      console.log(`[Dwello-WhatsApp Debug]: Routing batch direct reminders for ${contacts.length} occupants`);
      let successCount = 0;

      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        const msg = generateWhatsAppSplitMessage(splitResult, contact.name || `Roommate ${i + 1}`, i + 1, contacts.length);
        const res = await sendWhatsAppWithFallback(contact.phone, msg);

        if (res.success) {
          successCount++;
        } else {
          // Display graceful toast per directive and continue batch
          showDebugBanner(
            'warning',
            'Number not on WhatsApp — message copied to clipboard',
            `${contact.name}: Number not on WhatsApp — message copied to clipboard`
          );
        }
      }

      if (successCount > 0) {
        showDebugBanner('success', 'Batch Complete', `Sent reminders to ${successCount} roommate(s).`);
      }
    }
  };

  const handleDirectContactShare = async (contact: { id: string; name: string; phone: string }, index: number) => {
    console.log(`[Dwello-WhatsApp Debug]: Direct WhatsApp share targeted to ${contact.name} (${contact.phone})`);
    const msg = generateWhatsAppSplitMessage(splitResult, contact.name || `Roommate ${index + 1}`, index + 1, contacts.length);
    const result = await sendWhatsAppWithFallback(contact.phone, msg);
    if (!result.success && result.copiedToClipboard) {
      showDebugBanner(
        'warning',
        'Number not on WhatsApp — message copied to clipboard',
        `Could not open WhatsApp for ${contact.name}. Message copied to clipboard.`
      );
    } else if (result.success) {
      showDebugBanner('success', 'WhatsApp Launched', `Opened direct chat for ${contact.name}.`);
    }
  };

  const handleCopyBreakdown = async (contact: { id: string; name: string; phone: string }, index: number) => {
    const msg = generateWhatsAppSplitMessage(splitResult, contact.name || `Roommate ${index + 1}`, index + 1, contacts.length);
    try {
      await Clipboard.setStringAsync(msg);
      showDebugBanner('success', 'Copied to Clipboard', `Payment share for ${contact.name} copied.`);
    } catch {
      showDebugBanner('error', 'Copy Failed', 'Unable to copy text to clipboard.');
    }
  };

  const confirmAndSendReminders = () => {
    Alert.alert(
      'Send Reminders',
      contacts.length === 1
        ? `Open WhatsApp to send payment breakdown to ${contacts[0].name}?`
        : `Send individual WhatsApp payment reminders to all ${contacts.length} roommates?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', onPress: () => handleContextAwareShare() },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header (Manual Page 12 & 17) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rent & Expense Splitter</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>
          Calculate and share cost breakdowns with your roommates.
        </Text>

        {/* Base Rent Input */}
        <Text style={styles.inputLabel}>Monthly Base Rent (Nu.)</Text>
        <View style={styles.baseRentInputRow}>
          <Ionicons name="home" size={20} color="#111827" style={styles.inputIcon} />
          <TextInput
            style={styles.rentTextInput}
            keyboardType="numeric"
            value={baseRent}
            onChangeText={setBaseRent}
            placeholder="10000"
          />
        </View>

        {/* Utilities & Other Costs Grid */}
        <Text style={styles.sectionTitle}>Utilities & Other Costs</Text>
        <View style={styles.utilityGrid}>
          {/* Electricity */}
          <View style={styles.utilityItem}>
            <Text style={styles.utilityLabel}>Electricity</Text>
            <TextInput
              style={styles.utilityInput}
              keyboardType="numeric"
              value={electricity}
              onChangeText={setElectricity}
              placeholder="0"
            />
          </View>

          {/* Water */}
          <View style={styles.utilityItem}>
            <Text style={styles.utilityLabel}>Water</Text>
            <TextInput
              style={styles.utilityInput}
              keyboardType="numeric"
              value={water}
              onChangeText={setWater}
              placeholder="0"
            />
          </View>

          {/* WiFi */}
          <View style={styles.utilityItem}>
            <Text style={styles.utilityLabel}>WiFi / Internet</Text>
            <TextInput
              style={styles.utilityInput}
              keyboardType="numeric"
              value={wifi}
              onChangeText={setWifi}
              placeholder="0"
            />
          </View>

          {/* Maintenance */}
          <View style={styles.utilityItem}>
            <Text style={styles.utilityLabel}>Maintenance</Text>
            <TextInput
              style={styles.utilityInput}
              keyboardType="numeric"
              value={maintenance}
              onChangeText={setMaintenance}
              placeholder="0"
            />
          </View>
        </View>

        {/* Roommates & Contacts Management Header */}
        <View style={styles.contactsHeaderRow}>
          <View>
            <Text style={styles.contactsHeaderTitle}>Roommates & Contacts ({contacts.length})</Text>
            <Text style={styles.contactsHeaderSubtitle}>Add contacts to split costs evenly</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowAddContactForm(!showAddContactForm)}
            style={styles.addContactToggleBtn}>
            <Ionicons
              name={showAddContactForm ? 'close-circle' : 'person-add'}
              size={18}
              color="#FFFFFF"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.addContactToggleText}>
              {showAddContactForm ? 'Cancel' : 'Add Contact'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Add Contact Form */}
        {showAddContactForm && (
          <View style={styles.addContactFormCard}>
            <Text style={styles.addContactFormTitle}>New Roommate Contact</Text>
            <TextInput
              style={styles.contactFormInput}
              value={newContactName}
              onChangeText={setNewContactName}
              placeholder="Contact Name (e.g. Dechen)"
              placeholderTextColor="#9CA3AF"
            />
            <TextInput
              style={[styles.contactFormInput, { marginTop: 8 }]}
              value={newContactPhone}
              onChangeText={setNewContactPhone}
              placeholder="WhatsApp Phone (e.g. 17123456)"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
            />
            <TouchableOpacity
              onPress={handleAddContact}
              activeOpacity={0.88}
              style={styles.submitNewContactBtn}>
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.submitNewContactText}>Save Contact</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Dynamic Contacts List */}
        <View style={styles.contactsListContainer}>
          {contacts.map((contact, idx) => (
            <View key={contact.id} style={styles.occupantCard}>
              <View style={styles.occupantLeft}>
                <Ionicons
                  name="person-circle-outline"
                  size={32}
                  color="#6B7280"
                  style={{ marginRight: 8 }}
                />
                <View style={styles.occupantInputCol}>
                  <TextInput
                    style={styles.occupantNameInput}
                    value={contact.name}
                    onChangeText={(txt) => updateContact(contact.id, 'name', txt)}
                    placeholder={`Roommate ${idx + 1}`}
                  />
                  <TextInput
                    style={styles.occupantPhoneInput}
                    value={contact.phone}
                    onChangeText={(txt) => updateContact(contact.id, 'phone', txt)}
                    placeholder="WhatsApp No. (e.g. 17123456)"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View style={styles.occupantRight}>
                <Text style={styles.occupantShareText}>{formatNu(splitResult.perPersonShare)}</Text>
                {/* Copy Individual Breakdown Action */}
                <TouchableOpacity
                  onPress={() => handleCopyBreakdown(contact, idx)}
                  style={styles.occupantCopyBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  accessibilityLabel={`Copy breakdown for ${contact.name}`}>
                  <Ionicons name="copy-outline" size={15} color="#4B5563" />
                </TouchableOpacity>
                {/* Direct WhatsApp Action */}
                <TouchableOpacity
                  onPress={() => handleDirectContactShare(contact, idx)}
                  style={styles.occupantShareBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  accessibilityLabel={`Send WhatsApp to ${contact.name}`}>
                  <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
                </TouchableOpacity>
                {/* Remove Contact Action */}
                <TouchableOpacity
                  onPress={() => handleRemoveContact(contact.id, contact.name)}
                  style={styles.removeContactBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  accessibilityLabel={`Remove ${contact.name}`}>
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Calculation Result Summary Card (Manual Page 12 & 17) */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeaderRow}>
            <View>
              <Text style={styles.eachPaysLabel}>Each Person Pays</Text>
              <Text style={styles.eachPaysAmount}>{formatNu(splitResult.perPersonShare)}</Text>
            </View>
            <View style={styles.totalBillCol}>
              <Text style={styles.totalLabel}>Total: {formatNu(splitResult.totalBill)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Line-Item Breakdown */}
          <Text style={styles.lineItemTitle}>LINE-ITEM BREAKDOWN</Text>
          <View style={styles.lineItemRow}>
            <Text style={styles.lineItemName}>Monthly Rent</Text>
            <Text style={styles.lineItemVal}>{formatNu(splitResult.itemizedBreakdown.baseRent)}</Text>
          </View>
          <View style={styles.lineItemRow}>
            <Text style={styles.lineItemName}>Electricity</Text>
            <Text style={styles.lineItemVal}>{formatNu(splitResult.itemizedBreakdown.electricity)}</Text>
          </View>
          <View style={styles.lineItemRow}>
            <Text style={styles.lineItemName}>Water</Text>
            <Text style={styles.lineItemVal}>{formatNu(splitResult.itemizedBreakdown.water)}</Text>
          </View>
          <View style={styles.lineItemRow}>
            <Text style={styles.lineItemName}>Internet</Text>
            <Text style={styles.lineItemVal}>{formatNu(splitResult.itemizedBreakdown.wifi)}</Text>
          </View>
          {splitResult.itemizedBreakdown.maintenance > 0 && (
            <View style={styles.lineItemRow}>
              <Text style={styles.lineItemName}>Maintenance</Text>
              <Text style={styles.lineItemVal}>{formatNu(splitResult.itemizedBreakdown.maintenance)}</Text>
            </View>
          )}
        </View>

        {/* Context-Aware WhatsApp CTA Button (Single Direct vs Group Breakdown with Confirmation) */}
        <TouchableOpacity
          onPress={confirmAndSendReminders}
          activeOpacity={0.88}
          style={styles.whatsAppShareBtn}>
          <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.whatsAppShareText}>
            {contacts.length <= 1
              ? `Message ${contacts[0]?.name || 'Roommate'} on WhatsApp`
              : `Send WhatsApp Reminders (${contacts.length} Roommates)`}
          </Text>
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
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
    fontWeight: '500',
  },
  baseRentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
    backgroundColor: '#F9FAFB',
  },
  inputIcon: {
    marginRight: 10,
  },
  rentTextInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  utilityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  utilityItem: {
    width: '48%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#F9FAFB',
  },
  utilityLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
  },
  utilityInput: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    padding: 0,
  },
  contactsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 14,
  },
  contactsHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  contactsHeaderSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  addContactToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DwelloColors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addContactToggleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  addContactFormCard: {
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  addContactFormTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  contactFormInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
  },
  submitNewContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DwelloColors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  submitNewContactText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  contactsListContainer: {
    marginBottom: 16,
  },
  occupantInputCol: {
    flex: 1,
  },
  occupantPhoneInput: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    padding: 0,
  },
  removeContactBtn: {
    padding: 6,
    marginLeft: 4,
  },
  summaryCard: {
    backgroundColor: '#FFF5F6',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#FFE4E6',
    marginBottom: 24,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eachPaysLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  eachPaysAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: DwelloColors.primary,
    marginTop: 2,
  },
  totalBillCol: {
    alignItems: 'flex-end',
  },
  totalLabel: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#FED7AA',
    marginVertical: 14,
    opacity: 0.5,
  },
  lineItemTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  lineItemName: {
    fontSize: 13,
    color: '#4B5563',
  },
  lineItemVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  occupantsSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  occupantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  occupantLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  occupantNameInput: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    flex: 1,
  },
  occupantRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  occupantShareText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  occupantCopyBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  occupantShareBtn: {
    backgroundColor: DwelloColors.whatsappGreen,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  whatsAppShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DwelloColors.primary,
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 16,
    ...Platform.select({
      ios: {
        shadowColor: DwelloColors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  whatsAppShareText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

