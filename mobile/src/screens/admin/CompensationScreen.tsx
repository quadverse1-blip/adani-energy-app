import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Platform,
  Alert,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Menu,
  Upload,
  Download,
  Calendar,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  FileText,
  IndianRupee,
  ShieldCheck,
  Settings,
  Eye,
  TrendingDown,
  Lock,
  Edit3,
  HelpCircle,
  AlertCircle,
} from 'lucide-react-native';
import * as Sharing from 'expo-sharing';
import { Paths, File as ExpoFile } from 'expo-file-system';
import { useAdminDrawerStore } from '../../store/useAdminDrawerStore';
import { salaryService } from '../../services/salaryService';
import { employeeService } from '../../services/employeeService';
import { SalarySlip, SalarySummaryResponse, User, SalaryConfig } from '../../types';
import { UploadSalarySlipModal } from '../../components/compensation/UploadSalarySlipModal';
import { AdminDrawerModal } from '../../components/navigation/AdminDrawerModal';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { AppBackButton } from '../../components/common/AppBackButton';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const CompensationScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { openDrawer } = useAdminDrawerStore();

  const [selectedMonth, setSelectedMonth] = useState<number>(10); // Oct
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [summary, setSummary] = useState<SalarySummaryResponse | null>(null);
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const [search, setSearch] = useState<string>('');
  const [filterTab, setFilterTab] = useState<'all' | 'finalized' | 'draft'>('all');

  // Configure Salary Modal
  const [configModalVisible, setConfigModalVisible] = useState<boolean>(false);
  const [configuringEmp, setConfiguringEmp] = useState<SalarySlip | null>(null);
  const [configMonthlySalary, setConfigMonthlySalary] = useState<string>('20000');
  const [configAbsentRate, setConfigAbsentRate] = useState<string>('500');
  const [configHalfDayRate, setConfigHalfDayRate] = useState<string>('250');
  const [configNotes, setConfigNotes] = useState<string>('');
  const [configSaving, setConfigSaving] = useState<boolean>(false);

  // Review & Finalize Modal
  const [reviewModalVisible, setReviewModalVisible] = useState<boolean>(false);
  const [reviewingSlip, setReviewingSlip] = useState<SalarySlip | null>(null);
  const [finalizing, setFinalizing] = useState<boolean>(false);

  // Legacy Upload Modal
  const [uploadModalVisible, setUploadModalVisible] = useState<boolean>(false);
  const [selectedEmpForUpload, setSelectedEmpForUpload] = useState<string | undefined>(undefined);

  const isWide = width >= 768;

  const fetchData = async () => {
    try {
      const [sumRes, empRes] = await Promise.all([
        salaryService.getSalarySummary(selectedMonth, selectedYear),
        employeeService.getEmployees().catch(() => []),
      ]);
      setSummary(sumRes);

      if (empRes && empRes.length > 0) {
        setEmployees(empRes);
      } else if (sumRes?.slips && sumRes.slips.length > 0) {
        const mappedUsers: User[] = sumRes.slips.map((s) => ({
          id: s.employeeId,
          employeeId: s.employeeId,
          name: s.employeeName,
          designation: s.designation,
          role: 'technician',
          phone: '',
          status: 'active',
        }));
        setEmployees(mappedUsers);
      }
    } catch (e: any) {
      console.warn('Compensation fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const prevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  // Open Configure Modal
  const handleOpenConfigure = async (slip: SalarySlip) => {
    setConfiguringEmp(slip);
    setConfigMonthlySalary(String(slip.monthlySalary || 20000));
    setConfigAbsentRate(String(slip.absentDeductionRate || 500));
    setConfigHalfDayRate(String(slip.halfDayDeductionRate || 250));
    setConfigNotes(slip.notes || '');
    setConfigModalVisible(true);

    try {
      const liveCfg = await salaryService.getSalaryConfig(slip.employeeId);
      if (liveCfg) {
        setConfigMonthlySalary(String(liveCfg.monthlySalary));
        setConfigAbsentRate(String(liveCfg.absentDeductionRate));
        setConfigHalfDayRate(String(liveCfg.halfDayDeductionRate));
        if (liveCfg.notes) setConfigNotes(liveCfg.notes);
      }
    } catch (e) {
      // Use slip defaults
    }
  };

  // Save Config
  const handleSaveConfig = async () => {
    if (!configuringEmp) return;
    const mSalary = parseFloat(configMonthlySalary) || 20000;
    const aRate = parseFloat(configAbsentRate) || 500;
    const hdRate = parseFloat(configHalfDayRate) || 250;

    setConfigSaving(true);
    try {
      await salaryService.updateSalaryConfig(configuringEmp.employeeId, {
        monthlySalary: mSalary,
        absentDeductionRate: aRate,
        halfDayDeductionRate: hdRate,
        effectiveDate: `${selectedYear}-${selectedMonth < 10 ? '0' : ''}${selectedMonth}-01`,
        notes: configNotes || 'Updated from Admin Compensation Console',
      });
      Alert.alert(
        'Salary Configured',
        `Successfully updated compensation for ${configuringEmp.employeeName} (${configuringEmp.employeeId}).`
      );
      setConfigModalVisible(false);
      fetchData();
    } catch (e: any) {
      Alert.alert('Configuration Error', e.message || 'Failed to update salary settings.');
    } finally {
      setConfigSaving(false);
    }
  };

  // Finalize Salary
  const handleFinalizeStatement = async (slip: SalarySlip) => {
    setFinalizing(true);
    try {
      await salaryService.finalizeSalary({
        employeeId: slip.employeeId,
        month: selectedMonth,
        year: selectedYear,
        notes: 'Finalized and approved by Operations Admin',
      });
      Alert.alert('Statement Finalized', `Salary statement for ${slip.employeeName} has been frozen.`);
      setReviewModalVisible(false);
      fetchData();
    } catch (e: any) {
      Alert.alert('Finalize Error', e.message || 'Failed to finalize salary statement.');
    } finally {
      setFinalizing(false);
    }
  };

  // Download PDF
  const handleDownloadSlip = async (slip: SalarySlip) => {
    try {
      const url = salaryService.getDownloadUrl(slip.employeeId, selectedMonth, selectedYear);
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
        return;
      }

      const filename = `Adani_Payslip_${slip.employeeId.replace('/', '_')}_${selectedMonth}_${selectedYear}.pdf`;
      const destination = new ExpoFile(Paths.document, filename);
      const downloadedFile = await ExpoFile.downloadFileAsync(url, destination);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(downloadedFile.uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Adani Payslip - ${slip.employeeName}`,
        });
      } else {
        Alert.alert('Payslip Downloaded', `Saved to ${downloadedFile.uri}`);
      }
    } catch (err: any) {
      Alert.alert('Download Error', err.message || 'Failed to download payslip');
    }
  };

  const filteredSlips = useMemo(() => {
    if (!summary?.slips) return [];
    return summary.slips.filter((s) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        s.employeeName.toLowerCase().includes(q) ||
        s.employeeId.toLowerCase().includes(q) ||
        s.designation.toLowerCase().includes(q);

      if (!matchSearch) return false;

      const isFin = (s.status || '').toUpperCase() === 'FINALIZED' || (s.status || '').toUpperCase() === 'PAID';
      if (filterTab === 'finalized') return isFin;
      if (filterTab === 'draft') return !isFin;
      return true;
    });
  }, [summary, search, filterTab]);

  const totalDisbursed = summary?.totalNetPayable || 0;
  const totalDeductions = summary?.totalDeductions || 0;
  const totalGross = summary?.totalGrossDisbursed || 0;

  if (loading && !summary) {
    return <LoadingSpinner message="Loading workforce payroll & compensation..." />;
  }

  return (
    <View style={[styles.screen, { paddingTop: Math.max(insets.top, 12) }]}>
      {/* 1. Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <AppBackButton style={{ marginRight: 8 }} />
          <TouchableOpacity style={styles.menuBtn} onPress={() => openDrawer()} activeOpacity={0.7}>
            <Menu size={20} color="#0F172A" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Compensation & Salary</Text>
            <Text style={styles.headerSub}>Attendance-Based Payroll Management</Text>
          </View>
        </View>

        {/* Month Selector Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={styles.monthArrowBtn}>
            <ChevronLeft size={16} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.monthNavText}>
            {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </Text>
          <TouchableOpacity onPress={nextMonth} style={styles.monthArrowBtn}>
            <ChevronRight size={16} color="#1E293B" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) + 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1E63F0']} />}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Top Summary KPI Cards */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { borderLeftColor: '#2563EB', borderLeftWidth: 4 }]}>
            <Text style={styles.kpiLabel}>TOTAL ASSIGNED GROSS</Text>
            <Text style={styles.kpiValue}>₹{totalGross.toLocaleString('en-IN')}</Text>
            <Text style={styles.kpiSub}>{summary?.totalEmployees || 0} Workforce active</Text>
          </View>

          <View style={[styles.kpiCard, { borderLeftColor: '#DC2626', borderLeftWidth: 4 }]}>
            <Text style={styles.kpiLabel}>TOTAL DEDUCTIONS</Text>
            <Text style={[styles.kpiValue, { color: '#DC2626' }]}>-₹{totalDeductions.toLocaleString('en-IN')}</Text>
            <Text style={styles.kpiSub}>Absent + Half-day penalties</Text>
          </View>

          <View style={[styles.kpiCard, { borderLeftColor: '#059669', borderLeftWidth: 4 }]}>
            <Text style={styles.kpiLabel}>NET PAYABLE DISBURSEMENT</Text>
            <Text style={[styles.kpiValue, { color: '#059669' }]}>₹{totalDisbursed.toLocaleString('en-IN')}</Text>
            <Text style={styles.kpiSub}>{summary?.finalizedCount || 0} Finalized • {summary?.draftCount || 0} Drafts</Text>
          </View>
        </View>

        {/* 3. Search & Filter Bar */}
        <View style={styles.filterSection}>
          <View style={styles.searchBox}>
            <Search size={16} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by employee name, ID, or designation..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <X size={16} color="#64748B" />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, filterTab === 'all' && styles.tabBtnActive]}
              onPress={() => setFilterTab('all')}
            >
              <Text style={[styles.tabBtnText, filterTab === 'all' && styles.tabBtnTextActive]}>
                All Employees ({summary?.slips?.length || 0})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, filterTab === 'finalized' && styles.tabBtnActive]}
              onPress={() => setFilterTab('finalized')}
            >
              <Text style={[styles.tabBtnText, filterTab === 'finalized' && styles.tabBtnTextActive]}>
                Finalized ({summary?.finalizedCount || 0})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, filterTab === 'draft' && styles.tabBtnActive]}
              onPress={() => setFilterTab('draft')}
            >
              <Text style={[styles.tabBtnText, filterTab === 'draft' && styles.tabBtnTextActive]}>
                Drafts ({summary?.draftCount || 0})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 4. Employee-Wise Salary Table / Card View */}
        <View style={styles.tableCard}>
          <View style={styles.tableCardHeader}>
            <Text style={styles.tableCardTitle}>Workforce Attendance & Salary Roster</Text>
            <Text style={styles.tableCardSub}>
              {MONTH_NAMES[selectedMonth - 1]} {selectedYear} • Real-time Attendance Integration
            </Text>
          </View>

          {isWide ? (
            /* Desktop/Tablet Table Layout */
            <View style={styles.tableWrap}>
              <View style={styles.thRow}>
                <Text style={[styles.thCell, { flex: 2 }]}>EMPLOYEE</Text>
                <Text style={[styles.thCell, { flex: 1.2, textAlign: 'right' }]}>MONTHLY SALARY</Text>
                <Text style={[styles.thCell, { flex: 0.8, textAlign: 'center' }]}>P</Text>
                <Text style={[styles.thCell, { flex: 0.8, textAlign: 'center' }]}>A</Text>
                <Text style={[styles.thCell, { flex: 1, textAlign: 'center' }]}>HALF DAYS</Text>
                <Text style={[styles.thCell, { flex: 1.2, textAlign: 'right' }]}>DEDUCTION</Text>
                <Text style={[styles.thCell, { flex: 1.3, textAlign: 'right' }]}>NET SALARY</Text>
                <Text style={[styles.thCell, { flex: 1, textAlign: 'center' }]}>STATUS</Text>
                <Text style={[styles.thCell, { flex: 1.5, textAlign: 'center' }]}>ACTIONS</Text>
              </View>

              {filteredSlips.map((slip) => {
                const isFin = (slip.status || '').toUpperCase() === 'FINALIZED' || (slip.status || '').toUpperCase() === 'PAID';
                return (
                  <View key={slip.employeeId} style={styles.trRow}>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.tdEmpName}>{slip.employeeName}</Text>
                      <Text style={styles.tdEmpId}>{slip.employeeId} • {slip.designation}</Text>
                    </View>
                    <Text style={[styles.tdCell, { flex: 1.2, textAlign: 'right', fontWeight: '700' }]}>
                      ₹{(slip.monthlySalary || 20000).toLocaleString('en-IN')}
                    </Text>
                    <Text style={[styles.tdCell, { flex: 0.8, textAlign: 'center', color: '#15803D', fontWeight: '800' }]}>
                      {slip.presentDays || 0}
                    </Text>
                    <Text style={[styles.tdCell, { flex: 0.8, textAlign: 'center', color: '#DC2626', fontWeight: '800' }]}>
                      {slip.absentDays || 0}
                    </Text>
                    <Text style={[styles.tdCell, { flex: 1, textAlign: 'center', color: '#D97706', fontWeight: '800' }]}>
                      {slip.halfDays || 0}
                    </Text>
                    <Text style={[styles.tdCell, { flex: 1.2, textAlign: 'right', color: '#DC2626', fontWeight: '700' }]}>
                      -₹{(slip.totalDeductionAmount || 0).toLocaleString('en-IN')}
                    </Text>
                    <Text style={[styles.tdCell, { flex: 1.3, textAlign: 'right', color: '#059669', fontWeight: '900', fontSize: 13 }]}>
                      ₹{(slip.netPay || 0).toLocaleString('en-IN')}
                    </Text>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <View style={[styles.statusBadgeSmall, isFin ? styles.statusBadgeFin : styles.statusBadgeDr]}>
                        <Text style={[styles.statusBadgeTextSmall, { color: isFin ? '#059669' : '#D97706' }]}>
                          {isFin ? 'FINALIZED' : 'DRAFT'}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.actionsCell, { flex: 1.5 }]}>
                      <TouchableOpacity
                        style={styles.actionIconBtn}
                        onPress={() => handleOpenConfigure(slip)}
                        accessibilityLabel="Configure Salary"
                      >
                        <Settings size={14} color="#2563EB" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionIconBtn}
                        onPress={() => {
                          setReviewingSlip(slip);
                          setReviewModalVisible(true);
                        }}
                        accessibilityLabel="View Breakdown"
                      >
                        <Eye size={14} color="#059669" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionIconBtn}
                        onPress={() => handleDownloadSlip(slip)}
                        accessibilityLabel="Download PDF"
                      >
                        <Download size={14} color="#1E293B" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            /* Mobile Responsive Card Layout */
            <View style={styles.cardList}>
              {filteredSlips.map((slip) => {
                const isFin = (slip.status || '').toUpperCase() === 'FINALIZED' || (slip.status || '').toUpperCase() === 'PAID';
                return (
                  <View key={slip.employeeId} style={styles.mobileCard}>
                    {/* Top Identity Row */}
                    <View style={styles.mobileCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mobileEmpName}>{slip.employeeName}</Text>
                        <Text style={styles.mobileEmpId}>{slip.employeeId} • {slip.designation}</Text>
                      </View>
                      <View style={[styles.statusBadgeSmall, isFin ? styles.statusBadgeFin : styles.statusBadgeDr]}>
                        <Text style={[styles.statusBadgeTextSmall, { color: isFin ? '#059669' : '#D97706' }]}>
                          {isFin ? 'FINALIZED' : 'DRAFT'}
                        </Text>
                      </View>
                    </View>

                    {/* Attendance Grid Strip */}
                    <View style={styles.mobileAttStrip}>
                      <View style={styles.mobileAttCol}>
                        <Text style={styles.attStripLabel}>PRESENT</Text>
                        <Text style={[styles.attStripVal, { color: '#15803D' }]}>{slip.presentDays || 0}</Text>
                      </View>
                      <View style={styles.mobileAttCol}>
                        <Text style={styles.attStripLabel}>ABSENT</Text>
                        <Text style={[styles.attStripVal, { color: '#DC2626' }]}>{slip.absentDays || 0}</Text>
                      </View>
                      <View style={styles.mobileAttCol}>
                        <Text style={styles.attStripLabel}>HALF DAYS</Text>
                        <Text style={[styles.attStripVal, { color: '#D97706' }]}>{slip.halfDays || 0}</Text>
                      </View>
                      <View style={styles.mobileAttCol}>
                        <Text style={styles.attStripLabel}>WEEKLY OFF</Text>
                        <Text style={[styles.attStripVal, { color: '#2563EB' }]}>{slip.weeklyOffDays || 4}</Text>
                      </View>
                    </View>

                    {/* Financial Summary */}
                    <View style={styles.mobileFinRow}>
                      <View>
                        <Text style={styles.finLabel}>MONTHLY SALARY</Text>
                        <Text style={styles.finVal}>₹{(slip.monthlySalary || 20000).toLocaleString('en-IN')}</Text>
                      </View>
                      <View>
                        <Text style={styles.finLabel}>TOTAL DEDUCTION</Text>
                        <Text style={[styles.finVal, { color: '#DC2626' }]}>-₹{(slip.totalDeductionAmount || 0).toLocaleString('en-IN')}</Text>
                      </View>
                      <View>
                        <Text style={styles.finLabel}>NET SALARY</Text>
                        <Text style={[styles.finVal, { color: '#059669', fontSize: 16 }]}>₹{(slip.netPay || 0).toLocaleString('en-IN')}</Text>
                      </View>
                    </View>

                    {/* Card Actions */}
                    <View style={styles.mobileActionsRow}>
                      <TouchableOpacity
                        style={styles.mobileBtnSecondary}
                        onPress={() => handleOpenConfigure(slip)}
                      >
                        <Settings size={13} color="#2563EB" style={{ marginRight: 4 }} />
                        <Text style={styles.mobileBtnSecondaryText}>Configure</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.mobileBtnSecondary}
                        onPress={() => {
                          setReviewingSlip(slip);
                          setReviewModalVisible(true);
                        }}
                      >
                        <Eye size={13} color="#059669" style={{ marginRight: 4 }} />
                        <Text style={[styles.mobileBtnSecondaryText, { color: '#059669' }]}>Breakdown</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.mobileBtnPrimary}
                        onPress={() => handleDownloadSlip(slip)}
                      >
                        <Download size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.mobileBtnPrimaryText}>PDF Slip</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* 5. CONFIGURE SALARY MODAL */}
      <Modal visible={configModalVisible} transparent animationType="fade" onRequestClose={() => setConfigModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.configModalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Configure Employee Salary</Text>
                <Text style={styles.modalSub}>
                  {configuringEmp?.employeeName} ({configuringEmp?.employeeId})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setConfigModalVisible(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 14 }}>
              {/* Preset Buttons for Quick Custom Amounts */}
              <View>
                <Text style={styles.inputLabel}>QUICK SALARY PRESETS (INR)</Text>
                <View style={styles.presetsRow}>
                  {['10000', '15000', '20000', '25000', '50000'].map((amt) => (
                    <TouchableOpacity
                      key={amt}
                      style={[styles.presetBtn, configMonthlySalary === amt && styles.presetBtnActive]}
                      onPress={() => setConfigMonthlySalary(amt)}
                    >
                      <Text style={[styles.presetBtnText, configMonthlySalary === amt && styles.presetBtnTextActive]}>
                        ₹{parseInt(amt, 10).toLocaleString('en-IN')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Monthly Salary Input */}
              <View>
                <Text style={styles.inputLabel}>MONTHLY SALARY AMOUNT (₹) *</Text>
                <TextInput
                  style={styles.formInput}
                  keyboardType="numeric"
                  placeholder="e.g. 20000"
                  value={configMonthlySalary}
                  onChangeText={setConfigMonthlySalary}
                />
                <Text style={styles.inputHelp}>
                  Per-day rate: ₹{Math.round((parseFloat(configMonthlySalary || '0') / 30) * 100) / 100} / day (auto-calculated)
                </Text>
              </View>

              {/* Absent Deduction Input */}
              <View>
                <Text style={styles.inputLabel}>ABSENT-DAY DEDUCTION AMOUNT (₹) *</Text>
                <TextInput
                  style={styles.formInput}
                  keyboardType="numeric"
                  placeholder="e.g. 500"
                  value={configAbsentRate}
                  onChangeText={setConfigAbsentRate}
                />
                <Text style={styles.inputHelp}>Deducted per unauthorized absent day</Text>
              </View>

              {/* Half-Day Deduction Input */}
              <View>
                <Text style={styles.inputLabel}>HALF-DAY DEDUCTION AMOUNT (₹) *</Text>
                <TextInput
                  style={styles.formInput}
                  keyboardType="numeric"
                  placeholder="e.g. 250"
                  value={configHalfDayRate}
                  onChangeText={setConfigHalfDayRate}
                />
                <Text style={styles.inputHelp}>Deducted per partial shift (&lt; 8 hrs worked)</Text>
              </View>

              {/* Notes */}
              <View>
                <Text style={styles.inputLabel}>ADMIN NOTES / REMARKS (OPTIONAL)</Text>
                <TextInput
                  style={[styles.formInput, { height: 60, textAlignVertical: 'top' }]}
                  placeholder="e.g. Adjusted annual increment effective Q4"
                  multiline
                  value={configNotes}
                  onChangeText={setConfigNotes}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setConfigModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveConfig}
                disabled={configSaving}
              >
                {configSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Save Salary Settings</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 6. REVIEW & FINALIZE BREAKDOWN MODAL */}
      <Modal visible={reviewModalVisible} transparent animationType="slide" onRequestClose={() => setReviewModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.reviewModalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Salary Statement Review</Text>
                <Text style={styles.modalSub}>
                  {reviewingSlip?.employeeName} ({reviewingSlip?.employeeId}) • {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReviewModalVisible(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {reviewingSlip && (
              <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 12 }}>
                {/* Breakdown Summary Grid */}
                <View style={styles.breakdownBox}>
                  <Text style={styles.breakdownHeader}>ATTENDANCE BREAKDOWN</Text>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLbl}>Present (Full Shifts):</Text>
                    <Text style={styles.breakdownVal}>{Math.max(0, (reviewingSlip.presentDays || 0) - (reviewingSlip.halfDays || 0))} Days</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLbl}>Half Days (&lt; 8 hrs):</Text>
                    <Text style={[styles.breakdownVal, { color: '#D97706' }]}>{reviewingSlip.halfDays || 0} Days</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLbl}>Absent Days:</Text>
                    <Text style={[styles.breakdownVal, { color: '#DC2626' }]}>{reviewingSlip.absentDays || 0} Days</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLbl}>Weekly Offs (Sundays):</Text>
                    <Text style={styles.breakdownVal}>{reviewingSlip.weeklyOffDays || 4} Days</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLbl}>Gazetted Public Holidays:</Text>
                    <Text style={styles.breakdownVal}>{reviewingSlip.publicHolidayDays || 1} Days</Text>
                  </View>
                </View>

                {/* Calculation Box */}
                <View style={[styles.breakdownBox, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                  <Text style={[styles.breakdownHeader, { color: '#166534' }]}>CALCULATION DETAILS</Text>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLbl}>Monthly Assigned Base:</Text>
                    <Text style={[styles.breakdownVal, { fontWeight: '800' }]}>₹{(reviewingSlip.monthlySalary || 20000).toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLbl}>Absent Penalty ({reviewingSlip.absentDays || 0} × ₹{reviewingSlip.absentDeductionRate || 500}):</Text>
                    <Text style={[styles.breakdownVal, { color: '#DC2626' }]}>-₹{(reviewingSlip.absentDeductionTotal || 0).toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLbl}>Half-Day Penalty ({reviewingSlip.halfDays || 0} × ₹{reviewingSlip.halfDayDeductionRate || 250}):</Text>
                    <Text style={[styles.breakdownVal, { color: '#DC2626' }]}>-₹{(reviewingSlip.halfDayDeductionTotal || 0).toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: '#BBF7D0', paddingTop: 6, marginTop: 4 }]}>
                    <Text style={[styles.breakdownLbl, { fontWeight: '800', color: '#166534' }]}>Final Payable Salary:</Text>
                    <Text style={[styles.breakdownVal, { fontWeight: '900', color: '#15803D', fontSize: 16 }]}>
                      ₹{(reviewingSlip.netPay || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setReviewModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: '#059669' }]}
                onPress={() => reviewingSlip && handleFinalizeStatement(reviewingSlip)}
                disabled={finalizing}
              >
                {finalizing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Lock size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.modalSaveBtnText}>Freeze & Finalize</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Global Navigation Drawer */}
      <AdminDrawerModal />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthArrowBtn: {
    padding: 6,
  },
  monthNavText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    paddingHorizontal: 8,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  kpiCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 4,
  },
  kpiSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 2,
  },
  filterSection: {
    gap: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  tableCardHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  tableCardSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  tableWrap: {
    width: '100%',
  },
  thRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  thCell: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  trRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tdEmpName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  tdEmpId: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  tdCell: {
    fontSize: 12,
    color: '#334155',
  },
  statusBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeFin: {
    backgroundColor: '#ECFDF5',
  },
  statusBadgeDr: {
    backgroundColor: '#FFFBEB',
  },
  statusBadgeTextSmall: {
    fontSize: 9,
    fontWeight: '800',
  },
  actionsCell: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  actionIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardList: {
    padding: 12,
    gap: 12,
  },
  mobileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10,
  },
  mobileCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mobileEmpName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  mobileEmpId: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  mobileAttStrip: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
  },
  mobileAttCol: {
    flex: 1,
    alignItems: 'center',
  },
  attStripLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  attStripVal: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  mobileFinRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  finLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.4,
  },
  finVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 2,
  },
  mobileActionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  mobileBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    borderRadius: 8,
  },
  mobileBtnSecondaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  mobileBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    borderRadius: 8,
  },
  mobileBtnPrimaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  configModalContainer: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 14,
  },
  reviewModalContainer: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  presetBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  presetBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  presetBtnTextActive: {
    color: '#2563EB',
    fontWeight: '800',
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  inputHelp: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },
  modalSaveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  breakdownBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  breakdownHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  breakdownLbl: {
    fontSize: 12,
    color: '#475569',
  },
  breakdownVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
});
