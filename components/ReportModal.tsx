/**
 * Report Listing Moderation Modal
 * Allows flagging inaccurate, unavailable, or misleading listings as specified in Project II.
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
import { DatabaseService } from '@/services/database';
import { useDebug } from '@/context/DebugContext';
import { DebugBanner } from './DebugBanner';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  listingId: string;
  listingTitle: string;
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
  listingTitle,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<typeof REASONS[number]>('Already Rented');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showDebugBanner } = useDebug();

  const handleSubmit = async () => {
    setIsSubmitting(true);
    console.log('[Dwello-Moderation Debug]: Submitting report for listing:', listingId, selectedReason);
    try {
      await DatabaseService.reportListing({
        listingId,
        listingTitle,
        reason: selectedReason,
        notes: notes.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      showDebugBanner(
        'success',
        'Report Submitted for Review',
        'Status: Pending. Our moderation team has been notified and will action this report.'
      );
      setNotes('');
      onClose();
    } catch (error: any) {
      console.error('[Dwello-Moderation Debug]: Error submitting listing report:', error);
      showDebugBanner('error', 'Report Failed', error.message || 'Unable to submit report.');
    } finally {
      setIsSubmitting(false);
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
          <View style={styles.header}>
            <Text style={styles.title}>Report Listing</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
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
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
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
});

