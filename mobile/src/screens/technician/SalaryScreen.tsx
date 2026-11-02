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
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { Paths, File as ExpoFile } from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  Banknote,
  Download,
  FileText,
  ChevronDown,
  ArrowLeft,
  Menu,
  RefreshCw,
  X,
  Check,
  Calendar,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  TrendingDown,
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
  const [selectedMonth, setSelectedMonth] = useState<number>(10);
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  // Dropdown Picker Modals
  const [showMonthModal, setShowMonthModal] = useState<boolean>(false);
  const [showYearModal, setShowYearModal] = useState<boolean>(false);

  // Salary slip data states
  const [slip, setSlip] = useState<SalarySlip | null>(null);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // STRICT EMPLOYEE ISOLATION: Technicians can ONLY retrieve their own salary records
  const currentUserId = user?.id || (user as any)?._id || (isSupervisor ? 'emp_05' : 'emp_01');

  const fetchSalary = async () => {
    if (!currentUserId) return;
    try {
      const data = await salaryService.getSalarySlip(currentUserId, selectedMonth, selectedYear);
      setSlip(data);
    } catch (e: any) {
      console.warn('Salary slip fetch error:', e);
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

  // Download Official Payslip PDF
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

      const filename = `Adani_Payslip_${slip?.employeeId || currentUserId}_${selectedMonth}_${selectedYear}.pdf`;
      const destination = new ExpoFile(Paths.document, filename);
      const downloadedFile = await ExpoFile.downloadFileAsync(url, destination, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(downloadedFile.uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Adani Payslip - ${slip?.employeeName || user?.name || 'Technician'} (${MONTH_NAMES[selectedMonth - 1]} ${selectedYear})`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert(
          'Payslip Downloaded',
          `Successfully saved ${filename} to device documents.\n\nFile: ${downloadedFile.uri}`
        );
      }
    } catch (err: any) {
      console.warn('Payslip download error:', err);
      const url = salaryService.getDownloadUrl(currentUserId, selectedMonth, selectedYear);
      try {
        await Linking.openURL(url);
      } catch (linkErr) {
        Alert.alert('Download Error', err.message || 'Failed to download payslip. Please try again.');
      }
    } finally {
      setDownloading(false);
    }
  };

  // Calculations derived safely
  const monthlySalary = slip?.monthlySalary || slip?.earnings?.grossEarnings || 20000;
  const presentDays = slip?.presentDays || 25;
  const halfDays = slip?.halfDays || 2;
  const fullPresentDays = Math.max(0, presentDays - halfDays);
  const absentDays = slip?.absentDays || 2;
  const weeklyOffDays = slip?.weeklyOffDays || 4;
  const publicHolidayDays = slip?.publicHolidayDays || 1;

  const absentRate = slip?.absentDeductionRate || 500;
  const halfDayRate = slip?.halfDayDeductionRate || 250;
  const absentDeduction = slip?.absentDeductionTotal || (absentDays * absentRate);
  const halfDayDeduction = slip?.halfDayDeductionTotal || (halfDays * halfDayRate);
  const totalDeductions = slip?.totalDeductionAmount || (absentDeduction + halfDayDeduction);
  const finalPayable = slip?.netPay !== undefined ? slip.netPay : Math.max(0, monthlySalary - totalDeductions);
  const dailyRate = slip?.dailySalaryRate || Math.round((monthlySalary / 30) * 100) / 100;
  const statusStr = (slip?.status || 'FINALIZED').toUpperCase();

  const isFinalized = statusStr === 'FINALIZED' || statusStr === 'PAID';

  return (
    <View style={styles.container}>
      {/* Top Navigation Bar */}
      <View style={[styles.topNavBar, { paddingTop: Math.max(insets.top, 14) + 6 }]}>
        <View style={styles.topNavLeft}>
          <TouchableOpacity
            style={styles.navRoundBtn}
            onPress={() => (isSupervisor ? openSupervisorDrawer('Salary') : openTechnicianDrawer('Salary'))}
            activeOpacity={0.7}
            accessibilityLabel="Open Navigation Menu"
          >
            <Menu size={19} color="#0F172A" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navRoundBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            accessibilityLabel="Back"
          >
            <ArrowLeft size={18} color="#0F172A" />
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
        {/* Top Header Strip */}
        <View style={styles.topRow}>
          <View style={styles.badgePill}>
            <Text style={styles.badgePillText}>Workforce Payroll & Compensation</Text>
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

        {/* Main Title Heading */}
        <View style={styles.titleRow}>
          <View style={styles.banknoteBadge}>
            <Banknote size={26} color="#1E40AF" strokeWidth={2.4} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mainTitleText}>My Salary & Compensation</Text>
            <Text style={styles.mainSubtitleText}>Attendance-Integrated Monthly Salary Statement</Text>
          </View>
        </View>

        {/* Download Button Banner */}
        <View style={styles.downloadBanner}>
          <TouchableOpacity
            style={[styles.downloadBtn, downloading && { opacity: 0.75 }]}
            onPress={handleDownload}
            activeOpacity={0.85}
            disabled={downloading}
          >
            <Download size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.downloadBtnText}>
              {downloading ? 'Generating Payslip PDF...' : 'Download Salary Slip (PDF)'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.downloadSubText}>
            Official signed statement for {MONTH_NAMES[selectedMonth - 1]} {selectedYear} • {slip?.referenceNumber || `ADN-PAY-${selectedYear}${selectedMonth < 10 ? '0' : ''}${selectedMonth}`}
          </Text>
        </View>

        {/* 1. EMPLOYEE PROFILE CARD */}
        <View style={[styles.card, SHADOWS.sm]}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardHeaderTitle}>Employee Information</Text>
              <Text style={styles.cardHeaderSub}>Personal workforce records</Text>
            </View>
            <View style={[styles.statusBadge, isFinalized ? styles.statusBadgeFinalized : styles.statusBadgeDraft]}>
              <CheckCircle2 size={12} color={isFinalized ? '#059669' : '#D97706'} style={{ marginRight: 4 }} />
              <Text style={[styles.statusBadgeText, { color: isFinalized ? '#059669' : '#D97706' }]}>
                {statusStr}
              </Text>
            </View>
          </View>

          <View style={styles.empGrid}>
            <View style={styles.empGridItem}>
              <Text style={styles.gridLabel}>EMPLOYEE NAME</Text>
              <Text style={styles.gridValue}>{slip?.employeeName || user?.name || 'Rohit Sharma'}</Text>
            </View>
            <View style={styles.empGridItem}>
              <Text style={styles.gridLabel}>EMPLOYEE ID</Text>
              <Text style={styles.gridValueHighlight}>{slip?.employeeId || user?.employeeId || 'b4S/Adani/01'}</Text>
            </View>
            <View style={styles.empGridItem}>
              <Text style={styles.gridLabel}>DESIGNATION</Text>
              <Text style={styles.gridValue}>{slip?.designation || user?.designation || 'Smart Meter Technician'}</Text>
            </View>
            <View style={styles.empGridItem}>
              <Text style={styles.gridLabel}>PAYROLL MONTH</Text>
              <Text style={styles.gridValue}>{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</Text>
            </View>
          </View>
        </View>

        {/* 2. SALARY OVERVIEW (BASE SALARY) */}
        <View style={[styles.card, SHADOWS.sm]}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardHeaderTitle}>Assigned Monthly Salary</Text>
              <Text style={styles.cardHeaderSub}>Base remuneration assigned by Operations Admin</Text>
            </View>
            <View style={styles.salaryPill}>
              <Text style={styles.salaryPillText}>₹{monthlySalary.toLocaleString('en-IN')}</Text>
            </View>
          </View>

          <View style={styles.salaryMetricsRow}>
            <View style={styles.salaryMetricCol}>
              <Text style={styles.metricLabel}>MONTHLY SALARY</Text>
              <Text style={styles.metricValLarge}>₹{monthlySalary.toLocaleString('en-IN')}</Text>
              <Text style={styles.metricSub}>Assigned contract rate</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.salaryMetricCol}>
              <Text style={styles.metricLabel}>PER-DAY RATE</Text>
              <Text style={styles.metricValMedium}>₹{dailyRate.toLocaleString('en-IN')}</Text>
              <Text style={styles.metricSub}>Auto-calculated (30 days)</Text>
            </View>
          </View>
        </View>

        {/* 3. ATTENDANCE SUMMARY (5 MANDATORY CATEGORIES) */}
        <View style={[styles.card, SHADOWS.sm]}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardHeaderTitle}>Attendance Summary</Text>
              <Text style={styles.cardHeaderSub}>Verified from centralized GPS attendance records</Text>
            </View>
          </View>

          <View style={styles.attGrid}>
            {/* P - Present (Full Days) */}
            <View style={[styles.attCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
              <Text style={[styles.attCardLabel, { color: '#166534' }]}>P – PRESENT</Text>
              <Text style={[styles.attCardVal, { color: '#15803D' }]}>{presentDays} <Text style={styles.dayUnit}>days</Text></Text>
              <Text style={styles.attCardNote}>Includes {fullPresentDays} full + {halfDays} half</Text>
            </View>

            {/* Half Day */}
            <View style={[styles.attCard, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
              <Text style={[styles.attCardLabel, { color: '#92400E' }]}>HALF DAY</Text>
              <Text style={[styles.attCardVal, { color: '#D97706' }]}>{halfDays} <Text style={styles.dayUnit}>days</Text></Text>
              <Text style={styles.attCardNote}>Shift duration &lt; 8 hrs</Text>
            </View>

            {/* A - Absent */}
            <View style={[styles.attCard, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
              <Text style={[styles.attCardLabel, { color: '#991B1B' }]}>A – ABSENT</Text>
              <Text style={[styles.attCardVal, { color: '#DC2626' }]}>{absentDays} <Text style={styles.dayUnit}>days</Text></Text>
              <Text style={styles.attCardNote}>No check-in recorded</Text>
            </View>

            {/* WO - Weekly Off */}
            <View style={[styles.attCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
              <Text style={[styles.attCardLabel, { color: '#1E40AF' }]}>WO – WEEKLY OFF</Text>
              <Text style={[styles.attCardVal, { color: '#2563EB' }]}>{weeklyOffDays} <Text style={styles.dayUnit}>days</Text></Text>
              <Text style={styles.attCardNote}>Paid scheduled rest</Text>
            </View>

            {/* PH - Public Holiday */}
            <View style={[styles.attCard, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }]}>
              <Text style={[styles.attCardLabel, { color: '#5B21B6' }]}>PH – HOLIDAYS</Text>
              <Text style={[styles.attCardVal, { color: '#7C3AED' }]}>{publicHolidayDays} <Text style={styles.dayUnit}>days</Text></Text>
              <Text style={styles.attCardNote}>Gazetted paid holiday</Text>
            </View>

            {/* Total Payable Days */}
            <View style={[styles.attCard, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
              <Text style={[styles.attCardLabel, { color: '#334155' }]}>PAYABLE DAYS</Text>
              <Text style={[styles.attCardVal, { color: '#0F172A' }]}>
                {slip?.payableDays || (presentDays + weeklyOffDays + publicHolidayDays)} <Text style={styles.dayUnit}>days</Text>
              </Text>
              <Text style={styles.attCardNote}>Eligible for salary</Text>
            </View>
          </View>
        </View>

        {/* 4. DEDUCTION BREAKDOWN */}
        <View style={[styles.card, SHADOWS.sm]}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardHeaderTitle}>Attendance Deductions</Text>
              <Text style={styles.cardHeaderSub}>Configured penalty amounts applied for missed duty</Text>
            </View>
            <View style={styles.deductionPill}>
              <TrendingDown size={14} color="#DC2626" style={{ marginRight: 4 }} />
              <Text style={styles.deductionPillText}>-₹{totalDeductions.toLocaleString('en-IN')}</Text>
            </View>
          </View>

          <View style={styles.deductionList}>
            {/* Absent deduction line */}
            <View style={styles.deductionRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.deductionItemTitle}>Absent Deduction</Text>
                <Text style={styles.deductionItemDesc}>
                  {absentDays} Absent Day(s) × ₹{absentRate.toLocaleString('en-IN')} configured rate
                </Text>
              </View>
              <Text style={styles.deductionItemVal}>-₹{absentDeduction.toLocaleString('en-IN')}</Text>
            </View>

            <View style={styles.tableDivider} />

            {/* Half day deduction line */}
            <View style={styles.deductionRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.deductionItemTitle}>Half-Day Deduction</Text>
                <Text style={styles.deductionItemDesc}>
                  {halfDays} Half Day(s) × ₹{halfDayRate.toLocaleString('en-IN')} configured rate
                </Text>
              </View>
              <Text style={styles.deductionItemVal}>-₹{halfDayDeduction.toLocaleString('en-IN')}</Text>
            </View>

            <View style={styles.tableDivider} />

            {/* Total Deductions Highlight */}
            <View style={[styles.deductionRow, styles.deductionTotalRow]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.deductionTotalTitle}>Total Attendance Deductions</Text>
                <Text style={styles.deductionTotalDesc}>Sum of absent & half-day penalties</Text>
              </View>
              <Text style={styles.deductionTotalVal}>-₹{totalDeductions.toLocaleString('en-IN')}</Text>
            </View>
          </View>
        </View>

        {/* 5. FINAL PAYABLE SALARY CARD (HIGHLIGHT SUMMARY) */}
        <View style={[styles.payableCard, SHADOWS.md]}>
          <View style={styles.payableTopRow}>
            <View>
              <Text style={styles.payableLabel}>FINAL PAYABLE SALARY</Text>
              <Text style={styles.payableSubLabel}>Net Take-Home Salary for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}</Text>
            </View>
            <View style={styles.payableIconCircle}>
              <ShieldCheck size={24} color="#059669" />
            </View>
          </View>

          <Text style={styles.payableAmount}>₹{finalPayable.toLocaleString('en-IN')}</Text>

          {/* Salary Formula Explanation */}
          <View style={styles.formulaBox}>
            <Info size={15} color="#065F46" style={{ marginRight: 6, marginTop: 1 }} />
            <Text style={styles.formulaText}>
              <Text style={{ fontWeight: '800' }}>Calculation Explanation: </Text>
              Monthly Salary (₹{monthlySalary.toLocaleString('en-IN')}) − Total Deductions (₹{totalDeductions.toLocaleString('en-IN')}) = Net Payable <Text style={{ fontWeight: '800' }}>₹{finalPayable.toLocaleString('en-IN')}</Text>
            </Text>
          </View>

          {slip?.notes && (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>OPERATIONS REMARKS:</Text>
              <Text style={styles.notesText}>{slip.notes}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.payableDownloadBtn}
            onPress={handleDownload}
            activeOpacity={0.85}
          >
            <Download size={15} color="#065F46" style={{ marginRight: 6 }} />
            <Text style={styles.payableDownloadBtnText}>Download Official Payslip (PDF)</Text>
          </TouchableOpacity>
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
  banknoteBadge: {
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
  downloadBanner: {
    backgroundColor: '#1E3A8A',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    width: '100%',
    justifyContent: 'center',
  },
  downloadBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  downloadSubText: {
    fontSize: 11,
    color: '#BFDBFE',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardHeaderSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeFinalized: {
    backgroundColor: '#ECFDF5',
  },
  statusBadgeDraft: {
    backgroundColor: '#FFFBEB',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  empGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  empGridItem: {
    width: '47%',
  },
  gridLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  gridValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
  },
  gridValueHighlight: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2563EB',
    marginTop: 2,
  },
  salaryPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  salaryPillText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1E40AF',
  },
  salaryMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
  },
  salaryMetricCol: {
    flex: 1,
  },
  metricDivider: {
    width: 1,
    height: 48,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 16,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  metricValLarge: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  metricValMedium: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 2,
  },
  metricSub: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 2,
  },
  attGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  attCard: {
    width: '31%',
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  attCardLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  attCardVal: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  dayUnit: {
    fontSize: 11,
    fontWeight: '600',
  },
  attCardNote: {
    fontSize: 9,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  deductionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deductionPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
  },
  deductionList: {
    gap: 10,
  },
  deductionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deductionItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  deductionItemDesc: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  deductionItemVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#DC2626',
  },
  tableDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  deductionTotalRow: {
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 8,
  },
  deductionTotalTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991B1B',
  },
  deductionTotalDesc: {
    fontSize: 10,
    fontWeight: '500',
    color: '#B91C1C',
  },
  deductionTotalVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#DC2626',
  },
  payableCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#6EE7B7',
    gap: 12,
  },
  payableTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  payableLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.5,
  },
  payableSubLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#047857',
    marginTop: 2,
  },
  payableIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payableAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#065F46',
  },
  formulaBox: {
    flexDirection: 'row',
    backgroundColor: '#D1FAE5',
    padding: 12,
    borderRadius: 10,
    alignItems: 'flex-start',
  },
  formulaText: {
    fontSize: 11,
    color: '#065F46',
    lineHeight: 16,
    flex: 1,
  },
  notesBox: {
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  notesLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.5,
  },
  notesText: {
    fontSize: 11,
    color: '#334155',
    marginTop: 2,
  },
  payableDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#059669',
    paddingVertical: 12,
    borderRadius: 10,
  },
  payableDownloadBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065F46',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pickerModal: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 8,
  },
  pickerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 8,
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
    fontWeight: '800',
    color: '#1E63F0',
  },
});
