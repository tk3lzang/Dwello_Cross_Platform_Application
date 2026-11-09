import { BHUTAN_LOCATION_CENTROIDS } from '../constants/BhutanLocationData';
import { GeocodingService } from '../services/geocodingService';

describe('Bhutan location fallback data', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('includes map labels for all 20 dzongkhags', () => {
    const dzongkhags = new Set(
      BHUTAN_LOCATION_CENTROIDS.filter((label) => label.kind === 'district').map((label) => label.dzongkhag)
    );

    expect(dzongkhags.size).toBe(20);
  });

  test('estimates locality and dzongkhag from saved Bhutan location data', () => {
    expect(GeocodingService.getInstantEstimate(27.5496, 90.7525)).toEqual({
      locality: 'Jakar',
      cityOrDistrict: 'Bumthang',
      formattedDisplay: 'Jakar, Bumthang Dzongkhag',
    });
  });

  test('does not assign a Bhutan district to coordinates outside Bhutan', () => {
    expect(GeocodingService.getInstantEstimate(24, 90.73)).toEqual({
      locality: 'Selected Area',
      cityOrDistrict: '',
      formattedDisplay: 'Selected Area',
    });
  });

  test('uses the nearest dzongkhag when reverse geocoding is offline', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network request failed'));

    await expect(GeocodingService.reverseGeocode(27.551, 90.754)).resolves.toMatchObject({
      locality: 'Jakar',
      cityOrDistrict: 'Bumthang',
      formattedDisplay: 'Jakar, Bumthang Dzongkhag',
    });
  });
});
