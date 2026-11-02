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
  Linking,
  ActivityIndicator,
  Image,
} from 'react-native';
import {
  Menu,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Check,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Navigation,
  FileSpreadsheet,
  Download,
  Edit,
  ExternalLink,
  Camera as CameraIcon,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { attendanceService } from '../../services/attendanceService';
import { employeeService } from '../../services/employeeService';
import { siteService } from '../../services/siteService';
import { User, Substation } from '../../types';
import { COLORS, RADII, SHADOWS } from '../../constants/theme';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useAdminDrawerStore } from '../../store/useAdminDrawerStore';
import { AdminDrawerModal } from '../../components/navigation/AdminDrawerModal';
import { ShiftRouteModal } from '../../components/common/ShiftRouteModal';
import { resolvePhotoUrl } from '../../utils/imageUrl';
import { AppBackButton } from '../../components/common/AppBackButton';

const { width } = Dimensions.get('window');

type PeriodType = 'Daily' | 'Weekly' | 'Monthly';
type AttendanceStatusType = 'present' | 'absent' | 'weekly_off' | 'public_holiday' | 'late' | 'half_day';

interface AttendanceLogItem {
  id: string;
  date: string;
  formattedDate: string;
  employeeId: string;
  technicianName: string;
  technicianCode: string;
  siteId: string;
  siteName: string;
  checkInSiteName?: string;
  checkOutSiteName?: string;
  checkInTime: string;
  checkOutTime: string;
  duration: string;
  workingMinutes: number;
  distanceTraveled: string;
  status: AttendanceStatusType;
  isHalfDay?: boolean;
  attendanceCategory?: string;
  adminRemarks?: string;
  latitude?: number;
  longitude?: number;
  checkInLatitude?: number;
  checkInLongitude?: number;
  checkOutLatitude?: number;
  checkOutLongitude?: number;
  photoUrl?: string;
}

const STATUS_CARDS: {
  key: AttendanceStatusType;
  title: string;
  sub: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
  buttonLabel: string;
}[] = [
  {
    key: 'present',
    title: 'Present (P)',
    sub: 'Authorized on-duty shift completed at assigned substation',
    icon: CheckCircle2,
    color: '#059669',
    buttonLabel: 'Set as Present (P)',
  },
  {
    key: 'half_day',
    title: 'Half Day (HD)',
    sub: 'Partial shift recorded (< 8 hrs), subject to half-day deduction',
    icon: Clock,
    color: '#D97706',
    buttonLabel: 'Set as Half Day (HD)',
  },
  {
    key: 'absent',
    title: 'Absent (A)',
    sub: 'Unrecorded or non-working day without shift check-in',
    icon: AlertTriangle,
    color: '#DC2626',
    buttonLabel: 'Set as Absent (A)',
  },
];

const FALLBACK_LOGS: AttendanceLogItem[] = [];

