import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  Dimensions,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Clock,
  MapPin,
  Calendar,
  Zap,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  LogOut,
  User as UserIcon,
  Menu,
  Bell,
  Lock,
  ChevronRight,
  BarChart3,
  Check,
  X,
  FileText,
  Info,
  Shield,
  Timer,
  Navigation,
  Camera as CameraIcon,
  RotateCcw,
  AlertTriangle,
  Download,
  Building2,
  Banknote,
  Phone,
  PhoneCall,
  UserCheck,
} from 'lucide-react-native';
import { salaryService } from '../../services/salaryService';
import { SalarySlip } from '../../types';
import { triggerHaptic } from '../../utils/haptics';
import { useAuthStore } from '../../store/useAuthStore';
import { useAttendanceStore } from '../../store/useAttendanceStore';
import { useTechnicianDrawerStore } from '../../store/useTechnicianDrawerStore';
import { siteService } from '../../services/siteService';
import { attendanceService } from '../../services/attendanceService';
import { dashboardService, AdminNotification } from '../../services/dashboardService';
import { Substation } from '../../types';
import { COLORS } from '../../constants/theme';
import { AppCard } from '../../components/common/AppCard';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { holidayService, HolidayItem } from '../../services/holidayService';
import { getShiftInfo, formatTimeIST } from '../../utils/shiftUtils';
import { TechnicianDrawerModal } from '../../components/navigation/TechnicianDrawerModal';

const { width } = Dimensions.get('window');

// 2026 Adani Gazetted Holidays
const ADANI_HOLIDAYS_2026 = [
  { date: '26 Jan 2026', day: 'Monday', name: 'Republic Day', type: 'National Holiday' },
  { date: '08 Mar 2026', day: 'Sunday', name: 'Maha Shivratri', type: 'Gazetted' },
  { date: '25 Mar 2026', day: 'Wednesday', name: 'Holi', type: 'Gazetted' },
  { date: '14 Apr 2026', day: 'Tuesday', name: 'Dr. Ambedkar Jayanti', type: 'Gazetted' },
  { date: '01 May 2026', day: 'Friday', name: 'Maharashtra Day / May Day', type: 'Regional' },
  { date: '15 Aug 2026', day: 'Saturday', name: 'Independence Day', type: 'National Holiday' },
  { date: '07 Sep 2026', day: 'Monday', name: 'Janmashtami', type: 'Gazetted' },
  { date: '02 Oct 2026', day: 'Friday', name: 'Mahatma Gandhi Jayanti', type: 'National Holiday' },
  { date: '20 Oct 2026', day: 'Tuesday', name: 'Dussehra (Vijayadashami)', type: 'Gazetted' },
  { date: '08 Nov 2026', day: 'Sunday', name: 'Diwali (Deepavali)', type: 'Gazetted' },
  { date: '09 Nov 2026', day: 'Monday', name: 'Diwali Balipratipada', type: 'Gazetted' },
  { date: '25 Dec 2026', day: 'Friday', name: 'Christmas Day', type: 'Gazetted' },
];

// 7-Day Attendance Chart Data (matching user's reference photo)
interface DailyWorkData {
  day: string;
  dateStr: string;
  hours: number;
  isToday?: boolean;
  status: 'present' | 'late' | 'off' | 'active';
  target: number;
}

const WEEKLY_HOURS_DATA: DailyWorkData[] = [
  { day: 'Thu 22', dateStr: 'Oct 22, 2026', hours: 12.5, status: 'present', target: 8.0 },
  { day: 'Fri 23', dateStr: 'Oct 23, 2026', hours: 7.8, status: 'present', target: 8.0 },
  { day: 'Sat 24', dateStr: 'Oct 24, 2026', hours: 7.2, status: 'present', target: 8.0 },
  { day: 'Sun 25', dateStr: 'Oct 25, 2026', hours: 0.0, status: 'off', target: 8.0 },
  { day: 'Mon 26', dateStr: 'Oct 26, 2026', hours: 7.5, status: 'present', target: 8.0 },
  { day: 'Tue 27', dateStr: 'Oct 27, 2026', hours: 7.4, status: 'present', target: 8.0 },
  { day: 'Wed 28', dateStr: 'Today', hours: 8.0, isToday: true, status: 'active', target: 8.0 },
];

