/**
 * Moderation, Appeals & Notification Service for Dwello Mobile
 * Section 3 & 4: Isolated Admin Moderation, Listing Flagging, and Host Appeals.
 * Zero Regression: Fully isolated additive operations with local persistence and Supabase synchronization.
 * Logging prefix: [Dwello-Moderation Error]
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { supabase, isSupabaseConfigured } from './supabase';
import { DatabaseService } from './database';
import {
  ModerationReport,
  ModerationAppeal,
  ModerationNotification,
} from '@/types/moderation';

const STORAGE_KEYS = {
  USER_HIDDEN_LISTINGS: '@dwello_user_hidden_listings',
  LOCAL_REPORTS: '@dwello_local_reports',
  LOCAL_APPEALS: '@dwello_local_appeals',
  LOCAL_NOTIFICATIONS: '@dwello_local_notifications',
};

// Seed demo reports so the Demo Admin Dashboard is immediately interactive
const SEED_REPORTS: ModerationReport[] = [
  {
    id: 'rep-demo-001',
    listing_id: 'prop-2',
    listing_title: '3BHK House for Rent',
    reporter_id: 'user-reporter-1',
    reporter_email: 'karma.dorji@cst.edu.bt',
    reason: 'Misleading Information',
    details: 'The listed rent is Nu. 25,000 but host is asking Nu. 32,000 on WhatsApp and demanding extra cash deposit.',
    status: 'pending',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'rep-demo-002',
    listing_id: 'prop-4',
    listing_title: 'Cozy Shared Room near CST Campus',
    reporter_id: 'user-reporter-2',
    reporter_email: 'sonam.pema@cst.edu.bt',
    reason: 'Already Rented',
    details: 'Visited this flat yesterday near CST; current tenant confirmed it has been occupied for two months.',
    status: 'action_taken',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
];

const SEED_APPEALS: ModerationAppeal[] = [
  {
    id: 'app-demo-001',
    report_id: 'rep-demo-002',
    listing_id: 'prop-4',
    listing_title: 'Cozy Shared Room near CST Campus',
    host_id: 'owner-tandin',
    host_name: 'Tandin Kelzang',
    appeal_category: 'Correct Ownership Proof Provided',
    appeal_reason: 'The lease with previous tenant ended last Friday. We have updated photographs and valid tenancy documents ready.',
    status: 'pending',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
];

const SEED_NOTIFICATIONS: ModerationNotification[] = [
  {
    id: 'notif-demo-001',
    user_id: 'owner-tandin',
    title: 'Listing Removal Alert',
    body: "Action Taken: Your listing 'Budget Studio Flat with Balcony' was hidden due to policy reports. Tap to view details and submit an appeal.",
    type: 'listing_flagged',
    read: false,
    target_id: 'seed-2',
    action_url: 'dwello://appeal?listingId=seed-2&reportId=rep-demo-001',
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: 'notif-demo-002',
    user_id: 'owner-tandin',
    title: 'Report Received',
    body: 'Thank you for your report #REP-001. We are reviewing it.',
    type: 'report_received',
    read: false,
    target_id: 'seed-2',
    created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
  },
  {
    id: 'notif-demo-003',
    user_id: 'owner-tandin',
    title: 'Appeal Verdict',
    body: "Appeal Update: Your appeal for 'Cozy 2BHK Upper Babesa' was approved. Your listing is active again.",
    type: 'appeal_status',
    read: true,
    target_id: 'seed-4',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
];

let inMemoryReports: ModerationReport[] = [...SEED_REPORTS];
let inMemoryAppeals: ModerationAppeal[] = [...SEED_APPEALS];
let inMemoryNotifications: ModerationNotification[] = [...SEED_NOTIFICATIONS];
let userHiddenListings: Set<string> = new Set();
let isInitialized = false;

type ModerationListener = () => void;
const listeners: Set<ModerationListener> = new Set();

function notifyListeners() {
  listeners.forEach((l) => {
    try {
      l();
    } catch (e) {
      console.warn('[Dwello-Moderation Error]: Listener notification error:', e);
    }
  });
}

export const ModerationService = {
  /**
   * Subscribe to live updates in reports, appeals, and notifications
   */
  subscribe(listener: ModerationListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /**
   * Initialize local cache and synchronize with disk/remote
   */
  async initialize(): Promise<void> {
    if (isInitialized) return;
    try {
      // 1. User hidden listings
      const hiddenRaw = await AsyncStorage.getItem(STORAGE_KEYS.USER_HIDDEN_LISTINGS);
      if (hiddenRaw) {
        userHiddenListings = new Set(JSON.parse(hiddenRaw));
      }

      // 2. Local reports
      const reportsRaw = await AsyncStorage.getItem(STORAGE_KEYS.LOCAL_REPORTS);
      if (reportsRaw) {
        inMemoryReports = JSON.parse(reportsRaw);
      } else {
        await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_REPORTS, JSON.stringify(inMemoryReports));
      }

      // 3. Local appeals
      const appealsRaw = await AsyncStorage.getItem(STORAGE_KEYS.LOCAL_APPEALS);
      if (appealsRaw) {
        inMemoryAppeals = JSON.parse(appealsRaw);
      } else {
        await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_APPEALS, JSON.stringify(inMemoryAppeals));
      }

      // 4. Local notifications
      const notifsRaw = await AsyncStorage.getItem(STORAGE_KEYS.LOCAL_NOTIFICATIONS);
      if (notifsRaw) {
        const parsed = JSON.parse(notifsRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          inMemoryNotifications = parsed;
        } else {
          await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_NOTIFICATIONS, JSON.stringify(inMemoryNotifications));
        }
      } else {
        await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_NOTIFICATIONS, JSON.stringify(inMemoryNotifications));
      }

      isInitialized = true;
      notifyListeners();
    } catch (error) {
      console.error('[Dwello-Moderation Error]: Initialization failure:', error);
    }
  },

  /**
   * Submits a report and sends "Report Received" notification to reporter
   */
  async submitReport(payload: {
    listingId: string;
    listingTitle: string;
    reporterId: string;
    reporterEmail?: string;
    reason: string;
    details?: string;
  }): Promise<ModerationReport> {
    await this.initialize();
    const newReportId = `rep-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const newReport: ModerationReport = {
      id: newReportId,
      listing_id: payload.listingId,
      listing_title: payload.listingTitle,
      reporter_id: payload.reporterId,
      reporter_email: payload.reporterEmail,
      reason: payload.reason,
      details: payload.details,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    try {
      // Add to in-memory state & disk
      inMemoryReports = [newReport, ...inMemoryReports];
      await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_REPORTS, JSON.stringify(inMemoryReports));

      // Remote Supabase insert if online
      if (isSupabaseConfigured()) {
        try {
          await supabase.from('reports').insert({
            id: newReport.id,
            listing_id: newReport.listing_id,
            reporter_id: newReport.reporter_id,
            reason: newReport.reason,
            details: newReport.details,
            status: newReport.status,
            created_at: newReport.created_at,
          });
        } catch (remoteErr) {
          console.warn('[Dwello-Moderation Error]: Remote report insert failed (offline fallback active):', remoteErr);
        }
      }

      // Generate reporter notification: Title: "Report Received"
      const shortCode = newReport.id.slice(-6).toUpperCase();
      await this.createNotification({
        userId: payload.reporterId,
        title: 'Report Received',
        body: `Thank you for helping keep Dwello safe. Report #REP-${shortCode} is under review by our moderation team.`,
        type: 'report_received',
      });

      notifyListeners();
      return newReport;
    } catch (error) {
      console.error('[Dwello-Moderation Error]: submitReport error:', error);
      return newReport;
    }
  },

  /**
   * Hides listing locally from user's personal feed
   */
  async hideListingForUser(listingId: string): Promise<void> {
    try {
      userHiddenListings.add(listingId);
      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_HIDDEN_LISTINGS,
        JSON.stringify(Array.from(userHiddenListings))
      );
      notifyListeners();
    } catch (error) {
      console.error('[Dwello-Moderation Error]: hideListingForUser error:', error);
    }
  },

  /**
   * Retrieves array of listings hidden by the user
   */
  async getUserHiddenListings(): Promise<string[]> {
    await this.initialize();
    return Array.from(userHiddenListings);
  },

  isListingHiddenForUser(listingId: string): boolean {
    return userHiddenListings.has(listingId);
  },

  /**
   * Retrieves all reports
   */
  async getAllReports(): Promise<ModerationReport[]> {
    await this.initialize();
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('reports')
          .select('*')
          .order('created_at', { ascending: false });
        if (data && !error && data.length > 0) {
          // Merge with memory
          const remoteIds = new Set(data.map((d) => d.id));
          const localOnly = inMemoryReports.filter((r) => !remoteIds.has(r.id));
          inMemoryReports = [...data, ...localOnly];
        }
      } catch (e) {
        console.warn('[Dwello-Moderation Error]: Remote report fetch failed, using local:', e);
      }
    }
    return [...inMemoryReports];
  },

  /**
   * Dismisses a report
   */
  async dismissReport(reportId: string): Promise<void> {
    await this.initialize();
    try {
      inMemoryReports = inMemoryReports.map((r) =>
        r.id === reportId ? { ...r, status: 'dismissed' } : r
      );
      await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_REPORTS, JSON.stringify(inMemoryReports));

      if (isSupabaseConfigured()) {
        try {
          await supabase.from('reports').update({ status: 'dismissed' }).eq('id', reportId);
        } catch (e) {
          console.warn('[Dwello-Moderation Error]: Supabase report dismiss failed:', e);
        }
      }
      notifyListeners();
    } catch (error) {
      console.error('[Dwello-Moderation Error]: dismissReport error:', error);
    }
  },

  /**
   * Admin action: Flag & Hide Listing
   * Updates report status to 'action_taken', sets listings.is_hidden = true, notifies host.
   */
  async flagAndHideListing(
    reportId: string,
    listingId: string,
    hostId: string,
    listingTitle: string = 'Listing'
  ): Promise<void> {
    await this.initialize();
    try {
      // 1. Update report
      inMemoryReports = inMemoryReports.map((r) =>
        r.id === reportId ? { ...r, status: 'action_taken' } : r
      );
      await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_REPORTS, JSON.stringify(inMemoryReports));

      // 2. Hide listing in DatabaseService
      await DatabaseService.setListingHiddenStatus(listingId, true);

      // 3. Supabase update if online
      if (isSupabaseConfigured()) {
        try {
          await supabase.from('reports').update({ status: 'action_taken' }).eq('id', reportId);
          await supabase.from('listings').update({ is_hidden: true }).eq('id', listingId);
        } catch (e) {
          console.warn('[Dwello-Moderation Error]: Remote flagAndHideListing failed:', e);
        }
      }

      // 4. Generate Host notification:
      // Title: "Listing Removal Alert"
      // Body: "Action Taken: Your listing '[Title]' was hidden due to policy reports. Tap to view details and submit an appeal."
      await this.createNotification({
        userId: hostId,
        title: 'Listing Removal Alert',
        body: `Action Taken: Your listing '${listingTitle}' was hidden due to policy reports. Tap to view details and submit an appeal.`,
        type: 'listing_flagged',
        targetId: listingId,
        actionUrl: `dwello://appeal?listingId=${listingId}&reportId=${reportId}`,
      });

      notifyListeners();
    } catch (error) {
      console.error('[Dwello-Moderation Error]: flagAndHideListing error:', error);
    }
  },

  /**
   * Host submits an appeal for a hidden listing
   */
  async submitAppeal(payload: {
    reportId: string;
    listingId: string;
    hostId: string;
    hostName?: string;
    appealReason: string;
    listingTitle?: string;
    appealCategory?: string;
    proofImageUrl?: string;
  }): Promise<ModerationAppeal> {
    await this.initialize();
    const newAppealId = `app-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const newAppeal: ModerationAppeal = {
      id: newAppealId,
      report_id: payload.reportId,
      listing_id: payload.listingId,
      listing_title: payload.listingTitle,
      host_id: payload.hostId,
      host_name: payload.hostName,
      appeal_category: payload.appealCategory || 'General Appeal',
      appeal_reason: payload.appealReason,
      proof_image_url: payload.proofImageUrl,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    try {
      inMemoryAppeals = [newAppeal, ...inMemoryAppeals];
      await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_APPEALS, JSON.stringify(inMemoryAppeals));

      // Update report status to 'under_appeal'
      inMemoryReports = inMemoryReports.map((r) =>
        r.id === payload.reportId || r.listing_id === payload.listingId
          ? { ...r, status: 'under_appeal' }
          : r
      );
      await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_REPORTS, JSON.stringify(inMemoryReports));

      // Supabase remote updates
      if (isSupabaseConfigured()) {
        try {
          await supabase.from('appeals').insert({
            id: newAppeal.id,
            report_id: newAppeal.report_id,
            listing_id: newAppeal.listing_id,
            host_id: newAppeal.host_id,
            appeal_reason: newAppeal.appeal_reason,
            appeal_category: newAppeal.appeal_category,
            proof_image_url: newAppeal.proof_image_url,
            status: newAppeal.status,
            created_at: newAppeal.created_at,
          });
          await supabase
            .from('reports')
            .update({ status: 'under_appeal' })
            .eq('id', payload.reportId);
        } catch (e) {
          console.warn('[Dwello-Moderation Error]: Supabase appeal insert failed:', e);
        }
      }

      // Notify Host: Confirmation (Module 3)
      // "Appeal #APP-[ID] submitted successfully. Our admin team will review your submission."
      const shortCode = newAppeal.id.slice(-6).toUpperCase();
      await this.createNotification({
        userId: payload.hostId,
        title: 'Appeal Submitted',
        body: `Appeal #APP-${shortCode} submitted successfully. Our admin team will review your submission.`,
        type: 'appeal_status',
        targetId: payload.listingId,
      });

      notifyListeners();
      return newAppeal;
    } catch (error) {
      console.error('[Dwello-Moderation Error]: submitAppeal error:', error);
      return newAppeal;
    }
  },

  /**
   * Retrieves all appeals
   */
  async getAllAppeals(): Promise<ModerationAppeal[]> {
    await this.initialize();
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('appeals')
          .select('*')
          .order('created_at', { ascending: false });
        if (data && !error && data.length > 0) {
          const remoteIds = new Set(data.map((d) => d.id));
          const localOnly = inMemoryAppeals.filter((a) => !remoteIds.has(a.id));
          inMemoryAppeals = [...data, ...localOnly];
        }
      } catch (e) {
        console.warn('[Dwello-Moderation Error]: Remote appeal fetch failed, using local:', e);
      }
    }
    return [...inMemoryAppeals];
  },

  /**
   * Admin approves an appeal
   * Sets listings.is_hidden = false, appeal status = 'approved', notifies host.
   */
  async approveAppeal(
    appealId: string,
    listingId: string,
    hostId: string,
    listingTitle?: string
  ): Promise<void> {
    await this.initialize();
    try {
      // 1. Update appeal
      inMemoryAppeals = inMemoryAppeals.map((a) =>
        a.id === appealId ? { ...a, status: 'approved' } : a
      );
      await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_APPEALS, JSON.stringify(inMemoryAppeals));

      // 2. Update report
      inMemoryReports = inMemoryReports.map((r) =>
        r.listing_id === listingId ? { ...r, status: 'appeal_approved' } : r
      );
      await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_REPORTS, JSON.stringify(inMemoryReports));

      // 3. Restore listing visibility
      await DatabaseService.setListingHiddenStatus(listingId, false);

      // 4. Supabase update
      if (isSupabaseConfigured()) {
        try {
          await supabase.from('appeals').update({ status: 'approved' }).eq('id', appealId);
          await supabase.from('listings').update({ is_hidden: false }).eq('id', listingId);
        } catch (e) {
          console.warn('[Dwello-Moderation Error]: Remote approveAppeal failed:', e);
        }
      }

      // 5. Host notification (Module 2):
      // "Appeal Update: Your appeal for '[Title]' was approved."
      await this.createNotification({
        userId: hostId,
        title: 'Appeal Verdict',
        body: `Appeal Update: Your appeal for '${listingTitle || 'your listing'}' was approved. Your listing is active again.`,
        type: 'appeal_status',
        targetId: listingId,
      });

      notifyListeners();
    } catch (error) {
      console.error('[Dwello-Moderation Error]: approveAppeal error:', error);
    }
  },

  /**
   * Admin rejects an appeal
   * Updates appeal status to 'rejected', notifies host.
   */
  async rejectAppeal(
    appealId: string,
    hostId: string,
    listingTitle?: string,
    listingId?: string
  ): Promise<void> {
    await this.initialize();
    try {
      const appealItem = inMemoryAppeals.find((a) => a.id === appealId);
      const targetListingId = listingId || appealItem?.listing_id;

      inMemoryAppeals = inMemoryAppeals.map((a) =>
        a.id === appealId ? { ...a, status: 'rejected' } : a
      );
      await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_APPEALS, JSON.stringify(inMemoryAppeals));

      if (isSupabaseConfigured()) {
        try {
          await supabase.from('appeals').update({ status: 'rejected' }).eq('id', appealId);
        } catch (e) {
          console.warn('[Dwello-Moderation Error]: Remote rejectAppeal failed:', e);
        }
      }

      // Host notification (Module 2):
      // "Appeal Update: Your appeal for '[Title]' was rejected."
      await this.createNotification({
        userId: hostId,
        title: 'Appeal Verdict',
        body: `Appeal Update: Your appeal for '${listingTitle || 'your listing'}' was rejected.`,
        type: 'appeal_status',
        targetId: targetListingId,
      });

      notifyListeners();
    } catch (error) {
      console.error('[Dwello-Moderation Error]: rejectAppeal error:', error);
    }
  },

  /**
   * Creates a notification for a user
   */
  async createNotification(payload: {
    userId: string;
    title: string;
    body: string;
    type: ModerationNotification['type'];
    targetId?: string;
    actionUrl?: string;
  }): Promise<ModerationNotification> {
    const notif: ModerationNotification = {
      id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      user_id: payload.userId,
      title: payload.title,
      body: payload.body,
      type: payload.type,
      read: false,
      target_id: payload.targetId,
      action_url: payload.actionUrl,
      created_at: new Date().toISOString(),
    };

    try {
      inMemoryNotifications = [notif, ...inMemoryNotifications];
      await AsyncStorage.setItem(
        STORAGE_KEYS.LOCAL_NOTIFICATIONS,
        JSON.stringify(inMemoryNotifications)
      );

      if (isSupabaseConfigured()) {
        try {
          await supabase.from('notifications').insert({
            id: notif.id,
            user_id: notif.user_id,
            title: notif.title,
            body: notif.body,
            type: notif.type,
            read: notif.read,
            target_id: notif.target_id,
            action_url: notif.action_url,
            created_at: notif.created_at,
          });
        } catch (e) {
          console.warn('[Dwello-Moderation Error]: Remote notification insert failed:', e);
        }
      }

      // True background/local push notification trigger via expo-notifications
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: notif.title,
            body: notif.body,
            sound: true,
            data: {
              id: notif.id,
              type: notif.type,
              listingId: notif.target_id,
              targetId: notif.target_id,
              actionUrl: notif.action_url,
              isRemovalAlert:
                notif.type === 'listing_flagged' ||
                notif.title.toLowerCase().includes('removal') ||
                notif.title.toLowerCase().includes('action taken'),
              openAppeal:
                notif.type === 'listing_flagged' ||
                notif.title.toLowerCase().includes('removal'),
            },
          },
          trigger: null, // immediate delivery to system tray
        });
      } catch (pushErr) {
        console.warn('[Dwello-Notifications]: Push trigger warning:', pushErr);
      }

      notifyListeners();
      return notif;
    } catch (error) {
      console.error('[Dwello-Moderation Error]: createNotification error:', error);
      return notif;
    }
  },

  /**
   * Retrieves notifications for a specific user
   */
  async getUserNotifications(userId?: string): Promise<ModerationNotification[]> {
    await this.initialize();
    if (!userId) {
      return [...inMemoryNotifications];
    }
    return inMemoryNotifications.filter(
      (n) => n.user_id === userId || n.user_id === 'all' || n.user_id === 'owner-tandin'
    );
  },

  /**
   * Gets unread notification count
   */
  async getUnreadCount(userId?: string): Promise<number> {
    const list = await this.getUserNotifications(userId);
    return list.filter((n) => !n.read).length;
  },

  /**
   * Marks all notifications as read for a user
   */
  async markAllNotificationsRead(userId?: string): Promise<void> {
    try {
      inMemoryNotifications = inMemoryNotifications.map((n) => {
        if (!userId || n.user_id === userId || n.user_id === 'all' || n.user_id === 'owner-tandin') {
          return { ...n, read: true };
        }
        return n;
      });
      await AsyncStorage.setItem(
        STORAGE_KEYS.LOCAL_NOTIFICATIONS,
        JSON.stringify(inMemoryNotifications)
      );

      if (isSupabaseConfigured()) {
        try {
          if (userId) {
            await supabase.from('notifications').update({ read: true }).eq('user_id', userId);
          } else {
            await supabase.from('notifications').update({ read: true });
          }
        } catch (e) {
          console.warn('[Dwello-Moderation Error]: Supabase mark all read error:', e);
        }
      }

      notifyListeners();
    } catch (error) {
      console.error('[Dwello-Moderation Error]: markAllNotificationsRead error:', error);
    }
  },

  /**
   * Marks a notification as read
   */
  async markNotificationRead(notificationId: string): Promise<void> {
    try {
      inMemoryNotifications = inMemoryNotifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      );
      await AsyncStorage.setItem(
        STORAGE_KEYS.LOCAL_NOTIFICATIONS,
        JSON.stringify(inMemoryNotifications)
      );
      notifyListeners();
    } catch (error) {
      console.error('[Dwello-Moderation Error]: markNotificationRead error:', error);
    }
  },

  /**
   * Deletes / dismisses a notification permanently
   */
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      inMemoryNotifications = inMemoryNotifications.filter((n) => n.id !== notificationId);
      await AsyncStorage.setItem(
        STORAGE_KEYS.LOCAL_NOTIFICATIONS,
        JSON.stringify(inMemoryNotifications)
      );

      if (isSupabaseConfigured()) {
        try {
          await supabase.from('notifications').delete().eq('id', notificationId);
        } catch (e) {
          console.warn('[Dwello-Moderation Error]: Supabase delete notification error:', e);
        }
      }

      notifyListeners();
    } catch (error) {
      console.error('[Dwello-Moderation Error]: deleteNotification error:', error);
    }
  },

  /**
   * Toggles notification read status
   */
  async toggleNotificationRead(notificationId: string): Promise<void> {
    try {
      inMemoryNotifications = inMemoryNotifications.map((n) =>
        n.id === notificationId ? { ...n, read: !n.read } : n
      );
      await AsyncStorage.setItem(
        STORAGE_KEYS.LOCAL_NOTIFICATIONS,
        JSON.stringify(inMemoryNotifications)
      );
      notifyListeners();
    } catch (error) {
      console.error('[Dwello-Moderation Error]: toggleNotificationRead error:', error);
    }
  },
};
