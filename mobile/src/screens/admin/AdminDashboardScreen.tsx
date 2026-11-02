import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
  Modal,
  Linking,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Circle } from '../../components/common/AppMapView';
import Svg, { G, Circle as SvgCircle } from 'react-native-svg';
import {
  Users,
  ShieldCheck,
  UserX,
  CheckCircle2,
  TrendingUp,
  MapPin,
  ArrowRight,
  Shield,
  Zap,
  LogOut,
  Bell,
  CheckCheck,
  AlertTriangle,
  Clock,
  Calendar,
  Filter,
  BarChart3,
  PieChart,
  Eye,
  X,
  ChevronRight,
  ShieldAlert,
  Navigation,
  AlertCircle,
  Menu,
  Camera,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/useAuthStore';
import { resolvePhotoUrl } from '../../utils/imageUrl';
import { getStorageItem, setStorageItem } from '../../services/api';
import {
  dashboardService,
  AdminStats,
  AdminNotification,
  RecentAttendanceItem,
} from '../../services/dashboardService';
import { COLORS, RADII, SHADOWS } from '../../constants/theme';
import { AppCard } from '../../components/common/AppCard';
import { KPICard } from '../../components/common/KPICard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { AppButton } from '../../components/common/AppButton';
import { useAdminDrawerStore } from '../../store/useAdminDrawerStore';
import { AdminDrawerModal } from '../../components/navigation/AdminDrawerModal';

interface AdminDashboardScreenProps {
  navigation: any;
}

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useAdminDrawerStore();
  const { user, logout } = useAuthStore();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);



  // Notifications state (modal opens only when clicking bell icon)
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'all' | 'late' | 'geofence'>('all');

  // Recent attendance filtering & detail modal
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'present' | 'late' | 'half_day' | 'leave' | 'outside'>('all');
  const [markedAllRead, setMarkedAllRead] = useState(false);
  const [readNotifIds, setReadNotifIds] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const stored = await getStorageItem('admin_read_notif_ids');
      if (stored) {
        try {
          setReadNotifIds(JSON.parse(stored));
        } catch {}
      }
      const storedAll = await getStorageItem('admin_marked_all_read');
      if (storedAll === 'true') {
        setMarkedAllRead(true);
      }
    })();
  }, []);
  const [selectedRecord, setSelectedRecord] = useState<RecentAttendanceItem | null>(null);
  const [mapModalRecord, setMapModalRecord] = useState<RecentAttendanceItem | null>(null);

  // Chart view mode: Volume breakdown vs Punctuality percentage
  const [chartMode, setChartMode] = useState<'volume' | 'punctuality'>('volume');

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of the Adani Operations Center?',
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

  const fetchStats = async () => {
    try {
      const data = await dashboardService.getAdminStats();
      setStats(data);
    } catch (e) {
      console.warn('Dashboard stats error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setMarkedAllRead(true);
      await setStorageItem('admin_marked_all_read', 'true');
      const allIds = (stats?.notifications || []).map((n) => n.id);
      setReadNotifIds(allIds);
      await setStorageItem('admin_read_notif_ids', JSON.stringify(allIds));
      await dashboardService.markNotificationsRead();
      if (stats) {
        const updated = stats.notifications.map((n) => ({ ...n, isRead: true }));
        setStats({
          ...stats,
          notifications: updated,
          unreadNotificationsCount: 0,
        });
      }
    } catch (e) {
      console.warn('Mark read error:', e);
    }
  };



  useEffect(() => {
    fetchStats();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  // Notification items & live unread badge (hooks called unconditionally at top level)
  const notifications = useMemo(() => {
    const list = stats?.notifications || [];
    return list.map((n: AdminNotification) => ({
      ...n,
      isRead: markedAllRead || readNotifIds.includes(n.id) || n.isRead,
    }));
  }, [stats?.notifications, markedAllRead, readNotifIds]);

  const unreadCount = useMemo(() => {
    if (markedAllRead) return 0;
    return notifications.filter((n: AdminNotification) => !n.isRead).length;
  }, [notifications, markedAllRead]);

  if (loading && !stats) {
    return <LoadingSpinner message="Aggregating workforce telemetry..." />;
  }

  const kpi = stats?.kpi || {
    totalFieldStaff: 28,
    currentlyPresent: 23,
    absentOffDuty: 3,
    completedShift: 2,
  };

  const recentAttendance = stats?.recentAttendance || [];
  const filteredAttendance = recentAttendance.filter((rec) => {
    if (attendanceFilter === 'present') return rec.status === 'present' || rec.status === 'completed';
    if (attendanceFilter === 'late') return rec.status === 'late';
    if (attendanceFilter === 'half_day') return rec.status === 'half_day' || rec.status === 'half-day';
    if (attendanceFilter === 'leave') return rec.status === 'leave' || rec.status === 'absent';
    if (attendanceFilter === 'outside') return !rec.isInsideGeofence;
    return true;
  });

  const distribution = stats?.statusDistribution || {
    presentOnTime: 18,
    presentLate: 3,
    completedShift: 2,
    absent: 3,
    totalTracked: 26,
    complianceRate: 92.3,
    punctualityRate: 85.7,
    percentages: { onTime: 69, late: 12, completed: 8, absent: 11 },
  };

  const filteredNotifications = notifications.filter((item: AdminNotification) => {
    if (notifFilter === 'late') return item.type === 'warning' || item.category.toLowerCase().includes('late');
    if (notifFilter === 'geofence') return item.type === 'danger' || item.category.toLowerCase().includes('geofence');
    return true;
  });

  // Status Distribution Pie metrics: Present, Pending, Checked Out
  const presentCount = kpi.currentlyPresent || 0;
  const pendingCount = kpi.absentOffDuty || 0;
  const checkedOutCount = kpi.completedShift || 0;
  const totalPie = Math.max(1, presentCount + pendingCount + checkedOutCount);

  const presentPct = Math.round((presentCount / totalPie) * 100);
  const pendingPct = Math.round((pendingCount / totalPie) * 100);
  const checkedOutPct = Math.max(0, 100 - presentPct - pendingPct);

  const pieRadius = 46;
  const pieCircumference = 2 * Math.PI * pieRadius;
  const p1Len = (presentCount / totalPie) * pieCircumference;
  const p2Len = (pendingCount / totalPie) * pieCircumference;
  const p3Len = (checkedOutCount / totalPie) * pieCircumference;

  return (
    <View style={styles.screenContainer}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 24) + 10,
            paddingBottom: Math.max(insets.bottom, 16) + 30,
          },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header with 3-Line Menu */}
        <View style={styles.header}>
          {/* 3-Line Hamburger Menu Icon Button */}
          <TouchableOpacity delayPressIn={0}
            style={styles.menuBtn}
            onPress={() => openDrawer('AdminDashboard')}
            activeOpacity={0.7}
            accessibilityLabel="Open Navigation Menu"
          >
            <Menu size={22} color="#0F172A" />
          </TouchableOpacity>

          <View style={{ flex: 1, marginHorizontal: 10 }}>
            <Text style={styles.brandTitle}>Operations Center</Text>
            <View style={styles.liveTagRow}>
              <View style={styles.pulsingDot} />
              <Text style={styles.liveText}>LIVE MONITOR</Text>
            </View>
          </View>

          <View style={styles.headerRightCol}>
            {/* Notification Bell Icon */}
            <TouchableOpacity delayPressIn={0}
              style={styles.bellCardBtn}
              onPress={() => setShowNotificationsModal(true)}
              activeOpacity={0.8}
              accessibilityLabel="Admin Notifications"
            >
              <Bell size={20} color="#1E293B" />
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {unreadCount > 9 ? '9+' : String(unreadCount)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Top 4 KPI Cards */}
        <View style={styles.kpiRow}>
          <KPICard
            label="Field Staff"
            value={kpi.totalFieldStaff}
            icon={<Users size={16} color={COLORS.primary} />}
            subtitle="Registered engineers"
          />
          <KPICard
            label="On Duty"
            value={kpi.currentlyPresent}
            icon={<ShieldCheck size={16} color={COLORS.success} />}
            subtitle="Inside geofence"
            badge={<StatusBadge status="active" size="sm" />}
          />
        </View>

        <View style={styles.kpiRow}>
          <KPICard
            label="Off-Duty"
            value={kpi.absentOffDuty}
            icon={<UserX size={16} color={COLORS.danger} />}
            subtitle="Absent / Weekly off"
            badge={<StatusBadge status="absent" size="sm" />}
          />
          <KPICard
            label="Concluded"
            value={kpi.completedShift}
            icon={<CheckCircle2 size={16} color={COLORS.darkBlue} />}
            subtitle="Completed full shift"
          />
        </View>



        {/* ============================================================ */}
        {/* ============================================================ */}
        {/* 2. STATUS DISTRIBUTION (PIE CHART: PRESENT, PENDING, CHECKED OUT) */}
        {/* ============================================================ */}
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <PieChart size={16} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>WORKFORCE STATUS DISTRIBUTION</Text>
          </View>
          <View style={styles.compliancePill}>
            <Text style={styles.compliancePillText}>
              {distribution.complianceRate}% Active Rate
            </Text>
          </View>
        </View>

        <AppCard style={styles.distributionCard}>
          {/* Header Summary Rates */}
          <View style={styles.distRateRow}>
            <View style={styles.distRateBox}>
              <Text style={styles.distRateLabel}>Punctuality Index</Text>
              <Text style={styles.distRateValue}>{distribution.punctualityRate}%</Text>
              <Text style={styles.distRateSub}>Checked in on-time (&lt;09:00)</Text>
            </View>
            <View style={styles.distRateDivider} />
            <View style={styles.distRateBox}>
              <Text style={styles.distRateLabel}>Geofence Compliance</Text>
              <Text style={[styles.distRateValue, { color: COLORS.successDark }]}>
                {distribution.complianceRate}%
              </Text>
              <Text style={styles.distRateSub}>Verified within 500m radius</Text>
            </View>
          </View>

          {/* Donut / Pie Chart Visualization */}
          <View style={styles.pieChartContainer}>
            <View style={styles.pieChartWrapper}>
              <Svg width={130} height={130} viewBox="0 0 130 130">
                <G rotation="-90" origin="65, 65">
                  {/* Background Track */}
                  <SvgCircle
                    cx="65"
                    cy="65"
                    r={pieRadius}
                    stroke="#F1F5F9"
                    strokeWidth="16"
                    fill="none"
                  />
                  {/* Slice 1: Present (Emerald) */}
                  {presentCount > 0 && (
                    <SvgCircle
                      cx="65"
                      cy="65"
                      r={pieRadius}
                      stroke="#10B981"
                      strokeWidth="16"
                      strokeDasharray={`${p1Len} ${pieCircumference}`}
                      strokeDashoffset={0}
                      fill="none"
                    />
                  )}
                  {/* Slice 2: Pending (Amber) */}
                  {pendingCount > 0 && (
                    <SvgCircle
                      cx="65"
                      cy="65"
                      r={pieRadius}
                      stroke="#F59E0B"
                      strokeWidth="16"
                      strokeDasharray={`${p2Len} ${pieCircumference}`}
                      strokeDashoffset={-p1Len}
                      fill="none"
                    />
                  )}
                  {/* Slice 3: Checked Out (Tech Blue) */}
                  {checkedOutCount > 0 && (
                    <SvgCircle
                      cx="65"
                      cy="65"
                      r={pieRadius}
                      stroke="#1E63F0"
                      strokeWidth="16"
                      strokeDasharray={`${p3Len} ${pieCircumference}`}
                      strokeDashoffset={-(p1Len + p2Len)}
                      fill="none"
                    />
                  )}
                </G>
              </Svg>

              {/* Center Metric Label */}
              <View style={styles.donutCenter}>
                <Text style={styles.donutCenterValue}>{totalPie}</Text>
                <Text style={styles.donutCenterLabel}>STAFF</Text>
              </View>
            </View>

            {/* Status Breakdown Legend */}
            <View style={styles.pieLegendCol}>
              {/* 1. Present */}
              <View style={styles.pieLegendItem}>
                <View style={[styles.pieLegendIndicator, { backgroundColor: '#10B981' }]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.pieLegendHeader}>
                    <Text style={styles.pieLegendTitle}>Present</Text>
                    <Text style={[styles.pieLegendCount, { color: '#059669' }]}>
                      {presentCount} <Text style={styles.pieLegendPct}>({presentPct}%)</Text>
                    </Text>
                  </View>
                  <Text style={styles.pieLegendSub}>Active on site</Text>
                </View>
              </View>

              {/* 2. Pending */}
              <View style={styles.pieLegendItem}>
                <View style={[styles.pieLegendIndicator, { backgroundColor: '#F59E0B' }]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.pieLegendHeader}>
                    <Text style={styles.pieLegendTitle}>Pending</Text>
                    <Text style={[styles.pieLegendCount, { color: '#D97706' }]}>
                      {pendingCount} <Text style={styles.pieLegendPct}>({pendingPct}%)</Text>
                    </Text>
                  </View>
                  <Text style={styles.pieLegendSub}>Awaiting check-in / off</Text>
                </View>
              </View>

              {/* 3. Checked Out */}
              <View style={styles.pieLegendItem}>
                <View style={[styles.pieLegendIndicator, { backgroundColor: '#1E63F0' }]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.pieLegendHeader}>
                    <Text style={styles.pieLegendTitle}>Checked Out</Text>
                    <Text style={[styles.pieLegendCount, { color: '#1E63F0' }]}>
                      {checkedOutCount} <Text style={styles.pieLegendPct}>({checkedOutPct}%)</Text>
                    </Text>
                  </View>
                  <Text style={styles.pieLegendSub}>Shift concluded</Text>
                </View>
              </View>
            </View>
          </View>
        </AppCard>

        {/* ============================================================ */}
        {/* 3. INFORMATIVE CHARTS & PUNCTUALITY ANALYTICS                */}
        {/* ============================================================ */}
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <BarChart3 size={16} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>WEEKLY ATTENDANCE & PUNCTUALITY ANALYTICS</Text>
          </View>
        </View>

        <AppCard style={styles.trendCard}>
          {/* Chart Mode Toggle */}
          <View style={styles.chartToggleRow}>
            <View style={styles.chartTogglePills}>
              <TouchableOpacity delayPressIn={0}
                style={[styles.chartToggleBtn, chartMode === 'volume' && styles.chartToggleBtnActive]}
                onPress={() => setChartMode('volume')}
              >
                <Text style={[styles.chartToggleText, chartMode === 'volume' && styles.chartToggleTextActive]}>
                  Shift Volume (Stacked)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity delayPressIn={0}
                style={[styles.chartToggleBtn, chartMode === 'punctuality' && styles.chartToggleBtnActive]}
                onPress={() => setChartMode('punctuality')}
              >
                <Text style={[styles.chartToggleText, chartMode === 'punctuality' && styles.chartToggleTextActive]}>
                  Compliance %
                </Text>
              </TouchableOpacity>
            </View>
            <TrendingUp size={16} color={COLORS.primary} />
          </View>

          {/* Interactive Stacked Multi-Metric Bar Chart */}
          <View style={styles.barChartContainer}>
            {(stats?.weeklyTrend || []).map((item, idx) => {
              const onTime = item.present - item.late;
              const late = item.late;
              const absent = item.absent;
              const total = Math.max(1, onTime + late + absent);
              const compliance = item.attendanceRate || Math.round((item.present / total) * 100);

              return (
                <View key={idx} style={styles.barCol}>
                  <Text style={styles.barValueLabel}>
                    {chartMode === 'volume' ? item.present : `${compliance}%`}
                  </Text>
                  <View style={styles.barTrack}>
                    {chartMode === 'volume' ? (
                      <>
                        <View
                          style={[
                            styles.barSegment,
                            {
                              flex: Math.max(1, onTime),
                              backgroundColor: COLORS.success,
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.barSegment,
                            {
                              flex: Math.max(0.5, late),
                              backgroundColor: COLORS.warning,
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.barSegment,
                            {
                              flex: Math.max(0.5, absent),
                              backgroundColor: '#FCA5A5',
                            },
                          ]}
                        />
                      </>
                    ) : (
                      <View
                        style={[
                          styles.barFillCompliance,
                          { height: `${Math.min(100, Math.max(15, compliance))}%` },
                        ]}
                      />
                    )}
                  </View>
                  <Text style={styles.barDayLabel}>{item.day}</Text>
                  <Text style={styles.barSubLabel}>{compliance}%</Text>
                </View>
              );
            })}
          </View>

          {/* Color-Coded Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: COLORS.success }]} />
              <Text style={styles.legendText}>On-Time (&lt;09:00)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: COLORS.warning }]} />
              <Text style={styles.legendText}>Late Arrival</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: '#FCA5A5' }]} />
              <Text style={styles.legendText}>Absent</Text>
            </View>
          </View>

          {/* Hourly Punctuality Arrival Curve Breakdown */}
          <View style={styles.hourlyDivider} />
          <Text style={styles.hourlySectionTitle}>TODAY'S HOURLY ARRIVAL TIMELINE</Text>
          <View style={styles.hourlyGrid}>
            {(stats?.hourlyArrivals || []).map((slot, i) => (
              <View key={i} style={styles.hourlySlotCard}>
                <View style={styles.hourlySlotHeader}>
                  <Text style={styles.hourlySlotTime}>{slot.slot}</Text>
                  <View style={[styles.hourlyBadge, { backgroundColor: slot.color + '20' }]}>
                    <Text style={[styles.hourlyBadgeText, { color: slot.color }]}>{slot.label}</Text>
                  </View>
                </View>
                <View style={styles.hourlySlotCountRow}>
                  <Text style={styles.hourlyCountText}>{slot.count} staff</Text>
                  <Text style={styles.hourlyRateText}>{slot.rate}</Text>
                </View>
                <View style={styles.hourlyProgressTrack}>
                  <View
                    style={[
                      styles.hourlyProgressFill,
                      { width: slot.rate, backgroundColor: slot.color },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </AppCard>

        {/* ============================================================ */}
        {/* 4. RECENT ATTENDANCE SECTION (Photo 2 Table)                  */}
        {/* ============================================================ */}
        <View style={styles.recentAttendanceHeaderRow}>
          <View>
            <Text style={styles.recentAttendanceTitle}>Recent Attendance</Text>
          </View>
          <TouchableOpacity delayPressIn={0}
            onPress={() => setAttendanceFilter('all')}
            style={styles.viewAllBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllText}>View All</Text>
            <ArrowRight size={14} color="#1E63F0" />
          </TouchableOpacity>
        </View>

        {/* Filter Pills for Recent Attendance */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attendanceFilterRow}>
          <TouchableOpacity delayPressIn={0}
            style={[styles.attFilterPill, attendanceFilter === 'all' && styles.attFilterPillActive]}
            onPress={() => setAttendanceFilter('all')}
          >
            <Text style={[styles.attFilterText, attendanceFilter === 'all' && styles.attFilterTextActive]}>
              All Logs ({recentAttendance.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity delayPressIn={0}
            style={[styles.attFilterPill, attendanceFilter === 'present' && styles.attFilterPillActiveGreen]}
            onPress={() => setAttendanceFilter('present')}
          >
            <Text style={[styles.attFilterText, attendanceFilter === 'present' && styles.attFilterTextActiveGreen]}>
              Present On-Time
            </Text>
          </TouchableOpacity>
          <TouchableOpacity delayPressIn={0}
            style={[styles.attFilterPill, attendanceFilter === 'late' && styles.attFilterPillActiveAmber]}
            onPress={() => setAttendanceFilter('late')}
          >
            <Text style={[styles.attFilterText, attendanceFilter === 'late' && styles.attFilterTextActiveAmber]}>
              Late Flagged ⚠️
            </Text>
          </TouchableOpacity>
          <TouchableOpacity delayPressIn={0}
            style={[styles.attFilterPill, attendanceFilter === 'half_day' && styles.attFilterPillActivePurple]}
            onPress={() => setAttendanceFilter('half_day')}
          >
            <Text style={[styles.attFilterText, attendanceFilter === 'half_day' && styles.attFilterTextActivePurple]}>
              Half-Day ⏱️
            </Text>
          </TouchableOpacity>
          <TouchableOpacity delayPressIn={0}
            style={[styles.attFilterPill, attendanceFilter === 'leave' && styles.attFilterPillActiveBlue]}
            onPress={() => setAttendanceFilter('leave')}
          >
            <Text style={[styles.attFilterText, attendanceFilter === 'leave' && styles.attFilterTextActiveBlue]}>
              Leave / Absent
            </Text>
          </TouchableOpacity>
          <TouchableOpacity delayPressIn={0}
            style={[styles.attFilterPill, attendanceFilter === 'outside' && styles.attFilterPillActiveRed]}
            onPress={() => setAttendanceFilter('outside')}
          >
            <Text style={[styles.attFilterText, attendanceFilter === 'outside' && styles.attFilterTextActiveRed]}>
              Outside Geofence 🚨
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* The Exact Photo 2 Table with Horizontal Scroll */}
        <AppCard style={styles.tableCardContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled={true}>
            <View style={styles.tableWrapper}>
              {/* Table Header Row */}
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, { width: 160 }]}>EMPLOYEE</Text>
                <Text style={[styles.tableHeaderCell, { width: 190 }]}>SUBSTATION SITE</Text>
                <Text style={[styles.tableHeaderCell, { width: 130 }]}>CHECK-IN TIME</Text>
                <Text style={[styles.tableHeaderCell, { width: 130 }]}>CHECK-OUT TIME</Text>
                <Text style={[styles.tableHeaderCell, { width: 150 }]}>WORKING DURATION</Text>
                <Text style={[styles.tableHeaderCell, { width: 140 }]}>DISTANCE TRAVELED</Text>
                <Text style={[styles.tableHeaderCell, { width: 130 }]}>SHIFT STATUS</Text>
                <Text style={[styles.tableHeaderCell, { width: 130 }]}>ROUTE MAP</Text>
              </View>

              {/* Table Rows */}
              {filteredAttendance.length === 0 ? (
                <View style={styles.emptyTableRow}>
                  <Text style={styles.emptyTableText}>No attendance records matching filter.</Text>
                </View>
              ) : (
                filteredAttendance.map((rec, index) => {
                  const isLate = rec.status === 'late';
                  const isCompleted = rec.status === 'completed';
                  const isAbsent = rec.status === 'absent';
                  const isHalfDay = rec.status === 'half_day' || rec.status === 'half-day';
                  const isLeave = rec.status === 'leave';

                  return (
                    <View
                      key={rec.id}
                      style={[
                        styles.tableDataRow,
                        index % 2 === 1 && styles.tableDataRowAlt,
                      ]}
                    >
                      {/* 1. EMPLOYEE (Avatar Photo + Name) */}
                      <TouchableOpacity delayPressIn={0}
                        style={[styles.tableDataCell, { width: 175, flexDirection: 'row', alignItems: 'center', gap: 8 }]}
                        onPress={() => setSelectedRecord(rec)}
                        activeOpacity={0.7}
                      >
                        {rec.photoUrl ? (
                          <Image
                            source={{ uri: resolvePhotoUrl(rec.photoUrl) }}
                            style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: '#38BDF8' }}
                          />
                        ) : (
                          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' }}>
                            <Camera size={14} color="#64748B" />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.employeeNameText} numberOfLines={1}>{rec.employeeName}</Text>
                          <Text style={styles.employeeCodeText}>{rec.employeeId}</Text>
                        </View>
                      </TouchableOpacity>

                      {/* 2. SUBSTATION SITE */}
                      <View style={[styles.tableDataCell, { width: 190 }]}>
                        <Text style={styles.substationSiteText}>{rec.siteName}</Text>
                      </View>

                      {/* 3. CHECK-IN TIME */}
                      <View style={[styles.tableDataCell, { width: 130 }]}>
                        <Text style={styles.timeBoldText}>{rec.checkInTime}</Text>
                      </View>

                      {/* 4. CHECK-OUT TIME */}
                      <View style={[styles.tableDataCell, { width: 130 }]}>
                        <Text style={styles.timeBoldText}>{rec.checkOutTime}</Text>
                      </View>

                      {/* 5. WORKING DURATION (Electric Blue) */}
                      <View style={[styles.tableDataCell, { width: 150 }]}>
                        <Text style={styles.durationBlueText}>{rec.duration}</Text>
                      </View>

                      {/* 6. DISTANCE TRAVELED */}
                      <View style={[styles.tableDataCell, { width: 140 }]}>
                        <Text style={styles.distanceText}>{rec.distanceTraveled || '--'}</Text>
                      </View>

                      {/* 7. SHIFT STATUS (Photo 2 Pill) */}
                      <View style={[styles.tableDataCell, { width: 130 }]}>
                        {isLate ? (
                          <View style={styles.statusPillLate}>
                            <AlertCircle size={13} color="#D97706" />
                            <Text style={styles.statusPillLateText}>Late</Text>
                          </View>
                        ) : isHalfDay ? (
                          <View style={styles.statusPillHalfDay}>
                            <Clock size={13} color="#7C3AED" />
                            <Text style={styles.statusPillHalfDayText}>Half-Day</Text>
                          </View>
                        ) : isLeave ? (
                          <View style={styles.statusPillLeave}>
                            <Calendar size={13} color="#0284C7" />
                            <Text style={styles.statusPillLeaveText}>Leave</Text>
                          </View>
                        ) : isAbsent ? (
                          <View style={styles.statusPillAbsent}>
                            <UserX size={13} color="#DC2626" />
                            <Text style={styles.statusPillAbsentText}>Absent</Text>
                          </View>
                        ) : (
                          <View style={styles.statusPillOnTime}>
                            <CheckCircle2 size={13} color="#059669" />
                            <Text style={styles.statusPillOnTimeText}>
                              {isCompleted ? 'Completed' : 'On-Time'}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* 8. ROUTE MAP: [ ✈ View Map ] Button */}
                      <View style={[styles.tableDataCell, { width: 130 }]}>
                        <TouchableOpacity delayPressIn={0}
                          style={styles.viewMapBtn}
                          onPress={() => setMapModalRecord(rec)}
                          activeOpacity={0.75}
                        >
                          <Navigation size={13} color="#1E63F0" />
                          <Text style={styles.viewMapBtnText}>View Map</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        </AppCard>


      </ScrollView>

      {/* ============================================================ */}
      {/* MODAL 1: RECORD AUDIT DETAIL MODAL                           */}
      {/* ============================================================ */}
      <Modal visible={!!selectedRecord} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Attendance Audit Inspection</Text>
              <TouchableOpacity delayPressIn={0} onPress={() => setSelectedRecord(null)}>
                <X size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedRecord ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalUserRow}>
                  <Image source={{ uri: selectedRecord.avatar }} style={styles.modalAvatar} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.modalTechName}>{selectedRecord.employeeName}</Text>
                    <Text style={styles.modalEmpId}>ID: {selectedRecord.employeeId}</Text>
                    <Text style={styles.modalDesig}>{selectedRecord.designation}</Text>
                  </View>
                  <StatusBadge status={selectedRecord.status} />
                </View>

                {/* Substation & Geofence Badge */}
                <View style={styles.modalInfoBox}>
                  <Text style={styles.modalBoxTitle}>ASSIGNED SUBSTATION</Text>
                  <Text style={styles.modalBoxVal}>{selectedRecord.siteName} ({selectedRecord.siteCode})</Text>

                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 }}>
                    {selectedRecord.isInsideGeofence ? (
                      <CheckCircle2 size={16} color={COLORS.success} />
                    ) : (
                      <ShieldAlert size={16} color={COLORS.danger} />
                    )}
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: selectedRecord.isInsideGeofence ? COLORS.successDark : COLORS.dangerDark,
                      }}
                    >
                      {selectedRecord.isInsideGeofence
                        ? 'Compliance Verified: Inside 500m Substation Geofence'
                        : `Geofence Alert: Punched ${selectedRecord.distanceMeters.toFixed(0)}m outside authorized perimeter`}
                    </Text>
                  </View>
                </View>

                {/* Timing Summary */}
                <View style={styles.modalTimingsGrid}>
                  <View style={styles.modalTimingItem}>
                    <Text style={styles.modalTimingLabel}>Punch In Time</Text>
                    <Text style={styles.modalTimingVal}>{selectedRecord.checkInTime}</Text>
                  </View>
                  <View style={styles.modalTimingItem}>
                    <Text style={styles.modalTimingLabel}>Punch Out Time</Text>
                    <Text style={styles.modalTimingVal}>{selectedRecord.checkOutTime}</Text>
                  </View>
                  <View style={styles.modalTimingItem}>
                    <Text style={styles.modalTimingLabel}>Net Work Duration</Text>
                    <Text style={[styles.modalTimingVal, { color: COLORS.primary }]}>
                      {selectedRecord.duration}
                    </Text>
                  </View>
                </View>

                {/* Check-In Photo Preview */}
                {selectedRecord.photoUrl ? (
                  <View style={styles.modalPhotoSection}>
                    <Text style={styles.modalBoxTitle}>TECHNICIAN CHECK-IN PHOTO</Text>
                    <Image
                      source={{ uri: resolvePhotoUrl(selectedRecord.photoUrl) }}
                      style={styles.modalPhotoPreview}
                      resizeMode="cover"
                    />
                    <Text style={styles.modalPhotoNote}>
                      Live photo uploaded by technician during shift check-in.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.modalPhotoSection}>
                    <Text style={styles.modalBoxTitle}>TECHNICIAN CHECK-IN PHOTO</Text>
                    <View style={{ padding: 16, backgroundColor: '#F8FAFC', borderRadius: 8, alignItems: 'center' }}>
                      <Camera size={24} color="#94A3B8" />
                      <Text style={{ fontSize: 12, color: '#64748B', marginTop: 6, fontWeight: '600' }}>
                        No photo uploaded (Photo upload optional for field technicians)
                      </Text>
                    </View>
                  </View>
                )}

                {/* Remarks if any */}
                {selectedRecord.remarks ? (
                  <View style={styles.modalRemarksBox}>
                    <Text style={styles.modalBoxTitle}>TECHNICIAN SHIFT NOTES</Text>
                    <Text style={styles.modalRemarksText}>"{selectedRecord.remarks}"</Text>
                  </View>
                ) : null}

                <AppButton
                  title="Close Inspection"
                  onPress={() => setSelectedRecord(null)}
                  variant="primary"
                  style={{ marginTop: 16, marginBottom: 10 }}
                />
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>



      {/* ============================================================ */}
      {/* MODAL 3: TECHNICIAN REAL LOCATION MAP MODAL                  */}
      {/* ============================================================ */}
      <Modal visible={!!mapModalRecord} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContainer, { maxHeight: '92%', padding: 0, overflow: 'hidden' }]}>
            {/* Modal Top Bar */}
            <View style={styles.mapModalHeader}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MapPin size={18} color={COLORS.primary} />
                  <Text style={styles.mapModalTitle}>
                    {mapModalRecord?.employeeName}'s Real Location
                  </Text>
                </View>
                <Text style={styles.mapModalSubtitle}>
                  Emp ID: {mapModalRecord?.employeeId} • Site: {mapModalRecord?.siteName}
                </Text>
              </View>
              <TouchableOpacity delayPressIn={0}
                style={styles.mapModalCloseBtn}
                onPress={() => setMapModalRecord(null)}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {mapModalRecord ? (() => {
              const mapLat = mapModalRecord.latitude ?? 12.9610;
              const mapLng = mapModalRecord.longitude ?? 77.5963;
              const siteLat = mapModalRecord.siteLatitude ?? mapLat;
              const siteLng = mapModalRecord.siteLongitude ?? mapLng;
              const siteRadius = mapModalRecord.siteRadius ?? 500;

              return (
              <View style={styles.mapWrapper}>
                <MapView
                  style={styles.mapView}
                  initialRegion={{
                    latitude: mapLat,
                    longitude: mapLng,
                    latitudeDelta: 0.015,
                    longitudeDelta: 0.015,
                  }}
                >
                  {/* 1. Substation Site Marker */}
                  <Marker
                    coordinate={{
                      latitude: siteLat,
                      longitude: siteLng,
                    }}
                    title={`${mapModalRecord.siteName} Substation`}
                    description={`Authorized Geofence Perimeter: ${siteRadius}m`}
                    pinColor="#2563EB"
                  />

                  {/* 2. Substation 500m Geofence Circle */}
                  <Circle
                    center={{
                      latitude: siteLat,
                      longitude: siteLng,
                    }}
                    radius={siteRadius}
                    strokeColor={mapModalRecord.isInsideGeofence ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)'}
                    fillColor={mapModalRecord.isInsideGeofence ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}
                    strokeWidth={2}
                  />

                  {/* 3. Technician Real Location Marker */}
                  <Marker
                    coordinate={{
                      latitude: mapLat,
                      longitude: mapLng,
                    }}
                    title={`${mapModalRecord.employeeName} (Punch Location)`}
                    description={`Check-in: ${mapModalRecord.checkInTime} • ${mapModalRecord.isInsideGeofence ? 'Inside' : 'Outside'} Geofence`}
                    pinColor={mapModalRecord.isInsideGeofence ? '#10B981' : '#EF4444'}
                  />
                </MapView>

                {/* Floating Telemetry & Info Sheet */}
                <View style={styles.mapTelemetrySheet}>
                  <View style={styles.mapTelemetryHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.mapTechNameBold}>{mapModalRecord.employeeName}</Text>
                      <View style={styles.mapStatusPillSmall}>
                        <Text style={styles.mapStatusPillText}>{mapModalRecord.status.toUpperCase()}</Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.mapGeofenceBadge,
                        { backgroundColor: mapModalRecord.isInsideGeofence ? '#DCFCE7' : '#FEE2E2' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.mapGeofenceBadgeText,
                          { color: mapModalRecord.isInsideGeofence ? COLORS.successDark : COLORS.dangerDark },
                        ]}
                      >
                        {mapModalRecord.isInsideGeofence ? 'Inside Geofence' : `${mapModalRecord.distanceMeters.toFixed(0)}m Outside`}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.mapTelemetryGrid}>
                    <View style={styles.mapTelemetryItem}>
                      <Text style={styles.mapTelemetryLabel}>REAL LATITUDE</Text>
                      <Text style={styles.mapTelemetryVal}>{mapLat.toFixed(5)}° N</Text>
                    </View>
                    <View style={styles.mapTelemetryItem}>
                      <Text style={styles.mapTelemetryLabel}>REAL LONGITUDE</Text>
                      <Text style={styles.mapTelemetryVal}>{mapLng.toFixed(5)}° E</Text>
                    </View>
                    <View style={styles.mapTelemetryItem}>
                      <Text style={styles.mapTelemetryLabel}>CHECK-IN TIME</Text>
                      <Text style={styles.mapTelemetryVal}>{mapModalRecord.checkInTime}</Text>
                    </View>
                    <View style={styles.mapTelemetryItem}>
                      <Text style={styles.mapTelemetryLabel}>CHECK-OUT TIME</Text>
                      <Text style={styles.mapTelemetryVal}>{mapModalRecord.checkOutTime}</Text>
                    </View>
                    <View style={styles.mapTelemetryItem}>
                      <Text style={styles.mapTelemetryLabel}>DURATION</Text>
                      <Text style={[styles.mapTelemetryVal, { color: '#1E63F0' }]}>{mapModalRecord.duration}</Text>
                    </View>
                    <View style={styles.mapTelemetryItem}>
                      <Text style={styles.mapTelemetryLabel}>SITE DISTANCE</Text>
                      <Text style={styles.mapTelemetryVal}>{mapModalRecord.distanceTraveled || '--'}</Text>
                    </View>
                  </View>

                  {/* Actions Row */}
                  <View style={styles.mapActionBtnRow}>
                    <TouchableOpacity delayPressIn={0}
                      style={styles.openNativeMapsBtn}
                      onPress={() => {
                        const url = `https://www.google.com/maps/search/?api=1&query=${mapLat},${mapLng}`;
                        Linking.openURL(url).catch((err) => console.warn('Cannot open maps url', err));
                      }}
                      activeOpacity={0.8}
                    >
                      <Navigation size={14} color="#FFFFFF" />
                      <Text style={styles.openNativeMapsText}>Open in Google Maps</Text>
                    </TouchableOpacity>

                    <TouchableOpacity delayPressIn={0}
                      style={styles.closeMapSheetBtn}
                      onPress={() => setMapModalRecord(null)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.closeMapSheetText}>Close Map</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              );
            })() : null}
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* NOTIFICATIONS MODAL (ONLY OPENED WHEN TAPPING THE BELL ICON) */}
      {/* ============================================================ */}
      <Modal visible={showNotificationsModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContainer, { maxHeight: '88%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.bellCardBtn, { width: 36, height: 36, borderRadius: 18 }]}>
                  <Bell size={18} color={COLORS.primary} />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Field Notifications</Text>
                  <Text style={{ fontSize: 11, color: COLORS.textSecondary }}>
                    {unreadCount} unread alert{unreadCount === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity delayPressIn={0} onPress={() => setShowNotificationsModal(false)}>
                <X size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Filter Pills & Mark Read */}
            <View style={[styles.notifHeaderActions, { marginBottom: 12 }]}>
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
                  style={[styles.notifPill, notifFilter === 'late' && styles.notifPillActiveAmber]}
                  onPress={() => setNotifFilter('late')}
                >
                  <Text style={[styles.notifPillText, notifFilter === 'late' && styles.notifPillTextActiveAmber]}>
                    Late Punches ⚠️
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity delayPressIn={0}
                  style={[styles.notifPill, notifFilter === 'geofence' && styles.notifPillActiveRed]}
                  onPress={() => setNotifFilter('geofence')}
                >
                  <Text style={[styles.notifPillText, notifFilter === 'geofence' && styles.notifPillTextActiveRed]}>
                    Geofence 🚨
                  </Text>
                </TouchableOpacity>
              </View>

              {unreadCount > 0 && (
                <TouchableOpacity delayPressIn={0} style={styles.markReadBtn} onPress={handleMarkAllRead}>
                  <CheckCheck size={14} color={COLORS.primary} />
                  <Text style={styles.markReadText}>Mark read</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Notification Cards List */}
            <ScrollView showsVerticalScrollIndicator={false}>
              {filteredNotifications.length === 0 ? (
                <View style={styles.emptyNotifBox}>
                  <CheckCircle2 size={32} color={COLORS.success} />
                  <Text style={styles.emptyNotifText}>
                    No notifications in this category. All field operations in compliance.
                  </Text>
                </View>
              ) : (
                filteredNotifications.map((item: AdminNotification) => {
                  const isLate = item.type === 'warning';
                  const isGeo = item.type === 'danger';
                  const isEarly = item.type === 'info';

                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.notifItem,
                        !item.isRead && styles.notifItemUnread,
                        isLate && styles.notifItemLate,
                        isGeo && styles.notifItemGeo,
                      ]}
                    >
                      <View style={styles.notifTopRow}>
                        <View style={styles.notifBadgeRow}>
                          <View
                            style={[
                              styles.notifTypeIndicator,
                              {
                                backgroundColor: isGeo
                                  ? COLORS.danger
                                  : isLate
                                  ? COLORS.warning
                                  : isEarly
                                  ? COLORS.primary
                                  : COLORS.success,
                              },
                            ]}
                          />
                          <Text
                            style={[
                              styles.notifCategoryText,
                              {
                                color: isGeo
                                  ? COLORS.dangerDark
                                  : isLate
                                  ? COLORS.warningDark
                                  : COLORS.primary,
                              },
                            ]}
                          >
                            {item.category.toUpperCase()}
                          </Text>
                          {!item.isRead && <View style={styles.unreadDot} />}
                        </View>
                        <Text style={styles.notifTimeText}>{item.timestamp}</Text>
                      </View>

                      <View style={styles.notifBodyRow}>
                        <Image source={{ uri: item.avatar }} style={styles.notifAvatar} />
                        <View style={styles.notifContentCol}>
                          <Text style={styles.notifTitleText}>{item.title}</Text>
                          <Text style={styles.notifMessageText}>{item.message}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <AppButton
              title="Close Notifications"
              onPress={() => setShowNotificationsModal(false)}
              variant="outline"
              style={{ marginTop: 14 }}
            />
          </View>
        </View>
      </Modal>

      {/* Admin Slide-Out Drawer Navigation */}
      <AdminDrawerModal />
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  menuBtn: {
    width: 40,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  headerRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bellCardBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  bellBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#E11D48',
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  liveTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADII.pill,
    gap: 5,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  adminLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADII.sm,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  adminLogoutText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.3,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADII.pill,
    gap: 6,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.successDark,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },

  // Section Headers
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
  },
  unreadBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADII.pill,
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
  },
  compliancePill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADII.pill,
  },
  compliancePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.successDark,
  },

  // 1. Notifications Styling
  notificationsCard: {
    padding: 14,
    marginBottom: 10,
  },
  notifHeaderActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  notifFilterPills: {
    flexDirection: 'row',
    gap: 6,
  },
  notifPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.background,
  },
  notifPillActive: {
    backgroundColor: COLORS.softBlue,
  },
  notifPillActiveAmber: {
    backgroundColor: '#FEF3C7',
  },
  notifPillActiveRed: {
    backgroundColor: '#FEE2E2',
  },
  notifPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  notifPillTextActive: {
    color: COLORS.primary,
  },
  notifPillTextActiveAmber: {
    color: COLORS.warningDark,
  },
  notifPillTextActiveRed: {
    color: COLORS.dangerDark,
  },
  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markReadText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  emptyNotifBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  emptyNotifText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  notifItem: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.card,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  notifItemUnread: {
    backgroundColor: '#F8FAFC',
    borderColor: COLORS.border,
  },
  notifItemLate: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  notifItemGeo: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  notifTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  notifBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notifTypeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  notifCategoryText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.danger,
  },
  notifTimeText: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  notifBodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  notifAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.border,
  },
  notifContentCol: {
    flex: 1,
  },
  notifTitleText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  notifMessageText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  viewAllNotifsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    marginTop: 4,
    gap: 4,
  },
  viewAllNotifsText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // 2. Status Distribution Styling
  distributionCard: {
    padding: 16,
    marginBottom: 10,
  },
  distRateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  distRateBox: {
    flex: 1,
    alignItems: 'center',
  },
  distRateDivider: {
    width: 1,
    backgroundColor: COLORS.borderLight,
  },
  distRateLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  distRateValue: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  distRateSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  distBarTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  distProgressBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    marginBottom: 14,
  },
  distProgressSegment: {
    height: '100%',
  },
  distChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  distChip: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: RADII.sm,
    padding: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  distDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  distChipCount: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  distChipPct: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  distChipLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },

  // 3. Informative Analytics Chart Styling
  trendCard: {
    padding: 16,
    marginBottom: 12,
  },
  chartToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTogglePills: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: RADII.pill,
    padding: 2,
  },
  chartToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADII.pill,
  },
  chartToggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  chartToggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  chartToggleTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  barChartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 160,
    paddingTop: 10,
    paddingBottom: 4,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 3,
  },
  barValueLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  barTrack: {
    width: 22,
    height: 100,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barSegment: {
    width: '100%',
  },
  barFillCompliance: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 6,
  },
  barDayLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 6,
  },
  barSubLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendBox: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  hourlyDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: 14,
  },
  hourlySectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  hourlyGrid: {
    gap: 8,
  },
  hourlySlotCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADII.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  hourlySlotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  hourlySlotTime: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  hourlyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADII.sm,
  },
  hourlyBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  hourlySlotCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  hourlyCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  hourlyRateText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  hourlyProgressTrack: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  hourlyProgressFill: {
    height: '100%',
    borderRadius: 2,
  },

  // 4. Recent Attendance Log Styling
  recentTotalText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  attendanceFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  attFilterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  attFilterPillActive: {
    backgroundColor: COLORS.softBlue,
    borderColor: COLORS.primary,
  },
  attFilterPillActiveGreen: {
    backgroundColor: '#DCFCE7',
    borderColor: COLORS.success,
  },
  attFilterPillActiveAmber: {
    backgroundColor: '#FEF3C7',
    borderColor: COLORS.warning,
  },
  attFilterPillActiveRed: {
    backgroundColor: '#FEE2E2',
    borderColor: COLORS.danger,
  },
  attFilterText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  attFilterTextActive: {
    color: COLORS.primary,
  },
  attFilterTextActiveGreen: {
    color: COLORS.successDark,
  },
  attFilterTextActiveAmber: {
    color: COLORS.warningDark,
  },
  attFilterTextActiveRed: {
    color: COLORS.dangerDark,
  },
  emptyAttendanceCard: {
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyAttendanceText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  attendanceCard: {
    padding: 14,
    marginBottom: 10,
  },
  attCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  attUserCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  attAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.border,
    marginRight: 10,
  },
  attUserInfo: {
    flex: 1,
  },
  attTechName: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  attEmpIdPill: {
    backgroundColor: COLORS.softBlue,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADII.sm,
  },
  attEmpIdText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
  },
  attSubstationText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  attMetricsStrip: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: RADII.sm,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  attMetricCell: {
    flex: 1,
    alignItems: 'center',
  },
  attMetricLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  attMetricVal: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 2,
  },

  // Command & Control Grid
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  quickCard: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderRadius: RADII.card,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  quickSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  modalUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.border,
  },
  modalTechName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  modalEmpId: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 1,
  },
  modalDesig: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  modalInfoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADII.card,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 12,
  },
  modalBoxTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  modalBoxVal: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  modalTimingsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  modalTimingItem: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: RADII.sm,
    padding: 10,
    alignItems: 'center',
  },
  modalTimingLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  modalTimingVal: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  modalPhotoSection: {
    marginBottom: 14,
  },
  modalPhotoPreview: {
    width: '100%',
    height: 180,
    borderRadius: RADII.card,
    backgroundColor: '#0F172A',
    marginTop: 4,
  },
  modalPhotoNote: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 6,
    fontStyle: 'italic',
  },
  modalRemarksBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: RADII.card,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 14,
  },
  modalRemarksText: {
    fontSize: 12,
    color: COLORS.textPrimary,
    fontStyle: 'italic',
    lineHeight: 16,
  },

  // Photo 2: Recent Attendance Section Header
  recentAttendanceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  recentAttendanceTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  recentAttendanceSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E63F0',
  },

  // Photo 2: Recent Attendance Table
  tableCardContainer: {
    padding: 0,
    borderRadius: RADII.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  tableWrapper: {
    minWidth: 1140,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1.5,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  tableDataRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  tableDataRowAlt: {
    backgroundColor: '#FAFBFD',
  },
  tableDataCell: {
    justifyContent: 'center',
  },
  employeeNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  employeeCodeText: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  substationSiteText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  timeBoldText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  durationBlueText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E63F0',
  },
  distanceText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },

  // Photo 2: Status Pills
  statusPillHalfDay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#D8B4FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADII.pill,
    alignSelf: 'flex-start',
  },
  statusPillHalfDayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  statusPillLeave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADII.pill,
    alignSelf: 'flex-start',
  },
  statusPillLeaveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  attFilterPillActivePurple: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  attFilterTextActivePurple: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  attFilterPillActiveBlue: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  attFilterTextActiveBlue: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  statusPillLate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADII.pill,
    alignSelf: 'flex-start',
  },
  statusPillLateText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  statusPillOnTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADII.pill,
    alignSelf: 'flex-start',
  },
  statusPillOnTimeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  statusPillAbsent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADII.pill,
    alignSelf: 'flex-start',
  },
  statusPillAbsentText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },

  // Photo 2: [ ✈ View Map ] Button
  viewMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    alignSelf: 'flex-start',
  },
  viewMapBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E63F0',
  },

  emptyTableRow: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTableText: {
    fontSize: 13,
    color: '#94A3B8',
  },

  // Modal 3: Map View Styles
  mapModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  mapModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  mapModalSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  mapModalCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  mapWrapper: {
    height: 520,
    position: 'relative',
  },
  mapView: {
    width: '100%',
    height: '100%',
  },
  mapTelemetrySheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
  },
  mapTelemetryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  mapTechNameBold: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  mapStatusPillSmall: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  mapStatusPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D97706',
  },
  mapGeofenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADII.pill,
  },
  mapGeofenceBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  mapTelemetryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  mapTelemetryItem: {
    width: '31%',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mapTelemetryLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  mapTelemetryVal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  mapActionBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  openNativeMapsBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1E63F0',
    paddingVertical: 10,
    borderRadius: 10,
  },
  openNativeMapsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeMapSheetBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  closeMapSheetText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },

  // Status Distribution Pie Chart Styles
  pieChartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 16,
  },
  pieChartWrapper: {
    width: 130,
    height: 130,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenterValue: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  donutCenterLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
  },
  pieLegendCol: {
    flex: 1,
    gap: 10,
  },
  pieLegendItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  pieLegendIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  pieLegendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pieLegendTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  pieLegendCount: {
    fontSize: 13,
    fontWeight: '800',
  },
  pieLegendPct: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  pieLegendSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
});
