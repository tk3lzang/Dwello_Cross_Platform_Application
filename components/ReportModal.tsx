/**
 * Modal for reporting inaccurate, unavailable, or misleading listings.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DwelloColors } from '@/constants/Colors';
import { ModerationService } from '@/services/moderationService';
import { useAuth } from '@/context/AuthContext';
import { useDebug } from '@/context/DebugContext';
import { DebugBanner } from './DebugBanner';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  listingId: string;
}

const REASONS: ('Already Rented' | 'Misleading Information' | 'Wrong Price or Location' | 'Inappropriate Content' | 'Scam / Fraud')[] = [
  'Already Rented',
  'Misleading Information',
  'Wrong Price or Location',
  'Inappropriate Content',
  'Scam / Fraud',
];

export function ReportModal({
  visible,
  onClose,
  listingId,
}: ReportModalProps) {
  const { user } = useAuth();
  const [selectedReason, setSelectedReason] = useState<typeof REASONS[number]>('Already Rented');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedReportId, setSubmittedReportId] = useState<string | null>(null);
  const [isListingHiddenLocally, setIsListingHiddenLocally] = useState<boolean>(false);
  const { showDebugBanner } = useDebug();

  const handleClose = () => {
    setSubmittedReportId(null);
    setNotes('');
    setIsListingHiddenLocally(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      showDebugBanner('warning', 'Sign In Required', 'Please sign in before reporting a listing.');
      return;
    }

    setIsSubmitting(true);
    console.log('[Dwello-Moderation Debug]: Submitting report for listing:', listingId, selectedReason);
    try {
      const report = await ModerationService.submitReport({
        listingId,
        reason: selectedReason,
        details: notes.trim(),
      });

      const repCode = report.id.slice(-6).toUpperCase();
      showDebugBanner(
        'success',
        'Report Received',
        `Thank you for helping keep Dwello safe. Report #REP-${repCode} is under review.`
      );

      // Transition modal UI to clean success state
      setSubmittedReportId(report.id);
    } catch (error: any) {
      console.error('[Dwello-Moderation Error]: Error submitting listing report:', error);
      showDebugBanner('error', 'Report Failed', error.message || 'Unable to submit report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleHideFromFeed = async () => {
    if (isListingHiddenLocally) return;

    try {
      const hidden = await ModerationService.hideListingForUser(listingId);
      if (!hidden) {
        showDebugBanner('error', 'Update Failed', 'Could not hide this listing. Please try again.');
        return;
      }

      setIsListingHiddenLocally(true);
      showDebugBanner('info', 'Feed Updated', 'Listing will be hidden from your feed.');
    } catch (error) {
      console.error('[Dwello-Moderation Error]: Could not hide listing from feed:', error);
      showDebugBanner('error', 'Update Failed', 'Could not hide this listing. Please try again.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Toast Portal overlay inside native Modal to appear above modal dialog content */}
        <View pointerEvents="box-none" style={styles.modalToastContainer}>
          <DebugBanner insideModal />
        </View>

        <View style={styles.modalCard}>
          {submittedReportId ? (
            /* Confirmation state after report submission. */
            <View style={styles.successContainer}>
              <View style={styles.successIconCircle}>
                <Ionicons name="checkmark-circle" size={54} color={DwelloColors.success} />
              </View>

              <Text style={styles.successTitle}>Report Received</Text>
              <Text style={styles.successSubtitle}>
                Thank you for helping keep Dwello safe. Report{' '}
                <Text style={{ fontWeight: '700', color: '#111827' }}>
                  #REP-{submittedReportId.slice(-6).toUpperCase()}
                </Text>{' '}
                is under review by our moderation team.
              </Text>

              {/* Non-intrusive option: Hide listing from my feed */}
              <TouchableOpacity
                onPress={toggleHideFromFeed}
                activeOpacity={0.75}
                style={styles.hideFeedOption}>
                <Ionicons
                  name={isListingHiddenLocally ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={isListingHiddenLocally ? DwelloColors.primary : '#6B7280'}
                />
                <Text style={styles.hideFeedOptionText}>
                  Hide this listing from my feed
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleClose}
                activeOpacity={0.85}
                style={styles.doneBtn}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Report Form */
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Report Listing</Text>
                <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={22} color="#4B5563" />
                </TouchableOpacity>
              </View>

              <Text style={styles.subtitle}>
                Help maintain reliable rentals in Bhutan by reporting inaccurate or problematic listings.
              </Text>

              <Text style={styles.sectionLabel}>Select Reason</Text>
              <View style={styles.reasonsList}>
                {REASONS.map((reason) => {
                  const active = selectedReason === reason;
                  return (
                    <TouchableOpacity
                      key={reason}
                      onPress={() => setSelectedReason(reason)}
                      style={[styles.reasonRow, active && styles.activeReasonRow]}>
                      <Ionicons
                        name={active ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={active ? DwelloColors.primary : '#9CA3AF'}
                      />
                      <Text style={[styles.reasonText, active && styles.activeReasonText]}>
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionLabel}>Additional Notes (Optional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Provide any additional context for the review team..."
                placeholderTextColor="#9CA3AF"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />

              <View style={styles.buttonRow}>
                <TouchableOpacity onPress={handleClose} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  style={styles.submitBtn}>
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>Submit Report</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalToastContainer: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 99999,
    elevation: 9999,
    pointerEvents: 'box-none',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    width: '100%',
    maxWidth: 440,
    padding: 22,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  closeBtn: {
    padding: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  reasonsList: {
    marginBottom: 14,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4,
  },
  activeReasonRow: {
    backgroundColor: DwelloColors.primaryLight,
  },
  reasonText: {
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 10,
  },
  activeReasonText: {
    color: DwelloColors.primary,
    fontWeight: '600',
  },
  notesInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: '#111827',
    textAlignVertical: 'top',
    height: 72,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 1,
    backgroundColor: DwelloColors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  successIconCircle: {
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  hideFeedOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: '100%',
    marginBottom: 20,
  },
  hideFeedOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 10,
  },
  doneBtn: {
    backgroundColor: DwelloColors.primary,
    paddingVertical: 13,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
