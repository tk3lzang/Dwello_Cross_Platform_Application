jest.mock('../services/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    rpc: jest.fn(),
    from: jest.fn(),
    storage: { from: jest.fn() },
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
  isSupabaseConfigured: () => true,
}));

jest.mock('../services/database', () => ({
  DatabaseService: {
    setListingHiddenStatus: jest.fn(),
    refreshFromCloud: jest.fn(),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

import { ModerationService } from '../services/moderationService';
import { supabase } from '../services/supabase';
import { DatabaseService } from '../services/database';

const authenticatedUserId = 'c0d8c30f-d142-486b-98b7-05efae45b042';
const mockRpc = supabase.rpc as jest.Mock;
const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockFrom = supabase.from as jest.Mock;
const mockChannel = supabase.channel as jest.Mock;
const mockRemoveChannel = supabase.removeChannel as jest.Mock;
const mockSetListingHiddenStatus = DatabaseService.setListingHiddenStatus as jest.Mock;
const mockRefreshFromCloud = DatabaseService.refreshFromCloud as jest.Mock;

describe('ModerationService backend workflow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: authenticatedUserId } } },
      error: null,
    });
    mockSetListingHiddenStatus.mockResolvedValue(true);
    mockRefreshFromCloud.mockResolvedValue([]);
  });

  test('submits reports through the authenticated RPC and returns the saved report', async () => {
    const savedReport = {
      id: 'report-1',
      listing_id: 'listing-1',
      reporter_id: authenticatedUserId,
      status: 'pending',
    };
    mockRpc.mockResolvedValue({ data: savedReport, error: null });

    await expect(
      ModerationService.submitReport({
        listingId: 'listing-1',
        reason: 'Misleading Information',
        details: 'Incorrect rent shown.',
      })
    ).resolves.toEqual(savedReport);

    expect(mockRpc).toHaveBeenCalledWith('submit_listing_report', {
      p_listing_id: 'listing-1',
      p_reason: 'Misleading Information',
      p_details: 'Incorrect rent shown.',
    });
  });

  test('does not report success when the report RPC fails', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: new Error('database unavailable'),
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      ModerationService.submitReport({
        listingId: 'listing-1',
        reason: 'Misleading Information',
      })
    ).rejects.toThrow('database unavailable');
  });

  test('uses the owner resolved by the server action when updating the listing cache', async () => {
    mockRpc.mockResolvedValue({
      data: {
        listing_id: 'listing-from-report',
        owner_id: 'actual-listing-owner',
        moderation_action_id: 'action-1',
        action: 'flag_hide',
      },
      error: null,
    });

    await ModerationService.flagAndHideListing('report-1');

    expect(mockRpc).toHaveBeenCalledWith('review_listing_report', {
      p_report_id: 'report-1',
      p_action: 'flag_hide',
    });
    expect(mockSetListingHiddenStatus).toHaveBeenCalledWith('listing-from-report', true);
    expect(mockRefreshFromCloud).toHaveBeenCalledTimes(1);
  });

  test('loads notifications only for the authenticated recipient', async () => {
    const result = {
      data: [{ id: 'notification-1', user_id: authenticatedUserId }],
      error: null,
    };
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue(result),
    };
    mockFrom.mockReturnValue(query);

    await expect(
      ModerationService.getUserNotifications(authenticatedUserId)
    ).resolves.toEqual(result.data);

    expect(mockFrom).toHaveBeenCalledWith('notifications');
    expect(query.eq).toHaveBeenCalledWith('user_id', authenticatedUserId);
  });

  test('refuses to load another account notifications', async () => {
    await expect(
      ModerationService.getUserNotifications('different-account-id')
    ).rejects.toThrow('Your account changed');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('submits an appeal using the report reference without trusting a client-supplied owner ID', async () => {
    const savedAppeal = {
      id: 'appeal-1',
      report_id: 'report-1',
      listing_id: 'listing-1',
      host_id: authenticatedUserId,
      appeal_category: 'Pricing Verified',
      appeal_reason: 'The displayed price is correct.',
      status: 'pending',
    };
    mockRpc.mockResolvedValue({ data: savedAppeal, error: null });

    await expect(
      ModerationService.submitAppeal({
        reportId: 'report-1',
        appealCategory: 'Pricing Verified',
        appealReason: 'The displayed price is correct.',
      })
    ).resolves.toEqual(savedAppeal);

    expect(mockRpc).toHaveBeenCalledWith('submit_listing_appeal', {
      p_report_id: 'report-1',
      p_category: 'Pricing Verified',
      p_reason: 'The displayed price is correct.',
      p_proof_image_path: null,
    });
  });

  test('rejects short appeal explanations before contacting Supabase', async () => {
    await expect(
      ModerationService.submitAppeal({
        reportId: 'report-1',
        appealCategory: 'Other',
        appealReason: '  abc ',
      })
    ).rejects.toThrow('at least 5 characters');

    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('uses separate realtime channels for simultaneous notification subscriptions', async () => {
    const channelInstances = [
      { on: jest.fn().mockReturnThis(), subscribe: jest.fn().mockReturnThis() },
      { on: jest.fn().mockReturnThis(), subscribe: jest.fn().mockReturnThis() },
    ];
    mockChannel
      .mockReturnValueOnce(channelInstances[0])
      .mockReturnValueOnce(channelInstances[1]);

    const stopFirst = await ModerationService.subscribeToUserNotifications(authenticatedUserId);
    const stopSecond = await ModerationService.subscribeToUserNotifications(authenticatedUserId);

    expect(mockChannel).toHaveBeenCalledTimes(2);
    expect(mockChannel.mock.calls[0][0]).not.toBe(mockChannel.mock.calls[1][0]);
    channelInstances.forEach((channel) => {
      expect(channel.on).toHaveBeenCalledTimes(1);
      expect(channel.subscribe).toHaveBeenCalledTimes(1);
      expect(channel.on.mock.invocationCallOrder[0]).toBeLessThan(
        channel.subscribe.mock.invocationCallOrder[0]
      );
    });

    stopFirst();
    stopSecond();
    expect(mockRemoveChannel).toHaveBeenCalledWith(channelInstances[0]);
    expect(mockRemoveChannel).toHaveBeenCalledWith(channelInstances[1]);
  });
});
