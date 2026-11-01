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

  // Date selection states (Defaulting to October 2026 where Admin has uploaded official payslip)
  const [selectedMonth, setSelectedMonth] = useState<number>(10);
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  // Dropdown Picker Modals
  const [showMonthModal, setShowMonthModal] = useState<boolean>(false);
  const [showYearModal, setShowYearModal] = useState<boolean>(false);

  // Salary slip data states
  const [slip, setSlip] = useState<SalarySlip | null>(null);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Current logged in user ID (strictly technician's or supervisor's own ID)
  const currentUserId = user?.id || (user as any)?._id || (isSupervisor ? 'emp_05' : 'emp_01');

  // Fetch user's own salary slip
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

  // Download or Share Official Payslip PDF
  const handleDownloadOrShare = async (isShare: boolean = false) => {
    setDownloading(true);
    try {
      const token = useAuthStore.getState().token;
      const url = salaryService.getDownloadUrl(currentUserId, selectedMonth, selectedYear);

      if (Platform.OS === 'web') {
        window.open(url, '_blank');
        setDownloading(false);
        return;
      }

      const rawExt = slip?.fileName && slip.fileName.includes('.')
        ? slip.fileName.split('.').pop()
        : 'pdf';
      const filename = slip?.fileName || `Adani_Payslip_${slip?.employeeId || currentUserId}_${selectedMonth}_${selectedYear}.${rawExt}`;

      const destination = new ExpoFile(Paths.document, filename);
      const downloadedFile = await ExpoFile.downloadFileAsync(url, destination, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(downloadedFile.uri, {
          mimeType: rawExt === 'pdf' ? 'application/pdf' : 'text/plain',
          dialogTitle: `Adani Payslip - ${slip?.employeeName || user?.name || 'Technician'} (${MONTH_NAMES[selectedMonth - 1]} ${selectedYear})`,
          UTI: rawExt === 'pdf' ? 'com.adobe.pdf' : 'public.plain-text',
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

  return (
    <View style={styles.container}>
      {/* Sleek Top Navigation Bar */}
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
        {/* ============================================================== */}
        {/* TOP ROW: BADGE (LEFT) & DROPDOWN PILLS (RIGHT)                 */}
        {/* ============================================================== */}
        <View style={styles.topRow}>
          <View style={styles.badgePill}>
            <Text style={styles.badgePillText}>Workforce Payroll & Compensation</Text>
          </View>

          {/* Month & Year Selectors (Top Right, matching reference image) */}
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

        {/* Company Subtitle with Bullet */}
        <View style={styles.companyRow}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.companyNameText}>Adani Energy Solutions</Text>
        </View>

        {/* Main Title Heading */}
        <View style={styles.titleRow}>
          <View style={styles.banknoteBadge}>
            <Banknote size={26} color="#1E40AF" strokeWidth={2.4} />
          </View>
          <Text style={styles.mainTitleText}>Salary & Monthly Records</Text>
        </View>

        {/* Active Tab: [ My Salary Slip ] */}
        <View style={styles.tabRow}>
          <TouchableOpacity style={styles.activeTabBtn} activeOpacity={0.9}>
            <FileText size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.activeTabText}>My Salary Slip</Text>
          </TouchableOpacity>
        </View>

        {/* Download Button Aligned Directly Under "My Salary Slip" Tab */}
        <View style={styles.tabUnderActionRow}>
          <TouchableOpacity
            style={[
              styles.downloadBtn,
              downloading && { opacity: 0.75 },
            ]}
            onPress={() => handleDownloadOrShare(false)}
            activeOpacity={0.8}
            disabled={downloading}
          >
            <Download size={15} color="#FFFFFF" style={{ marginRight: 7 }} />
            <Text style={styles.downloadBtnText}>
              {downloading ? 'Downloading PDF Slip...' : 'Download PDF Slip'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.downloadSubText}>
            Official signed payslip for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </Text>
        </View>

        {/* ============================================================== */}
        {/* MAIN CARD CONTAINER: COMPREHENSIVE OFFICIAL PAYSLIP VIEW       */}
        {/* ============================================================== */}
        <View style={[styles.mainCard, SHADOWS.sm]}>
          {/* Card Header with Adani Branding */}
          <View style={styles.slipCardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.slipCardCompany}>Adani Energy Solutions Limited</Text>
              <Text style={styles.slipCardPeriod}>
                Payroll Period: {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </Text>
            </View>
            <View style={styles.paidStatusBadge}>
              <Check size={12} color="#15803D" style={{ marginRight: 4 }} />
              <Text style={styles.paidStatusBadgeText}>PAID & VERIFIED</Text>
            </View>
          </View>

          {/* Employee Metadata Grid */}
          <View style={styles.empMetaGrid}>
            <View style={styles.empMetaItem}>
              <Text style={styles.empMetaLabel}>EMPLOYEE NAME</Text>
              <Text style={styles.empMetaValue}>{slip?.employeeName || user?.name || 'Rohit Sharma'}</Text>
            </View>
            <View style={styles.empMetaItem}>
              <Text style={styles.empMetaLabel}>EMPLOYEE ID</Text>
              <Text style={styles.empMetaValue}>{slip?.employeeId || user?.employeeId || 'b4S/Adani/01'}</Text>
            </View>
            <View style={styles.empMetaItem}>
              <Text style={styles.empMetaLabel}>DESIGNATION</Text>
              <Text style={styles.empMetaValue}>{slip?.designation || user?.designation || 'Smart Meter Technician'}</Text>
            </View>
            <View style={styles.empMetaItem}>
              <Text style={styles.empMetaLabel}>DAYS WORKED</Text>
              <Text style={styles.empMetaValue}>{slip?.presentDays || 26} Present • {slip?.paidLeaves || 3} Paid Leave</Text>
            </View>
          </View>

          {/* Earnings & Deductions Tables */}
          <View style={styles.breakdownRow}>
            {/* Left: Earnings */}
            <View style={styles.breakdownCol}>
              <View style={styles.breakdownColHeaderGreen}>
                <Text style={styles.breakdownColTitleGreen}>Earnings</Text>
                <Text style={styles.breakdownColSubGreen}>Gross Pay</Text>
              </View>
              <View style={styles.breakdownList}>
                <View style={styles.breakdownLine}>
                  <Text style={styles.breakdownItemName}>Basic Salary</Text>
                  <Text style={styles.breakdownItemVal}>₹{(slip?.earnings?.basicSalary || 21000).toLocaleString('en-IN')}</Text>
                </View>
                <View style={styles.breakdownLine}>
                  <Text style={styles.breakdownItemName}>HRA Allowance</Text>
                  <Text style={styles.breakdownItemVal}>₹{(slip?.earnings?.hra || 8400).toLocaleString('en-IN')}</Text>
                </View>
                <View style={styles.breakdownLine}>
                  <Text style={styles.breakdownItemName}>Dearness Allowance (DA)</Text>
                  <Text style={styles.breakdownItemVal}>₹{(slip?.earnings?.da || 4200).toLocaleString('en-IN')}</Text>
                </View>
                <View style={styles.breakdownLine}>
                  <Text style={styles.breakdownItemName}>Field & Travel</Text>
                  <Text style={styles.breakdownItemVal}>₹{((slip?.earnings?.travelAllowance || 2500) + (slip?.earnings?.siteFieldAllowance || 2000)).toLocaleString('en-IN')}</Text>
                </View>
                <View style={[styles.breakdownLine, styles.breakdownLineTotal]}>
                  <Text style={styles.breakdownTotalLabel}>Gross Earnings</Text>
                  <Text style={styles.breakdownTotalVal}>₹{(slip?.earnings?.grossEarnings || 38100).toLocaleString('en-IN')}</Text>
                </View>
              </View>
            </View>

            {/* Right: Deductions */}
            <View style={styles.breakdownCol}>
              <View style={styles.breakdownColHeaderRed}>
                <Text style={styles.breakdownColTitleRed}>Deductions</Text>
                <Text style={styles.breakdownColSubRed}>Statutory</Text>
              </View>
              <View style={styles.breakdownList}>
                <View style={styles.breakdownLine}>
                  <Text style={styles.breakdownItemName}>Provident Fund (PF)</Text>
                  <Text style={styles.breakdownItemVal}>₹{(slip?.deductions?.pf || 2520).toLocaleString('en-IN')}</Text>
                </View>
                <View style={styles.breakdownLine}>
                  <Text style={styles.breakdownItemName}>ESIC Health</Text>
                  <Text style={styles.breakdownItemVal}>₹{(slip?.deductions?.esic || 285).toLocaleString('en-IN')}</Text>
                </View>
                <View style={styles.breakdownLine}>
                  <Text style={styles.breakdownItemName}>Professional Tax (PT)</Text>
                  <Text style={styles.breakdownItemVal}>₹{(slip?.deductions?.professionalTax || 200).toLocaleString('en-IN')}</Text>
                </View>
                <View style={styles.breakdownLine}>
                  <Text style={styles.breakdownItemName}>TDS / Income Tax</Text>
                  <Text style={styles.breakdownItemVal}>₹0</Text>
                </View>
                <View style={[styles.breakdownLine, styles.breakdownLineTotal]}>
                  <Text style={styles.breakdownTotalLabel}>Total Deductions</Text>
                  <Text style={[styles.breakdownTotalVal, { color: '#DC2626' }]}>₹{(slip?.deductions?.totalDeductions || 3005).toLocaleString('en-IN')}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Net Take-Home Salary Banner */}
          <View style={styles.netPayoutBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.netPayoutLabel}>NET TAKE-HOME DISBURSED</Text>
              <Text style={styles.netPayoutSub}>Transferred to Bank Account via NEFT</Text>
            </View>
            <Text style={styles.netPayoutAmount}>
              ₹{(slip?.netPay || 35095).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ============================================================== */}
      {/* MONTH SELECTION MODAL                                          */}
      {/* ============================================================== */}
      <Modal
        visible={showMonthModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMonthModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMonthModal(false)}
        >
          <View style={styles.pickerModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Payroll Month</Text>
              <TouchableOpacity onPress={() => setShowMonthModal(false)} style={styles.modalCloseBtn}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              {MONTH_NAMES.map((mName, idx) => {
                const monthNum = idx + 1;
                const isSelected = selectedMonth === monthNum;
                return (
                  <TouchableOpacity
                    key={monthNum}
                    style={[styles.modalItem, isSelected && styles.modalItemActive]}
                    onPress={() => {
                      setSelectedMonth(monthNum);
                      setShowMonthModal(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalItemText, isSelected && styles.modalItemTextActive]}>
                      {mName}
                    </Text>
                    {isSelected ? <Check size={18} color="#1E63F0" /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ============================================================== */}
      {/* YEAR SELECTION MODAL                                           */}
      {/* ============================================================== */}
      <Modal
        visible={showYearModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowYearModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowYearModal(false)}
        >
          <View style={styles.pickerModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Payroll Year</Text>
              <TouchableOpacity onPress={() => setShowYearModal(false)} style={styles.modalCloseBtn}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={{ paddingVertical: 6 }}>
              {AVAILABLE_YEARS.map((yr) => {
                const isSelected = selectedYear === yr;
                return (
                  <TouchableOpacity
                    key={yr}
                    style={[styles.modalItem, isSelected && styles.modalItemActive]}
                    onPress={() => {
                      setSelectedYear(yr);
                      setShowYearModal(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalItemText, isSelected && styles.modalItemTextActive]}>
                      {yr}
                    </Text>
                    {isSelected ? <Check size={18} color="#1E63F0" /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Navigation Drawer based on role */}
      {isSupervisor ? <SupervisorDrawerModal /> : <TechnicianDrawerModal />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  topNavLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navRoundBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
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
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // 1. Top Row: Badge (Left) & Dropdowns (Right)
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  badgePill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 4.5,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  badgePillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E40AF',
    letterSpacing: 0.2,
  },
  dropdownsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dropdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 5.5,
    ...SHADOWS.sm,
  },
  dropdownPillText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
  },

  // 2. Company Subtitle
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: 14,
    color: '#94A3B8',
    marginRight: 6,
  },
  companyNameText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },

  // 3. Main Title Row
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  banknoteBadge: {
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainTitleText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },

  // 4. Subtitle Description
  subtitleText: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },

  // 5. Tab Row
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1657E0',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    ...SHADOWS.sm,
  },
  activeTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tabUnderActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 10,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E63F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    ...SHADOWS.sm,
  },
  downloadBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  downloadSubText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },

  // 6. Main Card Container: Official Payslip View
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
  },
  slipCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 14,
  },
  slipCardCompany: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  slipCardPeriod: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  paidStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  paidStatusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  empMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  empMetaItem: {
    width: '50%',
    marginVertical: 4,
  },
  empMetaLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.3,
  },
  empMetaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  breakdownRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  breakdownCol: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  breakdownColHeaderGreen: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  breakdownColTitleGreen: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1E40AF',
  },
  breakdownColSubGreen: {
    fontSize: 10.5,
    color: '#3B82F6',
  },
  breakdownColHeaderRed: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FEE2E2',
  },
  breakdownColTitleRed: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#991B1B',
  },
  breakdownColSubRed: {
    fontSize: 10.5,
    color: '#EF4444',
  },
  breakdownList: {
    padding: 10,
  },
  breakdownLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  breakdownItemName: {
    fontSize: 11,
    color: '#475569',
  },
  breakdownItemVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
  breakdownLineTotal: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 6,
    marginTop: 6,
  },
  breakdownTotalLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  breakdownTotalVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  netPayoutBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    padding: 14,
  },
  netPayoutLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
  },
  netPayoutSub: {
    fontSize: 10.5,
    color: '#047857',
    marginTop: 2,
  },
  netPayoutAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#047857',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
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
    ...SHADOWS.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  modalItemActive: {
    backgroundColor: '#EFF6FF',
  },
  modalItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  modalItemTextActive: {
    color: '#1E63F0',
    fontWeight: '800',
  },
});
