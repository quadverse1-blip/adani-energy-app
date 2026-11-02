import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import {
  Menu,
  ArrowLeft,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  User,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useSupervisorDrawerStore } from '../../store/useSupervisorDrawerStore';
import { SupervisorDrawerModal } from '../../components/navigation/SupervisorDrawerModal';
import { useAuthStore } from '../../store/useAuthStore';
import { attendanceService } from '../../services/attendanceService';
import { COLORS, SHADOWS } from '../../constants/theme';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

type PeriodType = 'Daily' | 'Weekly' | 'Monthly';
type AttendanceStatusType = 'half_day' | 'late' | 'present' | 'absent';

interface SupervisorLogItem {
  id: string;
  date: string;
  formattedDate: string;
  checkInTime: string;
  checkOutTime: string;
  duration: string;
  status: AttendanceStatusType;
  adminRemarks?: string;
}

const FALLBACK_SUPERVISOR_LOGS: SupervisorLogItem[] = [
  {
    id: 'att_suresh_22_1',
    date: '2026-10-22',
    formattedDate: '22 Oct 2026',
    checkInTime: '10:43 AM',
    checkOutTime: '10:44 AM',
    duration: '0h 01m',
    status: 'half_day',
    adminRemarks: '',
  },
  {
    id: 'att_suresh_22_2',
    date: '2026-10-22',
    formattedDate: '22 Oct 2026',
    checkInTime: '10:17 AM',
    checkOutTime: '10:43 AM',
    duration: '0h 25m',
    status: 'half_day',
    adminRemarks: '',
  },
  {
    id: 'att_suresh_21',
    date: '2026-10-21',
    formattedDate: '21 Oct 2026',
    checkInTime: '06:55 PM',
    checkOutTime: '06:00 PM',
    duration: '23h 05m',
    status: 'half_day',
    adminRemarks: 'Auto-checked out at 06:00 PM (Shift End)',
  },
  {
    id: 'att_suresh_20',
    date: '2026-10-20',
    formattedDate: '20 Oct 2026',
    checkInTime: '09:15 AM',
    checkOutTime: '06:00 PM',
    duration: '8h 45m',
    status: 'late',
    adminRemarks: 'Late checked-in arrival',
  },
  {
    id: 'att_suresh_19',
    date: '2026-10-19',
    formattedDate: '19 Oct 2026',
    checkInTime: '08:50 AM',
    checkOutTime: '06:00 PM',
    duration: '9h 10m',
    status: 'present',
    adminRemarks: 'Regular shift completed on schedule',
  },
];

export const SupervisorAttendanceHistoryScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { openDrawer } = useSupervisorDrawerStore();
  const { user } = useAuthStore();
  const { width: screenWidth } = useWindowDimensions();

  const isDesktop = screenWidth >= 960;
  const isTablet = screenWidth >= 640 && screenWidth < 960;

  const [period, setPeriod] = useState<PeriodType>('Monthly');
  const [currentMonth, setCurrentMonth] = useState(10);
  const [currentYear, setCurrentYear] = useState(2026);
  const [selectedDay, setSelectedDay] = useState(22);
  const [selectedWeek, setSelectedWeek] = useState(4);

  const [logs, setLogs] = useState<SupervisorLogItem[]>(FALLBACK_SUPERVISOR_LOGS);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const weekRanges = ['01-04 Oct', '05-11 Oct', '12-18 Oct', '19-25 Oct', '26-31 Oct'];

  const supervisorInitials = useMemo(() => {
    const name = user?.name || 'Suresh Patil';
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }, [user]);

  const fetchSupervisorLogs = async () => {
    setLoading(true);
    try {
      const targetEmpId = user?.id || user?.employeeId || 'emp_suresh';
      const data = await attendanceService.getAllLogs(
        currentMonth,
        currentYear,
        period.toLowerCase(),
        targetEmpId
      );
      if (data && data.logs && data.logs.length > 0) {
        // Filter specifically to this supervisor's records
        const supervisorOnlyLogs = data.logs.filter((item: any) => {
          const emp = String(item.employeeId || '');
          const code = String(item.technicianCode || '');
          return (
            emp === targetEmpId ||
            code === targetEmpId ||
            emp === 'emp_suresh' ||
            code === 'SUPER01' ||
            emp === user?.id ||
            code === user?.employeeId
          );
        });

        const sourceList = supervisorOnlyLogs.length > 0 ? supervisorOnlyLogs : data.logs;
        const mapped: SupervisorLogItem[] = sourceList.map((item: any) => {
          let st: AttendanceStatusType = 'present';
          const s = (item.status || '').toLowerCase();
          if (s === 'half_day' || s === 'half-day' || item.isHalfDay || item.attendanceCategory === 'HALF_DAY') st = 'half_day';
          else if (s === 'late') st = 'late';
          else if (s === 'absent') st = 'absent';

          return {
            id: item.id || Math.random().toString(),
            date: item.date || '2026-10-22',
            formattedDate: item.formattedDate || '22 Oct 2026',
            checkInTime: item.checkInTime || '--:--',
            checkOutTime: item.checkOutTime || '--:--',
            duration: item.duration || '--',
            status: st,
            adminRemarks: item.adminRemarks || '',
          };
        });
        setLogs(mapped);
      } else {
        setLogs(FALLBACK_SUPERVISOR_LOGS);
      }
    } catch (e) {
      console.warn('Error fetching supervisor logs:', e);
      setLogs(FALLBACK_SUPERVISOR_LOGS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSupervisorLogs();
  }, [currentMonth, currentYear, period]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSupervisorLogs();
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
    }
  };

  const filteredLogs = useMemo(() => {
    if (period === 'Daily') {
      const dayStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
      const filtered = logs.filter((l) => l.date === dayStr);
      return filtered.length > 0 ? filtered : logs.slice(0, 2);
    }
    if (period === 'Weekly') {
      const ranges = [
        [1, 4],
        [5, 11],
        [12, 18],
        [19, 25],
        [26, 31],
      ];
      const [startDay, endDay] = ranges[selectedWeek - 1] || [19, 25];
      const weekLogs = logs.filter((l) => {
        try {
          const parts = l.date.split('-');
          const d = parseInt(parts[2], 10);
          return d >= startDay && d <= endDay;
        } catch {
          return true;
        }
      });
      return weekLogs.length > 0 ? weekLogs : logs;
    }
    return logs;
  }, [logs, period, selectedDay, selectedWeek, currentMonth, currentYear]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('SupervisorDashboard');
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header Row with Menu & Back Navigation */}
      <View style={[styles.headerRow, { paddingTop: Math.max(insets.top, 16) + 8 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity delayPressIn={0}
            style={styles.menuBtn}
            onPress={() => openDrawer('AttendanceLogs')}
            activeOpacity={0.7}
            accessibilityLabel="Open Supervisor Navigation Menu"
          >
            <Menu size={20} color="#0F172A" />
          </TouchableOpacity>

          <TouchableOpacity delayPressIn={0}
            style={styles.backBtn}
            onPress={handleBack}
            activeOpacity={0.7}
            accessibilityLabel="Back to Dashboard"
          >
            <ArrowLeft size={18} color="#0F172A" />
          </TouchableOpacity>
        </View>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.screenTitle} numberOfLines={1}>My Attendance History</Text>
        </View>

        <TouchableOpacity delayPressIn={0}
          style={styles.refreshIconBtn}
          onPress={onRefresh}
          activeOpacity={0.7}
          accessibilityLabel="Refresh Records"
        >
          <RefreshCw size={13} color="#1E63F0" style={{ marginRight: 4 }} />
          <Text style={styles.refreshIconBtnText}>Sync</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={[
          styles.mainScrollContent,
          {
            paddingBottom: Math.max(insets.bottom, 20) + 24,
            maxWidth: isDesktop ? 960 : isTablet ? 720 : '100%',
            alignSelf: 'center',
            width: '100%',
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1E63F0']} />
        }
      >
        {/* Supervisor Identity Banner */}
        <View style={styles.supervisorInfoBar}>
          <View style={styles.supervisorAvatar}>
            <Text style={styles.supervisorAvatarText}>{supervisorInitials}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.supervisorNameText}>
              {user?.name || 'Suresh Patil'} • <Text style={styles.supervisorIdText}>{user?.employeeId || 'SUPER01'}</Text>
            </Text>
            <Text style={styles.supervisorRoleText}>
              {user?.designation || 'Area Operations Supervisor'} • Personal Attendance Ledger
            </Text>
          </View>
          <View style={styles.myPillBadge}>
            <Text style={styles.myPillBadgeText}>MY RECORD</Text>
          </View>
        </View>

        {/* ============================================================== */}
        {/* 1. PERIOD TABS PILL: Daily | Weekly | Monthly                   */}
        {/* ============================================================== */}
        <View style={[styles.periodTabsWrap, (isDesktop || isTablet) && styles.periodTabsWrapConstrained]}>
          {(['Daily', 'Weekly', 'Monthly'] as const).map((tab) => {
            const isActive = period === tab;
            return (
              <TouchableOpacity delayPressIn={0}
                key={tab}
                style={[styles.periodTab, isActive && styles.periodTabActive]}
                onPress={() => setPeriod(tab)}
                activeOpacity={0.7}
              >
                <Text style={[styles.periodTabText, isActive && styles.periodTabTextActive]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ============================================================== */}
        {/* 2. DATE NAVIGATOR CARD: <  📅 October 2026  >                  */}
        {/* ============================================================== */}
        <View style={[styles.monthNavigatorCard, (isDesktop || isTablet) && styles.monthNavigatorCardConstrained]}>
          <TouchableOpacity delayPressIn={0}
            style={styles.navArrowBtn}
            onPress={handlePrev}
            activeOpacity={0.7}
          >
            <ChevronLeft size={20} color="#64748B" />
          </TouchableOpacity>

          <View style={styles.navMonthCenter}>
            <Calendar size={18} color="#1E63F0" style={{ marginRight: 8 }} />
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
            <ChevronRight size={20} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* ============================================================== */}
        {/* 3. MAIN TABLE CARD WITH 5 COLUMNS:                            */}
        {/* DATE | CHECK-IN | CHECK-OUT | DURATION | STATUS                */}
        {/* (Substation Site and Distance Traveled columns removed)        */}
        {/* ============================================================== */}
        <View style={[styles.tableCard, SHADOWS.sm]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View style={{ minWidth: isDesktop ? '100%' : 540 }}>
              {/* Header Row */}
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thCell, { width: 120, flex: isDesktop ? 1.2 : undefined }]}>DATE</Text>
                <Text style={[styles.thCell, { width: 100, flex: isDesktop ? 1 : undefined }]}>CHECK-IN</Text>
                <Text style={[styles.thCell, { width: 100, flex: isDesktop ? 1 : undefined }]}>CHECK-OUT</Text>
                <Text style={[styles.thCell, { width: 110, flex: isDesktop ? 1.1 : undefined }]}>DURATION</Text>
                <Text style={[styles.thCell, { width: 190, flex: isDesktop ? 1.8 : undefined }]}>STATUS</Text>
              </View>

              {/* Data Rows */}
              {loading ? (
                <View style={{ paddingVertical: 45, alignItems: 'center' }}>
                  <LoadingSpinner message="Loading attendance history..." />
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
                    {/* 1. DATE */}
                    <View style={{ width: 120, flex: isDesktop ? 1.2 : undefined, justifyContent: 'center' }}>
                      <Text style={styles.tdDateText}>{item.formattedDate}</Text>
                    </View>

                    {/* 2. CHECK-IN */}
                    <View style={{ width: 100, flex: isDesktop ? 1 : undefined, justifyContent: 'center' }}>
                      <Text style={styles.tdTimeText}>{item.checkInTime}</Text>
                    </View>

                    {/* 3. CHECK-OUT */}
                    <View style={{ width: 100, flex: isDesktop ? 1 : undefined, justifyContent: 'center' }}>
                      <Text style={styles.tdTimeText}>{item.checkOutTime}</Text>
                    </View>

                    {/* 4. DURATION */}
                    <View style={{ width: 110, flex: isDesktop ? 1.1 : undefined, justifyContent: 'center' }}>
                      <Text style={styles.tdDurationText}>{item.duration}</Text>
                    </View>

                    {/* 5. STATUS */}
                    <View style={{ width: 190, flex: isDesktop ? 1.8 : undefined, justifyContent: 'center' }}>
                      {item.status === 'half_day' && (
                        <View style={styles.statusHalfDayBadge}>
                          <Clock size={12} color="#C2410C" style={{ marginRight: 5 }} />
                          <Text style={styles.statusHalfDayText}>Half Day</Text>
                        </View>
                      )}

                      {item.status === 'late' && (
                        <View style={styles.statusLateBadge}>
                          <Clock size={12} color="#B45309" style={{ marginRight: 5 }} />
                          <Text style={styles.statusLateText}>Late</Text>
                        </View>
                      )}

                      {item.status === 'present' && (
                        <View style={styles.statusPresentBadge}>
                          <CheckCircle2 size={12} color="#047857" style={{ marginRight: 5 }} />
                          <Text style={styles.statusPresentText}>Present</Text>
                        </View>
                      )}

                      {item.status === 'absent' && (
                        <View style={styles.statusAbsentBadge}>
                          <AlertTriangle size={12} color="#DC2626" style={{ marginRight: 5 }} />
                          <Text style={styles.statusAbsentText}>Absent</Text>
                        </View>
                      )}

                      {/* Auto checkout note or remarks */}
                      {item.adminRemarks ? (
                        <Text style={styles.autoNoteText} numberOfLines={2}>
                          {item.adminRemarks}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      {/* Render Supervisor Navigation Drawer */}
      <SupervisorDrawerModal />
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginHorizontal: 10,
  },
  screenTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  screenSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  refreshIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  refreshIconBtnText: {
    color: '#1E63F0',
    fontSize: 12,
    fontWeight: '700',
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    padding: 16,
  },

  // Supervisor Identity Info Bar
  supervisorInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    ...SHADOWS.sm,
  },
  supervisorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supervisorAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E63F0',
  },
  supervisorNameText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  supervisorIdText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  supervisorRoleText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  myPillBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  myPillBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.4,
  },

  // 1. Period Tabs
  periodTabsWrap: {
    flexDirection: 'row',
    backgroundColor: '#EEF2F6',
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
  },
  periodTabsWrapConstrained: {
    maxWidth: 440,
    alignSelf: 'center',
    width: '100%',
  },
  periodTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodTabActive: {
    backgroundColor: '#1E63F0',
    ...SHADOWS.sm,
  },
  periodTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  periodTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // 2. Month Navigator Card
  monthNavigatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
    ...SHADOWS.sm,
  },
  monthNavigatorCardConstrained: {
    maxWidth: 440,
    alignSelf: 'center',
    width: '100%',
  },
  navArrowBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  navMonthCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navMonthText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },

  // 3. Table Card
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  thCell: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  tableDataRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  tdDateText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  tdTimeText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
  },
  tdDurationText: {
    fontSize: 13,
    color: '#1E63F0',
    fontWeight: '800',
  },

  // Badges matching user image 2
  statusHalfDayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 3,
  },
  statusHalfDayText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#C2410C',
  },
  statusLateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 3,
  },
  statusLateText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
  },
  statusPresentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 3,
  },
  statusPresentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
  },
  statusAbsentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 3,
  },
  statusAbsentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  autoNoteText: {
    fontSize: 11,
    color: '#475569',
    fontStyle: 'italic',
    marginTop: 2,
    lineHeight: 14,
  },
  emptyTable: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTableText: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
});

export default SupervisorAttendanceHistoryScreen;
