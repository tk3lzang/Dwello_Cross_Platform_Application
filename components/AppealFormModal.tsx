/**
 * AppealFormModal Component
 * Section 3: Formal Host Appeal Submission Workflow for Flagged / Hidden Listings.
 * Allows hosts to select an appeal reason, provide detailed justification,
 * and attach supporting photographic / document proof.
 * Logging prefix: [Dwello-Moderation Error]
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { DwelloColors } from '@/constants/Colors';
import { ModerationService } from '@/services/moderationService';
import { useDebug } from '@/context/DebugContext';
import { useAuth } from '@/context/AuthContext';
import { DebugBanner } from './DebugBanner';
import { ensureMediaLibraryPermission } from '@/utils/permissions';

export interface AppealFormModalProps {
  visible: boolean;
  onClose: () => void;
  listingId: string;
  listingTitle: string;
  reportId?: string;
  removalTimestamp?: string;
  onAppealSubmitted?: () => void;
}

const APPEAL_REASONS = [
  'False Spam Report',
  'Correct Ownership Proof Provided',
  'Pricing Verified',
  'Other',
];

export function AppealFormModal({
  visible,
  onClose,
  listingId,
  listingTitle,
  reportId = 'rep-appeal-default',
  removalTimestamp,
  onAppealSubmitted,
}: AppealFormModalProps) {
  const { user } = useAuth();
  const { showDebugBanner } = useDebug();

  const [selectedReason, setSelectedReason] = useState<string>(APPEAL_REASONS[0]);
  const [justification, setJustification] = useState<string>('');
  const [proofImageUri, setProofImageUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isPickingImage, setIsPickingImage] = useState<boolean>(false);

  const resetForm = () => {
    setSelectedReason(APPEAL_REASONS[0]);
    setJustification('');
    setProofImageUri(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handlePickProofImage = async () => {
    try {
      const hasPermission = await ensureMediaLibraryPermission();
      if (!hasPermission) {
        showDebugBanner('warning', 'Permission Required', 'Media library access is needed to upload proof.');
        return;
      }

      setIsPickingImage(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setProofImageUri(result.assets[0].uri);
        showDebugBanner('info', 'Document Attached', 'Supporting document ready for appeal submission.');
      }
    } catch (error) {
      console.error('[Dwello-Moderation Error]: Failed to pick proof image:', error);
      showDebugBanner('error', 'Upload Error', 'Could not access image library.');
    } finally {
      setIsPickingImage(false);
    }
  };

  const handleSubmit = async () => {
    if (!justification.trim()) {
      showDebugBanner(
        'warning',
        'Justification Required',
        'Please explain why the policy report or flag is inaccurate.'
      );
      return;
    }

    setIsSubmitting(true);
    console.log('[Dwello-Moderation Debug]: Submitting host appeal for listing:', listingId, 'Reason:', selectedReason);

    try {
      const appeal = await ModerationService.submitAppeal({
        reportId,
        listingId,
        hostId: user?.id || 'owner-tandin',
        hostName: user?.fullName || 'Tandin Kelzang',
        appealCategory: selectedReason,
        appealReason: justification.trim(),
        listingTitle,
        proofImageUrl: proofImageUri || undefined,
      });

      const shortId = appeal.id.slice(-6).toUpperCase();
      showDebugBanner(
        'success',
        'Appeal Submitted',
        `Appeal #APP-${shortId} submitted successfully. Our admin team will review your submission.`
      );

      resetForm();
      onAppealSubmitted?.();
      onClose();
    } catch (error: any) {
      console.error('[Dwello-Moderation Error]: Appeal submission failed:', error);
      showDebugBanner('error', 'Appeal Failed', error.message || 'Unable to submit appeal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedTime = removalTimestamp
    ? new Date(removalTimestamp).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Recently';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        {/* Toast Portal overlay inside native Modal */}
        <View pointerEvents="box-none" style={styles.modalToastContainer}>
          <DebugBanner insideModal />
        </View>

        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconTitleRow}>
              <View style={styles.iconBadge}>
                <Ionicons name="shield-half" size={20} color="#D97706" />
              </View>
              <Text style={styles.title}>Submit Listing Appeal</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color="#4B5563" />
            </TouchableOpacity>
          </View>

          {/* Removal Info Banner */}
          <View style={styles.removalBanner}>
            <View style={styles.removalDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.removalTitle} numberOfLines={1}>
                {listingTitle || 'Reported Property Listing'}
              </Text>
              <Text style={styles.removalSubtitle}>
                Flagged & Hidden • Action Taken {formattedTime}
              </Text>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.scrollBody}
            contentContainerStyle={styles.scrollContent}>
            {/* Reason Selection */}
            <Text style={styles.sectionLabel}>Reason for Appeal</Text>
            <View style={styles.reasonsContainer}>
              {APPEAL_REASONS.map((reason) => {
                const isSelected = selectedReason === reason;
                return (
                  <TouchableOpacity
                    key={reason}
                    style={[styles.reasonChip, isSelected && styles.reasonChipSelected]}
                    onPress={() => setSelectedReason(reason)}
                    activeOpacity={0.75}>
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={16}
                      color={isSelected ? '#B45309' : '#9CA3AF'}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={[styles.reasonChipText, isSelected && styles.reasonChipTextSelected]}>
                      {reason}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Detailed Justification */}
            <Text style={styles.sectionLabel}>Detailed Justification</Text>
            <TextInput
              style={styles.justificationInput}
              placeholder="State why this listing is compliant with community standards, provide accurate tenancy information, or clarify details..."
              placeholderTextColor="#9CA3AF"
              value={justification}
              onChangeText={setJustification}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {/* Supporting Proof Upload */}
            <Text style={styles.sectionLabel}>Supporting Proof / Documents (Optional)</Text>
            <Text style={styles.proofSubtitle}>
              Attach a utility bill, tenancy agreement, or photos demonstrating property availability.
            </Text>

            {proofImageUri ? (
              <View style={styles.proofPreviewContainer}>
                <Image source={{ uri: proofImageUri }} style={styles.proofThumbnail} />
                <View style={styles.proofDetails}>
                  <View style={styles.proofBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#059669" style={{ marginRight: 4 }} />
                    <Text style={styles.proofBadgeText}>Image Attached</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setProofImageUri(null)}
                    style={styles.removeProofBtn}
                    activeOpacity={0.7}>
                    <Ionicons name="trash-outline" size={14} color="#DC2626" style={{ marginRight: 4 }} />
                    <Text style={styles.removeProofText}>Remove Image</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.uploadBtn}
                onPress={handlePickProofImage}
                disabled={isPickingImage}
                activeOpacity={0.8}>
                {isPickingImage ? (
                  <ActivityIndicator size="small" color="#4B5563" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={20} color="#4B5563" style={{ marginRight: 8 }} />
                    <Text style={styles.uploadBtnText}>Upload Photo or Screenshot</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleClose}
              disabled={isSubmitting}
              style={styles.cancelBtn}
              activeOpacity={0.75}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={[styles.submitBtn, isSubmitting && styles.btnDisabled]}
              activeOpacity={0.85}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.submitBtnText}>Submit Appeal</Text>
                </>
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
    padding: 16,
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
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
  removalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  removalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
    marginRight: 10,
  },
  removalTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
  },
  removalSubtitle: {
    fontSize: 11,
    color: '#B91C1C',
    marginTop: 2,
  },
  scrollBody: {
    maxHeight: 380,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginTop: 10,
    marginBottom: 6,
  },
  reasonsContainer: {
    gap: 8,
    marginBottom: 12,
  },
  reasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reasonChipSelected: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
  },
  reasonChipText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  reasonChipTextSelected: {
    color: '#92400E',
    fontWeight: '700',
  },
  justificationInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: '#111827',
    minHeight: 90,
    marginBottom: 12,
  },
  proofSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 16,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    backgroundColor: '#F9FAFB',
    marginBottom: 8,
  },
  uploadBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  proofPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    gap: 12,
  },
  proofThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  proofDetails: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  proofBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  proofBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  removeProofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  removeProofText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  submitBtn: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: DwelloColors.primary,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