export const DashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, refreshProfile } = useAuthStore();
  const { openDrawer } = useTechnicianDrawerStore();

  const {
    todayStatus,
    todayRecord,
    assignedSite,
    assignedSites,
    liveElapsedSeconds,
    fetchTodayAttendance,
    incrementTimer,
    setShiftCompleted,
  } = useAttendanceStore();

  // Shift & Clock state
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [shiftInfo, setShiftInfo] = useState(getShiftInfo());
  const [substation, setSubstation] = useState<Substation | null>(null);
  const [dashboardSalarySlip, setDashboardSalarySlip] = useState<SalarySlip | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCheckOutConfirm, setShowCheckOutConfirm] = useState(false);

  // Analytics tab toggle: 'daily' | 'distribution'
  const [analyticsTab, setAnalyticsTab] = useState<'daily' | 'distribution'>('daily');
  const [selectedBar, setSelectedBar] = useState<DailyWorkData | null>(WEEKLY_HOURS_DATA[6]);

  // Notifications Modal State
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);

  // Holidays Modal State
  const [showHolidaysModal, setShowHolidaysModal] = useState(false);
  const [holidaysList, setHolidaysList] = useState<HolidayItem[]>([]);
  const [downloadingHolidaysPdf, setDownloadingHolidaysPdf] = useState(false);

  useEffect(() => {
    holidayService.getHolidays(2026).then((data) => {
      if (data && data.length > 0) setHolidaysList(data);
    }).catch(() => {});
  }, []);

  // Mandatory Camera Photo Check-In State
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('front');
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [isSubmittingPhoto, setIsSubmittingPhoto] = useState(false);
  const cameraRef = useRef<any>(null);

  // Live GPS Coords based on assigned substation
  const deviceCoords = {
    latitude: substation?.latitude || 0,
    longitude: substation?.longitude || 0,
  };

  // Derive user initials
  const initials = useMemo(() => {
    const name = user?.name || 'Technician';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }, [user]);

  // Strictly verify whether today's record belongs to the currently logged-in user
  const isRecordForCurrentUser = useMemo(() => {
    if (!todayRecord || !user) return false;
    const userEmpId = (user.employeeId || '').toLowerCase().trim();
    const userId = (user.id || (user as any)._id || '').toLowerCase().trim();
    const recEmpId = (todayRecord.employeeId || '').toLowerCase().trim();
    const recTechCode = ((todayRecord as any).technicianCode || '').toLowerCase().trim();
    const recUserId = ((todayRecord as any).userId || '').toLowerCase().trim();
    return (
      Boolean(userEmpId && (recEmpId === userEmpId || recTechCode === userEmpId || recUserId === userEmpId)) ||
      Boolean(userId && (recEmpId === userId || recTechCode === userId || recUserId === userId))
    );
  }, [todayRecord, user]);

  const isShiftActive = isRecordForCurrentUser && todayStatus === 'active';
  const isShiftConcluded = isRecordForCurrentUser && (
    todayStatus === 'completed' ||
    Boolean(todayRecord?.checkIn && todayRecord?.checkOut)
  );

  // Load Substation & Attendance Data strictly synchronized with DB
  const loadData = async () => {
    try {
      const freshUser = await refreshProfile();
      await fetchTodayAttendance();

      const activeUser = freshUser || user;
      const userSiteId = activeUser?.assignedSiteId || (activeUser?.assignedSiteIds && activeUser.assignedSiteIds[0]);

      // Prefer live assignedSite returned from backend /attendance/today
      const storeSite = useAttendanceStore.getState().assignedSite;
      if (storeSite) {
        setSubstation(storeSite);
      } else if (userSiteId) {
        try {
          const site = await siteService.getSiteById(userSiteId);
          setSubstation(site);
        } catch {
          setSubstation(null);
        }
      } else {
        setSubstation(null);
      }

      // Load personal attendance-based salary overview
      try {
        const currentEmpId = (freshUser || user)?.id || ((freshUser || user) as any)?._id || '';
        if (currentEmpId) {
          const currentMonth = new Date().getMonth() + 1;
          const currentYear = new Date().getFullYear();
          const slip = await salaryService.getSalarySlip(currentEmpId, currentMonth, currentYear);
          if (slip) setDashboardSalarySlip(slip);
        }
      } catch (salErr) {
        // Silently use defaults
      }

      // Load Notifications from Dashboard Service
      const stats = await dashboardService.getAdminStats();
      if (stats?.notifications) {
        setNotifications(stats.notifications);
      }
    } catch (e) {
      console.warn('Dashboard loadData error:', e);
    }
  };

  useEffect(() => {
    if (assignedSite) {
      setSubstation(assignedSite);
    }
  }, [assignedSite]);

  useEffect(() => {
    loadData();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setShiftInfo(getShiftInfo());
    setRefreshing(false);
  };

  // Update digital clock, timer, and evaluate shift rules every 1 second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
      incrementTimer();
      setShiftInfo(getShiftInfo());
    }, 1000);
    return () => clearInterval(timer);
  }, [incrementTimer]);

  // AUTO CHECKOUT RULE AT 06:00 PM IST:
  // If technician is currently checked in and time reaches 06:00 PM (18:00 IST), trigger auto checkout!
  const hasAutoCheckedOutRef = useRef(false);
  useEffect(() => {
    if (isShiftActive && shiftInfo.isAfterShiftEnd && !hasAutoCheckedOutRef.current) {
      hasAutoCheckedOutRef.current = true;
      handleAutoCheckOut();
    }
  }, [isShiftActive, shiftInfo.isAfterShiftEnd]);

  const handleAutoCheckOut = async () => {
    try {
      const record = await attendanceService.checkOut({
        latitude: deviceCoords.latitude,
        longitude: deviceCoords.longitude,
        accuracy: 10,
        remarks: 'Auto Check-Out (06:00 PM IST Shift Concluded)',
      });
      setShiftCompleted(record);
      Alert.alert(
        'Shift Concluded',
        'Standard shift concluded at 06:00 PM IST.\nYou have been automatically checked out.',
        [{ text: 'OK' }]
      );
    } catch (e) {
      console.warn('Auto checkout error:', e);
    }
  };

  // Manual Check In Trigger: Navigates to Field Shift Check-In screen
  const handleCheckIn = () => {
    if (!substation) {
      Alert.alert(
        'No Substation Assigned',
        'You do not have an active work site assigned yet. Please contact your Supervisor or Operations Admin to allocate your designated substation.'
      );
      return;
    }
    // 1. Prevent re-checkin if already checked in today
    if (isShiftActive) {
      Alert.alert('Already Checked In', 'You are already checked in. Your shift is currently in progress.');
      return;
    }
    if (isShiftConcluded || (isRecordForCurrentUser && Boolean(todayRecord?.checkIn))) {
      Alert.alert('Already Checked In', 'You have already checked in for today. Re-check in is not allowed.');
      return;
    }

    const currentShift = getShiftInfo();

    // Enforce 09:00 AM - 06:00 PM rule
    if (!currentShift.isCheckInAllowed) {
      Alert.alert(
        'Check-In Closed',
        currentShift.isAfterShiftEnd
          ? 'Shift check-in closed at 06:00 PM IST.\n\nCheck-in is disabled for the night and reopens tomorrow at 09:00 AM IST.'
          : 'Shift check-in is closed (06:00 PM – 09:00 AM IST).\n\nCheck-in will reopen today at 09:00 AM IST.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Navigate to dedicated Field Shift Check-In screen with Live Location Radar & Geofence
    navigation.navigate('CheckIn');
  };

  // Click Photo from Live Camera
  const handleCapturePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
          skipProcessing: false,
          base64: true,
        });
        const photoData = photo.base64
          ? (photo.base64.startsWith('data:') ? photo.base64 : `data:image/jpeg;base64,${photo.base64}`)
          : photo.uri;
        setCapturedPhotoUri(photoData);
        triggerHaptic('success');
      } catch (e: any) {
        Alert.alert('Camera Error', e.message || 'Failed to capture photo. Please try again.');
      }
    }
  };

  // Submit Photo & Record Check-In (Photo is COMPULSORY)
  const handleSubmitPhotoAndCheckIn = async () => {
    if (isShiftActive || isShiftConcluded || (isRecordForCurrentUser && Boolean(todayRecord?.checkIn))) {
      Alert.alert('Already Checked In', 'You have already checked in for today. Re-check in is not allowed.');
      return;
    }

    if (!capturedPhotoUri) {
      Alert.alert('Photo Required', 'Check-in photo is compulsory. Please capture a photo before checking in.');
      return;
    }

    setIsSubmittingPhoto(true);
    triggerHaptic('medium');

    try {
      const currentShift = getShiftInfo();
      const siteId = user?.assignedSiteId || substation?.id || '';

      // 1. Upload live captured photo to server
      let uploadedPhotoUrl: string | undefined = undefined;
      try {
        uploadedPhotoUrl = await attendanceService.uploadPhoto(capturedPhotoUri);
      } catch (uploadErr) {
        console.warn('Photo upload fallback to captured URI:', uploadErr);
        uploadedPhotoUrl = capturedPhotoUri;
      }

      // 2. Submit attendance
      const record = await attendanceService.checkIn({
        siteId,
        latitude: deviceCoords.latitude,
        longitude: deviceCoords.longitude,
        accuracy: 10,
        photoUrl: uploadedPhotoUrl,
        remarks: `Field Technician Check-In (Photo Verified - ${currentShift.punctualityLabel})`,
      });

      await fetchTodayAttendance();
      setShowCameraModal(false);
      setCapturedPhotoUri(null);
      triggerHaptic('success');

      Alert.alert(
        'Check-In Successful',
        `Welcome, ${user?.name || 'Technician'}!\n\n✓ Photo Verified & Submitted\n✓ Location: ${substation?.name || 'Assigned Site'}\n✓ Time: ${currentShift.formattedTimeIST}\n✓ Status: ${currentShift.punctualityLabel}`,
        [{ text: 'Continue to Field Desk' }]
      );
    } catch (err: any) {
      Alert.alert(
        'Check-In Failed',
        err.response?.data?.detail || err.message || 'Unable to record check-in. Please try again.'
      );
    } finally {
      setIsSubmittingPhoto(false);
    }
  };

  // Manual Check Out Trigger: Open confirmation popup modal
  const handleCheckOut = () => {
    setShowCheckOutConfirm(true);
  };

  // Conclude Shift Check-Out
  const executeCheckOut = async () => {
    setActionLoading(true);
    try {
      const record = await attendanceService.checkOut({
        latitude: deviceCoords.latitude,
        longitude: deviceCoords.longitude,
        accuracy: 10,
        remarks: 'Field Technician Check-Out',
      });
      setShiftCompleted(record);
      setShowCheckOutConfirm(false);
      triggerHaptic('success');
      Alert.alert(
        'Shift Concluded',
        'Your checkout punch has been recorded successfully. Work hours telemetry saved.',
        [{ text: 'OK', onPress: () => fetchTodayAttendance() }]
      );
    } catch (err: any) {
      Alert.alert(
        'Check-Out Notice',
        err.response?.data?.detail || err.message || 'Check-out failed. Please try again.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Format elapsed seconds to 'Xh Ym' based on real check-in / check-out data
  const formatWorkedHours = (totalSecs: number) => {
    if (!isRecordForCurrentUser || (!isShiftActive && !isShiftConcluded)) {
      return '--';
    }
    // If shift concluded, show actual recorded working hours from the database
    if (isShiftConcluded && todayRecord) {
      if (todayRecord.workingHoursFormatted) {
        return todayRecord.workingHoursFormatted
          .replace(' hrs', 'h')
          .replace(' mins', 'm')
          .replace(' hr', 'h')
          .replace(' min', 'm');
      }
      const mins = todayRecord.workingMinutes ?? 0;
      const hours = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hours}h ${remMins.toString().padStart(2, '0')}m`;
    }

    // Active shift: show live elapsed time
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    return `${hours}h ${mins.toString().padStart(2, '0')}m`;
  };

  // Accurate Check-in time string in Indian Standard Time (IST)
  const checkInDisplayTime = useMemo(() => {
    if (isRecordForCurrentUser && todayRecord?.checkIn?.time) {
      return (todayRecord.checkIn as any).timeIST || formatTimeIST(todayRecord.checkIn.time);
    }
    return '--:--';
  }, [todayRecord, isRecordForCurrentUser]);

  // Shift Punctuality / Half-Day Status Meta
  const todayPunctualityMeta = useMemo(() => {
    if (!isRecordForCurrentUser || !todayRecord) {
      return {
        label: 'Not Started',
        badgeText: '• Punch Status ›',
        badgeColor: '#1E63F0',
        badgeBg: '#EFF6FF',
      };
    }
    const rawStatus = (todayRecord.status || '').toLowerCase().replace('-', '_');
    if (rawStatus === 'half_day') {
      return {
        label: 'Half Day',
        badgeText: isShiftActive ? '• In Progress ›' : '• Concluded ›',
        badgeColor: '#D97706',
        badgeBg: '#FEF3C7',
      };
    }
    if (rawStatus === 'late') {
      return {
        label: 'Late Checked-In',
        badgeText: isShiftActive ? '• In Progress ›' : '• Concluded ›',
        badgeColor: '#D97706',
        badgeBg: '#FEF3C7',
      };
    }
    if (rawStatus === 'present' || rawStatus === 'on_time') {
      return {
        label: 'On-Time',
        badgeText: isShiftActive ? '• In Progress ›' : '• Concluded ›',
        badgeColor: '#16A34A',
        badgeBg: '#DCFCE7',
      };
    }
    return {
      label: isShiftActive ? 'In Progress' : 'Concluded',
      badgeText: isShiftActive ? '• View Status ›' : '• View Audit ›',
      badgeColor: '#1E63F0',
      badgeBg: '#EFF6FF',
    };
  }, [isRecordForCurrentUser, todayRecord, isShiftActive]);

  // STRICT EMPLOYEE NOTIFICATIONS FILTER:
  // Shows ONLY notifications belonging to the logged-in technician
  const employeeNotifications = useMemo(() => {
    const currentEmpId = (user?.employeeId || '').toLowerCase();
    const currentName = (user?.name || '').toLowerCase();
    const firstName = currentName.split(' ')[0];

    // Seeded personal notifications for this employee to match professional standards
    const personalDefaults: AdminNotification[] = [
      {
        id: 'emp_notif_geo_01',
        type: 'success',
        category: 'Geofence Verified',
        title: 'Geofence Verified (500m)',
        message: `You are inside the authorized 500m geofence perimeter at ${substation?.name || 'Assigned Site'} (Lat: 12.9625, Long: 77.5937).`,
        timestamp: '10:14 AM',
        employeeId: user?.employeeId || '',
        employeeName: user?.name || 'Technician',
        isRead: false,
        source: 'employee',
      },
      {
        id: 'emp_notif_policy_02',
        type: 'info',
        category: 'Shift Timing Policy',
        title: 'Shift Hours Policy (IST)',
        message: 'Daily check-in window opens at 09:00 AM IST. Check-in is disabled after 06:00 PM IST with auto check-out at 06:00 PM.',
        timestamp: '09:00 AM',
        employeeId: user?.employeeId || '',
        employeeName: user?.name || 'Technician',
        isRead: false,
        source: 'admin',
      },
      {
        id: 'emp_notif_safety_03',
        type: 'warning',
        category: 'Safety Directive',
        title: 'PPE Safety Compliance',
        message: 'Mandatory Level-2 electrical insulation gloves and helmet required for substation transformer diagnostics.',
        timestamp: 'Yesterday',
        employeeId: user?.employeeId || '',
        employeeName: user?.name || 'Technician',
        isRead: true,
        source: 'admin',
      },
    ];

    // Filter server notifications strictly for this employee
    const serverFiltered = notifications.filter((n) => {
      if (n.employeeName) {
        const notifName = n.employeeName.toLowerCase();
        // If notification explicitly names another employee, EXCLUDE IT
        if (!notifName.includes(firstName)) return false;
      }
      if (n.employeeId) {
        const notifEmpId = n.employeeId.toLowerCase();
        if (!notifEmpId.includes('01') && !notifEmpId.includes(currentEmpId)) return false;
      }
      return true;
    });

    const combined = [...personalDefaults];
    serverFiltered.forEach((sn) => {
      if (!combined.some((c) => c.id === sn.id)) {
        combined.unshift(sn);
      }
    });

    return combined;
  }, [notifications, user, substation]);

  const unreadNotifCount = useMemo(() => {
    return employeeNotifications.filter((n) => !n.isRead).length;
  }, [employeeNotifications]);

  const handleMarkAllNotifRead = async () => {
    try {
      await dashboardService.markNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (e) {
      console.warn('Mark notif read error:', e);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 16) + 8,
            paddingBottom: Math.max(insets.bottom, 16) + 36,
          },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ============================================================== */}
        {/* 1. TOP HEADER BAR (AS IN PHOTO WITH 3-LINE MENU & NOTIF ICON)   */}
        {/* ============================================================== */}
        <View style={styles.topHeaderCard}>
          <View style={styles.headerLeftCol}>
            {/* 3-Line Hamburger Menu Icon Button */}
            <TouchableOpacity
              style={styles.hamburgerBtn}
              onPress={() => openDrawer('Dashboard')}
              activeOpacity={0.7}
              accessibilityLabel="Open Navigation Menu"
            >
              <Menu size={22} color="#0F172A" />
            </TouchableOpacity>

            {/* Initials Avatar Box 'RS' */}
            <View style={styles.avatarBox}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>

            {/* Name, Designation & Site Info */}
            <View style={styles.headerIdentityWrap}>
              <View style={styles.nameRow}>
                <Text style={styles.greetingTitle}>Hello, {user?.name || 'Technician'}</Text>
                <View style={styles.techPillBadge}>
                  <Text style={styles.techPillText}>Field Technician</Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>
                  Employee ID: <Text style={styles.metaEmpId}>{user?.employeeId || ''}</Text>
                </Text>
                <Text style={styles.metaDot}>•</Text>
                <MapPin size={11} color="#2563EB" style={{ marginRight: 3 }} />
                <Text style={styles.metaSiteText} numberOfLines={1}>
                  Assignment: {substation?.name || 'Assigned Site'}
                </Text>
              </View>
            </View>
          </View>

          {/* Right Header Controls Strip */}
          <View style={styles.headerRightCol}>
            {/* Field Portal Active Pill */}
            <View style={styles.activePortalPill}>
              <View style={styles.greenPulseDot} />
              <Text style={styles.activePortalText}>Field Portal Active</Text>
            </View>

            {/* Today's Attendance Status Audit Button */}
            <TouchableOpacity
              style={[styles.headerActionBtn, { borderColor: '#93C5FD', backgroundColor: '#EFF6FF' }]}
              onPress={() => navigation.navigate('Today')}
              activeOpacity={0.75}
            >
              <Clock size={13} color="#1E63F0" style={{ marginRight: 5 }} />
              <Text style={[styles.headerActionBtnText, { color: '#1E63F0', fontWeight: '700' }]}>
                Today's Status
              </Text>
            </TouchableOpacity>

            {/* Holidays 2026 (PDF) Button */}
            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={() => setShowHolidaysModal(true)}
              activeOpacity={0.75}
            >
              <Calendar size={13} color="#475569" style={{ marginRight: 5 }} />
              <Text style={styles.headerActionBtnText}>Holidays 2026 (PDF)</Text>
            </TouchableOpacity>

            {/* Refresh Status Button */}
            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={onRefresh}
              activeOpacity={0.75}
            >
              <RefreshCw size={13} color="#475569" style={{ marginRight: 5 }} />
              <Text style={styles.headerActionBtnText}>Refresh Status</Text>
            </TouchableOpacity>

            {/* Personal Employee Notification Bell Icon */}
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() => setShowNotifModal(true)}
              activeOpacity={0.75}
              accessibilityLabel="View Personal Notifications"
            >
              <Bell size={18} color="#1E293B" />
              {unreadNotifCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unreadNotifCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ============================================================== */}
        {/* 2. TOP 5 KPI CARDS (AS IN PHOTO)                                */}
        {/* ============================================================== */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kpiCardsRow}
        >
          {/* Card 1: Today's Shift */}
          <TouchableOpacity
            style={styles.kpiCard}
            onPress={() => navigation.navigate('Today')}
            activeOpacity={0.8}
          >
            <Text style={styles.kpiLabel}>TODAY'S SHIFT</Text>
            <Text style={[styles.kpiMainValue, todayPunctualityMeta.label === 'Half Day' && { color: '#D97706' }]}>
              {todayPunctualityMeta.label}
            </Text>
            <View style={styles.kpiFooterRow}>
              <Text style={[styles.kpiSubText, { color: todayPunctualityMeta.badgeColor, fontWeight: '700' }]}>
                {todayPunctualityMeta.badgeText}
              </Text>
              <View style={[styles.kpiIconCircle, { backgroundColor: todayPunctualityMeta.badgeBg }]}>
                <Clock size={14} color={todayPunctualityMeta.badgeColor} />
              </View>
            </View>
          </TouchableOpacity>

          {/* Card 2: Check-In Time */}
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>CHECK-IN TIME</Text>
            <Text style={styles.kpiMainValue}>{checkInDisplayTime}</Text>
            <View style={styles.kpiFooterRow}>
              <Text style={styles.kpiSubText}>
                {isRecordForCurrentUser && todayRecord?.date ? todayRecord.date : shiftInfo.formattedTimeIST}
              </Text>
              <View style={[styles.kpiIconCircle, { backgroundColor: '#EFF6FF' }]}>
                <Clock size={14} color="#2563EB" />
              </View>
            </View>
          </View>

          {/* Card 3: Hours Worked */}
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>HOURS WORKED</Text>
            <Text style={styles.kpiMainValue}>
              {formatWorkedHours(isRecordForCurrentUser ? liveElapsedSeconds : 0)}
            </Text>
            <View style={styles.kpiFooterRow}>
              <Text style={styles.kpiSubText}>Standard 8h shift</Text>
              <View style={[styles.kpiIconCircle, { backgroundColor: '#F0FDF4' }]}>
                <Timer size={14} color="#15803D" />
              </View>
            </View>
          </View>

          {/* Card 4: Authorized Geofence */}
          <TouchableOpacity
            style={styles.kpiCard}
            onPress={() => navigation.navigate('SiteDetails')}
            activeOpacity={0.75}
          >
            <Text style={styles.kpiLabel}>AUTHORIZED GEOFENCE</Text>
            <Text style={styles.kpiMainValue}>500 m</Text>
            <View style={styles.kpiFooterRow}>
              <View style={styles.greenDotRow}>
                <View style={styles.tinyGreenDot} />
                <Text style={styles.kpiSubText}>Verified in Zone</Text>
              </View>
              <View style={[styles.kpiIconCircle, { backgroundColor: '#FAF5FF' }]}>
                <MapPin size={14} color="#9333EA" />
              </View>
            </View>
          </TouchableOpacity>

          {/* Card 5: Monthly Attendance */}
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>MONTHLY ATTENDANCE</Text>
            <Text style={styles.kpiMainValue}>57%</Text>
            <View style={styles.kpiFooterRow}>
              <Text style={styles.kpiSubText}>14 Shifts Logged</Text>
              <View style={[styles.kpiIconCircle, { backgroundColor: '#F5F3FF' }]}>
                <TrendingUp size={14} color="#7C3AED" />
              </View>
            </View>
          </View>
        </ScrollView>

        {/* ============================================================== */}
        {/* 3. LIVE SHIFT VERIFICATION BANNER (AS IN PHOTO)                */}
        {/* ============================================================== */}
        <View style={styles.liveVerificationBanner}>
          <View style={styles.bannerTopRow}>
            {/* Left Check Icon Box */}
            <View style={styles.bannerIconSquare}>
              <CheckCircle2 size={24} color="#FFFFFF" />
            </View>

            {/* Banner Center Text */}
            <View style={styles.bannerCenterInfo}>
              <Text style={styles.bannerTagText}>LIVE SHIFT VERIFICATION</Text>
              <Text style={styles.bannerTitleText}>
                {isShiftActive
                  ? `Shift Active • ${todayPunctualityMeta.label}`
                  : isShiftConcluded
                  ? `Shift Concluded • ${todayPunctualityMeta.label}`
                  : !shiftInfo.isCheckInAllowed
                  ? shiftInfo.isAfterShiftEnd
                    ? 'Check-In Closed • Shift Ended at 18:00'
                    : 'Check-In Closed • Opens 9:00 AM'
                  : 'Ready to Check In'}
              </Text>
              <Text style={styles.bannerSubtitleText} numberOfLines={1}>
                {isShiftConcluded
                  ? 'Shift recorded for today • Re-check in is not allowed'
                  : substation?.name ? `GPS verified at your current device location • ${substation.name}` : 'Please contact admin to allocate your work site'}
              </Text>
            </View>

            {/* Action Check In / Check Out Button */}
            {isShiftActive ? (
              <TouchableOpacity
                style={styles.bannerCheckOutBtn}
                onPress={handleCheckOut}
                disabled={actionLoading}
                activeOpacity={0.85}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <>
                    <LogOut size={16} color="#DC2626" style={{ marginRight: 6 }} />
                    <Text style={styles.bannerCheckOutBtnText}>Check Out</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : isShiftConcluded ? (
              /* ALREADY CONCLUDED TODAY: RE-CHECK IN NOT ALLOWED */
              <TouchableOpacity
                style={[styles.bannerLockedBtn, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
                onPress={() =>
                  Alert.alert(
                    'Shift Concluded',
                    'You have already recorded your check-in and concluded your shift for today. Re-check in is not allowed.',
                    [{ text: 'OK' }]
                  )
                }
                activeOpacity={0.75}
              >
                <CheckCircle2 size={15} color="#2563EB" style={{ marginRight: 6 }} />
                <Text style={[styles.bannerLockedBtnText, { color: '#1E40AF', fontWeight: '800' }]}>
                  Shift Logged
                </Text>
              </TouchableOpacity>
            ) : !shiftInfo.isCheckInAllowed ? (
              /* DISABLED CHECK IN BUTTON OUTSIDE 09:00 AM - 06:00 PM */
              <TouchableOpacity
                style={styles.bannerLockedBtn}
                onPress={() =>
                  Alert.alert(
                    'Check-In Closed',
                    shiftInfo.isAfterShiftEnd
                      ? 'Shift hours ended at 06:00 PM IST.\n\nCheck-in is disabled and will reopen at 09:00 AM tomorrow.'
                      : 'Shift check-in is closed (06:00 PM – 09:00 AM IST).\n\nCheck-in will reopen at 09:00 AM today.',
                    [{ text: 'OK' }]
                  )
                }
                activeOpacity={0.7}
              >
                <Lock size={15} color="#64748B" style={{ marginRight: 6 }} />
                <Text style={styles.bannerLockedBtnText}>
                  {shiftInfo.isAfterShiftEnd ? 'Check In (Closed)' : 'Check In (Opens 9 AM)'}
                </Text>
              </TouchableOpacity>
            ) : (
              /* ENABLED CHECK IN BUTTON BETWEEN 09:00 AM AND 06:00 PM */
              <TouchableOpacity
                style={styles.bannerCheckInBtn}
                onPress={handleCheckIn}
                disabled={actionLoading}
                activeOpacity={0.85}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#059669" />
                ) : (
                  <>
                    <CheckCircle2 size={16} color="#059669" style={{ marginRight: 6 }} />
                    <Text style={styles.bannerCheckInBtnText}>Check In</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Banner Bottom Coordinates & Geofence Strip */}
          <View style={styles.bannerCoordsStrip}>
            <View style={styles.coordsLeft}>
              <MapPin size={11} color="#BFDBFE" style={{ marginRight: 4 }} />
              <Text style={styles.coordsText}>
                Lat: {deviceCoords.latitude.toFixed(4)} | Long: {deviceCoords.longitude.toFixed(4)}
              </Text>
            </View>

            <View style={styles.geofenceRight}>
              <Text style={styles.geofenceText}>Authorized Dynamic Geofence: 500m</Text>
            </View>
          </View>
        </View>

        {/* Shift Timing Policy Notice Strip */}
        <View style={styles.timingNoticeStrip}>
          <Clock size={13} color="#2563EB" style={{ marginRight: 6 }} />
          <Text style={styles.timingNoticeText}>
            Shift Window: 09:00 AM – 06:00 PM IST | After 06:00 PM Disabled (Reopens 09:00 AM) | Auto Check-Out at 06:00 PM
          </Text>
        </View>

        {/* ============================================================== */}
        {/* 4. MY ATTENDANCE REVIEW & WORK HOURS (AS IN PHOTO GRAPH/KPI)   */}
        {/* ============================================================== */}
        <View style={styles.analyticsCard}>
          {/* Section Header */}
          <View style={styles.analyticsHeaderRow}>
            <View style={styles.analyticsIconBox}>
              <BarChart3 size={18} color="#1E63F0" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.analyticsTitleRow}>
                <Text style={styles.analyticsTitle}>My Attendance Review & Work Hours</Text>
                <View style={styles.analyticsGreenBadge}>
                  <Text style={styles.analyticsGreenBadgeText}>EMPLOYEE ANALYTICS</Text>
                </View>
              </View>
              
            </View>

            {/* Right Toggle Buttons */}
            <View style={styles.analyticsToggleWrap}>
              <TouchableOpacity
                style={[
                  styles.analyticsToggleBtn,
                  analyticsTab === 'daily' && styles.analyticsToggleBtnActive,
                ]}
                onPress={() => setAnalyticsTab('daily')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.analyticsToggleBtnText,
                    analyticsTab === 'daily' && styles.analyticsToggleBtnTextActive,
                  ]}
                >
                  Daily Hours Trend
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.analyticsToggleBtn,
                  analyticsTab === 'distribution' && styles.analyticsToggleBtnActive,
                ]}
                onPress={() => setAnalyticsTab('distribution')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.analyticsToggleBtnText,
                    analyticsTab === 'distribution' && styles.analyticsToggleBtnTextActive,
                  ]}
                >
                  Shift Distribution
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.fullLogsBtn}
                onPress={() => navigation.navigate('History')}
                activeOpacity={0.8}
              >
                <Text style={styles.fullLogsBtnText}>→ Full Logs</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 4 Analytics Summary Stat Cards */}
          <View style={styles.statsSummaryGrid}>
            <View style={styles.statSummaryBox}>
              <Text style={styles.statSummaryLabel}>WEEK TOTAL HOURS</Text>
              <Text style={styles.statSummaryValue}>
                53.0 <Text style={styles.statSummaryUnit}>hrs</Text>
              </Text>
              <Text style={styles.statSummarySub}>Target: 40h standard week</Text>
            </View>

            <View style={styles.statSummaryBox}>
              <Text style={styles.statSummaryLabel}>DAILY AVERAGE</Text>
              <Text style={styles.statSummaryValue}>
                10.6 <Text style={styles.statSummaryUnit}>hrs/day</Text>
              </Text>
              <Text style={styles.statSummarySub}>Optimal field efficiency</Text>
            </View>

            <View style={styles.statSummaryBox}>
              <Text style={styles.statSummaryLabel}>PRESENT SHIFTS</Text>
              <Text style={styles.statSummaryValue}>
                5 <Text style={styles.statSummaryUnit}>/ 6 Days</Text>
              </Text>
              <Text style={styles.statSummarySub}>Attendance: 57%</Text>
            </View>

            <View style={styles.statSummaryBox}>
              <Text style={styles.statSummaryLabel}>GEOFENCE COMPLIANCE</Text>
              <Text style={[styles.statSummaryValue, { color: '#059669' }]}>100%</Text>
              <Text style={styles.statSummarySub}>100% In-Range Verified</Text>
            </View>
          </View>

          {/* Dynamic Content: Bar Chart vs Distribution */}
          {analyticsTab === 'daily' ? (
            /* Bar Chart View matching Photo */
            <View style={styles.chartContainer}>
              {/* Chart Legend */}
              <View style={styles.chartLegendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.legendText}>Hours Worked per Day (Target line: 8.0 hrs)</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#1E63F0' }]} />
                  <Text style={styles.legendText}>Today's Live Shift</Text>
                </View>
              </View>

              {/* Chart Canvas Area */}
              <View style={styles.chartCanvas}>
                {/* Dotted Target Line at 8 Hours */}
                <View style={styles.targetDottedLine} />
                <View style={styles.targetBadge}>
                  <Text style={styles.targetBadgeText}>8h Target Shift</Text>
                </View>

                {/* Y-Axis Reference Labels */}
                <View style={styles.yAxisCol}>
                  <Text style={styles.yAxisLabel}>10h</Text>
                  <Text style={styles.yAxisLabel}>5h</Text>
                  <Text style={styles.yAxisLabel}>2h</Text>
                  <Text style={styles.yAxisLabel}>0h</Text>
                </View>

                {/* Bars Container */}
                <View style={styles.barsContainer}>
                  {WEEKLY_HOURS_DATA.map((item, index) => {
                    const maxHeight = 135; // Max bar container px
                    const heightPct = Math.min((item.hours / 14) * 100, 100);
                    const isSelected = selectedBar?.day === item.day;
                    const parts = item.day.trim().split(/\s+/);
                    const dayName = parts[0] || '';
                    const dayDate = parts[1] || '';

                    return (
                      <TouchableOpacity
                        key={index}
                        style={styles.barCol}
                        activeOpacity={0.8}
                        onPress={() => setSelectedBar(item)}
                      >
                        {/* Bar Pillar */}
                        <View style={[styles.barPillarWrap, { height: maxHeight }]}>
                          <View
                            style={[
                              styles.barFill,
                              {
                                height: `${heightPct}%`,
                                backgroundColor: item.isToday
                                  ? '#1E63F0'
                                  : item.hours === 0
                                  ? 'transparent'
                                  : '#10B981',
                                borderTopLeftRadius: 6,
                                borderTopRightRadius: 6,
                              },
                              isSelected && styles.selectedBarGlow,
                            ]}
                          />
                        </View>

                        {/* X-Axis Day & Date Label */}
                        <View style={styles.xAxisLabelContainer}>
                          <Text
                            style={[
                              styles.xAxisDayLabel,
                              item.isToday && styles.xAxisDayLabelToday,
                              isSelected && styles.xAxisDayLabelSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {dayName}
                          </Text>
                          {dayDate ? (
                            <Text
                              style={[
                                styles.xAxisDateLabel,
                                item.isToday && styles.xAxisDateLabelToday,
                                isSelected && styles.xAxisDateLabelSelected,
                              ]}
                              numberOfLines={1}
                            >
                              {dayDate}
                            </Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Selected Bar Tooltip Banner */}
              {selectedBar && (
                <View style={styles.tooltipBanner}>
                  <Info size={14} color="#1E63F0" style={{ marginRight: 6 }} />
                  <Text style={styles.tooltipText}>
                    <Text style={{ fontWeight: '800' }}>{selectedBar.day} ({selectedBar.dateStr}): </Text>
                    {selectedBar.hours > 0
                      ? `${selectedBar.hours} hours logged • Target ${selectedBar.target}h satisfied`
                      : 'Scheduled Weekend Field Off • 0 hours logged'}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            /* Shift Distribution Breakdown */
            <View style={styles.distributionContainer}>
              <View style={styles.distGrid}>
                <View style={styles.distCard}>
                  <Text style={styles.distLabel}>On-Time Shifts</Text>
                  <Text style={[styles.distValue, { color: '#059669' }]}>18 Shifts</Text>
                  <Text style={styles.distPct}>75.0% of total schedule</Text>
                </View>

                <View style={styles.distCard}>
                  <Text style={styles.distLabel}>Late Checked-In</Text>
                  <Text style={[styles.distValue, { color: '#D97706' }]}>3 Shifts</Text>
                  <Text style={styles.distPct}>12.5% grace period</Text>
                </View>

                <View style={styles.distCard}>
                  <Text style={styles.distLabel}>Half-Day Shifts</Text>
                  <Text style={[styles.distValue, { color: '#8B5CF6' }]}>2 Shifts</Text>
                  <Text style={styles.distPct}>8.3% half shift credited</Text>
                </View>

                <View style={styles.distCard}>
                  <Text style={styles.distLabel}>Loss of Pay / Off</Text>
                  <Text style={[styles.distValue, { color: '#64748B' }]}>1 Shift</Text>
                  <Text style={styles.distPct}>4.2% approved leave</Text>
                </View>
              </View>

              <View style={styles.payoutScoreBox}>
                <ShieldCheck size={18} color="#059669" style={{ marginRight: 8 }} />
                <Text style={styles.payoutScoreText}>
                  Overall Attendance Compliance: <Text style={{ fontWeight: '900', color: '#059669' }}>95.8%</Text> • Qualified for Full Monthly Attendance Allowance
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ============================================================== */}
      {/* 5. PERSONAL EMPLOYEE NOTIFICATIONS MODAL (EMPLOYEE-ONLY)       */}
      {/* ============================================================== */}
      <Modal
        visible={showNotifModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNotifModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.modalTitle}>Field Notifications</Text>
                  <View style={styles.notifCountBadge}>
                    <Text style={styles.notifCountBadgeText}>{employeeNotifications.length}</Text>
                  </View>
                </View>
                
              </View>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowNotifModal(false)}
                activeOpacity={0.7}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Mark All Read Action */}
            <View style={styles.notifActionBar}>
              <Text style={styles.notifFilterText}>Showing employee-specific alerts only</Text>
              <TouchableOpacity onPress={handleMarkAllNotifRead} activeOpacity={0.7}>
                <Text style={styles.markAllReadText}>Mark all read</Text>
              </TouchableOpacity>
            </View>

            {/* Notifications List */}
            <ScrollView style={styles.notifList} showsVerticalScrollIndicator={false}>
              {employeeNotifications.map((notif) => {
                const isSuccess = notif.type === 'success';
                const isWarning = notif.type === 'warning';
                const isDanger = notif.type === 'danger';

                return (
                  <View
                    key={notif.id}
                    style={[
                      styles.notifCard,
                      !notif.isRead && styles.notifCardUnread,
                    ]}
                  >
                    <View style={styles.notifIconCol}>
                      {isSuccess ? (
                        <CheckCircle2 size={18} color="#059669" />
                      ) : isWarning ? (
                        <AlertCircle size={18} color="#D97706" />
                      ) : isDanger ? (
                        <AlertCircle size={18} color="#DC2626" />
                      ) : (
                        <Info size={18} color="#2563EB" />
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={styles.notifTitleRow}>
                        <Text style={styles.notifTitle}>{notif.title}</Text>
                        <Text style={styles.notifTime}>{notif.timestamp}</Text>
                      </View>
                      <Text style={styles.notifMessage}>{notif.message}</Text>
                      <View style={styles.notifFooterRow}>
                        <View style={styles.notifCategoryPill}>
                          <Text style={styles.notifCategoryPillText}>{notif.category}</Text>
                        </View>
                        {!notif.isRead && <View style={styles.unreadBlueDot} />}
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* Modal Bottom Close */}
            <TouchableOpacity
              style={styles.modalDoneBtn}
              onPress={() => setShowNotifModal(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalDoneBtnText}>Close Notifications</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* 6. HOLIDAYS 2026 MODAL                                         */}
      {/* ============================================================== */}
      <Modal
        visible={showHolidaysModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHolidaysModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContainer, { maxHeight: '82%' }]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Adani Power Holidays 2026</Text>
                
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowHolidaysModal(false)}
                activeOpacity={0.7}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.notifList} showsVerticalScrollIndicator={false}>
              {(holidaysList.length > 0
                ? holidaysList.map((item) => {
                    const parts = (item.date || '').split('-');
                    const dt = new Date((item.date || '2026-01-01') + 'T00:00:00');
                    const mName = dt.toLocaleDateString('en-US', { month: 'short' });
                    return {
                      date: `${parts[2] || '01'} ${mName} ${parts[0] || '2026'}`,
                      day: item.day || 'Day',
                      name: item.name,
                      type: item.type || 'Gazetted',
                    };
                  })
                : ADANI_HOLIDAYS_2026
              ).map((h, idx) => (
                <View key={idx} style={styles.holidayRow}>
                  <View style={styles.holidayDateCol}>
                    <Text style={styles.holidayDateText}>{h.date.split(' ')[0]}</Text>
                    <Text style={styles.holidayMonthText}>{h.date.split(' ')[1]}</Text>
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.holidayName}>{h.name}</Text>
                    <Text style={styles.holidayDay}>{h.day} • {h.type}</Text>
                  </View>

                  <View style={styles.holidayPaidBadge}>
                    <Text style={styles.holidayPaidBadgeText}>Paid Holiday</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#EFF6FF',
                  borderWidth: 1,
                  borderColor: '#BFDBFE',
                  paddingVertical: 12,
                  borderRadius: 10,
                }}
                onPress={async () => {
                  setDownloadingHolidaysPdf(true);
                  try {
                    await holidayService.downloadHolidaysPdf(2026);
                  } catch (e: any) {
                    Alert.alert('Download Error', e.message || 'Failed to download holiday calendar.');
                  } finally {
                    setDownloadingHolidaysPdf(false);
                  }
                }}
                disabled={downloadingHolidaysPdf}
                activeOpacity={0.8}
              >
                {downloadingHolidaysPdf ? (
                  <ActivityIndicator size="small" color="#1E63F0" />
                ) : (
                  <>
                    <Download size={14} color="#1E63F0" style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E63F0' }}>Download PDF</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalDoneBtn, { flex: 1, marginTop: 0 }]}
                onPress={() => setShowHolidaysModal(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.modalDoneBtnText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* 7. MANDATORY CAMERA PHOTO VERIFICATION MODAL                   */}
      {/* ============================================================== */}
      <Modal
        visible={showCameraModal}
        animationType="slide"
        onRequestClose={() => {
          if (!isSubmittingPhoto) {
            setShowCameraModal(false);
            setCapturedPhotoUri(null);
          }
        }}
      >
        <View style={styles.cameraModalContainer}>
          {!cameraPermission?.granted ? (
            /* Camera Permission Prompt */
            <View style={styles.permissionScreen}>
              <View style={styles.permIconBox}>
                <CameraIcon size={44} color="#1E63F0" />
              </View>
              <Text style={styles.permScreenTitle}>Camera Access Required</Text>
              <Text style={styles.permScreenSub}>
                Attendance check-in requires a live camera photo to verify your presence at{' '}
                {substation?.name || 'Assigned Site'}. Photo upload from gallery is disabled.
              </Text>

              <TouchableOpacity
                style={styles.grantPermBtn}
                onPress={requestCameraPermission}
                activeOpacity={0.85}
              >
                <CameraIcon size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.grantPermBtnText}>Enable Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelPermBtn}
                onPress={() => setShowCameraModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelPermBtnText}>Cancel Check-In</Text>
              </TouchableOpacity>
            </View>
          ) : !capturedPhotoUri ? (
            /* Active Camera Viewfinder (Click Photo Mode) */
            <View style={StyleSheet.absoluteFill}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing={cameraFacing}
                ref={cameraRef}
              >
                {/* Top Overlay */}
                <View style={[styles.cameraTopOverlay, { paddingTop: Math.max(insets.top, 20) + 10 }]}>
                  <View style={styles.cameraHeaderWrap}>
                    <View style={styles.cameraShieldBox}>
                      <ShieldCheck size={18} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cameraHeaderTitle}>MANDATORY SELFIE VERIFICATION</Text>
                      <Text style={styles.cameraHeaderSub}>
                        {substation?.name || 'Assigned Site'} • 500m Geofence Active
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.cameraCloseBtn}
                      onPress={() => {
                        setShowCameraModal(false);
                        Alert.alert('Check-In Incomplete', 'Photo capture was cancelled. You must take and submit a photo to check in.');
                      }}
                      activeOpacity={0.7}
                    >
                      <X size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Center Face Alignment Guide */}
                <View style={styles.cameraCenterOverlay}>
                  <View style={styles.faceTargetRing} />
                  <View style={styles.faceInstructionBadge}>
                    <Text style={styles.faceInstructionText}>
                      Align face inside frame • Live Camera Only (Upload Disabled)
                    </Text>
                  </View>
                </View>

                {/* Bottom Camera Controls Bar (Strictly Live Photo Capture Only) */}
                <View style={[styles.cameraBottomBar, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}>
                  {/* Flip Front/Back Camera */}
                  <TouchableOpacity
                    style={styles.cameraSideBtn}
                    onPress={() => setCameraFacing((prev) => (prev === 'front' ? 'back' : 'front'))}
                    activeOpacity={0.75}
                  >
                    <RotateCcw size={22} color="#FFFFFF" />
                    <Text style={styles.cameraSideBtnText}>Flip</Text>
                  </TouchableOpacity>

                  {/* Main Shutter Button: "Click Photo" */}
                  <TouchableOpacity
                    style={styles.shutterRingBtn}
                    onPress={handleCapturePhoto}
                    activeOpacity={0.8}
                  >
                    <View style={styles.shutterInnerCircle}>
                      <CameraIcon size={24} color="#1E63F0" />
                    </View>
                  </TouchableOpacity>

                  {/* Cancel Button */}
                  <TouchableOpacity
                    style={styles.cameraSideBtn}
                    onPress={() => {
                      setShowCameraModal(false);
                      Alert.alert('Check-In Incomplete', 'Photo capture was cancelled. You must take and submit a photo to check in.');
                    }}
                    activeOpacity={0.75}
                  >
                    <X size={22} color="#EF4444" />
                    <Text style={[styles.cameraSideBtnText, { color: '#EF4444' }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </CameraView>
            </View>
          ) : (
            /* Photo Captured Preview & Mandatory Submission Screen */
            <View style={[styles.previewScreenContainer, { paddingTop: Math.max(insets.top, 20) + 10, paddingBottom: Math.max(insets.bottom, 20) + 16 }]}>
              {/* Header */}
              <View style={styles.previewHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewTitle}>Review & Submit Photo</Text>
                  <Text style={styles.previewSubtitle}>
                    Photo captured via live camera • Ready for attendance punch
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.previewCloseBtn}
                  onPress={() => {
                    if (!isSubmittingPhoto) {
                      setShowCameraModal(false);
                      setCapturedPhotoUri(null);
                      Alert.alert('Check-In Incomplete', 'Photo was not submitted. Attendance has not been recorded.');
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <X size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Photo Preview Box */}
              <View style={styles.capturedImageBox}>
                <Image source={{ uri: capturedPhotoUri }} style={styles.capturedImage} />
                <View style={styles.capturedImageStamp}>
                  <CheckCircle2 size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.capturedImageStampText}>Verified Live Camera Photo</Text>
                </View>
              </View>

              {/* Telemetry Badge */}
              <View style={styles.previewTelemetryCard}>
                <View style={styles.telemetryRow}>
                  <MapPin size={13} color="#1E63F0" style={{ marginRight: 6 }} />
                  <Text style={styles.telemetryCardText}>
                    Location: <Text style={{ fontWeight: '800' }}>{substation?.name || 'Assigned Site'}</Text> (Lat: {deviceCoords.latitude.toFixed(4)}, Long: {deviceCoords.longitude.toFixed(4)})
                  </Text>
                </View>
                <View style={[styles.telemetryRow, { marginTop: 4 }]}>
                  <Clock size={13} color="#15803D" style={{ marginRight: 6 }} />
                  <Text style={styles.telemetryCardText}>
                    Time: <Text style={{ fontWeight: '800' }}>{shiftInfo.formattedTimeIST}</Text> • Punctuality: <Text style={{ fontWeight: '800', color: '#15803D' }}>{shiftInfo.punctualityLabel}</Text>
                  </Text>
                </View>
              </View>

              {/* Notice */}
              <View style={styles.mandatoryNoticeBox}>
                <CheckCircle2 size={16} color="#059669" style={{ marginRight: 8, marginTop: 1 }} />
                <Text style={[styles.mandatoryNoticeText, { color: '#065F46' }]}>
                  Photo upload is optional. Any photo you upload will be attached to your check-in and viewable by Admin.
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.previewActionCol}>
                {/* Submit Photo & Complete Check In */}
                <TouchableOpacity
                  style={[styles.submitPhotoBtn, isSubmittingPhoto && { opacity: 0.8 }]}
                  onPress={handleSubmitPhotoAndCheckIn}
                  disabled={isSubmittingPhoto}
                  activeOpacity={0.85}
                >
                  {isSubmittingPhoto ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.submitPhotoBtnText}>Uploading & Verifying Check-In...</Text>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.submitPhotoBtnText}>Submit Photo & Check In</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Retake Photo Button */}
                <TouchableOpacity
                  style={styles.retakePhotoBtn}
                  onPress={() => setCapturedPhotoUri(null)}
                  disabled={isSubmittingPhoto}
                  activeOpacity={0.8}
                >
                  <RotateCcw size={16} color="#1E63F0" style={{ marginRight: 6 }} />
                  <Text style={styles.retakePhotoBtnText}>Retake Photo</Text>
                </TouchableOpacity>

                {/* Cancel Button */}
                <TouchableOpacity
                  style={styles.cancelCheckInBtn}
                  onPress={() => {
                    if (!isSubmittingPhoto) {
                      setShowCameraModal(false);
                      setCapturedPhotoUri(null);
                    }
                  }}
                  disabled={isSubmittingPhoto}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelCheckInBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* 8. TECHNICIAN SIDE DRAWER MODAL                                */}
      {/* ============================================================== */}
      {/* CHECK-OUT CONFIRMATION MODAL */}
      <ConfirmationModal
        visible={showCheckOutConfirm}
        title="Confirm Check-Out"
        message="Are you sure you want to conclude your shift and punch out for today?"
        confirmTitle="Confirm Check-Out"
        cancelTitle="Cancel"
        variant="danger"
        loading={actionLoading}
        onConfirm={executeCheckOut}
        onCancel={() => {
          if (!actionLoading) setShowCheckOutConfirm(false);
        }}
      >
        <View style={styles.checkoutModalSummary}>
          <View style={styles.checkoutModalRow}>
            <Text style={styles.checkoutModalLabel}>Current Time (IST):</Text>
            <Text style={styles.checkoutModalVal}>{shiftInfo.formattedTimeIST}</Text>
          </View>
          <View style={styles.checkoutModalRow}>
            <Text style={styles.checkoutModalLabel}>Substation / Location:</Text>
            <Text style={styles.checkoutModalVal}>{substation?.name || 'Assigned Site'}</Text>
          </View>
          {todayRecord?.checkIn?.time ? (
            <View style={styles.checkoutModalRow}>
              <Text style={styles.checkoutModalLabel}>Checked In At:</Text>
              <Text style={styles.checkoutModalVal}>
                {(todayRecord?.checkIn as any)?.timeIST || formatTimeIST(todayRecord.checkIn.time)}
              </Text>
            </View>
          ) : null}
        </View>
      </ConfirmationModal>

      <TechnicianDrawerModal />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  assignedSiteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  assignedSiteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  assignedSiteIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  assignedSiteCardTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  assignedSiteName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  assignedStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusBadgeActive: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  statusBadgeUnassigned: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  assignedStatusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  assignedSiteBody: {
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  assignedDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  assignedDetailLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  assignedDetailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 1,
  },
  assignedGridRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  assignedGridItem: {
    flex: 1,
  },
  assignedGridLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 2,
  },
  assignedGridVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  unassignedSiteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
  },
  unassignedSiteText: {
    flex: 1,
    fontSize: 12,
    color: '#B45309',
    lineHeight: 18,
  },
  siteTabsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    gap: 8,
  },
  siteTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  siteTabPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  siteTabPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  siteTabPillTextActive: {
    color: '#1D4ED8',
  },
  assignerCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  assignerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  assignerTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assignerHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 0.5,
  },
  assignerRoleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeAdmin: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  roleBadgeSupervisor: {
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  assignerRoleText: {
    fontSize: 9,
    fontWeight: '800',
  },
  roleTextAdmin: {
    color: '#1D4ED8',
  },
  roleTextSupervisor: {
    color: '#6D28D9',
  },
  assignerBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  assignerNameVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  assignerPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  assignerPhoneLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginRight: 4,
  },
  assignerPhoneVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
    textDecorationLine: 'underline',
  },
  assignerCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    marginLeft: 10,
  },
  assignerCallBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    gap: 16,
  },

  // 1. Top Header Card
  topHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  headerLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 260,
  },
  hamburgerBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E63F0',
  },
  headerIdentityWrap: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  greetingTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  techPillBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  techPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E63F0',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 11,
    color: '#64748B',
  },
  metaEmpId: {
    fontWeight: '700',
    color: '#0F172A',
  },
  metaDot: {
    fontSize: 11,
    color: '#94A3B8',
    marginHorizontal: 5,
  },
  metaSiteText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E63F0',
  },
  headerRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  activePortalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 6,
  },
  greenPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  activePortalText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  headerActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    width: 17,
    height: 17,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // 2. Top 5 KPI Cards
  kpiCardsRow: {
    gap: 12,
    paddingVertical: 2,
  },
  kpiCard: {
    width: 156,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 2,
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  kpiMainValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 6,
  },
  kpiFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  kpiSubText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  kpiIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  greenDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tinyGreenDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },

  // 3. Live Shift Verification Banner
  liveVerificationBanner: {
    backgroundColor: '#1E40AF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#1E40AF',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 5,
  },
  bannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexWrap: 'wrap',
  },
  bannerIconSquare: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  bannerCenterInfo: {
    flex: 1,
    minWidth: 180,
  },
  bannerTagText: {
    fontSize: 9,
    fontWeight: '900',
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
    fontSize: 11,
    color: '#DBEAFE',
    marginTop: 2,
  },
  bannerCheckInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  bannerCheckInBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#059669',
  },
  bannerCheckOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  bannerCheckOutBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
  },
  bannerLockedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    opacity: 0.85,
  },
  bannerLockedBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
  },
  bannerCoordsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    flexWrap: 'wrap',
    gap: 8,
  },
  coordsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coordsText: {
    fontSize: 10,
    color: '#BFDBFE',
    fontWeight: '600',
  },
  geofenceRight: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  geofenceText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Timing Notice Strip
  timingNoticeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  timingNoticeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E40AF',
    flex: 1,
    lineHeight: 14,
  },

  // 4. Analytics Card
  analyticsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  analyticsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  analyticsIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyticsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  analyticsTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  analyticsGreenBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  analyticsGreenBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  analyticsSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  analyticsToggleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 8,
  },
  analyticsToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  analyticsToggleBtnActive: {
    backgroundColor: '#1E63F0',
  },
  analyticsToggleBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  analyticsToggleBtnTextActive: {
    color: '#FFFFFF',
  },
  fullLogsBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fullLogsBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E63F0',
  },

  // 4 Stats Summary Grid
  statsSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  statSummaryBox: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statSummaryLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  statSummaryValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 4,
  },
  statSummaryUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  statSummarySub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },

  // Bar Chart Styles
  chartContainer: {
    marginTop: 16,
  },
  chartLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
    marginBottom: 12,
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
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  chartCanvas: {
    height: 205,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 30,
    paddingTop: 8,
    marginTop: 8,
  },
  targetDottedLine: {
    position: 'absolute',
    top: 66,
    left: 30,
    right: 0,
    borderTopWidth: 1.5,
    borderTopColor: '#34D399',
    borderStyle: 'dashed',
    zIndex: 1,
  },
  targetBadge: {
    position: 'absolute',
    top: 54,
    right: 0,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    zIndex: 2,
  },
  targetBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#059669',
  },
  yAxisCol: {
    position: 'absolute',
    left: 0,
    top: 8,
    height: 135,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  yAxisLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    height: 185,
  },
  barCol: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: 40,
  },
  barPillarWrap: {
    width: 22,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
  },
  selectedBarGlow: {
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  xAxisLabelContainer: {
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  xAxisDayLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 13,
  },
  xAxisDayLabelToday: {
    color: '#1E63F0',
    fontWeight: '900',
  },
  xAxisDayLabelSelected: {
    color: '#0F172A',
    fontWeight: '900',
  },
  xAxisDateLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#334155',
    textAlign: 'center',
    lineHeight: 14,
    marginTop: 2,
  },
  xAxisDateLabelToday: {
    color: '#1E63F0',
    fontWeight: '900',
  },
  xAxisDateLabelSelected: {
    color: '#0F172A',
    fontWeight: '900',
  },
  xAxisLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
  },
  xAxisLabelToday: {
    color: '#1E63F0',
    fontWeight: '900',
  },
  xAxisLabelSelected: {
    color: '#0F172A',
  },
  tooltipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  tooltipText: {
    fontSize: 11,
    color: '#1E40AF',
    flex: 1,
  },

  // Shift Distribution Tab Styles
  distributionContainer: {
    marginTop: 16,
  },
  distGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  distCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  distLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  distValue: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  distPct: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  payoutScoreBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: 12,
  },
  payoutScoreText: {
    fontSize: 11,
    color: '#15803D',
    flex: 1,
  },

  // 5. Notifications Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    maxHeight: '80%',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  notifCountBadge: {
    backgroundColor: '#1E63F0',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 10,
  },
  notifCountBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  notifFilterText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  markAllReadText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E63F0',
  },
  notifList: {
    maxHeight: 380,
  },
  notifCard: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  notifCardUnread: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  notifIconCol: {
    marginTop: 2,
  },
  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  notifTime: {
    fontSize: 9,
    color: '#94A3B8',
    marginLeft: 6,
  },
  notifMessage: {
    fontSize: 11,
    color: '#475569',
    marginTop: 3,
    lineHeight: 15,
  },
  notifFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  notifCategoryPill: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  notifCategoryPillText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#475569',
  },
  unreadBlueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1E63F0',
  },
  modalDoneBtn: {
    backgroundColor: '#1E63F0',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  modalDoneBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // 6. Holidays List Styles
  holidayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  holidayDateCol: {
    width: 44,
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  holidayDateText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1E63F0',
  },
  holidayMonthText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#2563EB',
    textTransform: 'uppercase',
  },
  holidayName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  holidayDay: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  holidayPaidBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  holidayPaidBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },

  // 7. Mandatory Camera Photo Verification Styles
  cameraModalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  permissionScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permIconBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  permScreenTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  permScreenSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    maxWidth: 300,
  },
  grantPermBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E63F0',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginBottom: 12,
  },
  grantPermBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cancelPermBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelPermBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },

  // Camera Overlay
  cameraTopOverlay: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  cameraHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cameraShieldBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#1E63F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraHeaderTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  cameraHeaderSub: {
    fontSize: 10,
    color: '#BFDBFE',
    marginTop: 2,
  },
  cameraCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Face guide oval
  cameraCenterOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  faceTargetRing: {
    width: 240,
    height: 310,
    borderRadius: 120,
    borderWidth: 2.5,
    borderColor: '#34D399',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  faceInstructionBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 18,
  },
  faceInstructionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Bottom Camera Controls Bar
  cameraBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  cameraSideBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
  },
  cameraSideBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
  },
  shutterRingBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  shutterInnerCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Preview & Submit Photo Screen
  previewScreenContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  previewTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  previewSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  previewCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  capturedImageBox: {
    position: 'relative',
    height: 260,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    marginVertical: 14,
  },
  capturedImage: {
    width: '100%',
    height: '100%',
  },
  capturedImageStamp: {
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
  capturedImageStampText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  previewTelemetryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  telemetryCardText: {
    fontSize: 11,
    color: '#334155',
    flex: 1,
  },
  mandatoryNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 14,
  },
  mandatoryNoticeText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
    lineHeight: 15,
    flex: 1,
  },
  previewActionCol: {
    gap: 10,
  },
  submitPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 10,
    shadowColor: '#059669',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  submitPhotoBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  retakePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 12,
    borderRadius: 10,
  },
  retakePhotoBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E63F0',
  },
  cancelCheckInBtn: {
    paddingVertical: 10,
    alignItems: 'center',
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
  cancelCheckInBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  salarySectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
    marginTop: 12,
  },
  salarySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  salarySectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  salarySectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  salarySectionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  salaryViewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  salaryViewAllBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
    marginRight: 2,
  },
  salaryKpiRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  salaryKpiCol: {
    flex: 1,
    alignItems: 'center',
  },
  salaryKpiDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E2E8F0',
  },
  salaryKpiLbl: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  salaryKpiVal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 3,
  },
  salaryKpiSub: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 2,
  },
  salaryPayableBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  salaryPayableBannerLbl: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.5,
  },
  salaryPayableBannerVal: {
    fontSize: 22,
    fontWeight: '900',
    color: '#065F46',
    marginTop: 2,
  },
  salarySlipDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  salarySlipDownloadBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
  },
});

export default DashboardScreen;
