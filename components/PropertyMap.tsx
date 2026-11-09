/**
 * Interactive Property Map Component
 * Connects database listings with geographical coordinates to render pins with needle tips on Bhutan map.
 * Zooms into local streets/roads on pin selection and features bottom preview cards.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PropertyListing } from '@/types/listing';
import { DwelloColors } from '@/constants/Colors';
import { formatNu } from '@/utils/splitter';
import {
  GeocodingService,
  filterListingsByLocation,
  getLocationSearchRadius,
  LocationSearchResult,
} from '@/services/geocodingService';

// Default Bhutan region centered on Thimphu / Western Bhutan urban corridor
const INITIAL_REGION = {
  latitude: 27.4728,
  longitude: 89.6393,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

interface PropertyMapProps {
  listings: PropertyListing[];
  onSelectListing?: (listing: PropertyListing) => void;
  searchLocation?: string;
}

export function PropertyMap({ listings, onSelectListing, searchLocation }: PropertyMapProps) {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const searchRequestRef = useRef<AbortController | null>(null);
  const [selectedListing, setSelectedListing] = useState<PropertyListing | null>(null);
  const [locationSearchStatus, setLocationSearchStatus] = useState<
    'idle' | 'searching' | 'resolved' | 'notFound' | 'error'
  >('idle');
  const [searchedLocation, setSearchedLocation] = useState<LocationSearchResult | null>(null);
  const [searchedQuery, setSearchedQuery] = useState('');
  const normalizedSearch = searchLocation?.trim() || '';

  const mapListings = useMemo(() => {
    const locatedListings = listings.filter(
      (item) =>
        Number.isFinite(item.latitude) &&
        Number.isFinite(item.longitude) &&
        Math.abs(item.latitude) <= 90 &&
        Math.abs(item.longitude) <= 180
    );

    if (normalizedSearch.length < 2) return locatedListings;
    if (
      locationSearchStatus !== 'resolved' ||
      searchedQuery !== normalizedSearch ||
      !searchedLocation
    ) {
      return [];
    }

    return filterListingsByLocation(locatedListings, searchedLocation);
  }, [listings, locationSearchStatus, normalizedSearch, searchedLocation, searchedQuery]);

  useEffect(() => {
    if (normalizedSearch.length < 2) {
      searchRequestRef.current?.abort();
      searchRequestRef.current = null;
      setLocationSearchStatus('idle');
      setSearchedLocation(null);
      setSearchedQuery('');
      return;
    }

    const controller = new AbortController();
    searchRequestRef.current?.abort();
    searchRequestRef.current = controller;
    setLocationSearchStatus('searching');
    setSearchedLocation(null);
    setSearchedQuery('');

    const timeout = setTimeout(async () => {
      try {
        const result = await GeocodingService.searchLocation(normalizedSearch, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;

        if (!result) {
          setLocationSearchStatus('notFound');
          return;
        }

        setSearchedLocation(result);
        setSearchedQuery(normalizedSearch);
        setLocationSearchStatus('resolved');
        const radius = getLocationSearchRadius(result);
        const latitudeDelta = Math.min(0.35, Math.max(0.025, (radius * 2.8) / 111000));
        const longitudeDelta =
          latitudeDelta / Math.max(0.2, Math.cos((result.latitude * Math.PI) / 180));
        mapRef.current?.animateToRegion(
          {
            latitude: result.latitude,
            longitude: result.longitude,
            latitudeDelta,
            longitudeDelta,
          },
          600
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn('[Dwello-MapSearch]: Location search failed:', error);
          setLocationSearchStatus('error');
        }
      }
    }, 1000);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [normalizedSearch]);

  useEffect(() => {
    setSelectedListing((prev) => {
      if (prev && mapListings.some((listing) => listing.id === prev.id)) {
        return prev;
      }
      return mapListings[0] || null;
    });
  }, [mapListings]);

  const handleMarkerPress = (item: PropertyListing) => {
    console.log('[Dwello-Map Debug]: Pin selected. Zooming into locality for:', item.title, item.zoneArea);
    setSelectedListing(item);
    if (onSelectListing) {
      onSelectListing(item);
    }

    // Zoom into the specific neighborhood/locality with road network details visible
    // Slight latitude offset ensures the bottom preview card does not occlude the pin
    mapRef.current?.animateToRegion(
      {
        latitude: item.latitude,
        longitude: item.longitude,
        latitudeDelta: 0.014, // Tight street-level zoom
        longitudeDelta: 0.014,
      },
      550
    );
  };

  const resetMapZoom = () => {
    if (locationSearchStatus === 'resolved' && searchedLocation) {
      const radius = getLocationSearchRadius(searchedLocation);
      const latitudeDelta = Math.min(0.35, Math.max(0.025, (radius * 2.8) / 111000));
      const longitudeDelta =
        latitudeDelta / Math.max(0.2, Math.cos((searchedLocation.latitude * Math.PI) / 180));
      mapRef.current?.animateToRegion(
        {
          latitude: searchedLocation.latitude,
          longitude: searchedLocation.longitude,
          latitudeDelta,
          longitudeDelta,
        },
        500
      );
      return;
    }

    mapRef.current?.animateToRegion(INITIAL_REGION, 500);
  };

  const navigateToDetails = (id: string) => {
    router.push({
      pathname: '/listing/[id]',
      params: { id },
    });
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        mapType="standard" // Standard road & street map
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass
        showsBuildings
        showsPointsOfInterests
        showsIndoors>
        {mapListings.map((item) => {
          const isSelected = selectedListing?.id === item.id;
          return (
            <Marker
              key={item.id}
              coordinate={{
                latitude: item.latitude,
                longitude: item.longitude,
              }}
              anchor={{ x: 0.5, y: 1.0 }} // Anchors needle tip exactly to location coordinate
              onPress={() => handleMarkerPress(item)}>
              {/* Pin with rounded rectangle and needle tip */}
              <View style={styles.pinWrapper}>
                <View
                  style={[
                    styles.markerPill,
                    isSelected && styles.selectedMarkerPill,
                  ]}>
                  <Text
                    style={[
                      styles.markerText,
                      isSelected && styles.selectedMarkerText,
                    ]}>
                    {formatNu(item.price)}
                  </Text>
                </View>
                {/* Needle Tip Triangle pointing down to exact location */}
                <View
                  style={[
                    styles.needleTip,
                    isSelected && styles.selectedNeedleTip,
                  ]}
                />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Floating Map Controls (Reset Zoom) */}
      <View style={styles.mapControlsRow}>
        <TouchableOpacity
          onPress={resetMapZoom}
          activeOpacity={0.85}
          style={styles.mapControlBtn}>
          <Ionicons name="expand-outline" size={18} color="#111827" />
          <Text style={styles.mapControlText}>Overview</Text>
        </TouchableOpacity>
      </View>

      {normalizedSearch.length >= 2 && locationSearchStatus !== 'idle' && (
        <View style={styles.locationSearchMessage}>
          <Text style={styles.locationSearchMessageText}>
            {locationSearchStatus === 'searching'
              ? 'Searching Bhutan...'
              : locationSearchStatus === 'notFound'
              ? 'Location not found. Try another area.'
              : locationSearchStatus === 'error'
              ? 'Could not search now. Check your connection.'
              : mapListings.length === 0
              ? 'No listings found near this location.'
              : `${mapListings.length} nearby listing${mapListings.length === 1 ? '' : 's'}`}
          </Text>
        </View>
      )}

      {/* Preview of the selected listing. */}
      {selectedListing && (
        <View style={styles.previewCardWrapper}>
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => navigateToDetails(selectedListing.id)}
            style={styles.previewCard}>
            <Image
              source={{
                uri:
                  selectedListing.images && selectedListing.images.length > 0
                    ? selectedListing.images[0]
                    : 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
              }}
              style={styles.previewImage}
              resizeMode="cover"
            />
            <View style={styles.previewInfo}>
              <View style={styles.previewHeaderRow}>
                <View
                  style={[
                    styles.previewBadge,
                    selectedListing.category === 'Shared Room' && styles.sharedBadge,
                  ]}>
                  <Text
                    style={[
                      styles.previewBadgeText,
                      selectedListing.category === 'Shared Room' && styles.sharedBadgeText,
                    ]}>
                    {selectedListing.category === 'Full Flat' ? 'FULL FLAT' : 'ROOM AVAILABLE'}
                  </Text>
                </View>
                <Text style={styles.previewPrice}>
                  {formatNu(selectedListing.price)}
                  <Text style={styles.previewPerMo}> /mo</Text>
                </Text>
              </View>

              <Text style={styles.previewTitle} numberOfLines={1}>
                {selectedListing.title}
              </Text>
              <View style={styles.previewLocationRow}>
                <Ionicons name="location-sharp" size={13} color={DwelloColors.primary} />
                <Text style={styles.previewLocation} numberOfLines={1}>
                  {selectedListing.zoneArea} — {selectedListing.municipalRegion}
                </Text>
              </View>

              <View style={styles.viewDetailsRow}>
                <Text style={styles.viewDetailsText}>Tap to view full listing</Text>
                <Ionicons name="arrow-forward" size={13} color={DwelloColors.primary} />
              </View>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  pinWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.22,
        shadowRadius: 3,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  selectedMarkerPill: {
    backgroundColor: DwelloColors.primary,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.1 }],
  },
  markerText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
  },
  selectedMarkerText: {
    color: '#FFFFFF',
  },
  // Needle Tip pointing downwards directly to the pin coordinate
  needleTip: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
    marginTop: -1,
  },
  selectedNeedleTip: {
    borderTopColor: DwelloColors.primary,
  },
  mapControlsRow: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  mapControlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  mapControlText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  locationSearchMessage: {
    position: 'absolute',
    top: 58,
    right: 14,
    maxWidth: '75%',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  locationSearchMessageText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  previewCardWrapper: {
    position: 'absolute',
    bottom: 92,
    left: 16,
    right: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.16,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previewImage: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  previewInfo: {
    flex: 1,
    marginLeft: 12,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  previewBadge: {
    backgroundColor: DwelloColors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  previewBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: DwelloColors.primary,
  },
  sharedBadge: {
    backgroundColor: '#EEF2FF',
  },
  sharedBadgeText: {
    color: '#4338CA',
  },
  previewPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: DwelloColors.textPrimary,
  },
  previewPerMo: {
    fontSize: 10,
    fontWeight: '500',
    color: DwelloColors.textSecondary,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 3,
  },
  previewLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  previewLocation: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 3,
    flex: 1,
  },
  viewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: '600',
    color: DwelloColors.primary,
  },
});
