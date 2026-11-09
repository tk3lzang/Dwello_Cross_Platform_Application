import AsyncStorage from '@react-native-async-storage/async-storage';
import { ModerationService } from '../services/moderationService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('user-hidden listings', () => {
  test('persists a hidden listing and notifies feed subscribers', async () => {
    const listener = jest.fn();
    const unsubscribe = ModerationService.subscribe(listener);

    await expect(ModerationService.hideListingForUser('listing-1')).resolves.toBe(true);

    expect(ModerationService.isListingHiddenForUser('listing-1')).toBe(true);
    expect(await ModerationService.getUserHiddenListings()).toContain('listing-1');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@dwello_user_hidden_listings',
      JSON.stringify(['listing-1'])
    );
    expect(listener).toHaveBeenCalled();

    unsubscribe();
  });
});
