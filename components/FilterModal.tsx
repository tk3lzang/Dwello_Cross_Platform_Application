/**
 * Multi-Filter Control Panel Modal
 * Matches page 4 & 6 of the Dwello App Manual.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DwelloColors } from '@/constants/Colors';
import { ListingFilterState } from '@/types/listing';
import { formatNu } from '@/utils/splitter';

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  filters: ListingFilterState;
  onApplyFilters: (updated: ListingFilterState) => void;
  totalResultsCount: number;
}

const AMENITY_OPTIONS = ['Water Included', 'Parking', 'WiFi', 'Furnished'];
const ROOMMATE_PREF_OPTIONS = ['Student Friendly', 'Working Professional', 'Female Only', 'Male Only'];
const MUNICIPAL_ZONE_OPTIONS = [
  'Rinchending',
  'Kabreytar',
  'Core Town',
  'Pasakha',
  'Motithang',
  'Babesa',
  'Paro Town',
];
const BHK_OPTIONS = ['1BHK', '2BHK', '3BHK', 'Any'];
const SORT_OPTIONS: ('Newest' | 'Best Value')[] = ['Newest', 'Best Value'];
const RENT_TIERS = [5000, 10000, 15000, 20000, 30000, 50000, 100000];

export function FilterModal({
  visible,
  onClose,
  filters,
  onApplyFilters,
  totalResultsCount,
}: FilterModalProps) {
  const [localFilters, setLocalFilters] = useState<ListingFilterState>(filters);

  // Sync state whenever modal opens
  React.useEffect(() => {
    if (visible) {
      setLocalFilters(filters);
    }
  }, [visible, filters]);

  const toggleAmenity = (item: string) => {
    const current = localFilters.amenities;
    const exists = current.includes(item);
    setLocalFilters({
      ...localFilters,
      amenities: exists ? current.filter((x) => x !== item) : [...current, item],
    });
  };

  const toggleRoommatePref = (item: string) => {
    const current = localFilters.roommatePreferences;
    const exists = current.includes(item);
    setLocalFilters({
      ...localFilters,
      roommatePreferences: exists ? current.filter((x) => x !== item) : [...current, item],
    });
  };

  const selectZone = (zone: string) => {
    setLocalFilters({
      ...localFilters,
      zoneArea: localFilters.zoneArea === zone ? '' : zone,
    });
  };

  const selectBhk = (bhk: string) => {
    setLocalFilters({
      ...localFilters,
      bhkType: bhk,
    });
  };

  const selectSort = (sort: 'Newest' | 'Best Value') => {
    setLocalFilters({
      ...localFilters,
      sortBy: sort,
    });
  };

  const handleReset = () => {
    const resetState: ListingFilterState = {
      searchQuery: '',
      maxRent: 100000,
      bhkType: 'Any',
      amenities: [],
      roommatePreferences: [],
      sortBy: 'Newest',
      zoneArea: '',
      municipalRegion: '',
    };
    setLocalFilters(resetState);
  };

  const handleApply = () => {
    onApplyFilters(localFilters);
    onClose();
  };

  // Conditionally unmount on Android to prevent ghost-render of pageSheet modal
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Filters</Text>
          <TouchableOpacity onPress={handleReset}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
          {/* Amenities */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amenities</Text>
            <View style={styles.chipsContainer}>
              {AMENITY_OPTIONS.map((item) => {
                const active = localFilters.amenities.includes(item);
                return (
                  <TouchableOpacity
                    key={item}
                    onPress={() => toggleAmenity(item)}
                    style={[styles.filterChip, active && styles.activeFilterChip]}>
                    <Text style={[styles.filterChipText, active && styles.activeFilterChipText]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Roommate Preferences */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Roommate Preferences</Text>
            <View style={styles.chipsContainer}>
              {ROOMMATE_PREF_OPTIONS.map((item) => {
                const active = localFilters.roommatePreferences.includes(item);
                return (
                  <TouchableOpacity
                    key={item}
                    onPress={() => toggleRoommatePref(item)}
                    style={[styles.filterChip, active && styles.activeFilterChip]}>
                    <Text style={[styles.filterChipText, active && styles.activeFilterChipText]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Municipal Zone */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Municipal Zone</Text>
            <View style={styles.chipsContainer}>
              {MUNICIPAL_ZONE_OPTIONS.map((zone) => {
                const active = localFilters.zoneArea === zone;
                return (
                  <TouchableOpacity
                    key={zone}
                    onPress={() => selectZone(zone)}
                    style={[styles.filterChip, active && styles.activeFilterChip]}>
                    <Text style={[styles.filterChipText, active && styles.activeFilterChipText]}>
                      {zone}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Max Rent Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Max Rent: {formatNu(localFilters.maxRent)}/mo
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {RENT_TIERS.map((tier) => {
                const active = localFilters.maxRent === tier;
                return (
                  <TouchableOpacity
                    key={tier}
                    onPress={() => setLocalFilters({ ...localFilters, maxRent: tier })}
                    style={[styles.tierChip, active && styles.activeTierChip]}>
                    <Text style={[styles.tierChipText, active && styles.activeTierChipText]}>
                      {formatNu(tier)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Flat / Room Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Flat / Room Type</Text>
            <View style={styles.segmentedRow}>
              {BHK_OPTIONS.map((bhk) => {
                const active = (localFilters.bhkType || 'Any') === bhk;
                return (
                  <TouchableOpacity
                    key={bhk}
                    onPress={() => selectBhk(bhk)}
                    style={[styles.segmentBtn, active && styles.activeSegmentBtn]}>
                    <Text style={[styles.segmentBtnText, active && styles.activeSegmentBtnText]}>
                      {bhk}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Sort By */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sort By</Text>
            <View style={styles.segmentedRow}>
              {SORT_OPTIONS.map((sort) => {
                const active = localFilters.sortBy === sort;
                return (
                  <TouchableOpacity
                    key={sort}
                    onPress={() => selectSort(sort)}
                    style={[styles.segmentBtn, active && styles.activeSegmentBtn]}>
                    <Text style={[styles.segmentBtnText, active && styles.activeSegmentBtnText]}>
                      {sort}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Bottom CTA Action Button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity onPress={handleApply} style={styles.applyBtn} activeOpacity={0.88}>
            <Text style={styles.applyBtnText}>
              Show {totalResultsCount} {totalResultsCount === 1 ? 'result' : 'results'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
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
  closeBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  resetText: {
    fontSize: 14,
    fontWeight: '600',
    color: DwelloColors.primary,
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  activeFilterChip: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  filterChipText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  activeFilterChipText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  tierChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  activeTierChip: {
    backgroundColor: DwelloColors.primaryLight,
    borderColor: DwelloColors.primary,
  },
  tierChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  activeTierChipText: {
    color: DwelloColors.primary,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  activeSegmentBtn: {
    backgroundColor: DwelloColors.primary,
    borderColor: DwelloColors.primary,
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  activeSegmentBtnText: {
    color: '#FFFFFF',
  },
  bottomBar: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  applyBtn: {
    backgroundColor: DwelloColors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
