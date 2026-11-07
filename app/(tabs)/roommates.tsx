/**
 * Roommate & Flat Sharing Finder Feed
 * Section 3 of Dwello App Manual.
 * Reactive flatmate discovery with lifestyle preferences, instant search fallbacks, and map view.
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
import { RoommateCard } from '@/components/RoommateCard';
import { FilterModal } from '@/components/FilterModal';
import { PropertyMap } from '@/components/PropertyMap';
import { useListings } from '@/context/ListingsContext';
import { ListingFilterState } from '@/types/listing';
import { LIFESTYLE_TAGS } from '@/constants/BhutanData';

const ROOMMATE_SUGGESTIONS = ['CST', 'Rinchending', 'Student Friendly', 'Female Only', 'Phuentsholing'];

export default function RoommatesScreen() {
  const insets = useSafeAreaInsets();
  const { filterListings } = useListings();

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState<boolean>(false);
  const [selectedLifestyleTag, setSelectedLifestyleTag] = useState<string>('');

  const [filters, setFilters] = useState<ListingFilterState>({
    category: 'Shared Room',
    searchQuery: '',
    maxRent: 100000,
    bhkType: 'Any',
    amenities: [],
    roommatePreferences: [],
    sortBy: 'Newest',
    zoneArea: '',
    municipalRegion: '',
  });

  // Reactive listings compute instantly from in-memory context (0ms latency)
  const filteredListings = useMemo(() => {
    return filterListings(filters);
  }, [filterListings, filters]);

  const handleLifestyleTagPress = (tag: string) => {
    const nextTag = selectedLifestyleTag === tag ? '' : tag;
    setSelectedLifestyleTag(nextTag);
    setFilters((prev) => ({
      ...prev,
      roommatePreferences: nextTag ? [nextTag] : [],
    }));
  };

  const handleSearchChange = (text: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: text }));
  };

  const clearSearch = () => {
    setFilters((prev) => ({ ...prev, searchQuery: '' }));
  };

  const handleApplySuggestion = (sug: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: sug }));
  };

  const resetAllFilters = () => {
    setSelectedLifestyleTag('');
    setFilters({
      category: 'Shared Room',
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
              placeholder="Find roommates by zone or budget"
              placeholderTextColor="#9CA3AF"
              value={filters.searchQuery}
              onChangeText={handleSearchChange}
              returnKeyType="search"
            />
          </View>

          {filters.searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearSearchBtn}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => setIsFilterModalOpen(true)}
            style={styles.filterBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="options-outline" size={20} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* Horizontally scrollable Lifestyle Tag Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.lifestyleBarContainer}>
          {LIFESTYLE_TAGS.map((tag) => {
            const isSelected = selectedLifestyleTag === tag;
            return (
              <TouchableOpacity
                key={tag}
                onPress={() => handleLifestyleTagPress(tag)}
                style={[
                  styles.lifestyleChip,
                  isSelected && styles.selectedLifestyleChip,
                ]}>
                <Text
                  style={[
                    styles.lifestyleChipText,
                    isSelected && styles.selectedLifestyleChipText,
                  ]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Body */}
      <View style={styles.body}>
        {viewMode === 'map' ? (
          <PropertyMap listings={filteredListings} />
        ) : (
          <FlatList
            data={filteredListings}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <RoommateCard listing={item} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="people-outline" size={38} color="#6B7280" />
                </View>

                {filters.searchQuery.trim().length > 0 ? (
                  <>
                    <Text style={styles.emptyTitle}>
                      No roommates matching "{filters.searchQuery}"
                    </Text>
                    <Text style={styles.emptySubtitle}>
                      Try broadening your search or exploring these popular criteria:
                    </Text>
                    <View style={styles.suggestionsWrap}>
                      {ROOMMATE_SUGGESTIONS.map((sug) => (
                        <TouchableOpacity
                          key={sug}
                          onPress={() => handleApplySuggestion(sug)}
                          style={styles.suggestionChip}>
                          <Ionicons name="sparkles-outline" size={12} color={DwelloColors.primary} style={{ marginRight: 4 }} />
                          <Text style={styles.suggestionChipText}>{sug}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.emptyTitle}>No roommate posts found</Text>
                    <Text style={styles.emptySubtitle}>
                      No listings match your selected lifestyle preferences.
                    </Text>
                  </>
                )}

                <TouchableOpacity onPress={resetAllFilters} style={styles.resetFilterBtn}>
                  <Ionicons name="refresh-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.resetFilterText}>Clear Filters</Text>
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
            style={styles.floatingModeBtn}
            accessibilityLabel={viewMode === 'list' ? 'Switch to map view' : 'Switch to list view'}>
            <Text style={styles.floatingModeText}>
              {viewMode === 'list' ? 'Map' : 'List'}
            </Text>
            <Ionicons
              name={viewMode === 'list' ? 'map' : 'list'}
              size={16}
              color="#FFFFFF"
              style={styles.floatingModeIcon}
            />
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
  lifestyleBarContainer: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 4,
  },
  lifestyleChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedLifestyleChip: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  lifestyleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  selectedLifestyleChipText: {
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
    bottom: Platform.OS === 'ios' ? 44 : 38,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99,
  },
  floatingModeBtn: {
    backgroundColor: '#262626',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 7,
      },
      android: {
        elevation: 7,
      },
    }),
  },
  floatingModeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  floatingModeIcon: {
    marginLeft: 8,
  },
});
