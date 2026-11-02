import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  Modal,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import {
  Menu,
  Clock,
  Timer,
  MapPin,
  TrendingUp,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Calendar,
  Users,
  BarChart3,
  ArrowRight,
  LogOut,
  AlertTriangle,
  Building2,
  ChevronRight,
  FileText,
  Bell,
  X,
  CheckCheck,
  User as UserIcon,
  Lock,
} from 'lucide-react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { useSupervisorDrawerStore } from '../../store/useSupervisorDrawerStore';
import { attendanceService, TodayAttendanceResult } from '../../services/attendanceService';
import { dashboardService, AdminNotification } from '../../services/dashboardService';
import { SupervisorDrawerModal } from '../../components/navigation/SupervisorDrawerModal';
import { AttendanceRecord, Substation } from '../../types';
import { AppButton } from '../../components/common/AppButton';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { holidayService } from '../../services/holidayService';
import { getShiftInfo } from '../../utils/shiftUtils';

interface StaffAttendanceItem {
  id: string;
  technicianName: string;
  technicianCode: string;
  siteName: string;
  checkInTime: string;
  status: string;
}

export const SupervisorDashboardScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<any>();
  const { user, logout } = useAuthStore();
  const { openDrawer } = useSupervisorDrawerStore();

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [checkingIn, setCheckingIn] = useState<boolean>(false);
  const [checkingOut, setCheckingOut] = useState<boolean>(false);
  const [showCheckOutConfirm, setShowCheckOutConfirm] = useState(false);

  // Notifications state
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [showNotifModal, setShowNotifModal] = useState<boolean>(false);
  const [notifFilter, setNotifFilter] = useState<'all' | 'admin' | 'employee'>('all');

  // Today's attendance state
  const [todayData, setTodayData] = useState<TodayAttendanceResult | null>(null);
  const [liveElapsedMinutes, setLiveElapsedMinutes] = useState<number>(0);

  // Field Staff checked in today
  const [fieldStaff, setFieldStaff] = useState<StaffAttendanceItem[]>([]);
  const [staffLoading, setStaffLoading] = useState<boolean>(false);

  // Chart toggle
  const [chartMode, setChartMode] = useState<'daily' | 'distribution'>('daily');

  // Device GPS coords
  const [deviceCoords, setDeviceCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: 18.5204,
    longitude: 73.8567,
  });

  const fetchDashboardData = async () => {
    try {
      // 1. Fetch supervisor today's attendance
      const todayRes = await attendanceService.getTodayAttendance().catch(() => null);
      if (todayRes) {
        setTodayData(todayRes);
        setLiveElapsedMinutes(todayRes.liveElapsedMinutes || 0);
      }

      // 2. Fetch field staff check-ins today
      const todayDate = new Date();
      const logsRes = await attendanceService
        .getAllLogs(todayDate.getMonth() + 1, todayDate.getFullYear(), 'daily')
        .catch(() => ({ logs: [], total: 0 }));

      if (logsRes && logsRes.logs) {
        // Filter technicians checked in today
        const checkedInTechnicians: StaffAttendanceItem[] = logsRes.logs
          .filter(
            (l: any) =>
              l.checkInTime &&
              l.checkInTime !== '--:--' &&
              (l.role === 'technician' || !l.role)
          )
          .map((l: any) => ({
            id: l.recordId || l.id || Math.random().toString(),
            technicianName: l.technicianName || 'Field Technician',
            technicianCode: l.technicianCode || l.employeeId || 'b4S/Adani',
            siteName: l.siteName || 'Substation Hub',
            checkInTime: l.checkInTime,
            status: l.status || 'present',
          }));
        setFieldStaff(checkedInTechnicians);
      }

      // 3. Fetch notifications (both Admin directives and Employee alerts)
      try {
        const statsRes = await dashboardService.getAdminStats();
        if (statsRes && statsRes.notifications) {
          setNotifications(statsRes.notifications);
        }
      } catch (errNotif) {
        console.warn('Supervisor notifications load error:', errNotif);
      }

      // 4. Obtain location quietly
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setDeviceCoords({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      } catch {}
    } catch (e: any) {
      console.warn('Supervisor dashboard fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Live timer for active shift
  useEffect(() => {
    if (todayData?.status === 'active') {
      const interval = setInterval(() => {
        setLiveElapsedMinutes((m) => m + 1);
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [todayData?.status]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  // Notification Counts & Filtering (Both Admin Directives & Employee Field Updates)
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  const adminNotificationsCount = useMemo(() => {
    return notifications.filter((n) => n.source === 'admin').length;
  }, [notifications]);

  const employeeNotificationsCount = useMemo(() => {
    return notifications.filter((n) => n.source === 'employee' || !n.source).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (notifFilter === 'admin') return item.source === 'admin';
      if (notifFilter === 'employee') return item.source === 'employee' || !item.source;
      return true;
    });
  }, [notifications, notifFilter]);

  const handleMarkAllRead = async () => {
    try {
      await dashboardService.markNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (e) {
      console.warn('Mark all read error:', e);
    }
  };

  const handleToggleRead = async (item: AdminNotification) => {
    if (!item.isRead) {
      try {
        await dashboardService.markNotificationsRead(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
        );
      } catch (e) {
        console.warn('Toggle read error:', e);
      }
    }
  };

  // Sign out / Logout Handler
  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      `Are you sure you want to sign out of the supervisor portal (${user?.name || user?.employeeId || 'Supervisor'})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  // Live shift info state that updates periodically and on refresh
  const [shiftInfo, setShiftInfo] = useState(getShiftInfo());
  const isPastShiftEnd = shiftInfo.isPastShiftEnd;

  useEffect(() => {
    const timer = setInterval(() => {
      setShiftInfo(getShiftInfo());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Normal Check-In Handler with Time-Based Status Calculation
  const handleNormalCheckIn = async () => {
    setCheckingIn(true);
    try {
      const currentShift = getShiftInfo();
      // Check-in is strictly allowed only between 09:00 AM and 06:00 PM IST
      if (!currentShift.isCheckInAllowed) {
        Alert.alert(
          'Check-In Closed',
          currentShift.isAfterShiftEnd
            ? 'Shift hours ended at 06:00 PM IST. Check-in is disabled and will reopen at 09:00 AM tomorrow.'
            : 'Shift check-in is closed (06:00 PM – 09:00 AM IST). Check-in will reopen at 09:00 AM today.',
          [{ text: 'OK' }]
        );
        setCheckingIn(false);
        return;
      }

      const punctualityLabel = currentShift.punctualityLabel;
      const timeStr = currentShift.formattedTimeIST;

      // 2. Perform check-in via service
      const assignedSiteId = user?.assignedSiteId || 'site_pune_01';
      const record = await attendanceService.checkIn({
        siteId: assignedSiteId,
        latitude: deviceCoords.latitude,
        longitude: deviceCoords.longitude,
        accuracy: 10,
        remarks: `Supervisor Normal Check-In (${punctualityLabel})`,
      });

      Alert.alert(
        'Shift Check-In Successful',
        `Welcome, ${user?.name || 'Supervisor'}!\n\nCheck-in Time: ${timeStr}\nPunctuality: ${punctualityLabel}\nLocation: Pune - Phase 1 Substation\nSupervisor Privilege: Normal Attendance Approved.`,
        [{ text: 'Continue to Dashboard', onPress: () => fetchDashboardData() }]
      );
    } catch (err: any) {
      Alert.alert(
        'Check-In Failed',
        err.response?.data?.detail || err.message || 'Unable to record check-in. Please try again.'
      );
    } finally {
      setCheckingIn(false);
    }
  };

  // Normal Check-Out Trigger: Open confirmation popup modal
  const handleNormalCheckOut = () => {
    setShowCheckOutConfirm(true);
  };

  // Conclude Supervisor Check-Out
  const executeSupervisorCheckOut = async () => {
    setCheckingOut(true);
    try {
      await attendanceService.checkOut({
        latitude: deviceCoords.latitude,
        longitude: deviceCoords.longitude,
        accuracy: 10,
        remarks: 'Supervisor Normal Check-Out',
      });

      setShowCheckOutConfirm(false);
      Alert.alert(
        'Shift Concluded',
        'Shift successfully checked out and archived. Your attendance ledger has been recorded.',
        [{ text: 'OK', onPress: () => fetchDashboardData() }]
      );
    } catch (err: any) {
      Alert.alert(
        'Check-Out Failed',
        err.response?.data?.detail || err.message || 'Failed to complete check-out.'
      );
    } finally {
      setCheckingOut(false);
    }
  };

  // Helper variables for display
  const isShiftActive = todayData?.status === 'active';
  const isShiftCompleted = todayData?.status === 'completed';
  const hasShiftStarted = isShiftActive || isShiftCompleted;

  const checkInRecord = todayData?.record?.checkIn;
  const checkInTimeString = useMemo(() => {
    if (!checkInRecord?.time) return '--:--';
    try {
      const dt = new Date(checkInRecord.time);
      return dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return '--:--';
    }
  }, [checkInRecord]);

  const checkInDateString = useMemo(() => {
    if (!todayData?.record?.date) return new Date().toISOString().split('T')[0];
    return todayData.record.date;
  }, [todayData]);

  // Working hours formatted
  const hoursWorkedStr = useMemo(() => {
    if (!hasShiftStarted) return '--';
    const totalMinutes = isShiftCompleted
      ? todayData?.record?.workingMinutes || 0
      : liveElapsedMinutes;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m < 10 ? '0' : ''}${m}m`;
  }, [hasShiftStarted, isShiftCompleted, todayData, liveElapsedMinutes]);

  // Today shift badge text
  const shiftStatusText = useMemo(() => {
    if (!hasShiftStarted) return 'Not Started';
    const status = todayData?.record?.status;
    if (status === 'half-day' || status === 'half_day') return 'Half Day';
    if (status === 'late') return 'Late Checked-In';
    if (status === 'present') return 'On-Time';
    return isShiftActive ? 'Checked In' : 'Completed';
  }, [hasShiftStarted, todayData, isShiftActive]);

  // Supervisor Initials
  const supervisorInitials = useMemo(() => {
    const name = user?.name || 'Suresh Patil';
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }, [user]);

  // Weekly review bar data matching user screenshot 2
  const weeklyBars = [
    { day: 'Wed 21', hours: 10.2, target: 8.0 },
    { day: 'Thu 22', hours: 6.8, target: 8.0 },
    { day: 'Fri 23', hours: 7.0, target: 8.0 },
    { day: 'Sat 24', hours: 8.0, target: 8.0 },
    { day: 'Sun 25', hours: 0.0, target: 8.0 },
    { day: 'Mon 26', hours: 8.2, target: 8.0 },
    { day: 'Tue 27', hours: hasShiftStarted ? 8.1 : 0.0, target: 8.0, isToday: true },
  ];

  return (
    <View style={[styles.screen, { paddingTop: Math.max(insets.top, 12) }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1E63F0']} />
        }
      >
        {/* ============================================================== */}
        {/* SECTION 1: SUPERVISOR PROFILE HEADER CARD (IMAGE 1)           */}
        {/* ============================================================== */}
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            {/* 3-Line Hamburger Menu Icon Button */}
            <TouchableOpacity delayPressIn={0}
              style={styles.hamburgerBtn}
              onPress={() => openDrawer('SupervisorDashboard')}
              activeOpacity={0.7}
              accessibilityLabel="Open Navigation Menu"
            >
              <Menu size={20} color="#0F172A" />
            </TouchableOpacity>

            {/* Initials Avatar Box */}
            <View style={styles.initialsBox}>
              <Text style={styles.initialsText}>{supervisorInitials}</Text>
            </View>

            {/* Greeting & Assignment */}
            <View style={styles.headerInfoCol}>
              <View style={styles.nameRow}>
                <Text style={styles.greetingText}>
                  Hello, {user?.name || 'Suresh Patil'}
                </Text>
                <View style={styles.rolePill}>
                  <Text style={styles.rolePillText}>
                    {user?.designation || 'Area Operations Supervisor'}
                  </Text>
                </View>
              </View>

              <Text style={styles.employeeSubText} numberOfLines={1}>
                Employee ID: <Text style={styles.boldSub}>{user?.employeeId || 'SUPER01'}</Text> • 🏢 Assignment: <Text style={styles.boldSub}>Pune - Phase 1</Text>
              </Text>
            </View>

            {/* Right Action Pills */}
            <View style={styles.headerActionsWrap}>
              {/* Notification Button */}
              <TouchableOpacity delayPressIn={0}
                style={[styles.headerPillBtn, styles.notifPillBtn]}
                onPress={() => setShowNotifModal(true)}
                activeOpacity={0.7}
                accessibilityLabel="Supervisor Notifications"
              >
                <Bell size={13} color="#1E63F0" />
                <Text style={[styles.headerPillBtnText, { color: '#1E63F0', fontWeight: '700' }]}>
                  Alerts
                </Text>
                {unreadCount > 0 && (
                  <View style={styles.notifBadgeDot}>
                    <Text style={styles.notifBadgeText}>{unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Logout Button */}
              <TouchableOpacity delayPressIn={0}
                style={[styles.headerPillBtn, styles.logoutPillBtn]}
                onPress={handleLogout}
                activeOpacity={0.7}
                accessibilityLabel="Sign Out of Supervisor Portal"
              >
                <LogOut size={13} color="#DC2626" />
                <Text style={styles.logoutPillBtnText}>Logout</Text>
              </TouchableOpacity>

              <View style={styles.statusPillActive}>
                <View style={styles.greenLiveDot} />
                <Text style={styles.statusPillActiveText}>Field Portal Active</Text>
              </View>

              <TouchableOpacity delayPressIn={0}
                style={styles.headerPillBtn}
                onPress={async () => {
                  try {
                    await holidayService.downloadHolidaysPdf(2026);
                  } catch (e: any) {
                    Alert.alert('Holiday Calendar', e.message || 'Unable to download holiday calendar.');
                  }
                }}
                activeOpacity={0.7}
              >
                <Calendar size={13} color="#475569" />
                <Text style={styles.headerPillBtnText}>Holidays 2026 (PDF)</Text>
              </TouchableOpacity>

              <TouchableOpacity delayPressIn={0}
                style={styles.headerPillBtn}
                onPress={fetchDashboardData}
                activeOpacity={0.7}
              >
                <RefreshCw size={13} color="#475569" />
                <Text style={styles.headerPillBtnText}>Refresh Status</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ============================================================== */}
        {/* SECTION 2: 5 METRIC CARDS ROW (IMAGE 1)                      */}
        {/* ============================================================== */}
        <View style={styles.metricsRow}>
          {/* Card 1: Today's Shift */}
          <TouchableOpacity delayPressIn={0}
            style={styles.kpiCard}
            onPress={() => navigation.navigate('AttendanceLogs')}
            activeOpacity={0.85}
          >
            <View style={styles.kpiCardHeader}>
              <Text style={styles.kpiLabel}>TODAY'S SHIFT</Text>
              <View style={styles.kpiIconWrap}>
                <Clock size={15} color="#64748B" />
              </View>
            </View>

            {/* Punctuality Status Badge (Half Day / Late / On-Time) */}
            {shiftStatusText === 'Half Day' ? (
              <View style={styles.kpiStatusHalfDayPill}>
                <Clock size={12} color="#C2410C" style={{ marginRight: 4 }} />
                <Text style={styles.kpiStatusHalfDayText}>Half Day</Text>
              </View>
            ) : shiftStatusText === 'Late Checked-In' ? (
              <View style={styles.kpiStatusLatePill}>
                <Clock size={12} color="#B45309" style={{ marginRight: 4 }} />
                <Text style={styles.kpiStatusLateText}>Late Check-In</Text>
              </View>
            ) : shiftStatusText === 'On-Time' ? (
              <View style={styles.kpiStatusPresentPill}>
                <CheckCircle2 size={12} color="#047857" style={{ marginRight: 4 }} />
                <Text style={styles.kpiStatusPresentText}>On-Time</Text>
              </View>
            ) : (
              <Text style={styles.kpiMainValue} numberOfLines={1}>
                {shiftStatusText}
              </Text>
            )}

            <View style={styles.kpiSubRow}>
              <View
                style={[
                  styles.statusDot,
                  hasShiftStarted ? { backgroundColor: '#10B981' } : { backgroundColor: '#94A3B8' },
                ]}
              />
              <Text style={styles.kpiSubText}>
                {hasShiftStarted ? (isShiftActive ? 'Shift Active' : 'Shift Concluded') : 'Shift Inactive'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Card 2: Check-In Time */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiCardHeader}>
              <Text style={styles.kpiLabel}>CHECK-IN TIME</Text>
              <View style={styles.kpiIconWrap}>
                <Clock size={15} color="#3B82F6" />
              </View>
            </View>
            <Text style={styles.kpiMainValue}>
              {hasShiftStarted ? checkInTimeString : '--:--'}
            </Text>
            <Text style={styles.kpiSubText}>
              {checkInDateString}
            </Text>
          </View>

          {/* Card 3: Hours Worked */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiCardHeader}>
              <Text style={styles.kpiLabel}>HOURS WORKED</Text>
              <View style={styles.kpiIconWrap}>
                <Timer size={15} color="#059669" />
              </View>
            </View>
            <Text style={styles.kpiMainValue}>
              {hoursWorkedStr}
            </Text>
            <View style={styles.kpiSubRow}>
              <Clock size={11} color="#059669" />
              <Text style={styles.kpiSubText}>Standard 8h shift</Text>
            </View>
          </View>

          {/* Card 4: Authorized Geofence */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiCardHeader}>
              <Text style={styles.kpiLabel}>AUTHORIZED GEOFENCE</Text>
              <View style={styles.kpiIconWrap}>
                <MapPin size={15} color="#8B5CF6" />
              </View>
            </View>
            <Text style={styles.kpiMainValue}>500 m</Text>
            <View style={styles.kpiSubRow}>
              <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.kpiSubText}>Verified In Zone</Text>
            </View>
          </View>

          {/* Card 5: Monthly Attendance */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiCardHeader}>
              <Text style={styles.kpiLabel}>MONTHLY ATTENDANCE</Text>
              <View style={styles.kpiIconWrap}>
                <TrendingUp size={15} color="#EC4899" />
              </View>
            </View>
            <Text style={styles.kpiMainValue}>83%</Text>
            <Text style={styles.kpiSubText}>5 Shifts Logged</Text>
          </View>
        </View>

        {/* ============================================================== */}
        {/* SECTION 3: LIVE SHIFT VERIFICATION BLUE BANNER (IMAGE 1)       */}
        {/* ============================================================== */}
        <View style={styles.liveBanner}>
          <View style={styles.bannerMainContent}>
            {/* Verification Icon Box */}
            <View style={styles.bannerIconSquare}>
              <CheckCircle2 size={26} color="#FFFFFF" />
            </View>

            {/* Banner Titles */}
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.bannerTagText}>LIVE SHIFT VERIFICATION</Text>
              <Text style={styles.bannerTitleText}>
                {isShiftActive
                  ? `Shift Active • ${shiftStatusText}`
                  : isShiftCompleted
                  ? `Shift Concluded • ${shiftStatusText}`
                  : !shiftInfo.isCheckInAllowed
                  ? (shiftInfo.isAfterShiftEnd
                      ? 'Shift Closed • Reopens 9:00 AM'
                      : 'Check-In Closed • Opens 9:00 AM')
                  : 'Ready to Check In'}
              </Text>
              <Text style={styles.bannerSubtitleText} numberOfLines={1}>
                {isShiftActive
                  ? 'Active shift in progress • GPS verified at Pune - Phase 1'
                  : !shiftInfo.isCheckInAllowed
                  ? shiftInfo.windowMessage
                  : 'GPS verified at your current device location • Pune - Phase 1'}
              </Text>
            </View>

            {/* Action Check In / Check Out Button */}
            {isShiftActive ? (
              <TouchableOpacity delayPressIn={0}
                style={styles.normalCheckOutBtn}
                onPress={handleNormalCheckOut}
                disabled={checkingOut}
                activeOpacity={0.85}
              >
                {checkingOut ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <>
                    <LogOut size={16} color="#EF4444" style={{ marginRight: 6 }} />
                    <Text style={styles.normalCheckOutBtnText}>Normal Check Out</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : !shiftInfo.isCheckInAllowed ? (
              /* DISABLED BUTTON AFTER 6 PM AND BEFORE 9 AM (REOPENS AT 9 AM) */
              <TouchableOpacity delayPressIn={0}
                style={[
                  styles.normalCheckInBtn,
                  {
                    backgroundColor: '#E2E8F0',
                    borderColor: '#CBD5E1',
                    borderWidth: 1,
                    opacity: 0.8,
                  },
                ]}
                onPress={() =>
                  Alert.alert(
                    'Check-In Closed',
                    shiftInfo.isAfterShiftEnd
                      ? 'Shift check-in closed at 06:00 PM IST.\n\nCheck-in is disabled and will reappear at 09:00 AM tomorrow.'
                      : 'Shift check-in is closed (06:00 PM – 09:00 AM IST).\n\nCheck-in will reappear and become active at 09:00 AM today.',
                    [{ text: 'OK' }]
                  )
                }
                activeOpacity={0.7}
              >
                <Lock size={15} color="#64748B" style={{ marginRight: 6 }} />
                <Text style={[styles.normalCheckInBtnText, { color: '#64748B', fontWeight: '700' }]}>
                  {shiftInfo.isAfterShiftEnd ? 'Normal Check In (Closed)' : 'Normal Check In (Opens 9 AM)'}
                </Text>
              </TouchableOpacity>
            ) : (
              /* ACTIVE CHECK IN BUTTON BETWEEN 09:00 AM AND 06:00 PM */
              <TouchableOpacity delayPressIn={0}
                style={styles.normalCheckInBtn}
                onPress={handleNormalCheckIn}
                disabled={checkingIn}
                activeOpacity={0.85}
              >
                {checkingIn ? (
                  <ActivityIndicator size="small" color="#1E63F0" />
                ) : (
                  <>
                    <ShieldCheck size={16} color="#1E63F0" style={{ marginRight: 6 }} />
                    <Text style={styles.normalCheckInBtnText}>Normal Check In</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Banner Bottom Coordinates & Privilege Strip */}
          <View style={styles.bannerBottomStrip}>
            <View style={styles.coordsRow}>
              <MapPin size={12} color="#93C5FD" style={{ marginRight: 4 }} />
              <Text style={styles.coordsText}>
                Lat: {deviceCoords.latitude.toFixed(4)} | Long: {deviceCoords.longitude.toFixed(4)}
              </Text>
            </View>

            <View style={styles.privilegePill}>
              <Text style={styles.privilegePillText}>
                Supervisor Privilege Active • Normal Attendance
              </Text>
            </View>
          </View>
        </View>

        {/* Timing Policy Strip */}
        <View style={styles.policyStrip}>
          <Clock size={13} color="#2563EB" style={{ marginRight: 6 }} />
          <Text style={styles.policyStripText}>
            Shift Window: 09:00 AM – 06:00 PM IST | After 06:00 PM Disabled (Reopens 09:00 AM) | Auto Check-Out at 06:00 PM
          </Text>
        </View>

        {/* ============================================================== */}
        {/* SECTION 4: CHECKED-IN FIELD STAFF TODAY CARD (IMAGE 2)         */}
        {/* ============================================================== */}
        <View style={styles.staffCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardIconBox}>
              <Users size={18} color="#1E63F0" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.cardTitle}>Checked-In Field Staff Today</Text>
                <View style={styles.staffCountBadge}>
                  <Text style={styles.staffCountBadgeText}>
                    {fieldStaff.length} Checked In
                  </Text>
                </View>
              </View>
              <Text style={styles.cardSubTitle}>
                Live daily attendance roster of field technicians and installers
              </Text>
            </View>

            <TouchableOpacity delayPressIn={0}
              style={styles.refreshListBtn}
              onPress={fetchDashboardData}
              activeOpacity={0.7}
            >
              <RefreshCw size={13} color="#475569" />
              <Text style={styles.refreshListBtnText}>Refresh List</Text>
            </TouchableOpacity>
          </View>

          {/* Staff Content */}
          {fieldStaff.length === 0 ? (
            <View style={styles.dashedEmptyBox}>
              <Users size={32} color="#94A3B8" style={{ marginBottom: 8 }} />
              <Text style={styles.emptyTitle}>No field technicians checked in yet today</Text>
              <Text style={styles.emptySub}>
                Staff check-ins will appear live here as they punch in from substations.
              </Text>
            </View>
          ) : (
            <View style={styles.staffList}>
              {fieldStaff.map((staff) => (
                <View key={staff.id} style={styles.staffRowItem}>
                  <View style={styles.staffAvatar}>
                    <Text style={styles.staffAvatarText}>
                      {staff.technicianName
                        .split(' ')
                        .map((w) => w[0])
                        .join('')
                        .substring(0, 2)
                        .toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.staffNameText}>{staff.technicianName}</Text>
                    <Text style={styles.staffSubText}>
                      {staff.technicianCode} • {staff.siteName}
                    </Text>
                  </View>
                  <View style={styles.staffTimeCol}>
                    <Text style={styles.staffTimeText}>{staff.checkInTime}</Text>
                    <View
                      style={[
                        styles.staffStatusTag,
                        staff.status === 'present'
                          ? { backgroundColor: '#DCFCE7' }
                          : { backgroundColor: '#FEF3C7' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.staffStatusTagText,
                          staff.status === 'present' ? { color: '#15803D' } : { color: '#B45309' },
                        ]}
                      >
                        {staff.status === 'present' ? 'On-Time' : 'Late Arrival'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ============================================================== */}
        {/* SECTION 5: MY ATTENDANCE REVIEW & WORK HOURS (IMAGE 2)         */}
        {/* ============================================================== */}
        <View style={styles.analyticsCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardIconBox}>
              <BarChart3 size={18} color="#1E63F0" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.cardTitle}>My Attendance Review & Work Hours</Text>
                <View style={styles.analyticsPill}>
                  <Text style={styles.analyticsPillText}>EMPLOYEE ANALYTICS</Text>
                </View>
              </View>
              <Text style={styles.cardSubTitle}>
                Visual shift review, hours worked history & punctuality compliance
              </Text>
            </View>

            <View style={styles.analyticsHeaderActions}>
              <View style={styles.segmentToggle}>
                <TouchableOpacity delayPressIn={0}
                  style={[styles.segmentBtn, chartMode === 'daily' && styles.segmentBtnActive]}
                  onPress={() => setChartMode('daily')}
                >
                  <Text
                    style={[
                      styles.segmentBtnText,
                      chartMode === 'daily' && styles.segmentBtnTextActive,
                    ]}
                  >
                    Daily Hours Trend
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity delayPressIn={0}
                  style={[styles.segmentBtn, chartMode === 'distribution' && styles.segmentBtnActive]}
                  onPress={() => setChartMode('distribution')}
                >
                  <Text
                    style={[
                      styles.segmentBtnText,
                      chartMode === 'distribution' && styles.segmentBtnTextActive,
                    ]}
                  >
                    Shift Distribution
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity delayPressIn={0}
                style={styles.fullLogsBtn}
                onPress={() => navigation.navigate('AttendanceLogs')}
                activeOpacity={0.7}
              >
                <Text style={styles.fullLogsBtnText}>→ Full Logs</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 4 Analytics Summary Stat Cells */}
          <View style={styles.summaryStatsRow}>
            <View style={styles.summaryStatCell}>
              <Text style={styles.summaryStatLabel}>WEEK TOTAL HOURS</Text>
              <Text style={styles.summaryStatValue}>
                55.1 <Text style={styles.summaryStatUnit}>hrs</Text>
              </Text>
              <Text style={styles.summaryStatSub}>Target: 40h standard week</Text>
            </View>

            <View style={styles.summaryStatCell}>
              <Text style={styles.summaryStatLabel}>DAILY AVERAGE</Text>
              <Text style={styles.summaryStatValue}>
                11.0 <Text style={styles.summaryStatUnit}>hrs/day</Text>
              </Text>
              <Text style={styles.summaryStatSub}>Optimal field efficiency</Text>
            </View>

            <View style={styles.summaryStatCell}>
              <Text style={styles.summaryStatLabel}>PRESENT SHIFTS</Text>
              <Text style={styles.summaryStatValue}>
                5 <Text style={styles.summaryStatUnit}>/ 6 Days</Text>
              </Text>
              <Text style={styles.summaryStatSub}>Attendance: 83%</Text>
            </View>

            <View style={styles.summaryStatCell}>
              <Text style={styles.summaryStatLabel}>GEOFENCE COMPLIANCE</Text>
              <Text style={[styles.summaryStatValue, { color: '#10B981' }]}>100%</Text>
              <Text style={styles.summaryStatSub}>100% In-Range Verified</Text>
            </View>
          </View>

          {/* Visual Bar Chart (Matching Image 2) */}
          <View style={styles.chartWrapper}>
            {/* Chart Legend */}
            <View style={styles.chartLegendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.legendText}>
                  Hours Worked per Day (Target line: 8.0 hrs)
                </Text>
              </View>

              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#2563EB' }]} />
                <Text style={styles.legendText}>Today's Live Shift</Text>
              </View>
            </View>

            {/* Bars Area with Y-axis & Target line */}
            <View style={styles.chartArea}>
              {/* Y-Axis Labels */}
              <View style={styles.yAxisCol}>
                <Text style={styles.yAxisLabel}>10h</Text>
                <Text style={styles.yAxisLabel}>6h</Text>
                <Text style={styles.yAxisLabel}>2h</Text>
              </View>

              {/* Chart Grid & Bars */}
              <View style={styles.barsContainer}>
                {/* 8h Target Horizontal Line */}
                <View style={styles.targetDashedLine}>
                  <View style={styles.targetTag}>
                    <Text style={styles.targetTagText}>8h Target Shift</Text>
                  </View>
                </View>

                {/* Bars */}
                <View style={styles.barsRow}>
                  {weeklyBars.map((bar, idx) => {
                    const maxH = 140;
                    const barHeight = Math.max(8, (bar.hours / 12) * maxH);
                    const parts = bar.day.trim().split(/\s+/);
                    const dayName = parts[0] || '';
                    const dayDate = parts[1] || '';

                    return (
                      <View key={idx} style={styles.barCol}>
                        <View style={styles.barTrack}>
                          {bar.hours > 0 ? (
                            <View
                              style={[
                                styles.barFill,
                                { height: barHeight },
                                bar.isToday && styles.barFillToday,
                              ]}
                            />
                          ) : (
                            <View style={styles.barEmptyPill} />
                          )}
                        </View>
                        <View style={styles.barDayWrap}>
                          <Text
                            style={[
                              styles.barDayText,
                              bar.isToday && styles.barDayTextToday,
                            ]}
                            numberOfLines={1}
                          >
                            {dayName}
                          </Text>
                          {dayDate ? (
                            <Text
                              style={[
                                styles.barDateText,
                                bar.isToday && styles.barDateTextToday,
                              ]}
                              numberOfLines={1}
                            >
                              {dayDate}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ============================================================== */}
      {/* SUPERVISOR NOTIFICATIONS MODAL (ADMIN & EMPLOYEE ALERTS)       */}
      {/* ============================================================== */}
      <Modal visible={showNotifModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContainer, { maxHeight: '88%' }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.bellSquare, { backgroundColor: '#EFF6FF', borderRadius: 12, padding: 8 }]}>
                  <Bell size={20} color="#1E63F0" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Supervisor Notifications</Text>
                  <Text style={{ fontSize: 11.5, color: '#64748B', marginTop: 1 }}>
                    {unreadCount} unread • Directives from Admin & Technician Field Updates
                  </Text>
                </View>
              </View>
              <TouchableOpacity delayPressIn={0}
                onPress={() => setShowNotifModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Filter Tabs & Mark Read Row */}
            <View style={styles.notifHeaderActions}>
              <View style={styles.notifFilterPills}>
                <TouchableOpacity delayPressIn={0}
                  style={[styles.notifPill, notifFilter === 'all' && styles.notifPillActive]}
                  onPress={() => setNotifFilter('all')}
                >
                  <Text style={[styles.notifPillText, notifFilter === 'all' && styles.notifPillTextActive]}>
                    All ({notifications.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity delayPressIn={0}
                  style={[styles.notifPill, notifFilter === 'admin' && styles.notifPillActiveAdmin]}
                  onPress={() => setNotifFilter('admin')}
                >
                  <Text style={[styles.notifPillText, notifFilter === 'admin' && styles.notifPillTextActive]}>
                    From Admin 🏛️ ({adminNotificationsCount})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity delayPressIn={0}
                  style={[styles.notifPill, notifFilter === 'employee' && styles.notifPillActiveEmp]}
                  onPress={() => setNotifFilter('employee')}
                >
                  <Text style={[styles.notifPillText, notifFilter === 'employee' && styles.notifPillTextActive]}>
                    From Employees 👷 ({employeeNotificationsCount})
                  </Text>
                </TouchableOpacity>
              </View>

              {unreadCount > 0 && (
                <TouchableOpacity delayPressIn={0} style={styles.markReadBtn} onPress={handleMarkAllRead}>
                  <CheckCheck size={14} color="#1E63F0" />
                  <Text style={styles.markReadText}>Mark all read</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Notification Cards List */}
            <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
              {filteredNotifications.length === 0 ? (
                <View style={styles.emptyNotifBox}>
                  <CheckCircle2 size={36} color="#10B981" />
                  <Text style={styles.emptyNotifTitle}>All Caught Up</Text>
                  <Text style={styles.emptyNotifText}>
                    No notifications in this category. All field operations and directives are up to date.
                  </Text>
                </View>
              ) : (
                filteredNotifications.map((item) => {
                  const isAdmin = item.source === 'admin';
                  const isLate = item.type === 'warning';
                  const isDanger = item.type === 'danger';
                  const isSuccess = item.type === 'success';

                  return (
                    <TouchableOpacity delayPressIn={0}
                      key={item.id}
                      style={[
                        styles.notifItem,
                        !item.isRead && styles.notifItemUnread,
                        isAdmin ? styles.notifItemAdmin : styles.notifItemEmp,
                      ]}
                      onPress={() => handleToggleRead(item)}
                      activeOpacity={0.8}
                    >
                      {/* Top Source & Category Row */}
                      <View style={styles.notifSenderRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {isAdmin ? (
                            <View style={styles.sourceTagAdmin}>
                              <Building2 size={11} color="#7C3AED" />
                              <Text style={styles.sourceTagAdminText}>ADMIN DIRECTIVE</Text>
                            </View>
                          ) : (
                            <View style={styles.sourceTagEmp}>
                              <UserIcon size={11} color="#059669" />
                              <Text style={styles.sourceTagEmpText}>EMPLOYEE UPDATE</Text>
                            </View>
                          )}

                          <View
                            style={[
                              styles.categoryBadge,
                              {
                                backgroundColor: isDanger
                                  ? '#FEE2E2'
                                  : isLate
                                  ? '#FEF3C7'
                                  : isSuccess
                                  ? '#DCFCE7'
                                  : '#EFF6FF',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.categoryBadgeText,
                                {
                                  color: isDanger
                                    ? '#B91C1C'
                                    : isLate
                                    ? '#B45309'
                                    : isSuccess
                                    ? '#15803D'
                                    : '#1D4ED8',
                                },
                              ]}
                            >
                              {item.category}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.notifTimeText}>{item.timestamp}</Text>
                          {!item.isRead && <View style={styles.unreadDot} />}
                        </View>
                      </View>

                      {/* Title & Description */}
                      <Text style={styles.notifTitleText}>{item.title}</Text>
                      <Text style={styles.notifMessageText}>{item.message}</Text>

                      {/* Sender Info Footer */}
                      <View style={styles.notifFooterRow}>
                        {item.avatar ? (
                          <Image source={{ uri: item.avatar }} style={styles.notifSenderAvatar} />
                        ) : null}
                        <Text style={styles.notifSenderName}>
                          {item.sender || (isAdmin ? 'Central Admin Operations' : item.employeeName || 'Technician')}
                        </Text>
                        {item.siteName ? (
                          <Text style={styles.notifSiteText}>• {item.siteName}</Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {/* Modal Bottom CTA */}
            <View style={{ marginTop: 14 }}>
              <AppButton
                title="Close Notifications"
                variant="outline"
                size="md"
                onPress={() => setShowNotifModal(false)}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* CHECK-OUT CONFIRMATION MODAL */}
      <ConfirmationModal
        visible={showCheckOutConfirm}
        title="Confirm Check-Out"
        message="Are you sure you want to conclude your shift and punch out for today?"
        confirmTitle="Confirm Check-Out"
        cancelTitle="Cancel"
        variant="danger"
        loading={checkingOut}
        onConfirm={executeSupervisorCheckOut}
        onCancel={() => {
          if (!checkingOut) setShowCheckOutConfirm(false);
        }}
      >
        <View style={styles.checkoutModalSummary}>
          <View style={styles.checkoutModalRow}>
            <Text style={styles.checkoutModalLabel}>Current Time (IST):</Text>
            <Text style={styles.checkoutModalVal}>{shiftInfo.formattedTimeIST}</Text>
          </View>
          <View style={styles.checkoutModalRow}>
            <Text style={styles.checkoutModalLabel}>Checked In At:</Text>
            <Text style={styles.checkoutModalVal}>{checkInTimeString}</Text>
          </View>
          {todayData?.record?.workingHoursFormatted ? (
            <View style={styles.checkoutModalRow}>
              <Text style={styles.checkoutModalLabel}>Duration Logged:</Text>
              <Text style={styles.checkoutModalVal}>{todayData.record.workingHoursFormatted}</Text>
            </View>
          ) : null}
        </View>
      </ConfirmationModal>

      {/* Global Supervisor Drawer Modal */}
      <SupervisorDrawerModal />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },

  // 1. Header Card
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  hamburgerBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  initialsText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E63F0',
  },
  headerInfoCol: {
    flex: 1,
    minWidth: 200,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  greetingText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  rolePill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E63F0',
  },
  employeeSubText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  boldSub: {
    fontWeight: '700',
    color: '#0F172A',
  },
  headerActionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusPillActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  greenLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#16A34A',
  },
  statusPillActiveText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#15803D',
  },
  headerPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  headerPillBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
  },

  // 2. Metrics Row
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  kpiCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
  },
  kpiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  kpiIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiMainValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 4,
  },
  kpiStatusHalfDayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 14,
    marginBottom: 6,
  },
  kpiStatusHalfDayText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C2410C',
  },
  kpiStatusLatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 14,
    marginBottom: 6,
  },
  kpiStatusLateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  kpiStatusPresentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 14,
    marginBottom: 6,
  },
  kpiStatusPresentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  kpiSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  kpiSubText: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
  },

  // 3. Live Shift Verification Banner
  liveBanner: {
    backgroundColor: '#2563EB',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#2563EB',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 6,
  },
  bannerMainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexWrap: 'wrap',
  },
  bannerIconSquare: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  bannerTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#BFDBFE',
    letterSpacing: 0.8,
  },
  bannerTitleText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  bannerSubtitleText: {
    fontSize: 12,
    color: '#E0E7FF',
    marginTop: 2,
  },
  normalCheckInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  normalCheckInBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E63F0',
  },
  normalCheckOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  normalCheckOutBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#EF4444',
  },
  concludedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  concludedPillText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bannerBottomStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.18)',
    flexWrap: 'wrap',
    gap: 8,
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coordsText: {
    fontSize: 11,
    color: '#DBEAFE',
    fontWeight: '600',
  },
  privilegePill: {
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  privilegePillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // 4. Checked-In Field Staff Today Card
  staffCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  cardIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  staffCountBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  staffCountBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1E63F0',
  },
  cardSubTitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  refreshListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  refreshListBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
  },
  dashedEmptyBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 3,
  },
  emptySub: {
    fontSize: 11.5,
    color: '#94A3B8',
    textAlign: 'center',
  },
  staffList: {
    gap: 10,
  },
  staffRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  staffAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  staffAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E40AF',
  },
  staffNameText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  staffSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  staffTimeCol: {
    alignItems: 'flex-end',
  },
  staffTimeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  staffStatusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
  },
  staffStatusTagText: {
    fontSize: 9.5,
    fontWeight: '700',
  },

  // 5. My Attendance Review & Analytics Card
  analyticsCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
  },
  analyticsPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  analyticsPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.4,
  },
  analyticsHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  segmentToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
  },
  segmentBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  segmentBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentBtnTextActive: {
    fontWeight: '800',
    color: '#0F172A',
  },
  fullLogsBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  fullLogsBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E63F0',
  },

  // 4 Analytics Summary Stat Cells
  summaryStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  summaryStatCell: {
    flex: 1,
    minWidth: 130,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryStatLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  summaryStatValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 4,
  },
  summaryStatUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  summaryStatSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },

  // Chart Wrapper
  chartWrapper: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chartLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },

  chartArea: {
    flexDirection: 'row',
    height: 160,
  },
  yAxisCol: {
    width: 28,
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  yAxisLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  barsContainer: {
    flex: 1,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  targetDashedLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 50,
    borderBottomWidth: 1.5,
    borderStyle: 'dashed',
    borderBottomColor: '#10B981',
    flexDirection: 'row',
    justifyContent: 'center',
    zIndex: 1,
  },
  targetTag: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 6,
    marginTop: -8,
  },
  targetTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#10B981',
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    paddingBottom: 2,
    zIndex: 2,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barTrack: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: 28,
  },
  barFill: {
    width: 20,
    backgroundColor: '#10B981',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  barFillToday: {
    backgroundColor: '#2563EB',
  },
  barEmptyPill: {
    width: 8,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginBottom: 4,
  },
  barDayWrap: {
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  barDayText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 13,
  },
  barDayTextToday: {
    color: '#1E63F0',
    fontWeight: '900',
  },
  barDateText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#334155',
    textAlign: 'center',
    lineHeight: 14,
    marginTop: 2,
  },
  barDateTextToday: {
    color: '#1E63F0',
    fontWeight: '900',
  },
  policyStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: -4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  policyStripText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#1E40AF',
    flex: 1,
  },

  // Notification & Logout Header Buttons
  notifPillBtn: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  notifBadgeDot: {
    backgroundColor: '#EF4444',
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginLeft: 2,
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
  },
  logoutPillBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  logoutPillBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#DC2626',
  },

  // Supervisor Notifications Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 640,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 10,
  },
  bellSquare: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  notifHeaderActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 8,
  },
  notifFilterPills: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  notifPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  notifPillActive: {
    backgroundColor: '#1E63F0',
  },
  notifPillActiveAdmin: {
    backgroundColor: '#7C3AED',
  },
  notifPillActiveEmp: {
    backgroundColor: '#059669',
  },
  notifPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  notifPillTextActive: {
    color: '#FFFFFF',
  },
  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  markReadText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E63F0',
  },
  emptyNotifBox: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyNotifTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  emptyNotifText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 360,
  },
  notifItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notifItemUnread: {
    backgroundColor: '#F8FAFC',
    borderColor: '#93C5FD',
    borderLeftWidth: 4,
    borderLeftColor: '#1E63F0',
  },
  notifItemAdmin: {
    borderLeftColor: '#7C3AED',
  },
  notifItemEmp: {
    borderLeftColor: '#059669',
  },
  notifSenderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sourceTagAdmin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  sourceTagAdminText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.3,
  },
  sourceTagEmp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  sourceTagEmpText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.3,
  },
  categoryBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  notifTimeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#1E63F0',
  },
  notifTitleText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 3,
  },
  notifMessageText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  notifFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 6,
  },
  notifSenderAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  notifSenderName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  checkoutModalSummary: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  checkoutModalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  checkoutModalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  checkoutModalVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  notifSiteText: {
    fontSize: 11,
    color: '#64748B',
  },
});

export default SupervisorDashboardScreen;