export const AttendanceLogsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { openDrawer } = useAdminDrawerStore();

  const now = new Date();
  const [period, setPeriod] = useState<PeriodType>('Daily');
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [selectedWeek, setSelectedWeek] = useState(Math.min(5, Math.ceil(now.getDate() / 7)));

  const [logs, setLogs] = useState<AttendanceLogItem[]>(FALLBACK_LOGS);
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [sites, setSites] = useState<Substation[]>([]);
  const [selectedTechFilter, setSelectedTechFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Dropdown Pickers
  const [showTechFilterModal, setShowTechFilterModal] = useState(false);
  const [showTechFormPicker, setShowTechFormPicker] = useState(false);

  // Adjust Modal State
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  // Form Fields
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatusType>('present');
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formEmployeeName, setFormEmployeeName] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formSiteName, setFormSiteName] = useState('');
  const [formCheckIn, setFormCheckIn] = useState('09:00 AM');
  const [formCheckOut, setFormCheckOut] = useState('06:00 PM');
  const [formDuration, setFormDuration] = useState('9h 00m');
  const [formRemarks, setFormRemarks] = useState('');
  const [savingAdjust, setSavingAdjust] = useState(false);

  // Shift Route Modal State
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [selectedRouteLog, setSelectedRouteLog] = useState<AttendanceLogItem | null>(null);

  // Photo Inspection Modal State
  const [selectedPhotoLog, setSelectedPhotoLog] = useState<AttendanceLogItem | null>(null);

  const handleSelectStatus = (status: AttendanceStatusType) => {
    setSelectedStatus(status);
    if (status === 'late') {
      setFormRemarks('Auto-checked out at 06:00 PM (Shift End)');
      setFormCheckIn('10:14 AM');
      setFormCheckOut('06:00 PM');
      setFormDuration('7h 46m');
    } else if (status === 'half_day') {
      setFormRemarks('Partial shift recorded (less than 6 hours completed)');
      setFormCheckIn('09:30 AM');
      setFormCheckOut('01:30 PM');
      setFormDuration('4h 00m');
    } else if (status === 'present') {
      setFormRemarks('Regular shift completed on schedule');
      setFormCheckIn('09:30 AM');
      setFormCheckOut('06:00 PM');
      setFormDuration('8h 30m');
    } else if (status === 'absent') {
      setFormRemarks('Unexcused or unpaid leave of absence');
      setFormCheckIn('--:--');
      setFormCheckOut('--:--');
      setFormDuration('--');
    }
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [techList, siteList] = await Promise.all([
        employeeService.getEmployees(),
        siteService.getSites(),
      ]);
      setTechnicians(techList);
      setSites(siteList);
      await fetchLogs(selectedTechFilter, currentMonth, currentYear, period);
    } catch (e) {
      console.warn('Initial fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (techFilter = selectedTechFilter, month = currentMonth, year = currentYear, per = period) => {
    try {
      const data = await attendanceService.getAllLogs(
        month,
        year,
        per.toLowerCase(),
        techFilter === 'all' ? undefined : techFilter
      );
      if (data && data.logs && data.logs.length > 0) {
        setLogs(data.logs);
      } else {
        setLogs(FALLBACK_LOGS);
      }
    } catch (err) {
      console.warn('Fetch logs error:', err);
      setLogs(FALLBACK_LOGS);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLogs(selectedTechFilter, currentMonth, currentYear, period);
    setRefreshing(false);
  };

  const weekRanges = ['01-04 Oct', '05-11 Oct', '12-18 Oct', '19-25 Oct', '26-31 Oct'];

  const handlePeriodChange = (p: PeriodType) => {
    setPeriod(p);
  };

  const handlePrev = () => {
    if (period === 'Daily') {
      setSelectedDay((d) => (d > 1 ? d - 1 : 31));
    } else if (period === 'Weekly') {
      setSelectedWeek((w) => (w > 1 ? w - 1 : 5));
    } else {
      let m = currentMonth - 1;
      let y = currentYear;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
      setCurrentMonth(m);
      setCurrentYear(y);
      fetchLogs(selectedTechFilter, m, y, 'Monthly');
    }
  };

  const handleNext = () => {
    if (period === 'Daily') {
      setSelectedDay((d) => (d < 31 ? d + 1 : 1));
    } else if (period === 'Weekly') {
      setSelectedWeek((w) => (w < 5 ? w + 1 : 1));
    } else {
      let m = currentMonth + 1;
      let y = currentYear;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      setCurrentMonth(m);
      setCurrentYear(y);
      fetchLogs(selectedTechFilter, m, y, 'Monthly');
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const handleOpenAdjustRow = (log: AttendanceLogItem) => {
    setEditingLogId(log.id);
    setSelectedStatus(log.status || 'present');
    setFormEmployeeId(log.employeeId);
    setFormEmployeeName(`${log.technicianName} (${log.technicianCode})`);
    const dParts = log.date.split('-');
    if (dParts.length === 3) {
      setFormDate(`${dParts[2]}-${dParts[1]}-${dParts[0]}`);
    } else {
      setFormDate('22-10-2026');
    }
    setFormSiteName(log.siteName || 'st. joseph university');
    setFormCheckIn(log.checkInTime || '10:14 AM');
    setFormCheckOut(log.checkOutTime || '06:00 PM');
    setFormDuration(log.duration || '7h 46m');
    setFormRemarks(log.adminRemarks || 'Auto-checked out at 06:00 PM (Shift End)');
    setShowAdjustModal(true);
  };

  const handleOpenNewAdjust = () => {
    setEditingLogId(null);
    setSelectedStatus('present');
    const defaultTech = technicians[0] || null;
    setFormEmployeeId(defaultTech ? defaultTech.id : '');
    setFormEmployeeName(defaultTech ? `${defaultTech.name} (${defaultTech.employeeId})` : '');
    const nowD = new Date();
    const dStr = `${String(nowD.getDate()).padStart(2, '0')}-${String(nowD.getMonth() + 1).padStart(2, '0')}-${nowD.getFullYear()}`;
    setFormDate(dStr);
    setFormSiteName(sites[0]?.name || '');
    setFormCheckIn('09:00 AM');
    setFormCheckOut('06:00 PM');
    setFormDuration('9h 00m');
    setFormRemarks('');
    setShowAdjustModal(true);
  };

  const handleSaveAdjust = async () => {
    setSavingAdjust(true);
    try {
      const parts = formDate.split('-');
      const standardDate =
        parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : '2026-10-22';

      await attendanceService.adjustAttendance({
        recordId: editingLogId || undefined,
        employeeId: formEmployeeId,
        date: standardDate,
        status: selectedStatus,
        siteName: formSiteName,
        checkInTime: formCheckIn,
        checkOutTime: formCheckOut,
        duration: formDuration,
        adminRemarks: formRemarks,
      });

      Alert.alert(
        'Attendance Adjusted',
        `Successfully updated record for ${formEmployeeName} to ${selectedStatus.replace('_', ' ').toUpperCase()}.`
      );
      setShowAdjustModal(false);
      fetchLogs(selectedTechFilter, currentMonth, currentYear, period);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to adjust attendance status');
    } finally {
      setSavingAdjust(false);
    }
  };

  const handleOpenHolidays = () => {
    Alert.alert(
      'Adani Power & Grid - Holidays 2026',
      '• 26 Jan: Republic Day\n• 15 Aug: Independence Day\n• 02 Oct: Gandhi Jayanti\n• 24 Oct: Dussehra\n• 12 Nov: Diwali Deepavali\n• 25 Dec: Christmas\n\nOfficial compliance calendar PDF is available for internal download.',
      [{ text: 'Close', style: 'cancel' }]
    );
  };

  const handleOpenMap = (log: AttendanceLogItem) => {
    setSelectedRouteLog(log);
    setShowRouteModal(true);
  };

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (selectedTechFilter !== 'all') {
      result = result.filter(
        (l) => l.employeeId === selectedTechFilter || l.technicianCode === selectedTechFilter
      );
    }

    if (period === 'Daily') {
      const dayStr = String(selectedDay).padStart(2, '0');
      const targetPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${dayStr}`;
      const dayLogs = result.filter(
        (l) => l.date === targetPrefix || l.date.endsWith(`-${dayStr}`)
      );
      return dayLogs;
    }

    if (period === 'Weekly') {
      const ranges: [number, number][] = [
        [1, 4],
        [5, 11],
        [12, 18],
        [19, 25],
        [26, 31],
      ];
      const [startDay, endDay] = ranges[selectedWeek - 1] || [19, 25];
      const weekLogs = result.filter((l) => {
        try {
          const parts = l.date.split('-');
          const d = parseInt(parts[2], 10);
          return d >= startDay && d <= endDay;
        } catch {
          return true;
        }
      });
      if (weekLogs.length > 0) return weekLogs;
      return result;
    }

    return result;
  }, [logs, selectedTechFilter, period, selectedDay, selectedWeek, currentMonth, currentYear]);

  return (
    <View style={styles.container}>
      {/* Top Header with Menu Button */}
      <View
        style={[
          styles.headerRow,
          { paddingTop: Math.max(insets.top, 20) + 8 },
        ]}
      >
        <AppBackButton style={{ marginRight: 8 }} />

        <TouchableOpacity delayPressIn={0}
          style={styles.menuBtn}
          onPress={() => openDrawer('AttendanceLogs')}
          activeOpacity={0.7}
        >
          <Menu size={22} color="#0F172A" />
        </TouchableOpacity>

        <View style={{ flex: 1, marginHorizontal: 10 }}>
          <Text style={styles.screenTitle}>Attendance Logs & Shifts</Text>
        </View>

        <TouchableOpacity delayPressIn={0}
          style={styles.headerReportsBtn}
          onPress={() => navigation.navigate('Reports')}
          activeOpacity={0.85}
        >
          <FileSpreadsheet size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.headerReportsBtnText}>Reports & Export</Text>
        </TouchableOpacity>
      </View>

      {/* Action Chips Row */}
      <View style={styles.actionChipsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.actionChipsScroll}
        >
          <TouchableOpacity delayPressIn={0}
            style={styles.musterChipBtn}
            onPress={() => navigation.navigate('Reports')}
            activeOpacity={0.8}
          >
            <FileSpreadsheet size={14} color="#059669" style={{ marginRight: 6 }} />
            <Text style={styles.musterChipText}>Muster Roll & Excel</Text>
          </TouchableOpacity>

          <TouchableOpacity delayPressIn={0}
            style={styles.holidaysBtn}
            onPress={handleOpenHolidays}
            activeOpacity={0.8}
          >
            <Calendar size={14} color="#2563EB" style={{ marginRight: 6 }} />
            <Text style={styles.holidaysBtnText}>Holidays 2026 (PDF)</Text>
          </TouchableOpacity>

          <TouchableOpacity delayPressIn={0}
            style={styles.techFilterBtn}
            onPress={() => setShowTechFilterModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.techFilterLabel}>Filter Technician: </Text>
            <Text style={styles.techFilterVal}>
              {selectedTechFilter === 'all'
                ? 'All Field Technicians'
                : technicians.find((t) => t.id === selectedTechFilter)?.name || selectedTechFilter}
            </Text>
            <ChevronDown size={14} color="#64748B" style={{ marginLeft: 4 }} />
          </TouchableOpacity>

          <TouchableOpacity delayPressIn={0}
            style={styles.markLateBtn}
            onPress={handleOpenNewAdjust}
            activeOpacity={0.85}
          >
            <Clock size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.markLateBtnText}>+ Mark Late / Half Day</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Period Tabs: Daily | Weekly | Monthly */}
      <View style={styles.periodTabsWrap}>
        {(['Daily', 'Weekly', 'Monthly'] as const).map((tab) => {
          const isActive = period === tab;
          return (
            <TouchableOpacity delayPressIn={0}
              key={tab}
              style={[styles.periodTab, isActive && styles.periodTabActive]}
              onPress={() => handlePeriodChange(tab)}
              activeOpacity={0.7}
            >
              <Text style={[styles.periodTabText, isActive && styles.periodTabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Month / Week / Day Navigator Strip */}
      <View style={styles.monthNavigatorCard}>
        <TouchableOpacity delayPressIn={0}
          style={styles.navArrowBtn}
          onPress={handlePrev}
          activeOpacity={0.7}
        >
          <ChevronLeft size={18} color="#475569" />
        </TouchableOpacity>

        <View style={styles.navMonthCenter}>
          <Calendar size={15} color="#2563EB" style={{ marginRight: 6 }} />
          <Text style={styles.navMonthText}>
            {period === 'Daily' && `${selectedDay} ${monthNames[currentMonth - 1]} ${currentYear}`}
            {period === 'Weekly' && `Week ${selectedWeek} (${weekRanges[selectedWeek - 1]} ${currentYear})`}
            {period === 'Monthly' && `${monthNames[currentMonth - 1]} ${currentYear}`}
          </Text>
        </View>

        <TouchableOpacity delayPressIn={0}
          style={styles.navArrowBtn}
          onPress={handleNext}
          activeOpacity={0.7}
        >
          <ChevronRight size={18} color="#475569" />
        </TouchableOpacity>
      </View>

      {/* Period Context Badge */}
      <View style={styles.periodBadgeRow}>
        <View style={styles.periodBadgePill}>
          <Text style={styles.periodBadgeText}>
            {period === 'Daily' && `📅 Daily Shift Roster: ${filteredLogs.length} Records`}
            {period === 'Weekly' && `📊 Week ${selectedWeek} Shifts: ${filteredLogs.length} Records`}
            {period === 'Monthly' && `📈 Monthly Ledger: ${filteredLogs.length} Total Records`}
          </Text>
        </View>
      </View>

      {/* Ledger Table */}
      <ScrollView
        style={styles.tableScroll}
        contentContainerStyle={[
          styles.tableScrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 30 },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.tableCard, SHADOWS.sm]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thCell, { width: 110 }]}>DATE</Text>
                <Text style={[styles.thCell, { width: 150 }]}>TECHNICIAN</Text>
                <Text style={[styles.thCell, { width: 180 }]}>SUBSTATION SITE</Text>
                <Text style={[styles.thCell, { width: 90 }]}>CHECK-IN</Text>
                <Text style={[styles.thCell, { width: 90 }]}>CHECK-OUT</Text>
                <Text style={[styles.thCell, { width: 90 }]}>DURATION</Text>
                <Text style={[styles.thCell, { width: 130 }]}>DISTANCE TRAVELED</Text>
                <Text style={[styles.thCell, { width: 190 }]}>STATUS</Text>
                <Text style={[styles.thCell, { width: 110, textAlign: 'center' }]}>CHECK-IN PHOTO</Text>
                <Text style={[styles.thCell, { width: 100, textAlign: 'center' }]}>ADMIN ACTION</Text>
              </View>

              {loading ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <LoadingSpinner message="Loading attendance logs..." />
                </View>
              ) : filteredLogs.length === 0 ? (
                <View style={styles.emptyTable}>
                  <Text style={styles.emptyTableText}>
                    No shift attendance records found for this period.
                  </Text>
                </View>
              ) : (
                filteredLogs.map((item, index) => (
                  <View
                    key={item.id || index}
                    style={[
                      styles.tableDataRow,
                      index % 2 === 1 && { backgroundColor: '#F8FAFC' },
                    ]}
                  >
                    <View style={{ width: 110, justifyContent: 'center' }}>
                      <Text style={styles.tdDateText}>{item.formattedDate}</Text>
                    </View>

                    <View style={{ width: 150, justifyContent: 'center' }}>
                      <Text style={styles.tdTechName}>{item.technicianName}</Text>
                      <Text style={styles.tdTechCode}>{item.technicianCode}</Text>
                    </View>

                    <View style={{ width: 180, justifyContent: 'center' }}>
                      <Text style={styles.tdSiteText} numberOfLines={2}>
                        {item.siteName}
                      </Text>
                    </View>

                    <View style={{ width: 90, justifyContent: 'center' }}>
                      <Text style={styles.tdTimeText}>{item.checkInTime}</Text>
                    </View>

                    <View style={{ width: 90, justifyContent: 'center' }}>
                      <Text style={styles.tdTimeText}>{item.checkOutTime}</Text>
                    </View>

                    <View style={{ width: 90, justifyContent: 'center' }}>
                      <Text style={styles.tdDurationText}>{item.duration}</Text>
                    </View>

                    <View style={{ width: 130, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.tdDistanceText}>{item.distanceTraveled}</Text>
                      {item.distanceTraveled !== '--' && (
                        <TouchableOpacity delayPressIn={0}
                          style={styles.mapPillBtn}
                          onPress={() => handleOpenMap(item)}
                          activeOpacity={0.7}
                        >
                          <Navigation size={10} color="#2563EB" style={{ marginRight: 3 }} />
                          <Text style={styles.mapPillBtnText}>Map</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={{ width: 190, justifyContent: 'center' }}>
                      {item.status === 'late' && (
                        <View style={styles.statusLateBadge}>
                          <Clock size={11} color="#D97706" style={{ marginRight: 4 }} />
                          <Text style={styles.statusLateText}>Late</Text>
                        </View>
                      )}

                      {(item.status === 'half_day' || item.isHalfDay) && (
                        <View style={styles.statusHalfDayBadge}>
                          <Clock size={11} color="#EA580C" style={{ marginRight: 4 }} />
                          <Text style={styles.statusHalfDayText}>Half Day (HD)</Text>
                        </View>
                      )}

                      {item.status === 'present' && !item.isHalfDay && (
                        <View style={styles.statusPresentBadge}>
                          <CheckCircle2 size={11} color="#059669" style={{ marginRight: 4 }} />
                          <Text style={styles.statusPresentText}>Present (P)</Text>
                        </View>
                      )}

                      {item.status === 'absent' && (
                        <View style={styles.statusAbsentBadge}>
                          <AlertTriangle size={11} color="#DC2626" style={{ marginRight: 4 }} />
                          <Text style={styles.statusAbsentText}>Absent</Text>
                        </View>
                      )}

                      {item.adminRemarks ? (
                        <Text style={styles.autoNoteText} numberOfLines={2}>
                          {item.adminRemarks}
                        </Text>
                      ) : null}
                    </View>

                    <View style={{ width: 110, justifyContent: 'center', alignItems: 'center' }}>
                      {item.photoUrl ? (
                        <TouchableOpacity delayPressIn={0}
                          style={styles.photoThumbBtn}
                          onPress={() => setSelectedPhotoLog(item)}
                          activeOpacity={0.75}
                        >
                          <Image
                            source={{ uri: resolvePhotoUrl(item.photoUrl) }}
                            style={styles.photoThumbImg}
                          />
                          <View style={styles.photoViewTag}>
                            <CameraIcon size={9} color="#FFFFFF" style={{ marginRight: 2 }} />
                            <Text style={styles.photoViewTagText}>View</Text>
                          </View>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.noPhotoText}>No Photo</Text>
                      )}
                    </View>

                    <View style={{ width: 100, justifyContent: 'center', alignItems: 'center' }}>
                      <TouchableOpacity delayPressIn={0}
                        style={styles.adjustRowBtn}
                        onPress={() => handleOpenAdjustRow(item)}
                        activeOpacity={0.8}
                      >
                        <Edit size={12} color="#D97706" style={{ marginRight: 4 }} />
                        <Text style={styles.adjustRowBtnText}>Adjust</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      {/* Tech Filter Picker Modal */}
      <Modal
        visible={showTechFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTechFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerModalCard, SHADOWS.lg]}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Filter by Technician</Text>
              <TouchableOpacity delayPressIn={0} onPress={() => setShowTechFilterModal(false)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              <TouchableOpacity delayPressIn={0}
                style={[styles.pickerItem, selectedTechFilter === 'all' && styles.pickerItemActive]}
                onPress={() => {
                  setSelectedTechFilter('all');
                  setShowTechFilterModal(false);
                  fetchLogs('all', currentMonth, currentYear, period);
                }}
              >
                <Text style={[styles.pickerItemText, selectedTechFilter === 'all' && styles.pickerItemTextActive]}>
                  All Field Technicians
                </Text>
                {selectedTechFilter === 'all' && <Check size={16} color="#2563EB" />}
              </TouchableOpacity>

              {technicians.map((t) => (
                <TouchableOpacity delayPressIn={0}
                  key={t.id}
                  style={[styles.pickerItem, selectedTechFilter === t.id && styles.pickerItemActive]}
                  onPress={() => {
                    setSelectedTechFilter(t.id);
                    setShowTechFilterModal(false);
                    fetchLogs(t.id, currentMonth, currentYear, period);
                  }}
                >
                  <Text style={[styles.pickerItemText, selectedTechFilter === t.id && styles.pickerItemTextActive]}>
                    {t.name} ({t.employeeId})
                  </Text>
                  {selectedTechFilter === t.id && <Check size={16} color="#2563EB" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Adjust Attendance Status Modal */}
      <Modal
        visible={showAdjustModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAdjustModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.adjustModalCard, SHADOWS.lg]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderIconBadge}>
                <Clock size={20} color="#D97706" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.adjustModalTitle}>Adjust Attendance Status</Text>
                <Text style={styles.adjustModalSub}>
                  Mark Late Arrival, Half Day, or Present for field technicians
                </Text>
              </View>
              <TouchableOpacity delayPressIn={0} onPress={() => setShowAdjustModal(false)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              <Text style={styles.sectionHeaderLabel}>SELECT ATTENDANCE STATUS *</Text>
              <View style={styles.statusGrid}>
                {STATUS_CARDS.map((card) => {
                  const IconComp = card.icon;
                  const isSelected = selectedStatus === card.key;
                  return (
                    <TouchableOpacity delayPressIn={0}
                      key={card.key}
                      style={[styles.statusCard, isSelected && styles.statusCardSelected]}
                      onPress={() => handleSelectStatus(card.key)}
                      activeOpacity={0.75}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <IconComp size={16} color={isSelected ? card.color : '#64748B'} />
                        <Text style={[styles.statusCardTitle, isSelected && { color: card.color, fontWeight: '800' }]}>
                          {card.title}
                        </Text>
                      </View>
                      <Text style={styles.statusCardSub}>{card.sub}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.formRow}>
                <View style={styles.colHalf}>
                  <Text style={styles.inputFieldLabel}>Field Technician *</Text>
                  <View style={styles.selectBoxDisabled}>
                    <Text style={styles.selectBoxText} numberOfLines={1}>
                      {formEmployeeName}
                    </Text>
                  </View>
                </View>

                <View style={styles.colHalf}>
                  <Text style={styles.inputFieldLabel}>Shift Date *</Text>
                  <View style={styles.dateInputWrap}>
                    <TextInput
                      style={styles.dateInputText}
                      value={formDate}
                      onChangeText={setFormDate}
                      placeholder="DD-MM-YYYY"
                      placeholderTextColor="#94A3B8"
                    />
                    <Calendar size={16} color="#64748B" />
                  </View>
                </View>
              </View>

              <View style={{ marginBottom: 12 }}>
                <Text style={styles.inputFieldLabel}>Substation Site Name</Text>
                <View style={styles.siteInputWrap}>
                  <Building2 size={16} color="#64748B" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.siteInputText}
                    value={formSiteName}
                    onChangeText={setFormSiteName}
                    placeholder="Enter substation site"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <View style={styles.timingStrip}>
                <View style={styles.timingCol}>
                  <Text style={styles.timingLabel}>Check-In</Text>
                  <TextInput
                    style={styles.timingInput}
                    value={formCheckIn}
                    onChangeText={setFormCheckIn}
                  />
                </View>

                <View style={styles.timingCol}>
                  <Text style={styles.timingLabel}>Check-Out</Text>
                  <TextInput
                    style={styles.timingInput}
                    value={formCheckOut}
                    onChangeText={setFormCheckOut}
                  />
                </View>

                <View style={styles.timingCol}>
                  <Text style={styles.timingLabel}>Duration</Text>
                  <TextInput
                    style={styles.timingInput}
                    value={formDuration}
                    onChangeText={setFormDuration}
                  />
                </View>
              </View>

              <View style={{ marginBottom: 14 }}>
                <Text style={styles.inputFieldLabel}>Supervisor Remarks *</Text>
                <TextInput
                  style={styles.remarksInput}
                  value={formRemarks}
                  onChangeText={setFormRemarks}
                  multiline
                  numberOfLines={2}
                />
              </View>

              <TouchableOpacity delayPressIn={0}
                style={styles.saveBtn}
                onPress={handleSaveAdjust}
                disabled={savingAdjust}
              >
                {savingAdjust ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Status Adjustment</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Shift Travel Route & Distance Road Map Modal */}
      {selectedRouteLog && (
        <ShiftRouteModal
          visible={showRouteModal}
          onClose={() => {
            setShowRouteModal(false);
            setSelectedRouteLog(null);
          }}
          technicianName={selectedRouteLog.technicianName}
          formattedDate={selectedRouteLog.formattedDate}
          checkInSiteName={selectedRouteLog.checkInSiteName || selectedRouteLog.siteName || 'Substation Site'}
          checkInTime={selectedRouteLog.checkInTime}
          checkOutSiteName={selectedRouteLog.checkOutSiteName && selectedRouteLog.checkOutSiteName !== '--' ? selectedRouteLog.checkOutSiteName : undefined}
          checkOutTime={selectedRouteLog.checkOutTime}
          distanceTraveled={selectedRouteLog.distanceTraveled}
          duration={selectedRouteLog.duration}
          checkInCoords={{
            latitude: selectedRouteLog.checkInLatitude || selectedRouteLog.latitude || 12.962590,
            longitude: selectedRouteLog.checkInLongitude || selectedRouteLog.longitude || 77.593617,
          }}
          checkOutCoords={
            selectedRouteLog.checkOutLatitude && selectedRouteLog.checkOutLongitude
              ? {
                  latitude: selectedRouteLog.checkOutLatitude,
                  longitude: selectedRouteLog.checkOutLongitude,
                }
              : undefined
          }
        />
      )}

      {/* Technician Check-In Photo Inspection Modal */}
      {selectedPhotoLog && (
        <Modal
          visible={Boolean(selectedPhotoLog)}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedPhotoLog(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.photoModalCard, SHADOWS.lg]}>
              <View style={styles.modalHeader}>
                <View style={[styles.modalHeaderIconBadge, { backgroundColor: '#EFF6FF' }]}>
                  <CameraIcon size={20} color="#1E63F0" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.adjustModalTitle}>Technician Check-In Photo</Text>
                  <Text style={styles.adjustModalSub}>
                    {selectedPhotoLog.technicianName} ({selectedPhotoLog.technicianCode})
                  </Text>
                </View>
                <TouchableOpacity delayPressIn={0} onPress={() => setSelectedPhotoLog(null)}>
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.photoModalBody}>
                {selectedPhotoLog.photoUrl ? (
                  <View style={styles.photoModalImgWrap}>
                    <Image
                      source={{ uri: resolvePhotoUrl(selectedPhotoLog.photoUrl) }}
                      style={styles.photoModalImg}
                      resizeMode="cover"
                    />
                    <View style={styles.photoModalBadge}>
                      <CheckCircle2 size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.photoModalBadgeText}>Live Attendance Punch Photo</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.noPhotoPlaceholderWrap}>
                    <CameraIcon size={32} color="#94A3B8" />
                    <Text style={styles.noPhotoPlaceholderText}>No photo was uploaded during check-in</Text>
                  </View>
                )}

                <View style={styles.photoMetaCard}>
                  <View style={styles.photoMetaRow}>
                    <Text style={styles.photoMetaLabel}>Substation Site:</Text>
                    <Text style={styles.photoMetaVal}>{selectedPhotoLog.siteName}</Text>
                  </View>
                  <View style={styles.photoMetaRow}>
                    <Text style={styles.photoMetaLabel}>Punch Time:</Text>
                    <Text style={styles.photoMetaVal}>
                      {selectedPhotoLog.formattedDate} • {selectedPhotoLog.checkInTime}
                    </Text>
                  </View>
                  <View style={styles.photoMetaRow}>
                    <Text style={styles.photoMetaLabel}>Status:</Text>
                    <Text
                      style={[
                        styles.photoMetaVal,
                        {
                          fontWeight: '800',
                          color: selectedPhotoLog.status === 'late' ? '#D97706' : '#059669',
                        },
                      ]}
                    >
                      {selectedPhotoLog.status?.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity delayPressIn={0}
                  style={styles.closePhotoBtn}
                  onPress={() => setSelectedPhotoLog(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.closePhotoBtnText}>Close Inspection</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      <AdminDrawerModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  screenSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  headerReportsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  headerReportsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  musterChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  musterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  actionChipsContainer: {
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  actionChipsScroll: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  holidaysBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  holidaysBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  techFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  techFilterLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  techFilterVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  markLateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#D97706',
  },
  markLateBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  periodTabsWrap: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  periodTabActive: {
    backgroundColor: '#1E63F0',
  },
  periodTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  periodTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  monthNavigatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  navArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navMonthCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navMonthText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  periodBadgeRow: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  periodBadgePill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  periodBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  tableScroll: {
    flex: 1,
  },
  tableScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  thCell: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  emptyTable: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyTableText: {
    fontSize: 13,
    color: '#64748B',
  },
  tdDateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  tdTechName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  tdTechCode: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  tdSiteText: {
    fontSize: 11,
    color: '#334155',
  },
  tdTimeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F172A',
  },
  tdDurationText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  tdDistanceText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  mapPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#EFF6FF',
  },
  mapPillBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  statusLateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#FEF3C7',
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  statusLateText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },
  statusHalfDayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#FFEDD5',
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  statusHalfDayText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EA580C',
  },
  statusPresentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#DCFCE7',
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  statusPresentText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  statusAbsentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#FEE2E2',
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  statusAbsentText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
  },
  autoNoteText: {
    fontSize: 10,
    color: '#64748B',
  },
  adjustRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  adjustRowBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },

  /* Modals */
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

  /* Adjust Modal */
  adjustModalCard: {
    width: Math.min(width * 0.92, 460),
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 12,
  },
  modalHeaderIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjustModalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  adjustModalSub: {
    fontSize: 11,
    color: '#64748B',
  },
  modalScroll: {
    flexGrow: 0,
  },
  sectionHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 8,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  statusCard: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
  },
  statusCardSelected: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
  },
  statusCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 6,
  },
  statusCardSub: {
    fontSize: 10,
    color: '#64748B',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  colHalf: {
    flex: 1,
  },
  inputFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  selectBoxDisabled: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  selectBoxText: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
  },
  dateInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  dateInputText: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    padding: 0,
  },
  siteInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  siteInputText: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    padding: 0,
  },
  timingStrip: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  timingCol: {
    flex: 1,
  },
  timingLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  timingInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0F172A',
    textAlign: 'center',
  },
  remarksInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0F172A',
    height: 56,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: '#1E63F0',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  /* Check-in photo styling */
  photoThumbBtn: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
  },
  photoThumbImg: {
    width: '100%',
    height: '100%',
  },
  photoViewTag: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  photoViewTagText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  noPhotoText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  photoModalCard: {
    width: Math.min(width * 0.92, 420),
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
  },
  photoModalBody: {
    alignItems: 'center',
  },
  photoModalImgWrap: {
    position: 'relative',
    width: '100%',
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    marginBottom: 14,
  },
  photoModalImg: {
    width: '100%',
    height: '100%',
  },
  photoModalBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 150, 105, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  photoModalBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  noPhotoPlaceholderWrap: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  noPhotoPlaceholderText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 8,
  },
  photoMetaCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    gap: 6,
  },
  photoMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  photoMetaLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  photoMetaVal: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '700',
  },
  closePhotoBtn: {
    width: '100%',
    backgroundColor: '#1E63F0',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closePhotoBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default AttendanceLogsScreen;
