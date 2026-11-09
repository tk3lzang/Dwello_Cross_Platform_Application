/**
 * Moderation, Reports, Appeals & Notification Types
 * Dwello Demo Admin & Appeal System
 */

export type ReportStatus =
  | 'pending'
  | 'dismissed'
  | 'action_taken'
  | 'under_appeal'
  | 'appeal_approved'
  | 'appeal_rejected';

export type AppealStatus = 'pending' | 'approved' | 'rejected';

export type NotificationType =
  | 'report_received'
  | 'listing_flagged'
  | 'listing_removed'
  | 'appeal_status'
  | 'appeal_approved';

export interface ModerationReport {
  id: string;
  listing_id: string;
  listing_title?: string;
  reporter_id: string;
  reporter_email?: string;
  reason: string;
  details?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  status: ReportStatus;
  created_at: string;
}

export interface ModerationAppeal {
  id: string;
  report_id: string;
  listing_id: string;
  listing_title?: string;
  host_id: string;
  host_name?: string;
  appeal_category?: string;
  appeal_reason: string;
  proof_image_url?: string;
  admin_notes?: string;
  moderation_action_id?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  status: AppealStatus;
  created_at: string;
}

export interface AppealEligibility {
  report_id: string;
  listing_id: string;
  listing_title: string;
  moderation_action_id: string;
  eligible: true;
}

export interface ModerationNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: NotificationType;
  read: boolean;
  target_id?: string;
  action_url?: string;
  report_id?: string;
  appeal_id?: string;
  moderation_action_id?: string;
  created_at: string;
}
