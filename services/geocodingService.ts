/**
 * Geocoding Service for Dwello Mobile
 * Provides live, debounced reverse-geocoding for listing location pin movement.
 *
 * Architecture:
 * 1. Coordinates Cache: Round coordinates to 3 decimal places (~100m) to reuse cached localities.
 * 2. High-Precision Bhutan Locality Resolver: Calculates nearest Bhutanese neighborhood (Motithang, Babesa,
 *    Changzamtog, Olakha, Chubachu, etc.) for instant zero-latency feedback and offline reliability.
 * 3. Network Reverse Geocoding: Enriches with OpenStreetMap Nominatim or Google Geocoding API when online.
 * 4. Request Cancellation & Debounce: Ensures outdated responses are discarded if the user drags the pin rapidly.
 */

import { BHUTAN_LOCATION_CENTROIDS } from '@/constants/BhutanLocationData';

export interface ReverseGeocodeResult {
  locality: string;
  cityOrDistrict: string;
  formattedDisplay: string;
  road?: string;
  fullAddress?: string;
  fromCache?: boolean;
}

export interface LocationSearchResult {
  latitude: number;
  longitude: number;
  displayName: string;
  bounds?: {
    south: number;
    north: number;
    west: number;
    east: number;
  };
}

interface HasCoordinates {
  latitude: number;
  longitude: number;
}

// Known Bhutanese zone centroids for instant proximity determination
interface ZoneCentroid {
  name: string;
  city: string;
  latitude: number;
  longitude: number;
}

const BHUTAN_LOCALITY_CENTROIDS: ZoneCentroid[] = BHUTAN_LOCATION_CENTROIDS.map((label) => ({
  name: label.name,
  city: label.dzongkhag,
  latitude: label.latitude,
  longitude: label.longitude,
}));
const BHUTAN_DZONGKHAG_CENTROIDS = BHUTAN_LOCATION_CENTROIDS.filter(
  (label) => label.kind === 'district'
);
const BHUTAN_BOUNDS = { south: 26.5, north: 28.4, west: 88.7, east: 92.2 };

function isWithinBhutan(latitude: number, longitude: number): boolean {
  return (
    latitude >= BHUTAN_BOUNDS.south &&
    latitude <= BHUTAN_BOUNDS.north &&
    longitude >= BHUTAN_BOUNDS.west &&
    longitude <= BHUTAN_BOUNDS.east
  );
}

function findNearestDzongkhag(latitude: number, longitude: number) {
  let closest = BHUTAN_DZONGKHAG_CENTROIDS[0];
  let minDistance = Infinity;

  for (const district of BHUTAN_DZONGKHAG_CENTROIDS) {
    const distance = getDistanceMeters(latitude, longitude, district.latitude, district.longitude);
    if (distance < minDistance) {
      minDistance = distance;
      closest = district;
    }
  }

  return { district: closest, distanceMeters: minDistance };
}

/**
 * Calculates Haversine distance in meters between two coordinates
 */
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Finds the nearest Bhutanese locality centroid
 */
function findNearestLocality(lat: number, lon: number): { centroid: ZoneCentroid; distanceMeters: number } {
  let closest = BHUTAN_LOCALITY_CENTROIDS[0];
  let minDistance = Infinity;

  for (const item of BHUTAN_LOCALITY_CENTROIDS) {
    const dist = getDistanceMeters(lat, lon, item.latitude, item.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      closest = item;
    }
  }

  return { centroid: closest, distanceMeters: minDistance };
}

// In-memory cache for resolved coordinates (100m grid)
const geocodeCache = new Map<string, ReverseGeocodeResult>();
const locationSearchCache = new Map<string, LocationSearchResult>();

function getCacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

export function distanceBetweenCoordinates(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
): number {
  return getDistanceMeters(latitude1, longitude1, latitude2, longitude2);
}

