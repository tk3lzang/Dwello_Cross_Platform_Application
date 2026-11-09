/**
 * Demo dashboard for reviewing listing reports and host appeals.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Modal,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DwelloColors } from '@/constants/Colors';
import { ModerationService } from '@/services/moderationService';
import { ModerationReport, ModerationAppeal } from '@/types/moderation';
import { useDebug } from '@/context/DebugContext';
import { useListings } from '@/context/ListingsContext';
import { PropertyListing } from '@/types/listing';

type TabType = 'reports' | 'appeals' | 'audit';

export default function AdminModerationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showDebugBanner } = useDebug();
  const { allListings } = useListings();

  const [activeTab, setActiveTab] = useState<TabType>('reports');
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [appeals, setAppeals] = useState<ModerationAppeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasModeratorAccess, setHasModeratorAccess] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [inspectingReport, setInspectingReport] = useState<ModerationReport | null>(null);
  const [inspectingProofImage, setInspectingProofImage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const isModerator = await ModerationService.isCurrentUserModerator();
      setHasModeratorAccess(isModerator);
      if (!isModerator) {
        setReports([]);
        setAppeals([]);
        return;
      }
      const [allReports, allAppeals] = await Promise.all([
        ModerationService.getAllReports(),
        ModerationService.getAllAppeals(),
      ]);
      setReports(allReports);
      setAppeals(allAppeals);
    } catch (error) {
      console.error('[Dwello-Moderation Error]: Failed to load moderation data:', error);
      setHasModeratorAccess(false);
      showDebugBanner('error', 'Error Loading Data', 'Unable to retrieve moderation queue.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [showDebugBanner]);

  useEffect(() => {
    loadData();
    const unsubscribe = ModerationService.subscribe(() => {
      loadData();
    });
    return () => unsubscribe();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Filtered datasets
  const pendingReports = reports.filter((r) => r.status === 'pending');
  const pendingAppeals = appeals.filter((a) => a.status === 'pending');
  const auditReports = reports.filter((r) => r.status !== 'pending');
  const auditAppeals = appeals.filter((a) => a.status !== 'pending');

  // Admin Actions: Reports
  const handleDismissReport = async (report: ModerationReport) => {
    setProcessingId(report.id);
    try {
      await ModerationService.dismissReport(report.id);
      showDebugBanner('info', 'Report Dismissed', `Report for "${report.listing_title}" was dismissed.`);
      await loadData();
    } catch (error: any) {
      console.error('[Dwello-Moderation Error]: Dismiss report failed:', error);
      showDebugBanner('error', 'Action Failed', error.message || 'Could not dismiss report.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleFlagAndHideListing = async (report: ModerationReport) => {
    setProcessingId(report.id);
    try {
      const listingTitle = report.listing_title || 'Listing';
      await ModerationService.flagAndHideListing(report.id);
      showDebugBanner(
        'success',
        'Listing Flagged & Hidden',
        `"${listingTitle}" is now hidden. The listing owner was notified.`
      );
      await loadData();
    } catch (error: any) {
      console.error('[Dwello-Moderation Error]: Flag & hide listing failed:', error);
      showDebugBanner('error', 'Action Failed', error.message || 'Could not hide listing.');
    } finally {
      setProcessingId(null);
    }
  };

  // Admin Actions: Appeals
  const handleApproveAppeal = async (appeal: ModerationAppeal) => {
    setProcessingId(appeal.id);
    try {
      await ModerationService.approveAppeal(
        appeal.id
      );
      showDebugBanner(
        'success',
        'Appeal Approved',
        `Visibility for "${appeal.listing_title || 'Listing'}" has been restored.`
      );
      await loadData();
    } catch (error: any) {
      console.error('[Dwello-Moderation Error]: Approve appeal failed:', error);
      showDebugBanner('error', 'Action Failed', error.message || 'Could not approve appeal.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectAppeal = async (appeal: ModerationAppeal) => {
    setProcessingId(appeal.id);
    try {
      await ModerationService.rejectAppeal(appeal.id);
      showDebugBanner(
        'info',
        'Appeal Rejected',
        `Appeal for "${appeal.listing_title || 'Listing'}" was rejected. The listing owner was notified.`
      );
      await loadData();
    } catch (error: any) {
      console.error('[Dwello-Moderation Error]: Reject appeal failed:', error);
      showDebugBanner('error', 'Action Failed', error.message || 'Could not reject appeal.');
    } finally {
      setProcessingId(null);
    }
  };

  const inspectingListing: PropertyListing | null = inspectingReport
    ? allListings.find((listing) => listing.id === inspectingReport.listing_id) || null
    : null;

  if (!isLoading && hasModeratorAccess === false) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', padding: 28 }]}>
        <Ionicons name="lock-closed-outline" size={48} color="#DC2626" />
        <Text style={[styles.headerTitle, { marginTop: 16, textAlign: 'center' }]}>
          Moderator access required
        </Text>
        <Text style={[styles.emptySubtitle, { textAlign: 'center', marginTop: 8 }]}>
          Sign in with an account authorized in the Supabase dwello_moderators table.
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={[styles.btnInspect, { marginTop: 20 }]}>
          <Text style={styles.btnInspectText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Moderation Panel</Text>
          <View style={styles.demoBadge}>
            <View style={styles.demoDot} />
            <Text style={styles.demoBadgeText}>Authorized Moderator</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          style={styles.refreshIconBtn}
          activeOpacity={0.7}>
          <Ionicons name="refresh" size={20} color="#4B5563" />
        </TouchableOpacity>
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsRow}>
        <View style={[styles.metricCard, activeTab === 'reports' && styles.metricCardActive]}>
          <Text style={styles.metricNumber}>{pendingReports.length}</Text>
          <Text style={styles.metricLabel}>Pending Reports</Text>
        </View>
        <View style={[styles.metricCard, activeTab === 'appeals' && styles.metricCardActive]}>
          <Text style={styles.metricNumber}>{pendingAppeals.length}</Text>
          <Text style={styles.metricLabel}>Appeals Queue</Text>
        </View>
        <View style={[styles.metricCard, activeTab === 'audit' && styles.metricCardActive]}>
          <Text style={styles.metricNumber}>{auditReports.length + auditAppeals.length}</Text>
          <Text style={styles.metricLabel}>Resolved / Audit</Text>
        </View>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'reports' && styles.tabButtonActive]}
          onPress={() => setActiveTab('reports')}
          activeOpacity={0.7}>
          <Ionicons
            name="flag"
            size={16}
            color={activeTab === 'reports' ? '#E0565B' : '#6B7280'}
            style={styles.tabIcon}
          />
          <Text style={[styles.tabText, activeTab === 'reports' && styles.tabTextActive]}>
            Reports ({pendingReports.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'appeals' && styles.tabButtonActive]}
          onPress={() => setActiveTab('appeals')}
          activeOpacity={0.7}>
          <Ionicons
            name="shield-half"
            size={16}
            color={activeTab === 'appeals' ? '#E0565B' : '#6B7280'}
            style={styles.tabIcon}
          />
          <Text style={[styles.tabText, activeTab === 'appeals' && styles.tabTextActive]}>
            Appeals ({pendingAppeals.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'audit' && styles.tabButtonActive]}
          onPress={() => setActiveTab('audit')}
          activeOpacity={0.7}>
          <Ionicons
            name="archive-outline"
            size={16}
            color={activeTab === 'audit' ? '#E0565B' : '#6B7280'}
            style={styles.tabIcon}
          />
          <Text style={[styles.tabText, activeTab === 'audit' && styles.tabTextActive]}>
            Audit Log
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content View */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={DwelloColors.primary} />
          <Text style={styles.loadingText}>Loading moderation records...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={DwelloColors.primary}
            />
          }
          showsVerticalScrollIndicator={false}>
          {/* TAB 1: PENDING REPORTS */}
          {activeTab === 'reports' && (
            <View>
              {pendingReports.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="checkmark-done-circle-outline" size={48} color="#10B981" />
                  <Text style={styles.emptyTitle}>Queue Clean</Text>
                  <Text style={styles.emptySubtitle}>
                    All reported properties have been reviewed. New community reports will appear here.
                  </Text>
                </View>
              ) : (
                pendingReports.map((report) => {
                  const isBusy = processingId === report.id;
                  const shortId = report.id.slice(-6).toUpperCase();
                  const reportedListing = allListings.find((listing) => listing.id === report.listing_id);
                  return (
                    <View key={report.id} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View style={styles.reportTag}>
                          <Text style={styles.reportTagText}>#REP-{shortId}</Text>
                        </View>
                        <View style={styles.reasonBadge}>
                          <Text style={styles.reasonBadgeText}>{report.reason}</Text>
                        </View>
                      </View>

                      <Text style={styles.listingName}>{report.listing_title}</Text>
                      <Text style={styles.metaText}>
                        Listing ID: {report.listing_id}
                        {reportedListing ? ` • Owner account: ${reportedListing.ownerId}` : ''}
                      </Text>

                      {report.details ? (
                        <View style={styles.detailsBox}>
                          <Ionicons name="chatbox-ellipses-outline" size={16} color="#6B7280" style={{ marginRight: 6 }} />
                          <Text style={styles.detailsText}>"{report.details}"</Text>
                        </View>
                      ) : null}

                      <View style={styles.metaRow}>
                        <Ionicons name="person-outline" size={14} color="#9CA3AF" />
                        <Text style={styles.metaText}>
                          Reporter: {report.reporter_email || report.reporter_id}
                        </Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Ionicons name="time-outline" size={14} color="#9CA3AF" />
                        <Text style={styles.metaText}>
                          {new Date(report.created_at).toLocaleString()}
                        </Text>
                      </View>

                      {/* Open the reported listing preview. */}
                      <TouchableOpacity
                        style={styles.btnInspect}
                        onPress={() => setInspectingReport(report)}
                        activeOpacity={0.8}>
                        <Ionicons name="eye-outline" size={16} color="#4F46E5" style={{ marginRight: 6 }} />
                        <Text style={styles.btnInspectText}>Inspect Listing</Text>
                      </TouchableOpacity>

                      {/* Action Buttons */}
                      <View style={styles.actionButtonsRow}>
                        <TouchableOpacity
                          style={[styles.btnSecondary, isBusy && styles.btnDisabled]}
                          onPress={() => handleDismissReport(report)}
                          disabled={isBusy}
                          activeOpacity={0.75}>
                          <Ionicons name="checkmark" size={16} color="#4B5563" style={{ marginRight: 4 }} />
                          <Text style={styles.btnSecondaryText}>Dismiss</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.btnDanger, isBusy && styles.btnDisabled]}
                          onPress={() => handleFlagAndHideListing(report)}
                          disabled={isBusy}
                          activeOpacity={0.85}>
                          {isBusy ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Ionicons name="flag" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                              <Text style={styles.btnDangerText}>Flag & Hide</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* TAB 2: PENDING APPEALS */}
          {activeTab === 'appeals' && (
            <View>
              {pendingAppeals.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="shield-checkmark-outline" size={48} color="#3B82F6" />
                  <Text style={styles.emptyTitle}>No Pending Appeals</Text>
                  <Text style={styles.emptySubtitle}>
                    When a host appeals a hidden listing, their justification will appear here for review.
                  </Text>
                </View>
              ) : (
                pendingAppeals.map((appeal) => {
                  const isBusy = processingId === appeal.id;
                  const shortId = appeal.id.slice(-6).toUpperCase();
                  const relatedReport = reports.find((report) => report.id === appeal.report_id);
                  return (
                    <View key={appeal.id} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View style={[styles.reportTag, { backgroundColor: '#EFF6FF' }]}>
                          <Text style={[styles.reportTagText, { color: '#2563EB' }]}>#APP-{shortId}</Text>
                        </View>
                        <View style={[styles.reasonBadge, { backgroundColor: '#FEF3C7' }]}>
                          <Text style={[styles.reasonBadgeText, { color: '#D97706' }]}>
                            {appeal.appeal_category || 'Other'}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.listingName}>{appeal.listing_title || 'Listing Target'}</Text>
                      <Text style={styles.metaText}>
                        Appeal #{shortId} • Report #{appeal.report_id}
                      </Text>

                      {relatedReport && (
                        <View style={[styles.detailsBox, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
                          <Ionicons name="flag-outline" size={16} color="#C2410C" style={{ marginRight: 6 }} />
                          <Text style={styles.detailsText}>
                            Original report: {relatedReport.reason}
                            {relatedReport.details ? ` — ${relatedReport.details}` : ''}
                          </Text>
                        </View>
                      )}

                      <View style={[styles.detailsBox, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                        <Ionicons name="document-text-outline" size={16} color="#16A34A" style={{ marginRight: 6 }} />
                        <Text style={[styles.detailsText, { color: '#166534' }]}>"{appeal.appeal_reason}"</Text>
                      </View>

                      <View style={styles.metaRow}>
                        <Ionicons name="business-outline" size={14} color="#9CA3AF" />
                        <Text style={styles.metaText}>
                          Owner: {appeal.host_name || 'Dwello member'} ({appeal.host_id})
                        </Text>
                      </View>
                      {appeal.moderation_action_id && (
                        <View style={styles.metaRow}>
                          <Ionicons name="shield-outline" size={14} color="#9CA3AF" />
                          <Text style={styles.metaText}>
                            Moderation action: {appeal.moderation_action_id}
                          </Text>
                        </View>
                      )}
                      {appeal.proof_image_url ? (
                        <View style={styles.metaRow}>
                          <Ionicons name="document-attach-outline" size={14} color="#9CA3AF" />
                          <Text style={styles.metaText}>Evidence is securely stored</Text>
                        </View>
                      ) : null}
                      <View style={styles.metaRow}>
                        <Ionicons name="home-outline" size={14} color="#9CA3AF" />
                        <Text style={styles.metaText}>Listing ID: {appeal.listing_id}</Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Ionicons name="time-outline" size={14} color="#9CA3AF" />
                        <Text style={styles.metaText}>
                          {new Date(appeal.created_at).toLocaleString()}
                        </Text>
                      </View>

                      {/* Supporting Proof Photo Preview */}
                      {appeal.proof_image_url ? (
                        <TouchableOpacity
                          style={styles.appealProofRow}
                          onPress={() => setInspectingProofImage(appeal.proof_image_url || null)}
                          activeOpacity={0.8}>
                          <Image source={{ uri: appeal.proof_image_url }} style={styles.appealProofThumb} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.appealProofTitle}>Supporting Document Attached</Text>
                            <Text style={styles.appealProofSubtitle}>Tap to inspect attached proof photo</Text>
                          </View>
                          <Ionicons name="scan-outline" size={18} color="#2563EB" />
                        </TouchableOpacity>
                      ) : null}

                      {/* Action Buttons */}
                      <View style={styles.actionButtonsRow}>
                        <TouchableOpacity
                          style={[styles.btnReject, isBusy && styles.btnDisabled]}
                          onPress={() => handleRejectAppeal(appeal)}
                          disabled={isBusy}
                          activeOpacity={0.75}>
                          <Ionicons name="close-circle-outline" size={16} color="#DC2626" style={{ marginRight: 4 }} />
                          <Text style={styles.btnRejectText}>Reject Appeal</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.btnApprove, isBusy && styles.btnDisabled]}
                          onPress={() => handleApproveAppeal(appeal)}
                          disabled={isBusy}
                          activeOpacity={0.85}>
                          {isBusy ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Ionicons name="checkmark-done" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                              <Text style={styles.btnApproveText}>Approve & Restore</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* TAB 3: AUDIT LOG */}
          {activeTab === 'audit' && (
            <View>
              {auditReports.length === 0 && auditAppeals.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="file-tray-outline" size={48} color="#9CA3AF" />
                  <Text style={styles.emptyTitle}>Audit Log Empty</Text>
                  <Text style={styles.emptySubtitle}>
                    Resolved reports and appeals will be logged here for accountability.
                  </Text>
                </View>
              ) : (
                <>
                  {/* Resolved Appeals */}
                  {auditAppeals.map((appeal) => (
                    <View key={appeal.id} style={styles.auditCard}>
                      <View style={styles.auditHeader}>
                        <Text style={styles.auditTitle}>Appeal: {appeal.listing_title || 'Listing'}</Text>
                        <View
                          style={[
                            styles.statusBadge,
                            appeal.status === 'approved'
                              ? { backgroundColor: '#DEF7EC' }
                              : { backgroundColor: '#FDE8E8' },
                          ]}>
                          <Text
                            style={[
                              styles.statusBadgeText,
                              appeal.status === 'approved'
                                ? { color: '#03543F' }
                                : { color: '#9B1C1C' },
                            ]}>
                            {appeal.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.auditDetails} numberOfLines={2}>
                        "{appeal.appeal_reason}"
                      </Text>
                      <Text style={styles.auditMeta}>
                        Owner: {appeal.host_name || appeal.host_id} • Submitted {new Date(appeal.created_at).toLocaleString()}
                        {appeal.reviewed_at
                          ? ` • Reviewed ${new Date(appeal.reviewed_at).toLocaleString()} by ${appeal.reviewed_by || 'moderator'}`
                          : ''}
                      </Text>
                    </View>
                  ))}

                  {/* Resolved Reports */}
                  {auditReports.map((report) => (
                    <View key={report.id} style={styles.auditCard}>
                      <View style={styles.auditHeader}>
                        <Text style={styles.auditTitle}>Report: {report.listing_title}</Text>
                        <View
                          style={[
                            styles.statusBadge,
                            report.status === 'action_taken'
                              ? { backgroundColor: '#FDE8E8' }
                              : report.status === 'appeal_approved'
                              ? { backgroundColor: '#DEF7EC' }
                              : report.status === 'appeal_rejected'
                              ? { backgroundColor: '#FDE8E8' }
                              : { backgroundColor: '#F3F4F6' },
                          ]}>
                          <Text
                            style={[
                              styles.statusBadgeText,
                              report.status === 'action_taken'
                                ? { color: '#9B1C1C' }
                                : report.status === 'appeal_approved'
                                ? { color: '#03543F' }
                                : report.status === 'appeal_rejected'
                                ? { color: '#9B1C1C' }
                                : { color: '#4B5563' },
                            ]}>
                            {report.status.replace('_', ' ').toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.auditDetails} numberOfLines={2}>
                        Reason: {report.reason} {report.details ? `— "${report.details}"` : ''}
                      </Text>
                      <Text style={styles.auditMeta}>
                        Reporter: {report.reporter_email || report.reporter_id} • Submitted {new Date(report.created_at).toLocaleString()}
                        {report.reviewed_at
                          ? ` • Reviewed ${new Date(report.reviewed_at).toLocaleString()} by ${report.reviewed_by || 'moderator'}`
                          : ''}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Listing inspection modal. */}
      <Modal
        visible={!!inspectingReport && !!inspectingListing}
        transparent
        animationType="slide"
        onRequestClose={() => setInspectingReport(null)}>
        <View style={styles.inspectOverlay}>
          <View style={styles.inspectCard}>
            {/* Modal Header */}
            <View style={styles.inspectHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inspectHeaderTitle}>Listing Inspection</Text>
                <Text style={styles.inspectHeaderSubtitle}>
                  #REP-{inspectingReport?.id.slice(-6).toUpperCase()} • In-Depth Admin Review
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setInspectingReport(null)}
                style={styles.inspectCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color="#4B5563" />
              </TouchableOpacity>
            </View>

            {inspectingListing && (
              <ScrollView
                style={styles.inspectScroll}
                contentContainerStyle={styles.inspectScrollContent}
                showsVerticalScrollIndicator={false}>
                {/* Photo & Price Banner */}
                <View style={styles.inspectImageContainer}>
                  <Image
                    source={{
                      uri:
                        inspectingListing.images?.[0] ||
                        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
                    }}
                    style={styles.inspectImage}
                  />
                  <View style={styles.inspectPriceBadge}>
                    <Text style={styles.inspectPriceText}>Nu. {inspectingListing.price.toLocaleString()} /mo</Text>
                  </View>
                </View>

                {/* Title & Location */}
                <Text style={styles.inspectTitle}>{inspectingListing.title}</Text>
                <View style={styles.inspectLocationRow}>
                  <Ionicons name="location-sharp" size={15} color={DwelloColors.primary} />
                  <Text style={styles.inspectLocationText}>
                    {inspectingListing.fullAddress ||
                      `${inspectingListing.zoneArea} • ${inspectingListing.municipalRegion}`}
                  </Text>
                </View>

                {/* Host Details */}
                <View style={styles.inspectHostCard}>
                  <View style={styles.inspectHostAvatar}>
                    <Ionicons name="person" size={20} color="#4B5563" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inspectHostName}>
                      {inspectingListing.ownerName || 'Verified Host'}
                    </Text>
                    <Text style={styles.inspectHostSub}>
                      {inspectingListing.ownerRole || 'Landlord / Host'} • WhatsApp:{' '}
                      {inspectingListing.ownerPhone || '17777777'}
                    </Text>
                  </View>
                  <View style={styles.inspectVerifiedPill}>
                    <Ionicons name="shield-checkmark" size={13} color="#059669" style={{ marginRight: 4 }} />
                    <Text style={styles.inspectVerifiedPillText}>Host</Text>
                  </View>
                </View>

                {/* Description */}
                <Text style={styles.inspectSectionTitle}>Property Description</Text>
                <Text style={styles.inspectDescriptionText}>{inspectingListing.description}</Text>

                {/* Property Details Row */}
                <View style={styles.inspectChipsRow}>
                  {inspectingListing.bhkType ? (
                    <View style={styles.inspectChip}>
                      <Text style={styles.inspectChipText}>{inspectingListing.bhkType}</Text>
                    </View>
                  ) : null}
                  <View style={styles.inspectChip}>
                    <Text style={styles.inspectChipText}>{inspectingListing.category}</Text>
                  </View>
                  {inspectingListing.fairMarketPrice && (
                    <View style={[styles.inspectChip, { backgroundColor: '#DEF7EC' }]}>
                      <Text style={[styles.inspectChipText, { color: '#03543F' }]}>
                        Fair Market Verified
                      </Text>
                    </View>
                  )}
                </View>

                {/* Moderation Case Details Box */}
                <View style={styles.inspectReportCaseCard}>
                  <View style={styles.inspectReportHeader}>
                    <Ionicons name="warning" size={18} color="#DC2626" style={{ marginRight: 6 }} />
                    <Text style={styles.inspectReportTitle}>Submitted Community Report</Text>
                  </View>
                  <View style={styles.inspectReportRow}>
                    <Text style={styles.inspectReportLabel}>Reason:</Text>
                    <Text style={styles.inspectReportValHighlight}>{inspectingReport?.reason}</Text>
                  </View>
                  <View style={styles.inspectReportRow}>
                    <Text style={styles.inspectReportLabel}>Reporter:</Text>
                    <Text style={styles.inspectReportVal}>
                      {inspectingReport?.reporter_email || inspectingReport?.reporter_id}
                    </Text>
                  </View>
                  <View style={styles.inspectReportRow}>
                    <Text style={styles.inspectReportLabel}>Reported At:</Text>
                    <Text style={styles.inspectReportVal}>
                      {inspectingReport?.created_at
                        ? new Date(inspectingReport.created_at).toLocaleString()
                        : ''}
                    </Text>
                  </View>
                  {inspectingReport?.details ? (
                    <View style={styles.inspectReportDetailsBox}>
                      <Text style={styles.inspectReportDetailsText}>
                        "{inspectingReport.details}"
                      </Text>
                    </View>
                  ) : null}
                </View>
              </ScrollView>
            )}

            {/* Moderation decision actions. */}
            <View style={styles.inspectStickyFooter}>
              <TouchableOpacity
                style={styles.inspectDismissBtn}
                onPress={() => {
                  if (inspectingReport) {
                    const rep = inspectingReport;
                    setInspectingReport(null);
                    handleDismissReport(rep);
                  }
                }}
                activeOpacity={0.8}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color="#374151"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.inspectDismissText}>Dismiss Report</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.inspectHideBtn}
                onPress={() => {
                  if (inspectingReport) {
                    const rep = inspectingReport;
                    setInspectingReport(null);
                    handleFlagAndHideListing(rep);
                  }
                }}
                activeOpacity={0.85}>
                <Ionicons
                  name="eye-off-outline"
                  size={18}
                  color="#FFFFFF"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.inspectHideText}>Remove / Hide</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Proof Image Viewer Modal */}
      {inspectingProofImage && (
        <Modal
          visible={!!inspectingProofImage}
          transparent
          animationType="fade"
          onRequestClose={() => setInspectingProofImage(null)}>
          <View style={styles.proofModalOverlay}>
            <View style={styles.proofModalContent}>
              <View style={styles.proofModalHeader}>
                <Text style={styles.proofModalTitle}>Host Supporting Proof</Text>
                <TouchableOpacity onPress={() => setInspectingProofImage(null)} style={styles.proofModalClose}>
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <Image source={{ uri: inspectingProofImage }} style={styles.proofFullImage} resizeMode="contain" />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 6,
    marginRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginRight: 8,
  },
  demoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DEF7EC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  demoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
    marginRight: 5,
  },
  demoBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
  },
  refreshIconBtn: {
    padding: 6,
  },
  metricsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: { elevation: 1 },
    }),
  },
  metricCardActive: {
    borderColor: '#E0565B',
    backgroundColor: '#FFF5F5',
  },
  metricNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E0565B',
    borderBottomWidth: 2,
  },
  tabIcon: {
    marginRight: 4,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#E0565B',
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#6B7280',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportTag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  reportTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
  },
  reasonBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  reasonBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  listingName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  detailsBox: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  detailsText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: '#6B7280',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 10,
  },
  btnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  btnSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  btnDanger: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#DC2626',
  },
  btnDangerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnReject: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  btnRejectText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
  btnApprove: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#16A34A',
  },
  btnApproveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  auditCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  auditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  auditTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  auditDetails: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 16,
    marginBottom: 6,
  },
  auditMeta: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  btnInspect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginTop: 8,
  },
  btnInspectText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  appealProofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    gap: 10,
  },
  appealProofThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#DBEAFE',
  },
  appealProofTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
  },
  appealProofSubtitle: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 2,
  },
  inspectOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  inspectCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    height: '88%',
    paddingBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },
  inspectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  inspectHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  inspectHeaderSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  inspectCloseBtn: {
    padding: 4,
  },
  inspectScroll: {
    flex: 1,
  },
  inspectScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  inspectImageContainer: {
    width: '100%',
    height: 190,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E5E7EB',
    marginBottom: 14,
  },
  inspectImage: {
    width: '100%',
    height: '100%',
  },
  inspectPriceBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inspectPriceText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  inspectTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  inspectLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  inspectLocationText: {
    fontSize: 13,
    color: '#4B5563',
    marginLeft: 4,
    fontWeight: '500',
  },
  inspectHostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    gap: 10,
  },
  inspectHostAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inspectHostName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  inspectHostSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  inspectVerifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DEF7EC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  inspectVerifiedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#03543F',
  },
  inspectSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  inspectDescriptionText: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 14,
  },
  inspectChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  inspectChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  inspectChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  inspectReportCaseCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
    marginBottom: 10,
  },
  inspectReportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  inspectReportTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#991B1B',
  },
  inspectReportRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  inspectReportLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7F1D1D',
    width: 90,
  },
  inspectReportVal: {
    flex: 1,
    fontSize: 12,
    color: '#374151',
  },
  inspectReportValHighlight: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  inspectReportDetailsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    marginTop: 8,
  },
  inspectReportDetailsText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#4B5563',
    lineHeight: 16,
  },
  inspectStickyFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  inspectDismissBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  inspectDismissText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  inspectHideBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#DC2626',
  },
  inspectHideText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  proofModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  proofModalContent: {
    width: '100%',
    height: '80%',
    justifyContent: 'center',
  },
  proofModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  proofModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  proofModalClose: {
    padding: 8,
  },
  proofFullImage: {
    width: '100%',
    height: '90%',
    borderRadius: 12,
  },
});
