/**
 * Explore & Discovery Marketplace (Properties Feed)
 * Section 2 of Dwello App Manual.
 * Dual display modes (List vs Interactive Map), active search with rich fallbacks,
 * instant reactive storage resilience, and quick municipal zone filters.
 */

import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DwelloColors } from '@/constants/Colors';
import { ListingCard } from '@/components/ListingCard';
import { FilterModal } from '@/components/FilterModal';
import { PropertyMap } from '@/components/PropertyMap';
import { useListings } from '@/context/ListingsContext';
import { ListingFilterState } from '@/types/listing';
import { QUICK_ZONE_CHIPS } from '@/constants/BhutanData';

const POPULAR_SEARCH_SUGGESTIONS = [
  'Babesa',
  'Motithang',
  'Rinchending',
  'Paro Town',
  '2BHK',
  '1BHK',
  'WiFi',
];

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { filterListings } = useListings();

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState<boolean>(false);
  const [selectedQuickZone, setSelectedQuickZone] = useState<string>('');

  const [filters, setFilters] = useState<ListingFilterState>({
    category: 'Full Flat',
    searchQuery: '',
    maxRent: 100000,
    bhkType: 'Any',
    amenities: [],
    roommatePreferences: [],
    sortBy: 'Newest',
    zoneArea: '',
    municipalRegion: '',
  });

  // Reactive listings compute instantly from in-memory context (0ms latency, zero re-fetch errors)
  const filteredListings = useMemo(() => {
    return filterListings(filters);
  }, [filterListings, filters]);

  const handleQuickZonePress = (zone: string) => {
    const nextZone = selectedQuickZone === zone ? '' : zone;
    setSelectedQuickZone(nextZone);
    setFilters((prev) => ({ ...prev, zoneArea: nextZone }));
  };

  const handleSearchChange = (text: string) => {
    // Clear zone filters when user types a custom search
    setSelectedQuickZone('');
    setFilters((prev) => ({ ...prev, searchQuery: text, zoneArea: '' }));
  };

  const clearSearch = () => {
    setFilters((prev) => ({ ...prev, searchQuery: '' }));
  };

  const handleApplySuggestion = (suggestion: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: suggestion }));
  };

  const resetAllFilters = () => {
    setSelectedQuickZone('');
    setFilters({
      category: 'Full Flat',
      searchQuery: '',
      maxRent: 100000,
      bhkType: 'Any',
      amenities: [],
      roommatePreferences: [],
      sortBy: 'Newest',
      zoneArea: '',
      municipalRegion: '',
    });
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Search Header */}
      <View style={styles.headerContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
          <View style={styles.searchInputContainer}>
            <Text style={styles.searchLabel}>Search area, town, or zone...</Text>
            <TextInput
              style={styles.input}
              placeholder="Find homes in Thimphu, Paro, and more"
              placeholderTextColor="#9CA3AF"
              value={filters.searchQuery}
              onChangeText={handleSearchChange}
              returnKeyType="search"
            />
          </View>

          {/* Clear text icon */}
          {filters.searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearSearchBtn}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}

          {/* Filter Modal Button */}
          <TouchableOpacity
            onPress={() => setIsFilterModalOpen(true)}
            style={styles.filterBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="options-outline" size={20} color="#111827" />
          </TouchableOpacity>
        </View>



        



        {/* Quick Municipal Zone Chips Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickZonesContainer}>
          {QUICK_ZONE_CHIPS.map((zone) => {
            const isSelected = selectedQuickZone === zone;
            return (
              <TouchableOpacity
                key={zone}
                onPress={() => handleQuickZonePress(zone)}
                style={[
                  styles.quickZoneChip,
                  isSelected && styles.selectedQuickZoneChip,
                ]}>
                <Ionicons
                  name="location-outline"
                  size={13}
                  color={isSelected ? '#FFFFFF' : DwelloColors.primary}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.quickZoneText,
                    isSelected && styles.selectedQuickZoneText,
                  ]}>
                  {zone}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content: Instant List vs. Map without re-fetch lag */}
      <View style={styles.body}>
        {viewMode === 'map' ? (
          <PropertyMap listings={filteredListings} />
        ) : (
          <FlatList
            data={filteredListings}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ListingCard listing={item} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="search-outline" size={36} color="#6B7280" />
                </View>

                {filters.searchQuery.trim().length > 0 ? (
                  <>
                    <Text style={styles.emptyTitle}>
                      No results for "{filters.searchQuery}"
                    </Text>
                    <Text style={styles.emptySubtitle}>
                      We couldn't find any rentals matching your search term. Try exploring popular areas or checking for typos.
                    </Text>

                    {/* Suggestions Section */}
                    <Text style={styles.suggestionHeader}>Suggested Searches:</Text>
                    <View style={styles.suggestionsWrap}>
                      {POPULAR_SEARCH_SUGGESTIONS.map((sug) => (
                        <TouchableOpacity
                          key={sug}
                          onPress={() => handleApplySuggestion(sug)}
                          style={styles.suggestionChip}>
                          <Ionicons name="trending-up-outline" size={12} color={DwelloColors.primary} style={{ marginRight: 4 }} />
                          <Text style={styles.suggestionChipText}>{sug}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.emptyTitle}>No matching listings</Text>
                    <Text style={styles.emptySubtitle}>
                      No active listings match your current filters. Try relaxing your price or amenity selections.
                    </Text>
                  </>
                )}

                <TouchableOpacity onPress={resetAllFilters} style={styles.resetFilterBtn}>
                  <Ionicons name="refresh-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.resetFilterText}>Reset All Filters</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}

        {/* Center Floating "Map / List" Toggle Button */}
        <View style={styles.floatingModeWrapper}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
            style={styles.floatingModeBtn}>
            <Text style={styles.floatingModeText}>
              {viewMode === 'list' ? 'Map 🗺️' : 'List 📋'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Modal */}
      <FilterModal
        visible={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filters={filters}
        onApplyFilters={(updated) => setFilters(updated)}
        totalResultsCount={filteredListings.length}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInputContainer: {
    flex: 1,
  },
  searchLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#374151',
  },
  input: {
    fontSize: 12,
    color: '#111827',
    padding: 0,
    margin: 0,
  },
  clearSearchBtn: {
    padding: 4,
    marginRight: 4,
  },
  filterBtn: {
    padding: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginLeft: 4,
  },
  tabSwitcherWrapper: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 3,
  },
  tabSwitcherBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 12,
  },
  activeTabSwitcherBtn: {
    backgroundColor: DwelloColors.primary,
    ...Platform.select({
      ios: {
        shadowColor: DwelloColors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  tabSwitcherText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
  },
  activeTabSwitcherText: {
    color: '#FFFFFF',
  },
  quickZonesContainer: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 4,
  },
  quickZoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedQuickZoneChip: {
    backgroundColor: DwelloColors.primary,
    borderColor: DwelloColors.primary,
  },
  quickZoneText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  selectedQuickZoneText: {
    color: '#FFFFFF',
  },
  body: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#F8F9FA',
  },
  listContent: {
    padding: 16,
    paddingBottom: 90,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    marginBottom: 16,
  },
  suggestionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
    alignSelf: 'center',
    marginBottom: 8,
  },
  suggestionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  suggestionChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  resetFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: DwelloColors.primary,
    ...Platform.select({
      ios: {
        shadowColor: DwelloColors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  resetFilterText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  floatingModeWrapper: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99,
  },
  floatingModeBtn: {
    backgroundColor: '#111827',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  floatingModeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
