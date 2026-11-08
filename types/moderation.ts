/**
 * Moderation, Reports, Appeals & Notification Types
 * Dwello Demo Admin & Appeal System
 */

export type ReportStatus =
  | 'pending'
  | 'dismissed'
  | 'action_taken'
  | 'under_appeal'
  | 'appeal_approved';

export type AppealStatus = 'pending' | 'approved' | 'rejected';

export type NotificationType =
  | 'report_received'
  | 'listing_flagged'
  | 'appeal_status';

export interface ModerationReport {
  id: string;
  listing_id: string;
  listing_title?: string;
  reporter_id: string;
  reporter_email?: string;
  reason: string;
  details?: string;
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
  status: AppealStatus;
  created_at: string;
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
  created_at: string;
}
