import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
  RefreshControl,
  Modal,
  ActivityIndicator,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { Paths, File as ExpoFile } from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  Download,
  FileText,
  ChevronDown,
  Menu,
  RefreshCw,
  X,
  Check,
  CheckCircle2,
  ShieldCheck,
  Info,
} from 'lucide-react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { useSupervisorDrawerStore } from '../../store/useSupervisorDrawerStore';
import { SupervisorDrawerModal } from '../../components/navigation/SupervisorDrawerModal';
import { useTechnicianDrawerStore } from '../../store/useTechnicianDrawerStore';
import { TechnicianDrawerModal } from '../../components/navigation/TechnicianDrawerModal';
import { salaryService } from '../../services/salaryService';
import { SalarySlip } from '../../types';
import { COLORS, SHADOWS } from '../../constants/theme';
import { AppBackButton } from '../../components/common/AppBackButton';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const AVAILABLE_YEARS = [2024, 2025, 2026, 2027, 2028];

export const SalaryScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { openDrawer: openSupervisorDrawer } = useSupervisorDrawerStore();
  const { openDrawer: openTechnicianDrawer } = useTechnicianDrawerStore();

  const isSupervisor = user?.role === 'supervisor';

  // Date selection states (Defaulting to October 2026)
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Dropdown Picker Modals
  const [showMonthModal, setShowMonthModal] = useState<boolean>(false);
  const [showYearModal, setShowYearModal] = useState<boolean>(false);

  // Salary slip data states
  const [slip, setSlip] = useState<SalarySlip | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // STRICT EMPLOYEE ISOLATION: Technicians can ONLY retrieve their own salary records
  const currentUserId = user?.id || (user as any)?._id || '';

  const fetchSalary = async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const data = await salaryService.getSalarySlip(currentUserId, selectedMonth, selectedYear);
      setSlip(data);
    } catch (e: any) {
      console.warn('Salary slip fetch error:', e);
      setSlip(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalary();
  }, [currentUserId, selectedMonth, selectedYear]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSalary();
    setRefreshing(false);
  };

  // Download Official Payslip PDF / Document uploaded by Admin
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const token = useAuthStore.getState().token;
      const url = salaryService.getDownloadUrl(currentUserId, selectedMonth, selectedYear, token || undefined);

      if (Platform.OS === 'web') {
        window.open(url, '_blank');
        setDownloading(false);
        return;
      }

      const rawFileName =
        slip?.fileName ||
        `Adani_Salary_Slip_${slip?.employeeId || currentUserId}_${selectedMonth}_${selectedYear}.pdf`;
      const filename = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const destination = new ExpoFile(Paths.document, filename);
      const downloadedFile = await ExpoFile.downloadFileAsync(url, destination, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(downloadedFile.uri, {
          mimeType: filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
          dialogTitle: `Adani Salary Slip - ${slip?.employeeName || user?.name || 'Employee'} (${MONTH_NAMES[selectedMonth - 1]} ${selectedYear})`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert(
          'Salary Slip Downloaded',
          `Successfully saved ${filename} to your device.\n\nPath: ${downloadedFile.uri}`
        );
      }
    } catch (err: any) {
      console.warn('Salary slip download error:', err);
      const url = salaryService.getDownloadUrl(currentUserId, selectedMonth, selectedYear);
      try {
        await Linking.openURL(url);
      } catch (linkErr) {
        Alert.alert('Download Error', err.message || 'Failed to download salary slip. Please try again.');
      }
    } finally {
      setDownloading(false);
    }
  };

  const documentName =
    slip?.fileName ||
    `Adani_Salary_Slip_${MONTH_NAMES[selectedMonth - 1]}_${selectedYear}.pdf`;

  const isDocumentAvailable = !!slip;

  return (
    <View style={styles.container}>
      {/* Top Navigation Bar with Left-Aligned Back Button */}
      <View style={[styles.topNavBar, { paddingTop: Math.max(insets.top, 14) + 6 }]}>
        <View style={styles.topNavLeft}>
          <AppBackButton />

          <TouchableOpacity
            style={styles.navRoundBtn}
            onPress={() => (isSupervisor ? openSupervisorDrawer('Salary') : openTechnicianDrawer('Salary'))}
            activeOpacity={0.7}
            accessibilityLabel="Open Navigation Menu"
          >
            <Menu size={19} color="#0F172A" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={onRefresh}
          activeOpacity={0.7}
          accessibilityLabel="Refresh Records"
        >
          <RefreshCw size={12} color="#1E63F0" style={{ marginRight: 5 }} />
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 20) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {/* Top Header Strip with Month & Year Selectors */}
        <View style={styles.topRow}>
          <View style={styles.badgePill}>
            <Text style={styles.badgePillText}>Official Payroll Portal</Text>
          </View>

          {/* Month & Year Selectors */}
          <View style={styles.dropdownsGroup}>
            <TouchableOpacity
              style={styles.dropdownPill}
              onPress={() => setShowMonthModal(true)}
              activeOpacity={0.75}
            >
              <Text style={styles.dropdownPillText}>{MONTH_NAMES[selectedMonth - 1]}</Text>
              <ChevronDown size={14} color="#475569" style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dropdownPill}
              onPress={() => setShowYearModal(true)}
              activeOpacity={0.75}
            >
              <Text style={styles.dropdownPillText}>{selectedYear}</Text>
              <ChevronDown size={14} color="#475569" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Company Subtitle */}
        <View style={styles.companyRow}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.companyNameText}>Adani Energy Solutions Limited</Text>
        </View>

        {/* Page Title */}
        <View style={styles.titleRow}>
          <View style={styles.fileIconBadge}>
            <FileText size={26} color="#1E40AF" strokeWidth={2.4} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mainTitleText}>Salary Slip</Text>
          </View>
        </View>

        {/* DOCUMENT RETRIEVAL SECTION */}
        {loading && !refreshing ? (
          <View style={[styles.card, styles.centerCard, SHADOWS.sm]}>
            <ActivityIndicator size="large" color="#1E63F0" />
            <Text style={styles.loadingText}>Retrieving salary slip...</Text>
          </View>
        ) : isDocumentAvailable ? (
          /* Available Document Card */
          <View style={[styles.documentCard, SHADOWS.md]}>
            <View style={styles.docHeader}>
              <View style={styles.docIconWrap}>
                <FileText size={32} color="#DC2626" />
                <View style={styles.pdfPill}>
                  <Text style={styles.pdfPillText}>PDF</Text>
                </View>
              </View>

              <View style={styles.docTitleWrap}>
                <View style={styles.statusBadgeRow}>
                  <View style={styles.statusBadge}>
                    <CheckCircle2 size={12} color="#059669" style={{ marginRight: 4 }} />
                    <Text style={styles.statusBadgeText}>
                      {slip?.hasUploadedDocument ? 'Uploaded by Admin' : 'Verified & Available'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.docFileName} numberOfLines={2}>
                  {documentName}
                </Text>
                <Text style={styles.docSubInfo}>
                  Payroll Cycle: {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Document Details Grid */}
            <View style={styles.docDetailsList}>
              <View style={styles.docDetailRow}>
                <Text style={styles.detailLabel}>Employee</Text>
                <Text style={styles.detailValue}>
                  {slip?.employeeName || user?.name || 'Employee'} ({slip?.employeeId || user?.employeeId || ''})
                </Text>
              </View>

              <View style={styles.docDetailRow}>
                <Text style={styles.detailLabel}>Payroll Period</Text>
                <Text style={styles.detailValue}>
                  {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                </Text>
              </View>

              <View style={styles.docDetailRow}>
                <Text style={styles.detailLabel}>Uploaded / Issued By</Text>
                <Text style={styles.detailValue}>
                  {slip?.uploadedBy || slip?.finalizedBy || 'Operations Admin'}
                </Text>
              </View>

              {slip?.uploadedAt && (
                <View style={styles.docDetailRow}>
                  <Text style={styles.detailLabel}>Uploaded On</Text>
                  <Text style={styles.detailValue}>{slip.uploadedAt}</Text>
                </View>
              )}

              {slip?.referenceNumber && (
                <View style={styles.docDetailRow}>
                  <Text style={styles.detailLabel}>Reference No.</Text>
                  <Text style={styles.detailValue}>{slip.referenceNumber}</Text>
                </View>
              )}
            </View>

            {/* Admin Notes if provided */}
            {slip?.notes ? (
              <View style={styles.notesBox}>
                <Info size={14} color="#1E40AF" style={{ marginRight: 6, marginTop: 1 }} />
                <Text style={styles.notesText}>
                  <Text style={{ fontWeight: '700' }}>Admin Note: </Text>
                  {slip.notes}
                </Text>
              </View>
            ) : null}

            {/* Download Button */}
            <TouchableOpacity
              style={[styles.downloadActionBtn, downloading && { opacity: 0.75 }]}
              onPress={handleDownload}
              activeOpacity={0.85}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
              ) : (
                <Download size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              )}
              <Text style={styles.downloadActionBtnText}>
                {downloading ? 'Downloading Salary Slip...' : 'Download Salary Slip (PDF)'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Empty State - No document uploaded yet */
          <View style={[styles.emptyCard, SHADOWS.sm]}>
            <View style={styles.emptyIconCircle}>
              <FileText size={36} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>No Salary Slip Uploaded Yet</Text>
            <Text style={styles.emptyMessage}>
              The admin has not uploaded a salary slip for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}. Please check back later or select another month above.
            </Text>
            <TouchableOpacity
              style={styles.emptyRetryBtn}
              onPress={onRefresh}
              activeOpacity={0.8}
            >
              <RefreshCw size={14} color="#1E63F0" style={{ marginRight: 6 }} />
              <Text style={styles.emptyRetryBtnText}>Check Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Security & Confidentiality Notice */}
        <View style={styles.securityStrip}>
          <ShieldCheck size={16} color="#059669" style={{ marginRight: 8 }} />
          <Text style={styles.securityText}>
            Confidential Document • Restricted strictly to {user?.employeeId || 'employee'}
          </Text>
        </View>
      </ScrollView>

      {/* Month Picker Modal */}
      <Modal visible={showMonthModal} transparent animationType="fade" onRequestClose={() => setShowMonthModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMonthModal(false)}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Payroll Month</Text>
              <TouchableOpacity onPress={() => setShowMonthModal(false)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }}>
              {MONTH_NAMES.map((m, idx) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.pickerItem, selectedMonth === idx + 1 && styles.pickerItemActive]}
                  onPress={() => {
                    setSelectedMonth(idx + 1);
                    setShowMonthModal(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, selectedMonth === idx + 1 && styles.pickerItemTextActive]}>
                    {m}
                  </Text>
                  {selectedMonth === idx + 1 && <Check size={16} color="#1E63F0" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Year Picker Modal */}
      <Modal visible={showYearModal} transparent animationType="fade" onRequestClose={() => setShowYearModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowYearModal(false)}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Payroll Year</Text>
              <TouchableOpacity onPress={() => setShowYearModal(false)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 260 }}>
              {AVAILABLE_YEARS.map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[styles.pickerItem, selectedYear === y && styles.pickerItemActive]}
                  onPress={() => {
                    setSelectedYear(y);
                    setShowYearModal(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, selectedYear === y && styles.pickerItemTextActive]}>
                    {y}
                  </Text>
                  {selectedYear === y && <Check size={16} color="#1E63F0" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sidecar Navigation Drawer */}
      {isSupervisor ? <SupervisorDrawerModal /> : <TechnicianDrawerModal />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  topNavLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navRoundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E63F0',
  },
  mainScroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgePill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338CA',
  },
  dropdownsGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  dropdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  dropdownPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -8,
  },
  bulletDot: {
    fontSize: 16,
    color: '#2563EB',
  },
  companyNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fileIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainTitleText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  mainSubtitleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  centerCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  documentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  docHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  docIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pdfPill: {
    position: 'absolute',
    bottom: -4,
    backgroundColor: '#DC2626',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  pdfPillText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  docTitleWrap: {
    flex: 1,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  docFileName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 20,
  },
  docSubInfo: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  docDetailsList: {
    gap: 8,
  },
  docDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  detailValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  notesText: {
    fontSize: 11.5,
    color: '#1E40AF',
    flex: 1,
    lineHeight: 16,
  },
  downloadActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E63F0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  downloadActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptyMessage: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  emptyRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  emptyRetryBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E63F0',
  },
  securityStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: 6,
  },
  securityText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#166534',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerModal: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  pickerItemActive: {
    backgroundColor: '#EFF6FF',
  },
  pickerItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  pickerItemTextActive: {
    color: '#1E63F0',
    fontWeight: '800',
  },
});
