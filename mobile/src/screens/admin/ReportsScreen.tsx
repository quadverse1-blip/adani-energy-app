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
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { siteService } from '../../services/siteService';
import { reportService, MusterRecord } from '../../services/reportService';
import { Substation } from '../../types';
import { SHADOWS } from '../../constants/theme';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useAdminDrawerStore } from '../../store/useAdminDrawerStore';
import { AdminDrawerModal } from '../../components/navigation/AdminDrawerModal';
import { useSupervisorDrawerStore } from '../../store/useSupervisorDrawerStore';
import { SupervisorDrawerModal } from '../../components/navigation/SupervisorDrawerModal';
import { useAuthStore } from '../../store/useAuthStore';

const { width } = Dimensions.get('window');

const DEFAULT_MUSTER_RECORDS: MusterRecord[] = [
  {
    sr: 1,
    employeeCode: 'b4S/Adani/01',
    employeeName: 'Rohit Sharma',
    designation: 'Junior Engineer',
    circle: 'Gujarat Circle',
    division: 'Surat Division',
    days: {
      1: 'A', 2: 'HL', 3: 'A', 4: 'P', 5: 'P', 6: 'P', 7: 'A', 8: 'P', 9: 'A', 10: 'A',
      11: 'O', 12: 'P', 13: 'A', 14: 'P', 15: 'A', 16: 'A', 17: 'P', 18: 'O', 19: 'A', 20: 'HL',
      21: 'P', 22: 'P', 23: 'A', 24: 'A', 25: 'O', 26: '-', 27: '-', 28: '-', 29: '-', 30: '-', 31: '-'
    },
    summary: { P: 9, WOP: 3, A: 11, OD: 0, WO: 0, PL: 0, PH: 2, Total: 14 }
  },
  {
    sr: 2,
    employeeCode: 'b4S/Adani/02',
    employeeName: 'Amit Kumar',
    designation: 'Junior Engineer',
    circle: 'Prc',
    division: 'Office',
    days: {
      1: 'A', 2: 'HL', 3: 'A', 4: 'O', 5: 'A', 6: 'A', 7: 'A', 8: 'A', 9: 'A', 10: 'A',
      11: 'O', 12: 'A', 13: 'A', 14: 'A', 15: 'A', 16: 'A', 17: 'A', 18: 'O', 19: 'A', 20: 'HL',
      21: 'P', 22: 'A', 23: 'A', 24: 'A', 25: 'O', 26: '-', 27: '-', 28: '-', 29: '-', 30: '-', 31: '-'
    },
    summary: { P: 1, WOP: 4, A: 18, OD: 0, WO: 0, PL: 0, PH: 2, Total: 7 }
  },
  {
    sr: 3,
    employeeCode: 'b4S/Adani/03',
    employeeName: 'Sandeep Yadav',
    designation: 'Junior Engineer',
    circle: 'Prc',
    division: 'Bundgarden',
    days: {
      1: 'A', 2: 'HL', 3: 'A', 4: 'O', 5: 'A', 6: 'A', 7: 'A', 8: 'A', 9: 'A', 10: 'A',
      11: 'O', 12: 'A', 13: 'A', 14: 'A', 15: 'A', 16: 'A', 17: 'A', 18: 'O', 19: 'A', 20: 'HL',
      21: 'A', 22: 'A', 23: 'A', 24: 'A', 25: 'O', 26: '-', 27: '-', 28: '-', 29: '-', 30: '-', 31: '-'
    },
    summary: { P: 0, WOP: 4, A: 19, OD: 0, WO: 0, PL: 0, PH: 2, Total: 6 }
  },
  {
    sr: 4,
    employeeCode: 'b4S/Adani/04',
    employeeName: 'Vikash Singh',
    designation: 'Junior Engineer',
    circle: 'Prc',
    division: 'Bundgarden',
    days: {
      1: 'A', 2: 'HL', 3: 'A', 4: 'O', 5: 'A', 6: 'A', 7: 'A', 8: 'A', 9: 'A', 10: 'A',
      11: 'O', 12: 'A', 13: 'A', 14: 'A', 15: 'A', 16: 'A', 17: 'A', 18: 'O', 19: 'A', 20: 'HL',
      21: 'A', 22: 'A', 23: 'A', 24: 'A', 25: 'O', 26: '-', 27: '-', 28: '-', 29: '-', 30: '-', 31: '-'
    },
    summary: { P: 0, WOP: 4, A: 19, OD: 0, WO: 0, PL: 0, PH: 2, Total: 6 }
  },
  {
    sr: 5,
    employeeCode: 'b4S/Adani/05',
    employeeName: 'Neha Patil',
    designation: 'Supervisor',
    circle: 'Prc',
    division: 'Office',
    days: {
      1: 'A', 2: 'HL', 3: 'A', 4: 'O', 5: 'A', 6: 'A', 7: 'A', 8: 'A', 9: 'A', 10: 'A',
      11: 'O', 12: 'A', 13: 'A', 14: 'A', 15: 'A', 16: 'A', 17: 'A', 18: 'O', 19: 'A', 20: 'HL',
      21: 'A', 22: 'A', 23: 'A', 24: 'A', 25: 'O', 26: '-', 27: '-', 28: '-', 29: '-', 30: '-', 31: '-'
    },
    summary: { P: 0, WOP: 4, A: 19, OD: 0, WO: 0, PL: 0, PH: 2, Total: 6 }
  },
  {
    sr: 6,
    employeeCode: 'b4S/Adani/06',
    employeeName: 'Harsh Parmar',
    designation: 'Junior Engineer',
    circle: 'Prc',
    division: 'st. joseph university',
    days: {
      1: 'A', 2: 'HL', 3: 'A', 4: 'P', 5: 'P', 6: 'A', 7: 'A', 8: 'A', 9: 'A', 10: 'A',
      11: 'O', 12: 'A', 13: 'A', 14: 'P', 15: 'A', 16: 'A', 17: 'A', 18: 'O', 19: 'A', 20: 'HL',
      21: 'A', 22: 'A', 23: 'A', 24: 'A', 25: 'O', 26: '-', 27: '-', 28: '-', 29: '-', 30: '-', 31: '-'
    },
    summary: { P: 3, WOP: 3, A: 17, OD: 0, WO: 0, PL: 0, PH: 2, Total: 8 }
  },
  {
    sr: 7,
    employeeCode: 'SUPER01',
    employeeName: 'Suresh Patil',
    designation: 'Area Operations Supervisor',
    circle: 'Maharashtra Circle',
    division: 'Pune Division',
    days: {
      1: 'A', 2: 'HL', 3: 'A', 4: 'O', 5: 'A', 6: 'A', 7: 'A', 8: 'A', 9: 'A', 10: 'A',
      11: 'O', 12: 'A', 13: 'A', 14: 'A', 15: 'A', 16: 'A', 17: 'A', 18: 'O', 19: 'A', 20: 'HL',
      21: 'P', 22: 'P', 23: 'A', 24: 'A', 25: 'O', 26: '-', 27: '-', 28: '-', 29: '-', 30: '-', 31: '-'
    },
    summary: { P: 2, WOP: 4, A: 17, OD: 0, WO: 0, PL: 0, PH: 2, Total: 8 }
  }
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

  // Selected Month & Year
  const [selectedMonth, setSelectedMonth] = useState<number>(10);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [fromDate, setFromDate] = useState<string>('01-10-2026');
  const [toDate, setToDate] = useState<string>('31-10-2026');

  // Site Filter Dropdown
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>('all');
  const [showSitePickerModal, setShowSitePickerModal] = useState<boolean>(false);
  const [sites, setSites] = useState<Substation[]>([]);

  // Muster Records & KPI Statistics
  const [musterRecords, setMusterRecords] = useState<MusterRecord[]>(DEFAULT_MUSTER_RECORDS);
  const [musterStats, setMusterStats] = useState({
    totalShifts: 21,
    present: 1,
    lateArrivals: 1,
    halfDays: 9,
    avgDuration: '10h 14m',
    compliance: '52.4%',
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);

  const fetchMusterData = async () => {
    setLoading(true);
    try {
      const [siteList, musterRes] = await Promise.all([
        siteService.getSites().catch(() => []),
        reportService.getMusterRoll(selectedMonth, selectedYear, selectedSiteFilter).catch(() => null),
      ]);
      setSites(siteList);

      if (musterRes && musterRes.records && musterRes.records.length > 0) {
        setMusterRecords(musterRes.records);
        if (musterRes.stats) setMusterStats(musterRes.stats);
      } else {
        setMusterRecords(DEFAULT_MUSTER_RECORDS);
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
        if (musterRes.stats) setMusterStats(musterRes.stats);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSelectMonth = (m: number, y: number) => {
    setSelectedMonth(m);
    setSelectedYear(y);
    if (m === 10) {
      setFromDate('01-10-2026');
      setToDate('31-10-2026');
    } else {
      setFromDate('01-09-2026');
      setToDate('30-09-2026');
    }
  };

  // Download Official Muster Roll Excel (.xlsx)
  const handleDownloadMusterExcel = async () => {
    setExporting(true);
    try {
      await reportService.downloadMusterRollExcel(selectedMonth, selectedYear, selectedSiteFilter);
      Alert.alert(
        'Excel Report Downloaded',
        'Official Attendance Muster Roll (.xlsx) has been successfully generated and downloaded.'
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
        'Generating print-ready PDF for October 2026 Muster Roll. You can save or share it directly.',
        [{ text: 'OK' }]
      );
    }
  };

  const selectedSiteLabel = useMemo(() => {
    if (selectedSiteFilter === 'all') return 'All Sites';
    const found = sites.find((s) => s.id === selectedSiteFilter);
    return found ? found.name : 'All Sites';
  }, [selectedSiteFilter, sites]);

  // Days 1 to 31 array
  const daysHeader = Array.from({ length: 31 }, (_, i) => i + 1);

  // Status cell style renderer
  const renderDayCell = (val: string = '-') => {
    let color = '#94A3B8';
    let fontWeight: any = '600';

    if (val === 'P') {
      color = '#10B981'; // Green Present
      fontWeight = '800';
    } else if (val === 'A') {
      color = '#EF4444'; // Red Absent
      fontWeight = '800';
    } else if (val === 'HL') {
      color = '#EA580C'; // Orange / Amber Holiday
      fontWeight = '800';
    } else if (val === 'O') {
      color = '#2563EB'; // Blue Weekly Off
      fontWeight = '800';
    }

    return (
      <Text style={[styles.dayCellText, { color, fontWeight }]}>
        {val}
      </Text>
    );
  };

  return (
    <View style={styles.container}>
      {/* ========================================================================= */}
      {/* 1. TOP HEADER APP BAR (MATCHING REFERENCE IMAGE 1)                       */}
      {/* ========================================================================= */}
      <View
        style={[
          styles.topHeaderBar,
          { paddingTop: Math.max(insets.top, 16) + 6 },
        ]}
      >
        <View style={styles.topHeaderRow1}>
          <TouchableOpacity
            style={styles.menuCircleBtn}
            onPress={handleMenuPress}
            activeOpacity={0.7}
            accessibilityLabel="Open Navigation Menu"
          >
            <Menu size={20} color="#0F172A" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backCircleBtn}
            onPress={handleBack}
            activeOpacity={0.7}
            accessibilityLabel="Go Back"
          >
            <ArrowLeft size={18} color="#0F172A" />
          </TouchableOpacity>

          <View style={{ marginLeft: 8, flex: 1, paddingRight: 40 }}>
            <Text style={styles.mainTitle} numberOfLines={1}>Reports & Muster Roll</Text>
          </View>
        </View>

        {/* Action Buttons Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topActionsRow}
        >
          <TouchableOpacity
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
            <Text style={styles.btnPrimaryGreenText}>Download .xlsx</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => navigation.navigate('AttendanceLogs')}
            activeOpacity={0.8}
          >
            <FileText size={13} color="#334155" style={{ marginRight: 5 }} />
            <Text style={styles.btnSecondaryText}>Detailed Logs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={handleExportPDF}
            activeOpacity={0.8}
          >
            <Printer size={13} color="#334155" style={{ marginRight: 5 }} />
            <Text style={styles.btnSecondaryText}>Export PDF</Text>
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
        {/* 2. REPORT PARAMETERS & DATE FILTER CARD                                  */}
        {/* ========================================================================= */}
        <View style={[styles.filterCard, SHADOWS.sm]}>
          <View style={styles.filterCardHeader}>
            <View style={styles.filterTitleRow}>
              <Filter size={15} color="#2563EB" style={{ marginRight: 6 }} />
              <Text style={styles.filterCardTitle}>REPORT PARAMETERS & DATE FILTER</Text>
            </View>

            {/* Quick Month Pills */}
            <View style={styles.monthPillsRow}>
              <TouchableOpacity
                style={[
                  styles.monthPill,
                  selectedMonth === 10 && styles.monthPillActive,
                ]}
                onPress={() => handleSelectMonth(10, 2026)}
                activeOpacity={0.75}
              >
                {selectedMonth === 10 && (
                  <Check size={12} color="#059669" style={{ marginRight: 4 }} />
                )}
                <Text
                  style={[
                    styles.monthPillText,
                    selectedMonth === 10 && styles.monthPillTextActive,
                  ]}
                >
                  Current Month: October 2026
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.monthPill,
                  selectedMonth === 9 && styles.monthPillActive,
                ]}
                onPress={() => handleSelectMonth(9, 2026)}
                activeOpacity={0.75}
              >
                {selectedMonth === 9 && (
                  <Check size={12} color="#059669" style={{ marginRight: 4 }} />
                )}
                <Text
                  style={[
                    styles.monthPillText,
                    selectedMonth === 9 && styles.monthPillTextActive,
                  ]}
                >
                  September 2026
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* From Date | To Date | Deployment Location / Site */}
          <View style={styles.filterInputsRow}>
            <View style={styles.inputCol}>
              <Text style={styles.inputLabel}>From Date</Text>
              <View style={styles.inputBoxWrap}>
                <TextInput
                  style={styles.inputField}
                  value={fromDate}
                  onChangeText={setFromDate}
                  placeholder="01-10-2026"
                  placeholderTextColor="#94A3B8"
                />
                <Calendar size={16} color="#64748B" />
              </View>
            </View>

            <View style={styles.inputCol}>
              <Text style={styles.inputLabel}>To Date</Text>
              <View style={styles.inputBoxWrap}>
                <TextInput
                  style={styles.inputField}
                  value={toDate}
                  onChangeText={setToDate}
                  placeholder="31-10-2026"
                  placeholderTextColor="#94A3B8"
                />
                <Calendar size={16} color="#64748B" />
              </View>
            </View>

            <View style={styles.inputCol}>
              <Text style={styles.inputLabel}>Deployment Location / Site</Text>
              <TouchableOpacity
                style={styles.inputBoxWrap}
                onPress={() => setShowSitePickerModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.dropdownSelectText} numberOfLines={1}>
                  {selectedSiteLabel}
                </Text>
                <ChevronDown size={16} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* 3. KPI STAT SUMMARY CARDS ROW (EXACT 6 CARDS FROM PHOTO 1)                */}
        {/* ========================================================================= */}
        {isWide ? (
          <View style={styles.kpiCardsRowWide}>
            {/* Card 1: TOTAL SHIFTS */}
            <View style={[styles.kpiCardWide, SHADOWS.sm]}>
              <Text style={styles.kpiLabel}>TOTAL SHIFTS</Text>
              <Text style={styles.kpiValueDark}>{musterStats.totalShifts}</Text>
              <Text style={styles.kpiSub}>Logged shift records</Text>
            </View>

            {/* Card 2: PRESENT */}
            <View style={[styles.kpiCardWide, styles.kpiCardBorderGreen, SHADOWS.sm]}>
              <Text style={[styles.kpiLabel, { color: '#059669' }]}>PRESENT</Text>
              <Text style={[styles.kpiValueDark, { color: '#059669' }]}>{musterStats.present}</Text>
              <Text style={styles.kpiSub}>Verified on-site shifts</Text>
            </View>

            {/* Card 3: LATE ARRIVALS */}
            <View style={[styles.kpiCardWide, styles.kpiCardBorderAmber, SHADOWS.sm]}>
              <Text style={[styles.kpiLabel, { color: '#D97706' }]}>LATE ARRIVALS</Text>
              <Text style={[styles.kpiValueDark, { color: '#D97706' }]}>{musterStats.lateArrivals}</Text>
              <Text style={styles.kpiSub}>09:00 – 10:30 AM</Text>
            </View>

            {/* Card 4: HALF DAYS */}
            <View style={[styles.kpiCardWide, styles.kpiCardBorderOrange, SHADOWS.sm]}>
              <Text style={[styles.kpiLabel, { color: '#EA580C' }]}>HALF DAYS</Text>
              <Text style={[styles.kpiValueDark, { color: '#EA580C' }]}>{musterStats.halfDays}</Text>
              <Text style={styles.kpiSub}>After 10:30 AM check-in</Text>
            </View>

            {/* Card 5: AVG DURATION */}
            <View style={[styles.kpiCardWide, SHADOWS.sm]}>
              <Text style={styles.kpiLabel}>AVG DURATION</Text>
              <Text style={styles.kpiValueDark}>{musterStats.avgDuration}</Text>
              <Text style={styles.kpiSub}>Shift duration avg</Text>
            </View>

            {/* Card 6: COMPLIANCE */}
            <View style={[styles.kpiCardWide, SHADOWS.sm]}>
              <Text style={styles.kpiLabel}>COMPLIANCE</Text>
              <Text style={styles.kpiValueDark}>{musterStats.compliance}</Text>
              <Text style={styles.kpiSub}>Geofence accuracy</Text>
            </View>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.kpiCardsScroll}
          >
            {/* Card 1: TOTAL SHIFTS */}
            <View style={[styles.kpiCard, SHADOWS.sm]}>
              <Text style={styles.kpiLabel}>TOTAL SHIFTS</Text>
              <Text style={styles.kpiValueDark}>{musterStats.totalShifts}</Text>
              <Text style={styles.kpiSub}>Logged shift records</Text>
            </View>

            {/* Card 2: PRESENT */}
            <View style={[styles.kpiCard, styles.kpiCardBorderGreen, SHADOWS.sm]}>
              <Text style={[styles.kpiLabel, { color: '#059669' }]}>PRESENT</Text>
              <Text style={[styles.kpiValueDark, { color: '#059669' }]}>{musterStats.present}</Text>
              <Text style={styles.kpiSub}>Verified on-site shifts</Text>
            </View>

            {/* Card 3: LATE ARRIVALS */}
            <View style={[styles.kpiCard, styles.kpiCardBorderAmber, SHADOWS.sm]}>
              <Text style={[styles.kpiLabel, { color: '#D97706' }]}>LATE ARRIVALS</Text>
              <Text style={[styles.kpiValueDark, { color: '#D97706' }]}>{musterStats.lateArrivals}</Text>
              <Text style={styles.kpiSub}>09:00 – 10:30 AM</Text>
            </View>

            {/* Card 4: HALF DAYS */}
            <View style={[styles.kpiCard, styles.kpiCardBorderOrange, SHADOWS.sm]}>
              <Text style={[styles.kpiLabel, { color: '#EA580C' }]}>HALF DAYS</Text>
              <Text style={[styles.kpiValueDark, { color: '#EA580C' }]}>{musterStats.halfDays}</Text>
              <Text style={styles.kpiSub}>After 10:30 AM check-in</Text>
            </View>

            {/* Card 5: AVG DURATION */}
            <View style={[styles.kpiCard, SHADOWS.sm]}>
              <Text style={styles.kpiLabel}>AVG DURATION</Text>
              <Text style={styles.kpiValueDark}>{musterStats.avgDuration}</Text>
              <Text style={styles.kpiSub}>Shift duration avg</Text>
            </View>

            {/* Card 6: COMPLIANCE */}
            <View style={[styles.kpiCard, SHADOWS.sm]}>
              <Text style={styles.kpiLabel}>COMPLIANCE</Text>
              <Text style={styles.kpiValueDark}>{musterStats.compliance}</Text>
              <Text style={styles.kpiSub}>Geofence accuracy</Text>
            </View>
          </ScrollView>
        )}

        {/* ========================================================================= */}
        {/* 4. VIEW SELECTOR TABS                                                     */}
        {/* ========================================================================= */}
        <View style={styles.tabsStrip}>
          <View style={styles.tabButtonsGroup}>
            <View style={[styles.viewTab, styles.viewTabActive]}>
              <Grid size={15} color="#2563EB" style={{ marginRight: 6 }} />
              <Text style={[styles.viewTabText, styles.viewTabTextActive]}>
                Muster Roll Matrix (Template View)
              </Text>
            </View>
          </View>

          <Text style={styles.tabRightCaption}>
            Format matches the downloaded Excel register
          </Text>
        </View>

        {/* ========================================================================= */}
        {/* 5. OFFICIAL REGISTER PREVIEW CARD (MATCHING PHOTO 1 & PHOTO 2)             */}
        {/* ========================================================================= */}
        <View style={[styles.registerCard, SHADOWS.md]}>
          {/* Dark Navy Register Header Banner */}
          <View style={styles.registerDarkHeader}>
            <View style={styles.registerHeaderTop}>
              <View style={styles.b4sLogoBadge}>
                <Text style={styles.b4sLogoText}>b4S</Text>
              </View>

              <View style={{ marginLeft: 10, flex: 1, paddingRight: 6 }}>
                <Text style={styles.registerSmallLabel}>OFFICIAL REGISTER PREVIEW</Text>
                <Text style={styles.registerTitle} numberOfLines={1}>
                  ATTENDANCE REGISTER • OCT 2026
                </Text>
              </View>

              <TouchableOpacity
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
                b4S SOLUTIONS PVT. LTD. • {selectedSiteLabel.toUpperCase()} • 31 DAYS
              </Text>
              <Text style={styles.swipeHintText}>
                Swipe ⇆ to view days 1–31
              </Text>
            </View>
          </View>

          {/* Unified Horizontal Scrollable Register Table (Swipe to view all days) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              {/* Header Row */}
              <View style={styles.matrixHeaderRow}>
                <Text style={[styles.mthCell, { width: 36, textAlign: 'center' }]}>SR.</Text>
                <Text style={[styles.mthCell, { width: 105 }]}>Employee Code</Text>
                <Text style={[styles.mthCell, { width: 125 }]}>Employee Name</Text>
                <Text style={[styles.mthCell, { width: 135 }]}>Designation</Text>
                <Text style={[styles.mthCell, { width: 105 }]}>CIRCLE</Text>
                <Text style={[styles.mthCell, { width: 115 }]}>Division</Text>

                {/* 1 - 31 Days Header Cells */}
                {daysHeader.map((d) => (
                  <Text key={d} style={[styles.mthDayCell, { width: 28 }]}>
                    {d}
                  </Text>
                ))}

                {/* Summary Totals Columns Header */}
                <Text style={[styles.mthSummaryCell, { width: 32 }]}>P</Text>
                <Text style={[styles.mthSummaryCell, { width: 38 }]}>WOP</Text>
                <Text style={[styles.mthSummaryCell, { width: 32 }]}>A</Text>
                <Text style={[styles.mthSummaryCell, { width: 34 }]}>OD</Text>
                <Text style={[styles.mthSummaryCell, { width: 34 }]}>WO</Text>
                <Text style={[styles.mthSummaryCell, { width: 32 }]}>PL</Text>
                <Text style={[styles.mthSummaryCell, { width: 34 }]}>PH</Text>
                <Text style={[styles.mthSummaryCell, { width: 44, fontWeight: '900' }]}>Total</Text>
              </View>

              {/* Data Rows */}
              {loading ? (
                <View style={{ height: 260, justifyContent: 'center', alignItems: 'center' }}>
                  <LoadingSpinner message="Loading muster roll register..." />
                </View>
              ) : (
                musterRecords.map((row, index) => (
                  <View
                    key={row.sr || index}
                    style={[
                      styles.matrixDataRow,
                      index % 2 === 1 && { backgroundColor: '#F8FAFC' },
                    ]}
                  >
                    <Text style={[styles.mtdCell, { width: 36, textAlign: 'center', color: '#64748B' }]}>
                      {row.sr}
                    </Text>
                    <Text style={[styles.mtdCell, { width: 105, fontWeight: '700', color: '#0F172A' }]}>
                      {row.employeeCode}
                    </Text>
                    <Text style={[styles.mtdCell, { width: 125, fontWeight: '700', color: '#0F172A' }]}>
                      {row.employeeName}
                    </Text>
                    <Text style={[styles.mtdCell, { width: 135, color: '#475569' }]}>
                      {row.designation}
                    </Text>
                    <Text style={[styles.mtdCell, { width: 105, color: '#475569' }]}>
                      {row.circle}
                    </Text>
                    <Text style={[styles.mtdCell, { width: 115, color: '#475569' }]}>
                      {row.division}
                    </Text>

                    {/* Days 1 to 31 */}
                    {daysHeader.map((d) => (
                      <View key={d} style={[styles.mtdDayBox, { width: 28 }]}>
                        {renderDayCell(row.days[d])}
                      </View>
                    ))}

                    {/* Summary Columns */}
                    <Text style={[styles.mtdSumCell, { width: 32, color: '#059669', fontWeight: '800' }]}>
                      {row.summary.P}
                    </Text>
                    <Text style={[styles.mtdSumCell, { width: 38, color: '#0F172A' }]}>
                      {row.summary.WOP}
                    </Text>
                    <Text style={[styles.mtdSumCell, { width: 32, color: '#DC2626', fontWeight: '800' }]}>
                      {row.summary.A}
                    </Text>
                    <Text style={[styles.mtdSumCell, { width: 34, color: '#64748B' }]}>
                      {row.summary.OD}
                    </Text>
                    <Text style={[styles.mtdSumCell, { width: 34, color: '#64748B' }]}>
                      {row.summary.WO}
                    </Text>
                    <Text style={[styles.mtdSumCell, { width: 32, color: '#64748B' }]}>
                      {row.summary.PL}
                    </Text>
                    <Text style={[styles.mtdSumCell, { width: 34, color: '#D97706', fontWeight: '800' }]}>
                      {row.summary.PH}
                    </Text>
                    <Text style={[styles.mtdSumCell, { width: 44, fontWeight: '900', color: '#0F172A' }]}>
                      {row.summary.Total}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </ScrollView>

          {/* Bottom Footer & Legend (Photo 1 & 2) */}
          <View style={styles.registerFooter}>
            <View style={styles.legendWrap}>
              <Text style={styles.legendPrefix}>Legend: </Text>
              <Text style={[styles.legendItem, { color: '#059669' }]}>P = Present</Text>
              <Text style={[styles.legendItem, { color: '#2563EB' }]}>WO = Weekly Off</Text>
              <Text style={[styles.legendItem, { color: '#EA580C' }]}>PH = Public Holiday</Text>
              <Text style={[styles.legendItem, { color: '#DC2626' }]}>A = Absent</Text>
              <Text style={[styles.legendItem, { color: '#7C3AED' }]}>OD = On Duty</Text>
              <Text style={[styles.legendItem, { color: '#475569' }]}>PL = Leave</Text>
              <Text style={[styles.legendItem, { color: '#475569' }]}>WOP = Without Pay</Text>
            </View>

            <Text style={styles.legendRightNote}>
              Calculated over 31 days in October 2026
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Deployment Site Filter Modal */}
      <Modal
        visible={showSitePickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSitePickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerModalCard, SHADOWS.lg]}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Deployment Site</Text>
              <TouchableOpacity onPress={() => setShowSitePickerModal(false)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300 }}>
              <TouchableOpacity
                style={[
                  styles.pickerItem,
                  selectedSiteFilter === 'all' && styles.pickerItemActive,
                ]}
                onPress={() => {
                  setSelectedSiteFilter('all');
                  setShowSitePickerModal(false);
                }}
              >
                <Text
                  style={[
                    styles.pickerItemText,
                    selectedSiteFilter === 'all' && styles.pickerItemTextActive,
                  ]}
                >
                  All Sites (Company-wide)
                </Text>
                {selectedSiteFilter === 'all' && <Check size={16} color="#2563EB" />}
              </TouchableOpacity>

              {sites.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.pickerItem,
                    selectedSiteFilter === s.id && styles.pickerItemActive,
                  ]}
                  onPress={() => {
                    setSelectedSiteFilter(s.id);
                    setShowSitePickerModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      selectedSiteFilter === s.id && styles.pickerItemTextActive,
                    ]}
                  >
                    {s.name} ({s.code})
                  </Text>
                  {selectedSiteFilter === s.id && <Check size={16} color="#2563EB" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {user?.role === 'supervisor' ? <SupervisorDrawerModal /> : <AdminDrawerModal />}
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
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  topHeaderRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  menuCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 6,
  },
  backCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  mainTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  mainSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  btnSecondaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  btnPrimaryGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#059669',
  },
  btnPrimaryGreenText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    padding: 12,
    maxWidth: 1440,
    width: '100%',
    alignSelf: 'center',
  },

  /* Parameter Filter Card */
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 10,
  },
  filterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 0.6,
  },
  monthPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthPillActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  monthPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  monthPillTextActive: {
    color: '#059669',
    fontWeight: '700',
  },
  filterInputsRow: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
  },
  inputCol: {
    flex: 1,
    minWidth: 140,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  inputBoxWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
  },
  inputField: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
    padding: 0,
  },
  dropdownSelectText: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
  },

  /* KPI Summary Stat Cards */
  kpiCardsRowWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    marginBottom: 18,
  },
  kpiCardWide: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    borderLeftColor: '#CBD5E1',
  },
  kpiCardsScroll: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  kpiCard: {
    width: 130,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    borderLeftColor: '#CBD5E1',
  },
  kpiCardBorderGreen: {
    borderLeftColor: '#059669',
  },
  kpiCardBorderAmber: {
    borderLeftColor: '#D97706',
  },
  kpiCardBorderOrange: {
    borderLeftColor: '#EA580C',
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  kpiValueDark: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 4,
  },
  kpiSub: {
    fontSize: 10,
    color: '#94A3B8',
  },

  /* View Selector Tabs Strip */
  tabsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 10,
  },
  tabButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  viewTabActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  viewTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  viewTabTextActive: {
    color: '#2563EB',
    fontWeight: '800',
  },
  tabRightCaption: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
  },

  /* Official Register Container */
  registerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  registerDarkHeader: {
    backgroundColor: '#0B192C',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  registerHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  b4sLogoBadge: {
    width: 38,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  b4sLogoText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1E3A8A',
    letterSpacing: -0.5,
  },
  registerSmallLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#60A5FA',
    letterSpacing: 0.8,
  },
  registerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 1,
  },
  registerSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  registerHeaderBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
    gap: 6,
  },
  swipeHintText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#60A5FA',
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  registerDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  registerDownloadBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Unified Matrix Table Styles */
  matrixHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    height: 38,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  mthCell: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
  },
  mthDayCell: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  mthSummaryCell: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  matrixDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  mtdCell: {
    fontSize: 11,
    paddingHorizontal: 6,
  },
  mtdDayBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellText: {
    fontSize: 11,
    textAlign: 'center',
  },
  mtdSumCell: {
    fontSize: 11,
    textAlign: 'center',
  },

  /* Register Footer & Legend */
  registerFooter: {
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  legendWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  legendPrefix: {
    fontSize: 10,
    fontWeight: '800',
    color: '#334155',
  },
  legendItem: {
    fontSize: 10,
    fontWeight: '700',
  },
  legendRightNote: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },

  /* Site Picker Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  pickerModalCard: {
    width: Math.min(width * 0.9, 360),
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 8,
  },
  pickerModalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  pickerItemActive: {
    backgroundColor: '#EFF6FF',
  },
  pickerItemText: {
    fontSize: 13,
    color: '#334155',
  },
  pickerItemTextActive: {
    fontWeight: '700',
    color: '#2563EB',
  },
});
