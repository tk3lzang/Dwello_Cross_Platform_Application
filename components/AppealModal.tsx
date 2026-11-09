/**
 * Modal for hosts to submit an appeal for a moderated listing.
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
import {
  MIN_APPEAL_EXPLANATION_LENGTH,
  ModerationService,
} from '@/services/moderationService';
import { useDebug } from '@/context/DebugContext';
import { DebugBanner } from './DebugBanner';

interface AppealModalProps {
  visible: boolean;
  onClose: () => void;
  listingId: string;
  listingTitle: string;
  reportId: string;
  onAppealSubmitted?: () => void;
}

export function AppealModal({
  visible,
  onClose,
  listingId,
  listingTitle,
  reportId,
  onAppealSubmitted,
}: AppealModalProps) {
  const { showDebugBanner } = useDebug();
  const [appealReason, setAppealReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    setAppealReason('');
    onClose();
  };

  const handleSubmit = async () => {
    const trimmedReason = appealReason.trim();
    if (trimmedReason.length < MIN_APPEAL_EXPLANATION_LENGTH) {
      showDebugBanner(
        'warning',
        'Explanation Required',
        `Please provide at least ${MIN_APPEAL_EXPLANATION_LENGTH} characters explaining why your listing is accurate and compliant.`
      );
      return;
    }

    setIsSubmitting(true);
    console.log('[Dwello-Moderation Debug]: Host submitting appeal for listing:', listingId);
    try {
      await ModerationService.submitAppeal({
        reportId,
        appealReason: trimmedReason,
        appealCategory: 'Other',
      });

      showDebugBanner(
        'success',
        'Appeal Submitted',
        'Your appeal has been routed to our moderation team for review.'
      );

      setAppealReason('');
      onAppealSubmitted?.();
      onClose();
    } catch (error: any) {
      console.error('[Dwello-Moderation Error]: Appeal submission failed:', error);
      showDebugBanner('error', 'Appeal Failed', error.message || 'Unable to submit appeal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        {/* Toast Portal overlay inside native Modal */}
        <View pointerEvents="box-none" style={styles.modalToastContainer}>
          <DebugBanner insideModal />
        </View>

        <View style={styles.modalCard}>
          <View style={styles.header}>
            <View style={styles.iconTitleRow}>
              <View style={styles.iconBadge}>
                <Ionicons name="shield-half" size={20} color="#D97706" />
              </View>
              <Text style={styles.title}>Submit Appeal</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#4B5563" />
            </TouchableOpacity>
          </View>

          <Text style={styles.listingTarget} numberOfLines={1}>
            Listing: {listingTitle}
          </Text>

          <Text style={styles.subtitle}>
            Provide details, explanation, or counter-evidence to verify this property and restore public marketplace visibility.
          </Text>

          <Text style={styles.sectionLabel}>Appeal Justification</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Explain why this listing is accurate, available, and compliant with community standards..."
            placeholderTextColor="#9CA3AF"
            value={appealReason}
            onChangeText={setAppealReason}
            multiline
            numberOfLines={4}
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
                <Text style={styles.submitBtnText}>Submit for Review</Text>
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
    marginBottom: 8,
  },
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  closeBtn: {
    padding: 4,
  },
  listingTarget: {
    fontSize: 13,
    fontWeight: '700',
    color: DwelloColors.primary,
    marginBottom: 6,
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
  notesInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#111827',
    textAlignVertical: 'top',
    height: 95,
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
    flex: 1.3,
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
