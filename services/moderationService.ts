/**
 * Coordinates authenticated report, moderation, appeal, and notification operations.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import { supabase, isSupabaseConfigured } from './supabase';
import { DatabaseService } from './database';
import { showNotificationToast } from './notificationService';
import {
  AppealEligibility,
  ModerationAppeal,
  ModerationNotification,
  ModerationReport,
} from '@/types/moderation';

const USER_HIDDEN_LISTINGS_KEY = '@dwello_user_hidden_listings';
export const MIN_APPEAL_EXPLANATION_LENGTH = 5;

let userHiddenListings: Set<string> = new Set();
let hasLoadedHiddenListings = false;
let notificationChannelSequence = 0;

type ModerationListener = () => void;
const listeners: Set<ModerationListener> = new Set();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.warn('[Dwello-Moderation Warning]: Listener notification failed:', error);
    }
  });
}

function requireBackend(): void {
  if (!isSupabaseConfigured()) {
    throw new Error('Moderation requires a connection to the Dwello account service.');
  }
}

async function requireCurrentUserId(expectedUserId?: string): Promise<string> {
  requireBackend();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Please sign in to continue.');
  if (expectedUserId && expectedUserId !== userId) {
    throw new Error('Your account changed. Please try again.');
  }
  return userId;
}

function logAndRethrow(context: string, error: unknown): never {
  console.error(`[Dwello-Moderation Error]: ${context} failed:`, error);
  throw error;
}

async function refreshListingVisibility(listingId: string, isHidden: boolean): Promise<void> {
  const updated = await DatabaseService.setListingHiddenStatus(listingId, isHidden);
  if (!updated) {
    console.error('[Dwello-Moderation Error]: Local listing visibility update failed', {
      listingId,
      isHidden,
    });
  }
  await DatabaseService.refreshFromCloud();
}

function evidenceContentType(extension: string): string {
  switch (extension) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    default:
      return 'image/jpeg';
  }
}

async function loadHiddenListings(): Promise<void> {
  if (hasLoadedHiddenListings) return;
  const raw = await AsyncStorage.getItem(USER_HIDDEN_LISTINGS_KEY);
  if (raw) {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some((id) => typeof id !== 'string')) {
      throw new Error('Saved hidden-listing data is invalid.');
    }
    userHiddenListings = new Set(parsed);
  }
  hasLoadedHiddenListings = true;
}

export const ModerationService = {
  subscribe(listener: ModerationListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async initialize(): Promise<void> {
    await loadHiddenListings();
  },

  async isCurrentUserModerator(): Promise<boolean> {
    await requireCurrentUserId();
    const { data, error } = await supabase.rpc('is_dwello_moderator');
    if (error) return logAndRethrow('check moderator access', error);
    return data === true;
  },

  async submitReport(payload: {
    listingId: string;
    reason: string;
    details?: string;
  }): Promise<ModerationReport> {
    await requireCurrentUserId();
    console.info('[Dwello-Moderation]: Submitting listing report', {
      listingId: payload.listingId,
      reason: payload.reason,
    });
    const { data, error } = await supabase.rpc('submit_listing_report', {
      p_listing_id: payload.listingId,
      p_reason: payload.reason,
      p_details: payload.details || '',
    });
    if (error) return logAndRethrow('submit report', error);
    if (!data || typeof data !== 'object') {
      throw new Error('The report service returned no saved report.');
    }
    const report = data as ModerationReport;
    console.info('[Dwello-Moderation]: Report saved', { reportId: report.id, listingId: report.listing_id });
    notifyListeners();
    return report;
  },

  async hideListingForUser(listingId: string): Promise<boolean> {
    try {
      await loadHiddenListings();
      userHiddenListings.add(listingId);
      await AsyncStorage.setItem(
        USER_HIDDEN_LISTINGS_KEY,
        JSON.stringify(Array.from(userHiddenListings))
      );
      notifyListeners();
      return true;
    } catch (error) {
      console.error('[Dwello-Moderation Error]: Could not hide listing for user:', error);
      return false;
    }
  },

  async getUserHiddenListings(): Promise<string[]> {
    await loadHiddenListings();
    return Array.from(userHiddenListings);
  },

  isListingHiddenForUser(listingId: string): boolean {
    return userHiddenListings.has(listingId);
  },

  async getAllReports(): Promise<ModerationReport[]> {
    await requireCurrentUserId();
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return logAndRethrow('load reports', error);
    return (data || []) as ModerationReport[];
  },

  async dismissReport(reportId: string): Promise<void> {
    await requireCurrentUserId();
    const { data, error } = await supabase.rpc('review_listing_report', {
      p_report_id: reportId,
      p_action: 'dismiss',
    });
    if (error) return logAndRethrow('dismiss report', error);
    if (!data) throw new Error('The report dismissal was not confirmed by the server.');
    console.info('[Dwello-Moderation]: Report dismissed', { reportId });
    notifyListeners();
  },

  async flagAndHideListing(reportId: string): Promise<void> {
    await requireCurrentUserId();
    const { data, error } = await supabase.rpc('review_listing_report', {
      p_report_id: reportId,
      p_action: 'flag_hide',
    });
    if (error) return logAndRethrow('flag listing', error);
    if (!data || typeof data !== 'object') {
      throw new Error('The moderation action was not confirmed by the server.');
    }
    console.info('[Dwello-Moderation]: Listing flagged and owner notified', {
      reportId,
      listingId: data.listing_id,
      ownerId: data.owner_id,
      action: data.action,
    });
    await refreshListingVisibility(data.listing_id, true);
    notifyListeners();
  },

  async getAppealEligibility(reportId: string): Promise<AppealEligibility | null> {
    await requireCurrentUserId();
    const { data, error } = await supabase.rpc('get_appeal_eligibility', {
      p_report_id: reportId,
    });
    if (error) return logAndRethrow('check appeal eligibility', error);
    const eligibility =
      data && typeof data === 'object' ? (data as AppealEligibility) : null;
    console.info('[Dwello-Moderation]: Appeal eligibility checked', {
      reportId,
      eligible: !!eligibility,
      listingId: eligibility?.listing_id,
    });
    return eligibility;
  },

  async submitAppeal(payload: {
    reportId: string;
    appealReason: string;
    appealCategory: string;
    proofImageUri?: string;
  }): Promise<ModerationAppeal> {
    const appealReason = payload.appealReason.trim();
    if (appealReason.length < MIN_APPEAL_EXPLANATION_LENGTH) {
      throw new Error(
        `Please provide an explanation of at least ${MIN_APPEAL_EXPLANATION_LENGTH} characters.`
      );
    }

    const userId = await requireCurrentUserId();
    let uploadedEvidencePath: string | null = null;
    try {
      if (payload.proofImageUri) {
        const file = new File(payload.proofImageUri);
        const extension = file.extension.replace(/^\./, '').toLowerCase() || 'jpg';
        const allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']);
        if (!allowedExtensions.has(extension)) {
          throw new Error('Choose a JPEG, PNG, WebP, or HEIC evidence image.');
        }
        const evidencePath = `${userId}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('appeal-evidence')
          .upload(evidencePath, await file.arrayBuffer(), {
            contentType: evidenceContentType(extension),
            cacheControl: '3600',
            upsert: false,
          });
        if (uploadError) throw uploadError;
        uploadedEvidencePath = evidencePath;
      }

      const { data, error } = await supabase.rpc('submit_listing_appeal', {
        p_report_id: payload.reportId,
        p_category: payload.appealCategory,
        p_reason: appealReason,
        p_proof_image_path: uploadedEvidencePath,
      });
      if (error) throw error;
      if (!data || typeof data !== 'object') {
        throw new Error('The appeal service returned no saved appeal.');
      }
      const appeal = data as ModerationAppeal;
      if (uploadedEvidencePath && appeal.proof_image_url !== uploadedEvidencePath) {
        const { error: removeError } = await supabase.storage
          .from('appeal-evidence')
          .remove([uploadedEvidencePath]);
        if (removeError) {
          console.error('[Dwello-Moderation Error]: Failed to clean up duplicate appeal evidence:', removeError);
        }
      }
      console.info('[Dwello-Moderation]: Appeal saved', {
        appealId: appeal.id,
        reportId: appeal.report_id,
        listingId: appeal.listing_id,
      });
      notifyListeners();
      return appeal;
    } catch (error) {
      if (uploadedEvidencePath) {
        const { error: removeError } = await supabase.storage
          .from('appeal-evidence')
          .remove([uploadedEvidencePath]);
        if (removeError) {
          console.error('[Dwello-Moderation Error]: Failed to clean up unused appeal evidence:', removeError);
        }
      }
      return logAndRethrow('submit appeal', error);
    }
  },

  async getAllAppeals(): Promise<ModerationAppeal[]> {
    await requireCurrentUserId();
    const { data, error } = await supabase
      .from('appeals')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return logAndRethrow('load appeals', error);

    return Promise.all(
      ((data || []) as ModerationAppeal[]).map(async (appeal) => {
        if (!appeal.proof_image_url || /^https?:\/\//i.test(appeal.proof_image_url)) {
          return appeal;
        }
        const { data: signed, error: signedUrlError } = await supabase.storage
          .from('appeal-evidence')
          .createSignedUrl(appeal.proof_image_url, 3600);
        if (signedUrlError) return logAndRethrow('load appeal evidence', signedUrlError);
        return { ...appeal, proof_image_url: signed.signedUrl };
      })
    );
  },

  async approveAppeal(appealId: string): Promise<void> {
    await this.reviewAppeal(appealId, 'approved');
  },

  async rejectAppeal(appealId: string): Promise<void> {
    await this.reviewAppeal(appealId, 'rejected');
  },

  async reviewAppeal(appealId: string, decision: 'approved' | 'rejected'): Promise<void> {
    await requireCurrentUserId();
    const { data, error } = await supabase.rpc('review_listing_appeal', {
      p_appeal_id: appealId,
      p_decision: decision,
    });
    if (error) return logAndRethrow('review appeal', error);
    if (!data || typeof data !== 'object') {
      throw new Error('The appeal outcome was not confirmed by the server.');
    }
    await refreshListingVisibility(data.listing_id, decision === 'rejected');
    console.info('[Dwello-Moderation]: Appeal outcome saved and owner notified', {
      appealId,
      listingId: data.listing_id,
      ownerId: data.owner_id,
      decision: data.decision,
    });
    notifyListeners();
  },

  async getUserNotifications(userId?: string): Promise<ModerationNotification[]> {
    if (!userId) return [];
    await requireCurrentUserId(userId);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) return logAndRethrow('load user notifications', error);
    console.info('[Dwello-Moderation]: Notifications retrieved', { userId, count: data?.length || 0 });
    return (data || []) as ModerationNotification[];
  },

  async subscribeToUserNotifications(userId: string): Promise<() => void> {
    await requireCurrentUserId(userId);
    const channel = supabase
      .channel(`dwello-notifications-${userId}-${++notificationChannelSequence}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notification = payload.new as ModerationNotification;
          console.info('[Dwello-Moderation]: Owner notification received', {
            notificationId: notification.id,
            reportId: notification.report_id,
            appealId: notification.appeal_id,
            listingId: notification.target_id,
          });
          notifyListeners();
          showNotificationToast(
            notification.type === 'listing_flagged' || notification.type === 'listing_removed'
              ? 'warning'
              : 'info',
            notification.title,
            notification.body
          );
        }
      )
      .subscribe((status, error) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[Dwello-Moderation Error]: Notification subscription failed:', error || status);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  },

  async getUnreadCount(userId?: string): Promise<number> {
    if (!userId) return 0;
    const notifications = await this.getUserNotifications(userId);
    return notifications.filter((notification) => !notification.read).length;
  },

  async markAllNotificationsRead(userId?: string): Promise<void> {
    if (!userId) return;
    await requireCurrentUserId(userId);
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) return logAndRethrow('mark notifications read', error);
    notifyListeners();
  },

  async markNotificationRead(notificationId: string): Promise<void> {
    const userId = await requireCurrentUserId();
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', userId);
    if (error) return logAndRethrow('mark notification read', error);
    notifyListeners();
  },

  async deleteNotification(notificationId: string): Promise<void> {
    const userId = await requireCurrentUserId();
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId);
    if (error) return logAndRethrow('delete notification', error);
    notifyListeners();
  },

  clearUserData(): void {
    userHiddenListings = new Set();
    hasLoadedHiddenListings = false;
    notifyListeners();
  },
};
