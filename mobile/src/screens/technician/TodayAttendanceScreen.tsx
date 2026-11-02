import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  useWindowDimensions,
  Modal,
  Alert,
  Platform,
  Image,
} from 'react-native';
import {
  ArrowLeft,
  Calendar,
  Building2,
  MapPin,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  FileText,
  X,
  ShieldCheck,
  Check,
  Camera,
} from 'lucide-react-native';
import { useAttendanceStore } from '../../store/useAttendanceStore';
import { useAuthStore } from '../../store/useAuthStore';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { resolvePhotoUrl } from '../../utils/imageUrl';
import * as Sharing from 'expo-sharing';
import { Paths, File as ExpoFile } from 'expo-file-system';
import { Linking } from 'react-native';
import { apiClient } from '../../services/api';
import { holidayService, HolidayItem } from '../../services/holidayService';
import { formatTimeIST } from '../../utils/shiftUtils';
import { AppBackButton } from '../../components/common/AppBackButton';

interface TodayAttendanceScreenProps {
  navigation: any;
}

// 2026 Adani Gazetted Holidays List
const ADANI_HOLIDAYS_2026 = [
  { date: '26 Jan 2026', day: 'Monday', name: 'Republic Day', type: 'National Holiday' },
  { date: '04 Mar 2026', day: 'Wednesday', name: 'Maha Shivratri', type: 'Gazetted' },
  { date: '25 Mar 2026', day: 'Wednesday', name: 'Holi', type: 'Gazetted' },
  { date: '31 Mar 2026', day: 'Tuesday', name: 'Id-ul-Fitr', type: 'Gazetted' },
  { date: '14 Apr 2026', day: 'Tuesday', name: 'Dr. Ambedkar Jayanti', type: 'Gazetted' },
  { date: '01 May 2026', day: 'Friday', name: 'Maharashtra / May Day', type: 'Regional' },
  { date: '15 Aug 2026', day: 'Saturday', name: 'Independence Day', type: 'National Holiday' },
  { date: '04 Sep 2026', day: 'Friday', name: 'Janmashtami', type: 'Gazetted' },
  { date: '02 Oct 2026', day: 'Friday', name: 'Mahatma Gandhi Jayanti', type: 'National Holiday' },
  { date: '20 Oct 2026', day: 'Tuesday', name: 'Dussehra (Vijayadashami)', type: 'Gazetted' },
  { date: '08 Nov 2026', day: 'Sunday', name: 'Diwali (Deepavali)', type: 'Gazetted' },
  { date: '25 Dec 2026', day: 'Friday', name: 'Christmas Day', type: 'Gazetted' },
];

