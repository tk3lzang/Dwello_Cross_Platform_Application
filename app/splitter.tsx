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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DwelloColors } from '@/constants/Colors';
import { calculateExpenseSplit, formatNu, generateWhatsAppSplitMessage } from '@/utils/splitter';
import { openWhatsAppChat } from '@/utils/linking';
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
  const [roommateCount, setRoommateCount] = useState(3);
  const [occupantNames, setOccupantNames] = useState<string[]>(['Karma', 'Sonam', 'Tandin']);

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

  const handleIncrementRoommates = () => {
    const nextCount = roommateCount + 1;
    setRoommateCount(nextCount);
    setOccupantNames((prev) => [...prev, `Roommate ${nextCount}`]);
  };

  const handleDecrementRoommates = () => {
    if (roommateCount > 1) {
      const nextCount = roommateCount - 1;
      setRoommateCount(nextCount);
      setOccupantNames((prev) => prev.slice(0, nextCount));
    }
  };

  const updateOccupantName = (index: number, name: string) => {
    setOccupantNames((prev) => {
      const copy = [...prev];
      copy[index] = name;
      return copy;
    });
  };

  const handleShareWhatsAppGeneral = () => {
    console.log('[Dwello-Splitter Debug]: Sharing general breakdown via WhatsApp');
    const msg = generateWhatsAppSplitMessage(splitResult, 'Flatmates', 1, roommateCount);
    openWhatsAppChat(undefined, msg);
    showDebugBanner('success', 'WhatsApp Launched', 'Shared cost breakdown generated.');
  };

  const handleShareSpecificOccupant = (name: string, index: number) => {
    console.log(`[Dwello-Splitter Debug]: Sharing individual breakdown for ${name}`);
    const msg = generateWhatsAppSplitMessage(splitResult, name, index + 1, roommateCount);
    openWhatsAppChat(undefined, msg);
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

        {/* Number of Roommates Stepper (Manual Page 12 & 17) */}
        <View style={styles.stepperContainer}>
          <View>
            <Text style={styles.stepperTitle}>Number of Roommates</Text>
            <Text style={styles.stepperSubtitle}>Total people splitting costs</Text>
          </View>

          <View style={styles.stepperControls}>
            <TouchableOpacity
              onPress={handleDecrementRoommates}
              disabled={roommateCount <= 1}
              style={[styles.stepBtn, roommateCount <= 1 && styles.disabledStepBtn]}>
              <Ionicons name="remove-circle-outline" size={24} color={roommateCount <= 1 ? '#D1D5DB' : DwelloColors.primary} />
            </TouchableOpacity>

            <Text style={styles.stepCountText}>{roommateCount}</Text>

            <TouchableOpacity onPress={handleIncrementRoommates} style={styles.stepBtn}>
              <Ionicons name="add-circle-outline" size={24} color={DwelloColors.primary} />
            </TouchableOpacity>
          </View>
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

        {/* Individual Roommates List */}
        <Text style={styles.occupantsSectionTitle}>Individual Occupant Shares</Text>
        {splitResult.individualBreakdowns.map((occ, idx) => (
          <View key={idx} style={styles.occupantCard}>
            <View style={styles.occupantLeft}>
              <Ionicons name="person-circle-outline" size={26} color="#6B7280" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.occupantNameInput}
                value={occ.occupantName}
                onChangeText={(txt) => updateOccupantName(idx, txt)}
                placeholder={`Roommate ${idx + 1}`}
              />
            </View>

            <View style={styles.occupantRight}>
              <Text style={styles.occupantShareText}>{formatNu(occ.shareAmount)}</Text>
              <TouchableOpacity
                onPress={() => handleShareSpecificOccupant(occ.occupantName, idx)}
                style={styles.occupantShareBtn}>
                <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Share via WhatsApp CTA Button (Manual Page 12 & 17) */}
        <TouchableOpacity
          onPress={handleShareWhatsAppGeneral}
          activeOpacity={0.88}
          style={styles.whatsAppShareBtn}>
          <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.whatsAppShareText}>Share via WhatsApp</Text>
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
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 20,
  },
  stepperTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  stepperSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBtn: {
    padding: 4,
  },
  disabledStepBtn: {
    opacity: 0.4,
  },
  stepCountText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    minWidth: 20,
    textAlign: 'center',
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

