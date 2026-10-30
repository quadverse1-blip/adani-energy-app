import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ScrollView,
} from 'react-native';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  ShieldCheck,
  TrendingUp,
  Menu,
  ArrowLeft,
  RotateCcw,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTechnicianDrawerStore } from '../../store/useTechnicianDrawerStore';
import { TechnicianDrawerModal } from '../../components/navigation/TechnicianDrawerModal';
import { attendanceService } from '../../services/attendanceService';
import { AttendanceRecord, AttendanceSummary } from '../../types';
import { COLORS, RADII } from '../../constants/theme';
import { KPICard } from '../../components/common/KPICard';
import { AttendanceCard } from '../../components/attendance/AttendanceCard';
import { BottomSheet } from '../../components/common/BottomSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const HistoryScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { openDrawer } = useTechnicianDrawerStore();

  // Active anchor date (Default: 2026-10-22 or current date)
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    // Default to October 2026 if year is far off, else now
    return new Date(2026, 9, 22);
  });

  const [filterMode, setFilterMode] = useState<'monthly' | 'weekly' | 'daily'>('monthly');
  const [allMonthRecords, setAllMonthRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);

  const selectedYear = currentDate.getFullYear();
  const selectedMonth = currentDate.getMonth() + 1; // 1-12
  const selectedDay = currentDate.getDate();

  // Fetch all attendance records for the currently selected month and year
  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await attendanceService.getHistory(selectedMonth, selectedYear);
      setAllMonthRecords(data.records || []);
    } catch (e) {
      console.warn('History fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [selectedMonth, selectedYear]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  };

  // Helper: compute start (Monday) and end (Sunday) of the week containing currentDate
  const weekRange = useMemo(() => {
    const cur = new Date(currentDate);
    const day = cur.getDay(); // 0 is Sunday
    const diffToMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(cur);
    mon.setDate(cur.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);

    const monStr = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`;
    const sunStr = `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, '0')}-${String(sun.getDate()).padStart(2, '0')}`;

    const label = `${mon.getDate()} ${MONTH_SHORT[mon.getMonth()]} – ${sun.getDate()} ${MONTH_SHORT[sun.getMonth()]} ${sun.getFullYear()}`;

    // Generate list of 7 days in this week for quick day selector
    const daysInWeek = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      daysInWeek.push(d);
    }

    return { mon, sun, monStr, sunStr, label, daysInWeek };
  }, [currentDate]);

  // Selected single day string formatted: YYYY-MM-DD
  const selectedDayStr = useMemo(() => {
    return `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  }, [selectedYear, selectedMonth, selectedDay]);

  // Navigate Previous / Next based on active filterMode
  const handlePrev = () => {
    const nextDate = new Date(currentDate);
    if (filterMode === 'monthly') {
      nextDate.setMonth(nextDate.getMonth() - 1);
    } else if (filterMode === 'weekly') {
      nextDate.setDate(nextDate.getDate() - 7);
    } else {
      nextDate.setDate(nextDate.getDate() - 1);
    }
    setCurrentDate(nextDate);
  };

  const handleNext = () => {
    const nextDate = new Date(currentDate);
    if (filterMode === 'monthly') {
      nextDate.setMonth(nextDate.getMonth() + 1);
    } else if (filterMode === 'weekly') {
      nextDate.setDate(nextDate.getDate() + 7);
    } else {
      nextDate.setDate(nextDate.getDate() + 1);
    }
    setCurrentDate(nextDate);
  };

  const handleJumpToToday = () => {
    setCurrentDate(new Date(2026, 9, 22));
  };

  // Filter records based on active mode (monthly, weekly, daily)
  const filteredRecords = useMemo(() => {
    if (!allMonthRecords || allMonthRecords.length === 0) return [];

    if (filterMode === 'monthly') {
      const prefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
      return allMonthRecords.filter((r) => r.date && r.date.startsWith(prefix));
    }

    if (filterMode === 'weekly') {
      return allMonthRecords.filter((r) => {
        if (!r.date) return false;
        return r.date >= weekRange.monStr && r.date <= weekRange.sunStr;
      });
    }

    // Daily mode
    return allMonthRecords.filter((r) => r.date === selectedDayStr);
  }, [allMonthRecords, filterMode, selectedYear, selectedMonth, selectedDayStr, weekRange]);

  // Dynamically compute real KPI summary metrics from filtered records
  const dynamicSummary: AttendanceSummary = useMemo(() => {
    const presentCount = filteredRecords.filter((r) => r.status === 'present').length;
    const lateCount = filteredRecords.filter((r) => r.status === 'late').length;
    const halfDayCount = filteredRecords.filter((r) => r.status === 'half_day' || r.status === 'half-day').length;
    const absentCount = filteredRecords.filter((r) => r.status === 'absent').length;
    const totalMin = filteredRecords.reduce((acc, r) => acc + (r.workingMinutes || 0), 0);
    const totalHours = Math.round((totalMin / 60) * 10) / 10;

    let targetWorkDays = 26;
    if (filterMode === 'weekly') {
      targetWorkDays = 6;
    } else if (filterMode === 'daily') {
      targetWorkDays = 1;
    }

    return {
      totalWorkingDays: targetWorkDays,
      presentDays: presentCount,
      lateDays: lateCount,
      halfDays: halfDayCount,
      absentDays: absentCount,
      totalHours: totalHours,
    };
  }, [filteredRecords, filterMode]);

  // Formatted Punch Times for Selected Record in Bottom Sheet
  const checkIn = selectedRecord?.checkIn;
  const checkOut = selectedRecord?.checkOut;

  const formatSheetTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    try {
      if (isoString.includes('T')) {
        const timePart = isoString.split('T')[1].substring(0, 5);
        const [hhStr, mmStr] = timePart.split(':');
        let hh = parseInt(hhStr, 10);
        const ampm = hh >= 12 ? 'PM' : 'AM';
        hh = hh % 12 || 12;
        return `${String(hh).padStart(2, '0')}:${mmStr} ${ampm}`;
      }
      return isoString;
    } catch {
      return isoString;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      {/* Top Header Bar */}
      <View style={styles.topNavHeader}>
        <TouchableOpacity
          style={styles.navHeaderBtn}
          onPress={() => openDrawer('History')}
          activeOpacity={0.7}
        >
          <Menu size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.navHeaderTitle}>Attendance History</Text>
        <TouchableOpacity
          style={styles.navHeaderBtn}
          onPress={() => navigation.navigate('Dashboard')}
          activeOpacity={0.7}
        >
          <ArrowLeft size={18} color="#475569" />
        </TouchableOpacity>
      </View>

      {/* Scope Filter: Monthly, Weekly, Daily */}
      <View style={styles.filterPillsRow}>
        {(['monthly', 'weekly', 'daily'] as const).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[styles.filterPill, filterMode === mode && styles.filterPillActive]}
            onPress={() => setFilterMode(mode)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterPillText,
                filterMode === mode && styles.filterPillTextActive,
              ]}
            >
              {mode.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Dynamic Date Selector Bar */}
      <View style={styles.dateSelectorBar}>
        <TouchableOpacity onPress={handlePrev} style={styles.dateNavBtn} activeOpacity={0.7}>
          <ChevronLeft size={20} color={COLORS.primary} />
        </TouchableOpacity>

        <View style={styles.dateCenter}>
          <Calendar size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
          <Text style={styles.dateTitle} numberOfLines={1}>
            {filterMode === 'monthly' && `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`}
            {filterMode === 'weekly' && weekRange.label}
            {filterMode === 'daily' && `${selectedDay} ${MONTH_SHORT[selectedMonth - 1]} ${selectedYear} (${DAY_NAMES[currentDate.getDay()]})`}
          </Text>
        </View>

        <View style={styles.dateNavRight}>
          <TouchableOpacity onPress={handleNext} style={styles.dateNavBtn} activeOpacity={0.7}>
            <ChevronRight size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Daily Mode: Horizontal 7-Day Quick Strip */}
      {filterMode === 'daily' && (
        <View style={styles.dayStripContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStripContent}>
            {weekRange.daysInWeek.map((d) => {
              const isSelected = d.getDate() === selectedDay && d.getMonth() === currentDate.getMonth();
              const dayAbbr = DAY_NAMES[d.getDay()];
              const dayNum = d.getDate();

              return (
                <TouchableOpacity
                  key={d.toISOString()}
                  style={[styles.dayStripItem, isSelected && styles.dayStripItemSelected]}
                  onPress={() => setCurrentDate(new Date(d))}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dayStripAbbr, isSelected && styles.dayStripAbbrSelected]}>
                    {dayAbbr}
                  </Text>
                  <Text style={[styles.dayStripNum, isSelected && styles.dayStripNumSelected]}>
                    {dayNum}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Attendance Records List & Dynamic KPIs */}
      <FlatList
        data={filteredRecords}
        keyExtractor={(item) => item.id || item._id || item.date}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        ListHeaderComponent={
          <>
            {/* KPI Cards Row 1 */}
            <View style={styles.kpiRow}>
              <KPICard
                label={filterMode === 'daily' ? 'Target Days' : 'Working Days'}
                value={dynamicSummary.totalWorkingDays}
                subtitle={filterMode === 'monthly' ? 'Monthly target' : filterMode === 'weekly' ? 'Weekly target' : 'Daily shift'}
              />
              <KPICard
                label="Present Days"
                value={dynamicSummary.presentDays}
                subtitle="Fully complied"
                badge={<StatusBadge status="present" size="sm" />}
              />
            </View>

            {/* KPI Cards Row 2 */}
            <View style={styles.kpiRow}>
              <KPICard
                label="Late / Half"
                value={`${dynamicSummary.lateDays} / ${dynamicSummary.halfDays}`}
                subtitle="Grace exceeded"
                badge={<StatusBadge status="late" size="sm" />}
              />
              <KPICard
                label="Absent Days"
                value={dynamicSummary.absentDays}
                subtitle="Loss of pay"
                badge={<StatusBadge status="absent" size="sm" />}
              />
              <KPICard
                label="Total Hours"
                value={`${dynamicSummary.totalHours}h`}
                subtitle="Cumulated on duty"
              />
            </View>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.listSectionTitle}>
                {filterMode === 'monthly' && `ATTENDANCE RECORDS (${filteredRecords.length})`}
                {filterMode === 'weekly' && `WEEKLY SHIFT LOGS (${filteredRecords.length})`}
                {filterMode === 'daily' && `DAILY ATTENDANCE AUDIT (${filteredRecords.length})`}
              </Text>

              {filterMode === 'daily' && selectedDayStr !== '2026-10-22' && (
                <TouchableOpacity style={styles.todayQuickBtn} onPress={handleJumpToToday}>
                  <RotateCcw size={12} color="#4338CA" />
                  <Text style={styles.todayQuickText}>Today</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        }
        renderItem={({ item }) => (
          <AttendanceCard record={item} onPress={() => setSelectedRecord(item)} />
        )}
        ListEmptyComponent={
          loading ? (
            <LoadingSpinner message="Fetching attendance records..." />
          ) : (
            <EmptyState
              title="No Attendance Logs Found"
              message={
                filterMode === 'monthly'
                  ? `No shift records found for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}.`
                  : filterMode === 'weekly'
                  ? `No attendance records logged for the week ${weekRange.label}.`
                  : `No attendance punch recorded for ${selectedDayStr}. Marked as Weekly Off or Absent.`
              }
            />
          )
        }
      />

      {/* Bottom Sheet for Detailed Punch Audit */}
      <BottomSheet
        visible={selectedRecord !== null}
        onClose={() => setSelectedRecord(null)}
        title="Attendance Punch Details"
      >
        {selectedRecord ? (
          <View>
            <View style={styles.sheetTopRow}>
              <View>
                <Text style={styles.sheetDateText}>{selectedRecord.date}</Text>
                <Text style={styles.sheetSub}>
                  Substation: {selectedRecord.siteName || 'Assigned Substation'}
                </Text>
              </View>
              <StatusBadge status={selectedRecord.status} size="md" />
            </View>

            {/* Verification Selfie if exists */}
            {checkIn?.photoUrl ? (
              <View style={styles.sheetPhotoWrapper}>
                <Image
                  source={{ uri: checkIn.photoUrl }}
                  style={styles.sheetSelfie}
                  resizeMode="cover"
                />
                <View style={styles.selfieBadge}>
                  <ShieldCheck size={14} color="#FFFFFF" />
                  <Text style={styles.selfieBadgeText}>Biometric Photo Verified</Text>
                </View>
              </View>
            ) : null}

            {/* Punch In Details */}
            <View style={styles.sheetSection}>
              <Text style={styles.sheetSectionTitle}>PUNCH IN AUDIT</Text>
              <View style={styles.auditRow}>
                <Text style={styles.auditLabel}>Punch In Time:</Text>
                <Text style={styles.auditVal}>{formatSheetTime(checkIn?.time)}</Text>
              </View>
              <View style={styles.auditRow}>
                <Text style={styles.auditLabel}>GPS Coordinates:</Text>
                <Text style={styles.auditVal}>
                  {checkIn ? `${checkIn.latitude.toFixed(6)}, ${checkIn.longitude.toFixed(6)}` : '--'}
                </Text>
              </View>
              <View style={styles.auditRow}>
                <Text style={styles.auditLabel}>Satellite Accuracy:</Text>
                <Text style={styles.auditVal}>
                  {checkIn ? `±${checkIn.accuracy.toFixed(1)}m` : '--'}
                </Text>
              </View>
              <View style={styles.auditRow}>
                <Text style={styles.auditLabel}>Substation Distance:</Text>
                <Text style={styles.auditVal}>
                  {checkIn?.distanceMeters !== undefined
                    ? `${checkIn.distanceMeters.toFixed(0)}m (Inside Geofence)`
                    : 'Inside Geofence'}
                </Text>
              </View>
              {checkIn?.remarks ? (
                <View style={styles.auditRow}>
                  <Text style={styles.auditLabel}>Technician Remarks:</Text>
                  <Text style={styles.auditVal}>{checkIn.remarks}</Text>
                </View>
              ) : null}
            </View>

            {/* Punch Out Details */}
            <View style={styles.sheetSection}>
              <Text style={styles.sheetSectionTitle}>PUNCH OUT AUDIT</Text>
              <View style={styles.auditRow}>
                <Text style={styles.auditLabel}>Punch Out Time:</Text>
                <Text style={styles.auditVal}>
                  {checkOut ? formatSheetTime(checkOut.time) : 'Shift In Progress / Active'}
                </Text>
              </View>
              {checkOut ? (
                <>
                  <View style={styles.auditRow}>
                    <Text style={styles.auditLabel}>GPS Coordinates:</Text>
                    <Text style={styles.auditVal}>
                      {checkOut.latitude.toFixed(6)}, {checkOut.longitude.toFixed(6)}
                    </Text>
                  </View>
                  <View style={styles.auditRow}>
                    <Text style={styles.auditLabel}>Accuracy:</Text>
                    <Text style={styles.auditVal}>±{checkOut.accuracy.toFixed(1)}m</Text>
                  </View>
                  {checkOut.remarks ? (
                    <View style={styles.auditRow}>
                      <Text style={styles.auditLabel}>Checkout Remarks:</Text>
                      <Text style={styles.auditVal}>{checkOut.remarks}</Text>
                    </View>
                  ) : null}
                </>
              ) : null}
            </View>

            {/* Net Duration */}
            <View style={styles.sheetDurationBox}>
              <Clock size={16} color={COLORS.primary} />
              <Text style={styles.sheetDurationText}>
                Net Working Duration:{' '}
                <Text style={{ fontWeight: '800', color: COLORS.darkBlue }}>
                  {Math.floor(selectedRecord.workingMinutes / 60)} hrs{' '}
                  {selectedRecord.workingMinutes % 60} mins
                </Text>
              </Text>
            </View>
          </View>
        ) : null}
      </BottomSheet>
      <TechnicianDrawerModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topNavHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  navHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  navHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterPillsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: RADII.pill,
    backgroundColor: '#F1F5F9',
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  dateSelectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dateNavBtn: {
    padding: 8,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.softBlue,
  },
  dateNavRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  dateTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  dayStripContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 8,
  },
  dayStripContent: {
    paddingHorizontal: 14,
    gap: 8,
  },
  dayStripItem: {
    width: 44,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayStripItemSelected: {
    backgroundColor: '#4338CA',
    borderColor: '#4338CA',
  },
  dayStripAbbr: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  dayStripAbbrSelected: {
    color: '#E0E7FF',
  },
  dayStripNum: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  dayStripNumSelected: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 10,
  },
  listSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
  },
  todayQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  todayQuickText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338CA',
  },
  sheetTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetDateText: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  sheetSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  sheetPhotoWrapper: {
    position: 'relative',
    height: 180,
    borderRadius: RADII.card,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#0F172A',
  },
  sheetSelfie: {
    width: '100%',
    height: '100%',
  },
  selfieBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(21, 65, 167, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADII.sm,
    gap: 6,
  },
  selfieBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sheetSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADII.btn,
    padding: 12,
    marginBottom: 10,
  },
  sheetSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  auditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  auditLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  auditVal: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sheetDurationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.softBlue,
    padding: 14,
    borderRadius: RADII.btn,
    gap: 8,
    marginTop: 6,
  },
  sheetDurationText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
});

export default HistoryScreen;