export function getLocationSearchRadius(result: LocationSearchResult): number {
  if (!result.bounds) return 5000;

  const { south, north, west, east } = result.bounds;
  const cornerDistances = [
    distanceBetweenCoordinates(result.latitude, result.longitude, south, west),
    distanceBetweenCoordinates(result.latitude, result.longitude, south, east),
    distanceBetweenCoordinates(result.latitude, result.longitude, north, west),
    distanceBetweenCoordinates(result.latitude, result.longitude, north, east),
  ];

  return Math.min(12000, Math.max(2500, Math.max(...cornerDistances)));
}

export function filterListingsByLocation<T extends HasCoordinates>(
  listings: T[],
  location: LocationSearchResult
): T[] {
  const radius = getLocationSearchRadius(location);
  return listings.filter(
    (listing) =>
      Number.isFinite(listing.latitude) &&
      Number.isFinite(listing.longitude) &&
      Math.abs(listing.latitude) <= 90 &&
      Math.abs(listing.longitude) <= 180 &&
      distanceBetweenCoordinates(
        location.latitude,
        location.longitude,
        listing.latitude,
        listing.longitude
      ) <= radius
  );
}

export const GeocodingService = {
  async searchLocation(
    query: string,
    options?: { signal?: AbortSignal }
  ): Promise<LocationSearchResult | null> {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.length < 2) return null;

    const cached = locationSearchCache.get(normalizedQuery);
    if (cached) return cached;

    const searchText = /\bBhutan\b/i.test(query.trim()) ? query.trim() : `${query.trim()}, Bhutan`;
    const url =
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1` +
      `&countrycodes=bt&limit=1&q=${encodeURIComponent(searchText)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DwelloApp-BhutanMobile/1.0 (contact: info@dwello.bt)',
        Accept: 'application/json',
      },
      signal: options?.signal,
    });

    if (!response.ok) {
      throw new Error(`Location search failed with status ${response.status}.`);
    }

    const results: Array<{
      lat?: string;
      lon?: string;
      display_name?: string;
      boundingbox?: string[];
      address?: { country_code?: string };
    }> = await response.json();

    const match = results[0];
    if (!match) return null;

    const latitude = Number(match.lat);
    const longitude = Number(match.lon);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180 ||
      (match.address?.country_code && match.address.country_code.toLowerCase() !== 'bt')
    ) {
      return null;
    }

    const boundingBox = match.boundingbox?.map(Number);
    const bounds =
      boundingBox?.length === 4 && boundingBox.every(Number.isFinite)
        ? {
            south: boundingBox[0],
            north: boundingBox[1],
            west: boundingBox[2],
            east: boundingBox[3],
          }
        : undefined;
    const result: LocationSearchResult = {
      latitude,
      longitude,
      displayName: match.display_name || query.trim(),
      bounds,
    };

    locationSearchCache.set(normalizedQuery, result);
    if (locationSearchCache.size > 100) {
      const oldestKey = locationSearchCache.keys().next().value;
      if (oldestKey) locationSearchCache.delete(oldestKey);
    }

    return result;
  },

  /**
   * Performs reverse-geocoding for a given latitude and longitude.
   * Returns live locality / neighborhood with zero-blocking fallback.
   */
  async reverseGeocode(
    latitude: number,
    longitude: number,
    options?: { signal?: AbortSignal }
  ): Promise<ReverseGeocodeResult> {
    const cacheKey = getCacheKey(latitude, longitude);
    const cached = geocodeCache.get(cacheKey);
    if (cached) {
      return { ...cached, fromCache: true };
    }

    // Baseline: calculate nearest local Bhutanese centroid immediately
    const withinBhutan = isWithinBhutan(latitude, longitude);
    const { centroid, distanceMeters } = findNearestLocality(latitude, longitude);
    const { district: nearestDistrict, distanceMeters: districtDistance } =
      findNearestDzongkhag(latitude, longitude);
    const nearbyDistrict =
      withinBhutan && districtDistance <= 40000 ? nearestDistrict.dzongkhag : '';

    let locality = withinBhutan && distanceMeters <= 3000 ? centroid.name : '';
    let city = withinBhutan && distanceMeters <= 3000 ? centroid.city : nearbyDistrict;
    let road = '';

    let bestLocality = withinBhutan && distanceMeters <= 3000 ? centroid.name : '';

    // Attempt online reverse-geocoding via OpenStreetMap Nominatim
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=17&addressdetails=1`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'DwelloApp-BhutanMobile/1.0 (contact: info@dwello.bt)',
          Accept: 'application/json',
        },
        signal: options?.signal,
      });

      if (response.ok) {
        const data = await response.json();
        const address = data?.address || {};

        const remoteNeighbourhood =
          address.neighbourhood ||
          address.suburb ||
          address.hamlet ||
          address.village ||
          address.city_district ||
          '';

        const remoteCity =
          address.state_district ||
          address.district ||
          address.county ||
          address.city ||
          address.town ||
          address.village ||
          address.state ||
          nearbyDistrict;

        const remoteRoad = address.road || '';

        if (remoteRoad) road = remoteRoad;

        // If OSM returned a specific English/Latin neighborhood, prioritize it
        if (remoteNeighbourhood && !/[\u0F00-\u0FFF]/.test(remoteNeighbourhood)) {
          locality = remoteNeighbourhood;
        } else if (bestLocality) {
          locality = bestLocality;
        } else if (remoteNeighbourhood) {
          locality = remoteNeighbourhood;
        }

        if (remoteCity && !/[\u0F00-\u0FFF]/.test(remoteCity)) {
          city = remoteCity.replace(/\s+Dzongkhag$/i, '');
        }
      }
    } catch {
      // Network drop or timeout: fallback to baseline Bhutan locality calculation
      if (bestLocality) {
        locality = bestLocality;
      }
    }

    // Final clean assembly
    const formattedDisplay = locality
      ? city
        ? locality === city
          ? `${city} Dzongkhag`
          : `${locality}, ${city} Dzongkhag`
        : locality
      : city
        ? `${city} Dzongkhag`
        : 'Selected Area';
    const fullAddress = road ? `${road}, ${formattedDisplay}` : formattedDisplay;

    const result: ReverseGeocodeResult = {
      locality: locality || city || 'Selected Area',
      cityOrDistrict: city,
      road: road || undefined,
      formattedDisplay,
      fullAddress,
    };

    geocodeCache.set(cacheKey, result);
    return result;
  },

  /**
   * Synchronous locality estimate for instant UI rendering during drag gestures
   */
  getInstantEstimate(latitude: number, longitude: number): ReverseGeocodeResult {
    const cacheKey = getCacheKey(latitude, longitude);
    const cached = geocodeCache.get(cacheKey);
    if (cached) return cached;

    if (!isWithinBhutan(latitude, longitude)) {
      return {
        locality: 'Selected Area',
        cityOrDistrict: '',
        formattedDisplay: 'Selected Area',
      };
    }

    const { centroid, distanceMeters } = findNearestLocality(latitude, longitude);
    if (distanceMeters <= 3000) {
      const formattedDisplay =
        centroid.name === centroid.city
          ? `${centroid.city} Dzongkhag`
          : `${centroid.name}, ${centroid.city} Dzongkhag`;
      return {
        locality: centroid.name,
        cityOrDistrict: centroid.city,
        formattedDisplay,
      };
    }

    const { district, distanceMeters: districtDistance } = findNearestDzongkhag(latitude, longitude);
    if (districtDistance <= 40000) {
      return {
        locality: district.dzongkhag,
        cityOrDistrict: district.dzongkhag,
        formattedDisplay: `${district.dzongkhag} Dzongkhag`,
      };
    }

    return {
      locality: 'Selected Area',
      cityOrDistrict: '',
      formattedDisplay: 'Selected Area',
    };
  },
};