export const TodayAttendanceScreen: React.FC<TodayAttendanceScreenProps> = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const isWide = width >= 860;

  const { user } = useAuthStore();
  const {
    todayStatus,
    todayRecord,
    assignedSite,
    liveElapsedSeconds,
    fetchTodayAttendance,
    isLoading,
  } = useAttendanceStore();

  const [refreshing, setRefreshing] = useState(false);
  const [showHolidaysModal, setShowHolidaysModal] = useState(false);
  const [downloadingHolidays, setDownloadingHolidays] = useState(false);
  const [holidaysList, setHolidaysList] = useState<HolidayItem[]>([]);

  useEffect(() => {
    holidayService.getHolidays(2026).then((data) => {
      if (data && data.length > 0) setHolidaysList(data);
    }).catch(() => {});
  }, []);

  const handleDownloadHolidaysPdf = async () => {
    setDownloadingHolidays(true);
    try {
      const url = `${apiClient.defaults.baseURL}/dashboard/holidays/pdf?year=2026`;
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
        setDownloadingHolidays(false);
        return;
      }
      const filename = 'Adani_Energy_Holidays_2026.pdf';
      const destination = new ExpoFile(Paths.document, filename);
      const downloadedFile = await ExpoFile.downloadFileAsync(url, destination);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(downloadedFile.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Adani Energy Holidays 2026 Calendar',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Calendar Downloaded', 'Adani_Energy_Holidays_2026.pdf saved to device documents.');
      }
    } catch (err: any) {
      console.warn('Holidays PDF download error:', err);
      try {
        await Linking.openURL(`${apiClient.defaults.baseURL}/dashboard/holidays/pdf?year=2026`);
      } catch (e) {
        Alert.alert('Notice', 'Adani Holidays calendar is cached and available.');
      }
    } finally {
      setDownloadingHolidays(false);
    }
  };

  useEffect(() => {
    fetchTodayAttendance();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTodayAttendance();
    setRefreshing(false);
  };

  // Strictly verify whether today's record belongs to the logged-in user
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

  const effectiveRecord = isRecordForCurrentUser ? todayRecord : null;
  const effectiveStatus = isRecordForCurrentUser ? todayStatus : 'not_started';

  // CheckIn & CheckOut objects
  const checkIn = effectiveRecord?.checkIn;
  const checkOut = effectiveRecord?.checkOut;

  // Format punch times to 12-hour AM/PM format (IST)
  const checkInTime = (checkIn as any)?.timeIST || formatTimeIST(checkIn?.time);
  const checkOutTime = checkOut ? ((checkOut as any)?.timeIST || formatTimeIST(checkOut.time)) : '--:--';

  // Format Working Hours (e.g., "7h 46m")
  const formattedHours = useMemo(() => {
    if (!isRecordForCurrentUser || (!effectiveRecord && effectiveStatus === 'not_started')) {
      return '--';
    }
    if (effectiveStatus === 'active' && liveElapsedSeconds > 0) {
      const h = Math.floor(liveElapsedSeconds / 3600);
      const m = Math.floor((liveElapsedSeconds % 3600) / 60);
      return `${h}h ${m < 10 ? '0' : ''}${m}m`;
    }
    const minutes = effectiveRecord?.workingMinutes;
    if (minutes !== undefined && minutes !== null && minutes > 0) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${h}h ${m < 10 ? '0' : ''}${m}m`;
    }
    if (effectiveRecord?.workingHoursFormatted) {
      return effectiveRecord.workingHoursFormatted
        .replace(' hrs', 'h')
        .replace(' mins', 'm')
        .replace(' hr', 'h')
        .replace(' min', 'm');
    }
    return '0h 00m';
  }, [effectiveRecord, effectiveStatus, liveElapsedSeconds, isRecordForCurrentUser]);

  // Determine status color theme
  const statusMeta = useMemo(() => {
    if (!effectiveRecord && effectiveStatus === 'not_started') {
      return {
        label: 'Not Checked In',
        bg: '#64748B',
        badgeBg: '#F1F5F9',
        badgeBorder: '#CBD5E1',
        badgeText: '#475569',
        isLate: false,
      };
    }
    const rawStatus = (effectiveRecord?.status || '').toLowerCase().replace('-', '_');
    if (rawStatus === 'half_day') {
      return {
        label: 'Half Day',
        bg: '#D97706', // Vibrant amber/orange
        badgeBg: '#FEF3C7',
        badgeBorder: '#F59E0B',
        badgeText: '#B45309',
        isLate: true,
      };
    }
    if (rawStatus === 'late') {
      return {
        label: 'Late',
        bg: '#D97706', // Vibrant amber/orange
        badgeBg: '#FEF3C7',
        badgeBorder: '#F59E0B',
        badgeText: '#B45309',
        isLate: true,
      };
    }
    if (effectiveStatus === 'active' || (!checkOut && checkIn)) {
      return {
        label: 'Shift Active',
        bg: '#1E63F0',
        badgeBg: '#DBEAFE',
        badgeBorder: '#3B82F6',
        badgeText: '#1D4ED8',
        isLate: false,
      };
    }
    if (rawStatus === 'present' || rawStatus === 'on_time') {
      return {
        label: 'Present',
        bg: '#16A34A',
        badgeBg: '#DCFCE7',
        badgeBorder: '#22C55E',
        badgeText: '#15803D',
        isLate: false,
      };
    }
    return {
      label: 'Absent',
      bg: '#DC2626',
      badgeBg: '#FEE2E2',
      badgeBorder: '#EF4444',
      badgeText: '#B91C1C',
      isLate: true,
    };
  }, [effectiveRecord, effectiveStatus, checkOut, checkIn]);

  // Date and site names
  const recordDate = effectiveRecord?.date || new Date().toISOString().split('T')[0];
  const siteName =
    assignedSite?.name ||
    effectiveRecord?.siteName ||
    'st. joseph university';

  // Coordinates
  const checkInCoords = checkIn?.latitude && checkIn?.longitude
    ? `${checkIn.latitude.toFixed(6)}, ${checkIn.longitude.toFixed(6)}`
    : '--';

  const checkOutCoords = checkOut?.latitude && checkOut?.longitude
    ? `${checkOut.latitude.toFixed(6)}, ${checkOut.longitude.toFixed(6)}`
    : '--';

  // Supervisor / Admin note
  const adminNote =
    effectiveRecord?.adminRemarks ||
    (checkOut?.remarks ? checkOut.remarks : effectiveRecord ? 'Auto-checked out at 06:00 PM (Shift End)' : 'No shift notes for today');

  if (isLoading && !effectiveRecord) {
    return <LoadingSpinner message="Loading attendance status..." />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1E63F0']} />
        }
      >
        {/* ======================================================== */}
        {/* TOP HEADER SECTION */}
        {/* ======================================================== */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <AppBackButton />
            <View>
              <Text style={styles.headerTitle}>Today's Attendance Status</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity delayPressIn={0}
              style={styles.pillButton}
              onPress={() => setShowHolidaysModal(true)}
              activeOpacity={0.7}
            >
              <Calendar size={15} color="#1E63F0" />
              <Text style={styles.pillButtonTextBlue}>Holidays 2026 (PDF)</Text>
            </TouchableOpacity>

            <TouchableOpacity delayPressIn={0}
              style={styles.pillButton}
              onPress={() => navigation.navigate('History')}
              activeOpacity={0.7}
            >
              <Text style={styles.pillButtonTextDark}>View Full History</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ======================================================== */}
        {/* MAIN RESPONSIVE CONTENT GRID */}
        {/* ======================================================== */}
        <View style={[styles.gridContainer, isWide ? styles.gridRow : styles.gridColumn]}>
          {/* ------------------------------------------------------ */}
          {/* LEFT COLUMN: HERO STATUS + ADMIN NOTE + AUDIT TABLE */}
          {/* ------------------------------------------------------ */}
          <View style={isWide ? styles.columnLeft : styles.columnFull}>
            {/* 1. Hero Status Card (Late / Present / Active) */}
            <View style={[styles.heroCard, { backgroundColor: statusMeta.bg }]}>
              <View style={styles.heroRow}>
                <View style={styles.heroIconBadge}>
                  {statusMeta.isLate ? (
                    <AlertCircle size={28} color="#FFFFFF" strokeWidth={2.5} />
                  ) : (
                    <CheckCircle2 size={28} color="#FFFFFF" strokeWidth={2.5} />
                  )}
                </View>
                <View style={styles.heroTextContent}>
                  <Text style={styles.heroTitle}>{statusMeta.label}</Text>
                  <Text style={styles.heroTimeLine}>
                    Checked In: {checkInTime}
                  </Text>
                  <Text style={styles.heroTimeLine}>
                    Checked Out: {checkOutTime}
                  </Text>
                  <View style={styles.heroPillBadge}>
                    <Text style={styles.heroPillText}>
                      Hours Worked:  {formattedHours}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 2. Supervisor / Admin Attendance Note */}
            <View style={styles.adminNoteBanner}>
              <AlertCircle size={18} color="#D97706" style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.adminNoteTitle}>
                  Supervisor / Admin Attendance Note
                </Text>
                <Text style={styles.adminNoteBody}>{adminNote}</Text>
              </View>
            </View>

            {/* 3. Detailed Shift Audit Table Card */}
            <View style={styles.tableCard}>
              {/* Row 1: Date */}
              <View style={styles.tableRow}>
                <View style={styles.tableRowLabelGroup}>
                  <Calendar size={18} color="#64748B" />
                  <Text style={styles.tableRowLabel}>Date</Text>
                </View>
                <Text style={styles.tableRowValueBold}>{recordDate}</Text>
              </View>

              {/* Row 2: Substation Site */}
              <View style={styles.tableRow}>
                <View style={styles.tableRowLabelGroup}>
                  <Building2 size={18} color="#64748B" />
                  <Text style={styles.tableRowLabel}>Substation Site</Text>
                </View>
                <Text style={styles.tableRowValueBold}>{siteName}</Text>
              </View>

              {/* Row 3: Location (Check In) */}
              <View style={styles.tableRow}>
                <View style={styles.tableRowLabelGroup}>
                  <Navigation size={18} color="#10B981" />
                  <Text style={styles.tableRowLabel}>Location (Check In)</Text>
                </View>
                <Text style={styles.tableRowCoordinates}>{checkInCoords}</Text>
              </View>

              {/* Row 4: Location (Check Out) */}
              <View style={styles.tableRow}>
                <View style={styles.tableRowLabelGroup}>
                  <MapPin size={18} color="#3B82F6" />
                  <Text style={styles.tableRowLabel}>Location (Check Out)</Text>
                </View>
                <Text style={styles.tableRowCoordinates}>{checkOutCoords}</Text>
              </View>

              {/* Row 5: Status Badge */}
              <View style={styles.tableRow}>
                <View style={styles.tableRowLabelGroup}>
                  <CheckCircle2 size={18} color="#64748B" />
                  <Text style={styles.tableRowLabel}>Status</Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: statusMeta.badgeBg,
                      borderColor: statusMeta.badgeBorder,
                    },
                  ]}
                >
                  {statusMeta.isLate ? (
                    <AlertCircle size={12} color={statusMeta.badgeText} />
                  ) : (
                    <Check size={12} color={statusMeta.badgeText} />
                  )}
                  <Text style={[styles.statusPillText, { color: statusMeta.badgeText }]}>
                    {statusMeta.label}
                  </Text>
                </View>
              </View>

              {/* Row 6: Working Hours */}
              <View style={[styles.tableRow, !checkIn?.photoUrl && styles.tableRowLast]}>
                <View style={styles.tableRowLabelGroup}>
                  <Clock size={18} color="#3B82F6" />
                  <Text style={styles.tableRowLabel}>Working Hours</Text>
                </View>
                <Text style={styles.tableRowValueBlue}>{formattedHours}</Text>
              </View>

              {/* Row 7: Check-In Photo (if uploaded) */}
              {checkIn?.photoUrl ? (
                <View style={[styles.tableRow, styles.tableRowLast, { paddingTop: 12 }]}>
                  <View style={styles.tableRowLabelGroup}>
                    <Camera size={18} color="#1E63F0" />
                    <Text style={styles.tableRowLabel}>Check-In Photo</Text>
                  </View>
                  <View style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', borderWidth: 1.5, borderColor: '#38BDF8' }}>
                    <Image
                      source={{ uri: resolvePhotoUrl(checkIn.photoUrl) }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                  </View>
                </View>
              ) : null}
            </View>
          </View>

          {/* ------------------------------------------------------ */}
          {/* RIGHT COLUMN: SHIFT TIMELINE + QUICK ACTIONS */}
          {/* ------------------------------------------------------ */}
          <View style={isWide ? styles.columnRight : styles.columnFull}>
            {/* 1. SHIFT TIMELINE CARD */}
            <View style={styles.sideCard}>
              <Text style={styles.sideCardTitle}>SHIFT TIMELINE</Text>

              {/* Check-In Step */}
              <View style={styles.timelineRow}>
                <View style={styles.timelineDotGreen} />
                <View style={styles.timelineTextGroup}>
                  <Text style={styles.timelineStepTitle}>Shift Started (Checked In)</Text>
                  <Text style={styles.timelineStepSubtitle}>
                    {checkInTime} • {siteName}
                  </Text>
                  <Text style={styles.timelineCoordsGreen}>{checkInCoords}</Text>
                </View>
              </View>

              {/* Connecting Line */}
              <View style={styles.timelineConnector} />

              {/* Check-Out Step */}
              <View style={styles.timelineRow}>
                <View
                  style={[
                    styles.timelineDotRed,
                    !checkOut && { backgroundColor: '#94A3B8' },
                  ]}
                />
                <View style={styles.timelineTextGroup}>
                  <Text style={styles.timelineStepTitle}>
                    {checkOut ? 'Shift Finalized (Checked Out)' : 'Shift In Progress'}
                  </Text>
                  <Text style={styles.timelineStepSubtitle}>
                    {checkOut
                      ? `${checkOutTime} • ${siteName}`
                      : 'Shift active • Awaiting departure punch'}
                  </Text>
                  {checkOut && checkOutCoords !== '--' && (
                    <Text style={styles.timelineCoordsBlue}>{checkOutCoords}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* 2. QUICK ACTIONS CARD */}
            <View style={styles.sideCard}>
              <Text style={styles.sideCardTitle}>QUICK ACTIONS</Text>

              <TouchableOpacity delayPressIn={0}
                style={styles.primaryActionButton}
                onPress={() => {
                  if (checkIn && !checkOut) {
                    navigation.navigate('CheckOut');
                  } else if (!checkIn) {
                    navigation.navigate('CheckIn');
                  } else {
                    navigation.navigate('CheckOut');
                  }
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryActionButtonText}>Go to Shift Check-Out</Text>
              </TouchableOpacity>

              <TouchableOpacity delayPressIn={0}
                style={styles.secondaryActionButton}
                onPress={() => setShowHolidaysModal(true)}
                activeOpacity={0.7}
              >
                <Download size={16} color="#1E293B" />
                <Text style={styles.secondaryActionButtonText}>
                  Holiday Calendar 2026 (PDF)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ======================================================== */}
      {/* 2026 GAZETTED HOLIDAYS MODAL */}
      {/* ======================================================== */}
      <Modal
        visible={showHolidaysModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHolidaysModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Calendar size={20} color="#1E63F0" />
                <Text style={styles.modalTitle}>Adani Gazetted Holidays 2026</Text>
              </View>
              <TouchableOpacity delayPressIn={0}
                onPress={() => setShowHolidaysModal(false)}
                style={styles.modalCloseBtn}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.modalNotice}>
                Official corporate holiday calendar approved for Adani Energy Solutions & Smart Meter Workforce.
              </Text>

              {(holidaysList.length > 0
                ? holidaysList.map((h) => {
                    const parts = (h.date || '').split('-');
                    const dt = new Date((h.date || '2026-01-01') + 'T00:00:00');
                    const mName = dt.toLocaleDateString('en-US', { month: 'short' });
                    return {
                      date: `${parts[2] || '01'} ${mName} ${parts[0] || '2026'}`,
                      day: h.day || 'Day',
                      name: h.name,
                      type: h.type || 'Gazetted',
                    };
                  })
                : ADANI_HOLIDAYS_2026
              ).map((item, idx) => (
                <View key={idx} style={styles.holidayRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.holidayName}>{item.name}</Text>
                    <Text style={styles.holidayMeta}>
                      {item.day} • {item.type}
                    </Text>
                  </View>
                  <View style={styles.holidayDateBadge}>
                    <Text style={styles.holidayDateText}>{item.date}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity delayPressIn={0}
                style={[styles.modalDownloadBtn, downloadingHolidays && { opacity: 0.75 }]}
                onPress={handleDownloadHolidaysPdf}
                disabled={downloadingHolidays}
              >
                <Download size={16} color="#FFFFFF" />
                <Text style={styles.modalDownloadText}>
                  {downloadingHolidays ? 'Downloading Calendar...' : 'Download Calendar (PDF)'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ============================================================
// STYLES - PIXEL PERFECT DESIGN FROM REFERENCE SCREENSHOT
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 48,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  pillButtonTextBlue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E63F0',
  },
  pillButtonTextDark: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },

  // Grid Layout
  gridContainer: {
    width: '100%',
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
  },
  gridColumn: {
    flexDirection: 'column',
    gap: 20,
  },
  columnLeft: {
    flex: 1.45,
  },
  columnRight: {
    flex: 1,
  },
  columnFull: {
    width: '100%',
  },

  // Hero Card
  heroCard: {
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 18,
  },
  heroIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTextContent: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  heroTimeLine: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  heroPillBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  heroPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // Admin Note Banner
  adminNoteBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  adminNoteTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  adminNoteBody: {
    fontSize: 13,
    fontWeight: '500',
    color: '#B45309',
    marginTop: 2,
  },

  // Audit Table Card
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 20,
    marginTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableRowLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tableRowLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
  },
  tableRowValueBold: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  tableRowCoordinates: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    fontVariant: ['tabular-nums'],
  },
  tableRowValueBlue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E63F0',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Side Cards (Shift Timeline & Quick Actions)
  sideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  sideCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 16,
  },

  // Timeline
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  timelineDotGreen: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    marginTop: 3,
  },
  timelineDotRed: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#EF4444',
    marginTop: 3,
  },
  timelineConnector: {
    width: 2,
    height: 36,
    backgroundColor: '#E2E8F0',
    marginLeft: 6,
    marginVertical: 4,
  },
  timelineTextGroup: {
    flex: 1,
  },
  timelineStepTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  timelineStepSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  timelineCoordsGreen: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  timelineCoordsBlue: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '600',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },

  // Quick Action Buttons
  primaryActionButton: {
    backgroundColor: '#1E63F0',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#1E63F0',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  primaryActionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 10,
  },
  secondaryActionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalScroll: {
    marginVertical: 14,
  },
  modalNotice: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 18,
  },
  holidayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  holidayName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  holidayMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  holidayDateBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  holidayDateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E63F0',
  },
  modalFooter: {
    paddingTop: 10,
  },
  modalDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E63F0',
    borderRadius: 12,
    paddingVertical: 14,
  },
  modalDownloadText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
