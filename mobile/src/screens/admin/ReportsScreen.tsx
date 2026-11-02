import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ScrollView,
  RefreshControl,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Building2,
  FileSpreadsheet,
  Download,
  Printer,
  Filter,
  Grid,
  ArrowLeft,
  FileText,
  Menu,
  Info,
  Sparkles,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { siteService } from '../../services/siteService';
import { attendanceService } from '../../services/attendanceService';
import { reportService, MusterRecord, MusterDay } from '../../services/reportService';
import { Substation } from '../../types';
import { SHADOWS } from '../../constants/theme';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useAdminDrawerStore } from '../../store/useAdminDrawerStore';
import { AdminDrawerModal } from '../../components/navigation/AdminDrawerModal';
import { useSupervisorDrawerStore } from '../../store/useSupervisorDrawerStore';
import { SupervisorDrawerModal } from '../../components/navigation/SupervisorDrawerModal';
import { useAuthStore } from '../../store/useAuthStore';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const ReportsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { openDrawer: openAdminDrawer } = useAdminDrawerStore();
  const { openDrawer: openSupervisorDrawer } = useSupervisorDrawerStore();
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 920;

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else if (user?.role === 'supervisor') {
      navigation.navigate('SupervisorDashboard');
    } else {
      navigation.navigate('AdminDashboard');
    }
  };

  const handleMenuPress = () => {
    if (user?.role === 'supervisor') {
      openSupervisorDrawer('Reports');
    } else {
      openAdminDrawer('Reports');
    }
  };

  // 1. Dynamic System Date Initialization (Requirement 1)
  const systemDate = useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = useState<number>(systemDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(systemDate.getFullYear());

  // Date range display strings
  const daysInSelectedMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 0).getDate();
  }, [selectedYear, selectedMonth]);

  const fromDateStr = `01-${String(selectedMonth).padStart(2, '0')}-${selectedYear}`;
  const toDateStr = `${String(daysInSelectedMonth).padStart(2, '0')}-${String(selectedMonth).padStart(2, '0')}-${selectedYear}`;

  // Site Filter Dropdown
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>('all');
  const [showSitePickerModal, setShowSitePickerModal] = useState<boolean>(false);
  const [sites, setSites] = useState<Substation[]>([]);

  // Muster Roll & Days Metadata
  const [musterRecords, setMusterRecords] = useState<MusterRecord[]>([]);
  const [daysMeta, setDaysMeta] = useState<MusterDay[]>([]);
  const [monthName, setMonthName] = useState<string>(
    `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`
  );

  // Strict 4 Status KPI Stats (Requirement 2 & 5)
  const [musterStats, setMusterStats] = useState({
    totalShifts: 0,
    present: 0,
    absent: 0,
    weeklyOff: 0,
    publicHolidays: 0,
    compliance: '0%',
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);

  // Admin Attendance Marking Modal State (Requirement 2)
  const [markModalVisible, setMarkModalVisible] = useState<boolean>(false);
  const [markEmpId, setMarkEmpId] = useState<string>('');
  const [markEmpName, setMarkEmpName] = useState<string>('');
  const [markDate, setMarkDate] = useState<string>('');
  const [markStatus, setMarkStatus] = useState<'P' | 'A'>('P');
  const [markRemarks, setMarkRemarks] = useState<string>('Marked Present by Operations Admin');
  const [savingMark, setSavingMark] = useState<boolean>(false);

  // Calendar Picker for Mark Attendance Modal
  const [showMarkDatePicker, setShowMarkDatePicker] = useState<boolean>(false);
  const [markCalYear, setMarkCalYear] = useState<number>(new Date().getFullYear());
  const [markCalMonth, setMarkCalMonth] = useState<number>(new Date().getMonth());

  const WEEKDAY_NAMES_MARK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const handlePrevMarkCalMonth = () => {
    if (markCalMonth === 0) {
      setMarkCalMonth(11);
      setMarkCalYear((prev) => prev - 1);
    } else {
      setMarkCalMonth((prev) => prev - 1);
    }
  };

  const handleNextMarkCalMonth = () => {
    if (markCalMonth === 11) {
      setMarkCalMonth(0);
      setMarkCalYear((prev) => prev + 1);
    } else {
      setMarkCalMonth((prev) => prev + 1);
    }
  };

  const handleSelectMarkCalDay = (day: number) => {
    const mm = String(markCalMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const pickedDate = `${markCalYear}-${mm}-${dd}`;
    setMarkDate(pickedDate);
    setShowMarkDatePicker(false);
  };

  const handleSelectMarkToday = () => {
    const today = new Date();
    setMarkCalYear(today.getFullYear());
    setMarkCalMonth(today.getMonth());
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setMarkDate(`${today.getFullYear()}-${mm}-${dd}`);
    setShowMarkDatePicker(false);
  };

  const daysInMarkCalMonth = new Date(markCalYear, markCalMonth + 1, 0).getDate();
  const markCalFirstDayOffset = new Date(markCalYear, markCalMonth, 1).getDay();

  const handleOpenMarkModal = (emp?: MusterRecord, dayDate?: string) => {
    if (user?.role !== 'admin') {
      Alert.alert('Permission Denied', 'Only Operations Administrators have permission to mark or adjust attendance records.');
      return;
    }

    if (emp) {
      setMarkEmpId(emp.employeeCode || emp.employeeName);
      setMarkEmpName(`${emp.employeeName} (${emp.employeeCode})`);
    } else if (musterRecords.length > 0) {
      setMarkEmpId(musterRecords[0].employeeCode || musterRecords[0].employeeName);
      setMarkEmpName(`${musterRecords[0].employeeName} (${musterRecords[0].employeeCode})`);
    } else {
      setMarkEmpId('');
      setMarkEmpName('');
    }

    if (dayDate) {
      setMarkDate(dayDate);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dayDate)) {
        const p = dayDate.split('-');
        setMarkCalYear(parseInt(p[0], 10));
        setMarkCalMonth(parseInt(p[1], 10) - 1);
      }
    } else {
      const today = new Date();
      const dStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      setMarkDate(dStr);
      setMarkCalYear(today.getFullYear());
      setMarkCalMonth(today.getMonth());
    }

    setShowMarkDatePicker(false);
    setMarkStatus('P');
    setMarkRemarks('Marked Present by Operations Admin');
    setMarkModalVisible(true);
  };

  const handleSaveAttendanceMark = async () => {
    if (!markEmpId) {
      Alert.alert('Select Employee', 'Please select a field employee.');
      return;
    }
    if (!markDate) {
      Alert.alert('Select Date', 'Please enter a valid date in YYYY-MM-DD format.');
      return;
    }

    setSavingMark(true);
    try {
      const res = await attendanceService.markAttendance({
        employeeId: markEmpId,
        date: markDate,
        status: markStatus,
        adminRemarks: markRemarks,
      });

      Alert.alert(
        'Attendance Updated',
        `Successfully recorded ${markStatus} for ${markEmpName || markEmpId} on ${markDate}.

Synchronized across all dashboards and muster reports.`,
        [{ text: 'OK' }]
      );
      setMarkModalVisible(false);
      fetchMusterData();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to mark attendance';
      Alert.alert('Attendance Update Error', msg);
    } finally {
      setSavingMark(false);
    }
  };

  // Holiday Details Popup Modal
  const [holidayTooltip, setHolidayTooltip] = useState<{
    visible: boolean;
    name: string;
    date: string;
    empName?: string;
  }>({
    visible: false,
    name: '',
    date: '',
  });

  const fetchMusterData = async () => {
    setLoading(true);
    try {
      const [siteList, musterRes] = await Promise.all([
        siteService.getSites().catch(() => []),
        reportService.getMusterRoll(selectedMonth, selectedYear, selectedSiteFilter).catch(() => null),
      ]);
      setSites(siteList);

      if (musterRes && musterRes.records) {
        setMusterRecords(musterRes.records);
        setDaysMeta(musterRes.days || []);
        setMonthName(musterRes.monthName || `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`);
        if (musterRes.stats) {
          setMusterStats({
            totalShifts: musterRes.stats.totalShifts,
            present: musterRes.stats.present,
            absent: musterRes.stats.absent,
            weeklyOff: musterRes.stats.weeklyOff,
            publicHolidays: musterRes.stats.publicHolidays,
            compliance: musterRes.stats.compliance,
          });
        }
      }
    } catch (err) {
      console.warn('ReportsScreen load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMusterData();
  }, [selectedMonth, selectedYear, selectedSiteFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const musterRes = await reportService.getMusterRoll(selectedMonth, selectedYear, selectedSiteFilter);
      if (musterRes && musterRes.records) {
        setMusterRecords(musterRes.records);
        setDaysMeta(musterRes.days || []);
        setMonthName(musterRes.monthName);
        if (musterRes.stats) {
          setMusterStats({
            totalShifts: musterRes.stats.totalShifts,
            present: musterRes.stats.present,
            absent: musterRes.stats.absent,
            weeklyOff: musterRes.stats.weeklyOff,
            publicHolidays: musterRes.stats.publicHolidays,
            compliance: musterRes.stats.compliance,
          });
        }
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setRefreshing(false);
    }
  };

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  const handleResetToCurrentMonth = () => {
    const now = new Date();
    setSelectedMonth(now.getMonth() + 1);
    setSelectedYear(now.getFullYear());
  };

  // Download Official Muster Roll Excel (.xlsx) (Requirement 5)
  const handleDownloadMusterExcel = async () => {
    setExporting(true);
    try {
      await reportService.downloadMusterRollExcel(selectedMonth, selectedYear, selectedSiteFilter);
      Alert.alert(
        'Excel Report Downloaded',
        `Official Attendance Muster Roll for ${monthName} (.xlsx) has been generated with horizontal dates and P, A, WO, PH statuses.`
      );
    } catch (err: any) {
      Alert.alert('Download Error', err.message || 'Failed to download Excel report');
    } finally {
      setExporting(false);
    }
  };

  // Print or Export PDF Report
  const handleExportPDF = () => {
    if (Platform.OS === 'web') {
      window.print();
    } else {
      Alert.alert(
        'Export PDF Report',
        `Generating printable attendance register for ${monthName}.`,
        [{ text: 'OK' }]
      );
    }
  };

  const selectedSiteLabel = useMemo(() => {
    if (selectedSiteFilter === 'all') return 'All Sites';
    const found = sites.find((s) => s.id === selectedSiteFilter);
    return found ? found.name : 'All Sites';
  }, [selectedSiteFilter, sites]);

  // Fallback days meta if not loaded yet
  const displayDays: MusterDay[] = useMemo(() => {
    if (daysMeta.length > 0) return daysMeta;
    const list: MusterDay[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    for (let d = 1; d <= daysInSelectedMonth; d++) {
      const dt = new Date(selectedYear, selectedMonth - 1, d);
      const dayName = dayNames[dt.getDay()];
      const isToday =
        dt.getDate() === now.getDate() &&
        dt.getMonth() === now.getMonth() &&
        dt.getFullYear() === now.getFullYear();
      list.push({
        day: d,
        date: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        dayName,
        label: `${String(d).padStart(2, '0')} ${dayName}`,
        isSunday: dt.getDay() === 0,
        isHoliday: false,
        isToday,
      });
    }
    return list;
  }, [daysMeta, daysInSelectedMonth, selectedYear, selectedMonth]);

  // Strictly 4 permitted attendance statuses renderer (Requirement 2 & 4)
  const renderStatusCell = (
    val: string = '-',
    holidayName?: string,
    row?: MusterRecord,
    dm?: MusterDay
  ) => {
    let textColor = '#94A3B8';
    let bgColor = '#FFFFFF';
    let borderColor = '#E2E8F0';

    if (val === 'P') {
      textColor = '#166534'; // Green Present
      bgColor = '#DCFCE7';
      borderColor = '#BBF7D0';
    } else if (val === 'A') {
      textColor = '#991B1B'; // Red Absent
      bgColor = '#FEE2E2';
      borderColor = '#FECACA';
    } else if (val === 'WO') {
      textColor = '#1E40AF'; // Blue Weekly Off
      bgColor = '#DBEAFE';
      borderColor = '#BFDBFE';
    } else if (val === 'PH') {
      textColor = '#6B21A8'; // Purple Public Holiday
      bgColor = '#F3E8FF';
      borderColor = '#E9D5FF';
    }

    const isPH = val === 'PH';
    const isInteractive = isPH || user?.role === 'admin';

    return (
      <TouchableOpacity delayPressIn={0}
        style={[
          styles.statusBadge,
          { backgroundColor: bgColor, borderColor },
          isPH && { borderWidth: 1.5 },
        ]}
        activeOpacity={isInteractive ? 0.7 : 1}
        onPress={() => {
          if (isPH && holidayName) {
            setHolidayTooltip({
              visible: true,
              name: holidayName,
              date: dm?.date || '',
              empName: row?.employeeName,
            });
          } else if (user?.role === 'admin' && row && dm) {
            handleOpenMarkModal(row, dm.date);
          }
        }}
      >
        <Text style={[styles.statusBadgeText, { color: textColor }]}>
          {val}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* ========================================================================= */}
      {/* 1. TOP HEADER APP BAR                                                    */}
      {/* ========================================================================= */}
      <View style={[styles.topHeaderBar, { paddingTop: Math.max(insets.top, 16) + 6 }]}>
        <View style={styles.topHeaderRow1}>
          <TouchableOpacity delayPressIn={0}
            style={styles.menuCircleBtn}
            onPress={handleMenuPress}
            activeOpacity={0.7}
            accessibilityLabel="Open Navigation Menu"
          >
            <Menu size={20} color="#0F172A" />
          </TouchableOpacity>

          <TouchableOpacity delayPressIn={0}
            style={styles.backCircleBtn}
            onPress={handleBack}
            activeOpacity={0.7}
            accessibilityLabel="Go Back"
          >
            <ArrowLeft size={18} color="#0F172A" />
          </TouchableOpacity>

          <View style={{ marginLeft: 8, flex: 1, paddingRight: 40 }}>
            <Text style={styles.mainTitle} numberOfLines={1}>Reports & Export</Text>
          </View>
        </View>

        {/* Action Buttons Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topActionsRow}
        >
          <TouchableOpacity delayPressIn={0}
            style={styles.btnPrimaryGreen}
            onPress={handleDownloadMusterExcel}
            activeOpacity={0.85}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
            ) : (
              <FileSpreadsheet size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            )}
            <Text style={styles.btnPrimaryGreenText}>Download Excel (.xlsx)</Text>
          </TouchableOpacity>

          {user?.role === 'admin' ? (
            <TouchableOpacity delayPressIn={0}
              style={styles.btnBlueMark}
              onPress={() => handleOpenMarkModal()}
              activeOpacity={0.8}
            >
              <Check size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
              <Text style={styles.btnBlueMarkText}>Mark Present (P)</Text>
            </TouchableOpacity>
          ) : null}

          {user?.role === 'admin' ? (
            <TouchableOpacity delayPressIn={0}
              style={styles.btnPurple}
              onPress={() => navigation.navigate('Holidays')}
              activeOpacity={0.8}
            >
              <Calendar size={13} color="#6B21A8" style={{ marginRight: 5 }} />
              <Text style={styles.btnPurpleText}>Manage Holidays</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity delayPressIn={0}
            style={styles.btnSecondary}
            onPress={() => navigation.navigate('AttendanceLogs')}
            activeOpacity={0.8}
          >
            <FileText size={13} color="#334155" style={{ marginRight: 5 }} />
            <Text style={styles.btnSecondaryText}>Detailed Logs</Text>
          </TouchableOpacity>

          <TouchableOpacity delayPressIn={0}
            style={styles.btnSecondary}
            onPress={handleExportPDF}
            activeOpacity={0.8}
          >
            <Printer size={13} color="#334155" style={{ marginRight: 5 }} />
            <Text style={styles.btnSecondaryText}>Print / PDF</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={[
          styles.mainScrollContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 40 },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#10B981']} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================================= */}
        {/* 2. DYNAMIC REAL-TIME CALENDAR & MONTH NAVIGATOR (Requirement 1)          */}
        {/* ========================================================================= */}
        <View style={[styles.filterCard, SHADOWS.sm]}>
          <View style={styles.filterCardHeader}>
            <View style={styles.filterTitleRow}>
              <Calendar size={16} color="#1E63F0" style={{ marginRight: 6 }} />
              <Text style={styles.filterCardTitle}>REAL-TIME ATTENDANCE CALENDAR</Text>
            </View>

            {/* Month & Year Stepper */}
            <View style={styles.monthNavRow}>
              <TouchableOpacity delayPressIn={0}
                style={styles.monthNavArrow}
                onPress={handlePrevMonth}
                activeOpacity={0.7}
              >
                <ChevronLeft size={16} color="#1E293B" />
              </TouchableOpacity>

              <View style={styles.currentMonthBadge}>
                <Text style={styles.currentMonthText}>{monthName}</Text>
              </View>

              <TouchableOpacity delayPressIn={0}
                style={styles.monthNavArrow}
                onPress={handleNextMonth}
                activeOpacity={0.7}
              >
                <ChevronRight size={16} color="#1E293B" />
              </TouchableOpacity>

              {/* Jump to Today Button */}
              <TouchableOpacity delayPressIn={0}
                style={styles.todayJumpBtn}
                onPress={handleResetToCurrentMonth}
                activeOpacity={0.8}
              >
                <Sparkles size={12} color="#1E63F0" style={{ marginRight: 4 }} />
                <Text style={styles.todayJumpBtnText}>Current Month</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Date Parameters & Deployment Site Filter */}
          <View style={styles.filterInputsRow}>
            <View style={styles.inputCol}>
              <Text style={styles.inputLabel}>From Date</Text>
              <View style={styles.inputBoxWrap}>
                <Text style={styles.inputFieldStatic}>{fromDateStr}</Text>
                <Calendar size={14} color="#64748B" />
              </View>
            </View>

            <View style={styles.inputCol}>
              <Text style={styles.inputLabel}>To Date</Text>
              <View style={styles.inputBoxWrap}>
                <Text style={styles.inputFieldStatic}>{toDateStr}</Text>
                <Calendar size={14} color="#64748B" />
              </View>
            </View>

            <View style={styles.inputCol}>
              <Text style={styles.inputLabel}>Deployment Location / Site</Text>
              <TouchableOpacity delayPressIn={0}
                style={styles.inputBoxWrap}
                onPress={() => setShowSitePickerModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.dropdownSelectText} numberOfLines={1}>
                  {selectedSiteLabel}
                </Text>
                <ChevronDown size={14} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* 3. STRICT 4 STATUS KPI STATS (P, A, WO, PH) (Requirement 2 & 5)           */}
        {/* ========================================================================= */}
        {isWide ? (
          <View style={styles.kpiCardsRowWide}>
            {/* PRESENT (P) */}
            <View style={[styles.kpiCardWide, styles.kpiCardBorderGreen, SHADOWS.sm]}>
              <Text style={[styles.kpiLabel, { color: '#059669' }]}>PRESENT (P)</Text>
              <Text style={[styles.kpiValueDark, { color: '#059669' }]}>{musterStats.present}</Text>
              <Text style={styles.kpiSub}>On-duty completed shifts</Text>
            </View>

            {/* ABSENT (A) */}
            <View style={[styles.kpiCardWide, styles.kpiCardBorderRed, SHADOWS.sm]}>
              <Text style={[styles.kpiLabel, { color: '#DC2626' }]}>ABSENT (A)</Text>
              <Text style={[styles.kpiValueDark, { color: '#DC2626' }]}>{musterStats.absent}</Text>
              <Text style={styles.kpiSub}>Unrecorded working days</Text>
            </View>

            {/* WEEKLY OFF (WO) */}
            <View style={[styles.kpiCardWide, styles.kpiCardBorderBlue, SHADOWS.sm]}>
              <Text style={[styles.kpiLabel, { color: '#2563EB' }]}>WEEKLY OFF (WO)</Text>
              <Text style={[styles.kpiValueDark, { color: '#2563EB' }]}>{musterStats.weeklyOff}</Text>
              <Text style={styles.kpiSub}>Scheduled Sundays</Text>
            </View>

            {/* PUBLIC HOLIDAYS (PH) */}
            <View style={[styles.kpiCardWide, styles.kpiCardBorderPurple, SHADOWS.sm]}>
              <Text style={[styles.kpiLabel, { color: '#7C3AED' }]}>PUBLIC HOLIDAYS (PH)</Text>
              <Text style={[styles.kpiValueDark, { color: '#7C3AED' }]}>{musterStats.publicHolidays}</Text>
              <Text style={styles.kpiSub}>Centralized gazetted holidays</Text>
            </View>

            {/* COMPLIANCE */}
            <View style={[styles.kpiCardWide, SHADOWS.sm]}>
              <Text style={styles.kpiLabel}>COMPLIANCE</Text>
              <Text style={styles.kpiValueDark}>{musterStats.compliance}</Text>
              <Text style={styles.kpiSub}>Present / Scheduled ratio</Text>
            </View>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.kpiCardsScroll}
          >
            <View style={[styles.kpiCard, styles.kpiCardBorderGreen, SHADOWS.sm]}>
              <Text style={[styles.kpiLabel, { color: '#059669' }]}>PRESENT (P)</Text>
              <Text style={[styles.kpiValueDark, { color: '#059669' }]}>{musterStats.present}</Text>
              <Text style={styles.kpiSub}>On-duty completed</Text>
            </View>

            <View style={[styles.kpiCard, styles.kpiCardBorderRed, SHADOWS.sm]}>
              <Text style={[styles.kpiLabel, { color: '#DC2626' }]}>ABSENT (A)</Text>
              <Text style={[styles.kpiValueDark, { color: '#DC2626' }]}>{musterStats.absent}</Text>
              <Text style={styles.kpiSub}>Unrecorded days</Text>
            </View>

            <View style={[styles.kpiCard, styles.kpiCardBorderBlue, SHADOWS.sm]}>
              <Text style={[styles.kpiLabel, { color: '#2563EB' }]}>WEEKLY OFF (WO)</Text>
              <Text style={[styles.kpiValueDark, { color: '#2563EB' }]}>{musterStats.weeklyOff}</Text>
              <Text style={styles.kpiSub}>Scheduled Sundays</Text>
            </View>

            <View style={[styles.kpiCard, styles.kpiCardBorderPurple, SHADOWS.sm]}>
              <Text style={[styles.kpiLabel, { color: '#7C3AED' }]}>PUBLIC HOLIDAYS (PH)</Text>
              <Text style={[styles.kpiValueDark, { color: '#7C3AED' }]}>{musterStats.publicHolidays}</Text>
              <Text style={styles.kpiSub}>Centralized holidays</Text>
            </View>

            <View style={[styles.kpiCard, SHADOWS.sm]}>
              <Text style={styles.kpiLabel}>COMPLIANCE</Text>
              <Text style={styles.kpiValueDark}>{musterStats.compliance}</Text>
              <Text style={styles.kpiSub}>Present ratio</Text>
            </View>
          </ScrollView>
        )}

        {/* ========================================================================= */}
        {/* 4. HORIZONTAL ATTENDANCE REGISTER (Requirement 1, 2, 4)                  */}
        {/* ========================================================================= */}
        <View style={[styles.registerCard, SHADOWS.md]}>
          {/* Header Banner */}
          <View style={styles.registerDarkHeader}>
            <View style={styles.registerHeaderTop}>
              <View style={styles.b4sLogoBadge}>
                <Text style={styles.b4sLogoText}>b4S</Text>
              </View>

              <View style={{ marginLeft: 10, flex: 1, paddingRight: 6 }}>
                <Text style={styles.registerSmallLabel}>HORIZONTAL ATTENDANCE CALENDAR</Text>
                <Text style={styles.registerTitle} numberOfLines={1}>
                  ATTENDANCE REGISTER • {monthName.toUpperCase()}
                </Text>
              </View>

              <TouchableOpacity delayPressIn={0}
                style={styles.registerDownloadBtn}
                onPress={handleDownloadMusterExcel}
                activeOpacity={0.85}
                disabled={exporting}
              >
                {exporting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 4 }} />
                ) : (
                  <Download size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                )}
                <Text style={styles.registerDownloadBtnText}>Excel</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.registerHeaderBottom}>
              <Text style={styles.registerSubtitle} numberOfLines={1}>
                {selectedSiteLabel.toUpperCase()} • {displayDays.length} DAYS • ONLY P, A, WO, PH
              </Text>
              <Text style={styles.swipeHintText}>
                ⇆ Scroll horizontally to view all days
              </Text>
            </View>
          </View>

          {/* Frozen Employee Column + Horizontally Scrollable Dates Layout */}
          <View style={styles.gridContainer}>
            {/* FROZEN LEFT COLUMN: Employee Info (Requirement 4) */}
            <View style={styles.frozenColumn}>
              {/* Header Cell */}
              <View style={[styles.frozenHeaderCell, { height: 46 }]}>
                <Text style={styles.frozenHeaderLabel}>EMPLOYEE</Text>
              </View>

              {/* Rows */}
              {loading ? (
                <View style={{ height: 200, justifyContent: 'center', alignItems: 'center' }}>
                  <LoadingSpinner message="" />
                </View>
              ) : (
                musterRecords.map((row, index) => (
                  <View
                    key={row.sr || index}
                    style={[
                      styles.frozenRowCell,
                      { height: 46 },
                      index % 2 === 1 && { backgroundColor: '#F8FAFC' },
                    ]}
                  >
                    <Text style={styles.frozenEmpName} numberOfLines={1}>
                      {row.sr}. {row.employeeName}
                    </Text>
                    <Text style={styles.frozenEmpSub} numberOfLines={1}>
                      {row.employeeCode} • {row.designation}
                    </Text>
                  </View>
                ))
              )}
            </View>

            {/* HORIZONTALLY SCROLLABLE DATES & SUMMARY (Requirement 4) */}
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View>
                {/* Horizontal Header Row: Dates & Summaries */}
                <View style={[styles.scrollableHeaderRow, { height: 46 }]}>
                  {/* Days 1 to daysInMonth Header Cells (01 Sun, 02 Mon, etc.) */}
                  {displayDays.map((dm) => {
                    const isToday = dm.isToday;
                    const isSunday = dm.isSunday;
                    const isHoliday = dm.isHoliday;

                    return (
                      <View
                        key={dm.day}
                        style={[
                          styles.dayColHeader,
                          { width: 50 },
                          isSunday && styles.sundayColHeader,
                          isHoliday && styles.holidayColHeader,
                          isToday && styles.todayColHeader,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayColNum,
                            isToday && styles.todayColNum,
                            isHoliday && { color: '#6B21A8' },
                          ]}
                        >
                          {String(dm.day).padStart(2, '0')}
                        </Text>
                        <Text
                          style={[
                            styles.dayColDay,
                            isToday && styles.todayColDay,
                            isSunday && { color: '#2563EB' },
                            isHoliday && { color: '#7C3AED' },
                          ]}
                        >
                          {dm.dayName}
                        </Text>
                        {isToday ? (
                          <View style={styles.todayDot} />
                        ) : null}
                      </View>
                    );
                  })}

                  {/* Employee-wise Attendance Summary Column Headers (Requirement 5) */}
                  <View style={[styles.summaryColHeader, { width: 44, backgroundColor: '#ECFDF5' }]}>
                    <Text style={[styles.summaryColHeaderText, { color: '#059669' }]}>P</Text>
                    <Text style={styles.summaryColHeaderSub}>Present</Text>
                  </View>
                  <View style={[styles.summaryColHeader, { width: 44, backgroundColor: '#FEF2F2' }]}>
                    <Text style={[styles.summaryColHeaderText, { color: '#DC2626' }]}>A</Text>
                    <Text style={styles.summaryColHeaderSub}>Absent</Text>
                  </View>
                  <View style={[styles.summaryColHeader, { width: 44, backgroundColor: '#EFF6FF' }]}>
                    <Text style={[styles.summaryColHeaderText, { color: '#2563EB' }]}>WO</Text>
                    <Text style={styles.summaryColHeaderSub}>Off</Text>
                  </View>
                  <View style={[styles.summaryColHeader, { width: 44, backgroundColor: '#FAF5FF' }]}>
                    <Text style={[styles.summaryColHeaderText, { color: '#7C3AED' }]}>PH</Text>
                    <Text style={styles.summaryColHeaderSub}>Holiday</Text>
                  </View>
                  <View style={[styles.summaryColHeader, { width: 50, backgroundColor: '#0F172A' }]}>
                    <Text style={[styles.summaryColHeaderText, { color: '#FFFFFF' }]}>Total</Text>
                    <Text style={[styles.summaryColHeaderSub, { color: '#94A3B8' }]}>Days</Text>
                  </View>
                </View>

                {/* Data Rows for Each Employee */}
                {loading ? (
                  <View style={{ height: 200 }} />
                ) : (
                  musterRecords.map((row, index) => (
                    <View
                      key={row.sr || index}
                      style={[
                        styles.scrollableDataRow,
                        { height: 46 },
                        index % 2 === 1 && { backgroundColor: '#F8FAFC' },
                      ]}
                    >
                      {/* Days 1 to daysInMonth Data Cells */}
                      {displayDays.map((dm) => {
                        const codeVal = row.days[dm.day] || '-';
                        const holName =
                          row.dayHolidayNames?.[dm.day] || dm.holidayName;

                        return (
                          <View
                            key={dm.day}
                            style={[
                              styles.dayDataCell,
                              { width: 50 },
                              dm.isToday && styles.todayDataCell,
                            ]}
                          >
                            {renderStatusCell(codeVal, holName, row, dm)}
                          </View>
                        );
                      })}

                      {/* Summary Values for this employee */}
                      <View style={[styles.summaryDataCell, { width: 44, backgroundColor: '#F0FDF4' }]}>
                        <Text style={[styles.summaryValText, { color: '#059669' }]}>
                          {row.summary.P}
                        </Text>
                      </View>
                      <View style={[styles.summaryDataCell, { width: 44, backgroundColor: '#FEF2F2' }]}>
                        <Text style={[styles.summaryValText, { color: '#DC2626' }]}>
                          {row.summary.A}
                        </Text>
                      </View>
                      <View style={[styles.summaryDataCell, { width: 44, backgroundColor: '#EFF6FF' }]}>
                        <Text style={[styles.summaryValText, { color: '#2563EB' }]}>
                          {row.summary.WO}
                        </Text>
                      </View>
                      <View style={[styles.summaryDataCell, { width: 44, backgroundColor: '#FAF5FF' }]}>
                        <Text style={[styles.summaryValText, { color: '#7C3AED' }]}>
                          {row.summary.PH}
                        </Text>
                      </View>
                      <View style={[styles.summaryDataCell, { width: 50, backgroundColor: '#F1F5F9' }]}>
                        <Text style={[styles.summaryValText, { color: '#0F172A', fontWeight: '900' }]}>
                          {row.summary.Total}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          </View>

          {/* Strict 4 Status Legend Bar (Requirement 2) */}
          <View style={styles.legendContainer}>
            <View style={styles.legendHeaderRow}>
              <Info size={14} color="#1E63F0" style={{ marginRight: 6 }} />
              <Text style={styles.legendTitle}>STRICT ATTENDANCE STATUS OPTIONS (ONLY 4 PERMITTED)</Text>
            </View>

            <View style={styles.legendGrid}>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' }]}>
                  <Text style={[styles.legendCode, { color: '#166534' }]}>P</Text>
                </View>
                <View style={{ marginLeft: 8 }}>
                  <Text style={styles.legendLabel}>Present</Text>
                  <Text style={styles.legendDesc}>Verified shift completed</Text>
                </View>
              </View>

              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
                  <Text style={[styles.legendCode, { color: '#991B1B' }]}>A</Text>
                </View>
                <View style={{ marginLeft: 8 }}>
                  <Text style={styles.legendLabel}>Absent</Text>
                  <Text style={styles.legendDesc}>Unexcused absence</Text>
                </View>
              </View>

              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: '#DBEAFE', borderColor: '#BFDBFE' }]}>
                  <Text style={[styles.legendCode, { color: '#1E40AF' }]}>WO</Text>
                </View>
                <View style={{ marginLeft: 8 }}>
                  <Text style={styles.legendLabel}>Weekly Off</Text>
                  <Text style={styles.legendDesc}>Scheduled Sunday rest day</Text>
                </View>
              </View>

              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: '#F3E8FF', borderColor: '#E9D5FF' }]}>
                  <Text style={[styles.legendCode, { color: '#6B21A8' }]}>PH</Text>
                </View>
                <View style={{ marginLeft: 8 }}>
                  <Text style={styles.legendLabel}>Public Holiday</Text>
                  <Text style={styles.legendDesc}>Centralized gazetted holiday</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Public Holiday Info Modal (Requirement 4) */}
      <Modal
        visible={holidayTooltip.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setHolidayTooltip({ visible: false, name: '', date: '' })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.holidayModalCard}>
            <View style={styles.holidayModalHeader}>
              <View style={styles.phModalBadge}>
                <Text style={styles.phModalBadgeText}>PH</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.holidayModalTitle}>{holidayTooltip.name}</Text>
                <Text style={styles.holidayModalDate}>{holidayTooltip.date}</Text>
              </View>
              <TouchableOpacity delayPressIn={0}
                onPress={() => setHolidayTooltip({ visible: false, name: '', date: '' })}
                style={{ padding: 4 }}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.holidayModalBody}>
              <Text style={styles.holidayModalText}>
                This date is declared a <Text style={{ fontWeight: '800' }}>Gazetted Public Holiday</Text> in the centralized Holiday Management sheet.
              </Text>
              <Text style={[styles.holidayModalText, { marginTop: 6, color: '#059669', fontWeight: '700' }]}>
                ✓ Attendance automatically marked as PH throughout the entire platform.
              </Text>
              {holidayTooltip.empName ? (
                <Text style={[styles.holidayModalText, { marginTop: 6, color: '#64748B' }]}>
                  Employee: {holidayTooltip.empName}
                </Text>
              ) : null}
            </View>

            <TouchableOpacity delayPressIn={0}
              style={styles.holidayModalCloseBtn}
              onPress={() => setHolidayTooltip({ visible: false, name: '', date: '' })}
            >
              <Text style={styles.holidayModalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Substation Site Filter Picker Modal */}
      <Modal
        visible={showSitePickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSitePickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sitePickerCard}>
            <View style={styles.sitePickerHeader}>
              <Building2 size={18} color="#1E63F0" style={{ marginRight: 8 }} />
              <Text style={styles.sitePickerTitle}>Filter by Substation Location</Text>
              <TouchableOpacity delayPressIn={0}
                onPress={() => setShowSitePickerModal(false)}
                style={{ padding: 4, marginLeft: 'auto' }}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              <TouchableOpacity delayPressIn={0}
                style={[
                  styles.siteOptionItem,
                  selectedSiteFilter === 'all' && styles.siteOptionItemActive,
                ]}
                onPress={() => {
                  setSelectedSiteFilter('all');
                  setShowSitePickerModal(false);
                }}
              >
                <Text
                  style={[
                    styles.siteOptionText,
                    selectedSiteFilter === 'all' && styles.siteOptionTextActive,
                  ]}
                >
                  All Substation Locations
                </Text>
                {selectedSiteFilter === 'all' && (
                  <Check size={16} color="#1E63F0" />
                )}
              </TouchableOpacity>

              {sites.map((s) => (
                <TouchableOpacity delayPressIn={0}
                  key={s.id}
                  style={[
                    styles.siteOptionItem,
                    selectedSiteFilter === s.id && styles.siteOptionItemActive,
                  ]}
                  onPress={() => {
                    setSelectedSiteFilter(s.id);
                    setShowSitePickerModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.siteOptionText,
                      selectedSiteFilter === s.id && styles.siteOptionTextActive,
                    ]}
                  >
                    {s.name}
                  </Text>
                  {selectedSiteFilter === s.id && (
                    <Check size={16} color="#1E63F0" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Admin Attendance Marking Modal (Requirement 2 & 3) */}
      <Modal
        visible={markModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMarkModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.markModalCard, SHADOWS.md]}>
            <View style={styles.markModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.markModalTitle}>Mark Attendance Record</Text>
                <Text style={styles.markModalSub}>
                  Centralized sync across Admin, Supervisor, and Employee dashboards
                </Text>
              </View>
              <TouchableOpacity delayPressIn={0}
                onPress={() => setMarkModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.markModalBody}>
              {/* Employee Selector */}
              <Text style={styles.inputFieldLabel}>FIELD EMPLOYEE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {musterRecords.map((mr) => {
                    const isSelected = markEmpId === (mr.employeeCode || mr.employeeName);
                    return (
                      <TouchableOpacity delayPressIn={0}
                        key={mr.employeeCode || mr.sr}
                        style={[styles.empPill, isSelected && styles.empPillActive]}
                        onPress={() => {
                          setMarkEmpId(mr.employeeCode || mr.employeeName);
                          setMarkEmpName(`${mr.employeeName} (${mr.employeeCode})`);
                        }}
                      >
                        <Text style={[styles.empPillText, isSelected && styles.empPillTextActive]}>
                          {mr.employeeName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Date Input with Interactive Calendar Picker */}
              <Text style={styles.inputFieldLabel}>ATTENDANCE DATE (YYYY-MM-DD)</Text>
              <View style={styles.dateInputRow}>
                <TextInput
                  style={styles.dateTextInput}
                  value={markDate}
                  onChangeText={(val) => {
                    setMarkDate(val);
                    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
                      const p = val.split('-');
                      setMarkCalYear(parseInt(p[0], 10));
                      setMarkCalMonth(parseInt(p[1], 10) - 1);
                    }
                  }}
                  placeholder="2026-11-01"
                  placeholderTextColor="#94A3B8"
                />
                <TouchableOpacity delayPressIn={0}
                  style={[
                    styles.dateCalendarIconBtn,
                    showMarkDatePicker && styles.dateCalendarIconBtnActive,
                  ]}
                  onPress={() => setShowMarkDatePicker((prev) => !prev)}
                  activeOpacity={0.7}
                  accessibilityLabel="Pick attendance date"
                >
                  <Calendar size={18} color={showMarkDatePicker ? '#FFFFFF' : '#1E63F0'} />
                </TouchableOpacity>
              </View>

              {/* Inline Interactive Calendar Picker */}
              {showMarkDatePicker && (
                <View style={styles.calPickerBox}>
                  <View style={styles.calNavHeader}>
                    <TouchableOpacity delayPressIn={0}
                      style={styles.calNavBtn}
                      onPress={handlePrevMarkCalMonth}
                      activeOpacity={0.7}
                    >
                      <ChevronLeft size={16} color="#334155" />
                    </TouchableOpacity>

                    <Text style={styles.calMonthYearTitle}>
                      {MONTH_NAMES[markCalMonth]} {markCalYear}
                    </Text>

                    <TouchableOpacity delayPressIn={0}
                      style={styles.calNavBtn}
                      onPress={handleNextMarkCalMonth}
                      activeOpacity={0.7}
                    >
                      <ChevronRight size={16} color="#334155" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.calWeekdaysRow}>
                    {WEEKDAY_NAMES_MARK.map((w, idx) => (
                      <View key={idx} style={styles.calWeekdayCell}>
                        <Text
                          style={[
                            styles.calWeekdayText,
                            (idx === 0 || idx === 6) && styles.calWeekendText,
                          ]}
                        >
                          {w}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.calDaysMatrix}>
                    {Array.from({ length: markCalFirstDayOffset }).map((_, i) => (
                      <View key={`empty-mark-${i}`} style={styles.calDayCell} />
                    ))}

                    {Array.from({ length: daysInMarkCalMonth }).map((_, i) => {
                      const day = i + 1;
                      const mm = String(markCalMonth + 1).padStart(2, '0');
                      const dd = String(day).padStart(2, '0');
                      const cellDate = `${markCalYear}-${mm}-${dd}`;
                      const isSelected = markDate === cellDate;
                      const isSunday = (markCalFirstDayOffset + i) % 7 === 0;

                      return (
                        <TouchableOpacity delayPressIn={0}
                          key={`mark-day-${day}`}
                          style={[
                            styles.calDayCell,
                            isSelected && styles.calDayCellSelected,
                          ]}
                          onPress={() => handleSelectMarkCalDay(day)}
                          activeOpacity={0.65}
                        >
                          <Text
                            style={[
                              styles.calDayText,
                              isSunday && styles.calDaySundayText,
                              isSelected && styles.calDayTextSelected,
                            ]}
                          >
                            {day}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={styles.calFooterActions}>
                    <TouchableOpacity delayPressIn={0}
                      style={styles.calTodayBtn}
                      onPress={handleSelectMarkToday}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.calTodayBtnText}>Select Today</Text>
                    </TouchableOpacity>

                    <TouchableOpacity delayPressIn={0}
                      style={styles.calCloseBtn}
                      onPress={() => setShowMarkDatePicker(false)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.calCloseBtnText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Strict Permitted Statuses (P vs A) */}
              <Text style={[styles.inputFieldLabel, { marginTop: 12 }]}>ATTENDANCE STATUS (STRICT 4 RULES)</Text>
              <View style={styles.statusButtonsRow}>
                <TouchableOpacity delayPressIn={0}
                  style={[styles.statusOptionBtn, markStatus === 'P' && styles.statusOptionBtnPActive]}
                  onPress={() => setMarkStatus('P')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.statusCircle, { backgroundColor: '#059669' }]} />
                  <Text style={[styles.statusOptionText, markStatus === 'P' && { color: '#059669', fontWeight: '800' }]}>
                    P • Present (On Duty)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity delayPressIn={0}
                  style={[styles.statusOptionBtn, markStatus === 'A' && styles.statusOptionBtnAActive]}
                  onPress={() => setMarkStatus('A')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.statusCircle, { backgroundColor: '#DC2626' }]} />
                  <Text style={[styles.statusOptionText, markStatus === 'A' && { color: '#DC2626', fontWeight: '800' }]}>
                    A • Absent (Off Duty)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Admin Remarks */}
              <Text style={[styles.inputFieldLabel, { marginTop: 12 }]}>ADMIN REMARKS / AUDIT LOG</Text>
              <TextInput
                style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                value={markRemarks}
                onChangeText={setMarkRemarks}
                placeholder="Operations admin authorization note..."
                placeholderTextColor="#94A3B8"
                multiline
              />
            </View>

            <View style={styles.markModalFooter}>
              <TouchableOpacity delayPressIn={0}
                style={styles.cancelBtn}
                onPress={() => setMarkModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity delayPressIn={0}
                style={styles.saveMarkBtn}
                onPress={handleSaveAttendanceMark}
                disabled={savingMark}
                activeOpacity={0.85}
              >
                {savingMark ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Check size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.saveMarkBtnText}>Save & Synchronize</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Drawer Modals */}
      <AdminDrawerModal />
      <SupervisorDrawerModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeaderBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  topHeaderRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  menuCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  mainTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnPrimaryGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  btnPrimaryGreenText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  btnPurple: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 8,
  },
  btnPurpleText: {
    color: '#6B21A8',
    fontSize: 12,
    fontWeight: '700',
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 8,
  },
  btnSecondaryText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    padding: 16,
    gap: 14,
  },
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  filterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 0.5,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthNavArrow: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentMonthBadge: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  currentMonthText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E63F0',
  },
  todayJumpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  todayJumpBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E63F0',
  },
  filterInputsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  inputCol: {
    flex: 1,
    minWidth: 140,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  inputBoxWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  inputFieldStatic: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  dropdownSelectText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  kpiCardsRowWide: {
    flexDirection: 'row',
    gap: 10,
  },
  kpiCardWide: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kpiCardsScroll: {
    flexDirection: 'row',
    gap: 10,
  },
  kpiCard: {
    width: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kpiCardBorderGreen: {
    borderLeftWidth: 4,
    borderLeftColor: '#059669',
  },
  kpiCardBorderRed: {
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  kpiCardBorderBlue: {
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
  },
  kpiCardBorderPurple: {
    borderLeftWidth: 4,
    borderLeftColor: '#7C3AED',
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 4,
  },
  kpiValueDark: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  kpiSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  registerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  registerDarkHeader: {
    backgroundColor: '#0B192C',
    padding: 14,
  },
  registerHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  b4sLogoBadge: {
    backgroundColor: '#1E63F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  b4sLogoText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  registerSmallLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#93C5FD',
  },
  registerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 1,
  },
  registerDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E63F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  registerDownloadBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  registerHeaderBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  registerSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    flex: 1,
  },
  swipeHintText: {
    fontSize: 10,
    color: '#93C5FD',
    fontWeight: '700',
  },
  gridContainer: {
    flexDirection: 'row',
  },
  frozenColumn: {
    width: 145,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 2,
    borderRightColor: '#CBD5E1',
    zIndex: 10,
  },
  frozenHeaderCell: {
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  frozenHeaderLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  frozenRowCell: {
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  frozenEmpName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  frozenEmpSub: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 1,
  },
  scrollableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
  },
  dayColHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#1E293B',
    paddingVertical: 4,
  },
  sundayColHeader: {
    backgroundColor: '#1E293B',
  },
  holidayColHeader: {
    backgroundColor: '#2E1065',
  },
  todayColHeader: {
    backgroundColor: '#1E3A8A',
    borderTopWidth: 2,
    borderTopColor: '#60A5FA',
  },
  dayColNum: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  todayColNum: {
    color: '#93C5FD',
  },
  dayColDay: {
    fontSize: 8,
    fontWeight: '700',
    color: '#94A3B8',
  },
  todayColDay: {
    color: '#BFDBFE',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#60A5FA',
    marginTop: 1,
  },
  summaryColHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#CBD5E1',
    paddingVertical: 4,
  },
  summaryColHeaderText: {
    fontSize: 11,
    fontWeight: '900',
  },
  summaryColHeaderSub: {
    fontSize: 8,
    fontWeight: '600',
    color: '#64748B',
  },
  scrollableDataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dayDataCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#F1F5F9',
    paddingHorizontal: 2,
  },
  todayDataCell: {
    backgroundColor: 'rgba(239, 246, 255, 0.7)',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  summaryDataCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  summaryValText: {
    fontSize: 11,
    fontWeight: '800',
  },
  legendContainer: {
    padding: 14,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  legendHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  legendTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.5,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 140,
  },
  legendBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendCode: {
    fontSize: 11,
    fontWeight: '900',
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  legendDesc: {
    fontSize: 10,
    color: '#64748B',
  },
  btnBlueMark: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E63F0',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  btnBlueMarkText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  markModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxWidth: 500,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingRight: 4,
  },
  dateTextInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  dateCalendarIconBtn: {
    padding: 7,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateCalendarIconBtnActive: {
    backgroundColor: '#1E63F0',
  },
  calPickerBox: {
    marginTop: 8,
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  calNavHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  calNavBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  calMonthYearTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  calWeekdaysRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  calWeekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  calWeekdayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  calWeekendText: {
    color: '#EF4444',
  },
  calDaysMatrix: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calDayCell: {
    width: '14.28%',
    aspectRatio: 1.15,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  calDayCellSelected: {
    backgroundColor: '#1E63F0',
  },
  calDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  calDaySundayText: {
    color: '#EF4444',
  },
  calDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  calFooterActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  calTodayBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  calTodayBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E63F0',
  },
  calCloseBtn: {
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  calCloseBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  markModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  markModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  markModalSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  markModalBody: {
    padding: 16,
  },
  inputFieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  empPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  empPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  empPillText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  empPillTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  statusButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  statusOptionBtnPActive: {
    borderColor: '#059669',
    backgroundColor: '#F0FDF4',
  },
  statusOptionBtnAActive: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  statusCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  markModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
  },
  saveMarkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E63F0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveMarkBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  holidayModalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
  },
  holidayModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  phModalBadge: {
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  phModalBadgeText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#6B21A8',
  },
  holidayModalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  holidayModalDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  holidayModalBody: {
    marginBottom: 16,
  },
  holidayModalText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  holidayModalCloseBtn: {
    backgroundColor: '#1E63F0',
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  holidayModalCloseBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sitePickerCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
  },
  sitePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sitePickerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  siteOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  siteOptionItemActive: {
    backgroundColor: '#EFF6FF',
  },
  siteOptionText: {
    fontSize: 13,
    color: '#334155',
  },
  siteOptionTextActive: {
    fontWeight: '700',
    color: '#1E63F0',
  },
});

export default ReportsScreen;
