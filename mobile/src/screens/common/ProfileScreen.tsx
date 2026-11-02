import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  User as UserIcon,
  Phone,
  Mail,
  Zap,
  Shield,
  LogOut,
  Database,
  Smartphone,
  ChevronRight,
  Menu,
  ArrowLeft,
  Bell,
  CheckCircle2,
  Radio,
  Sliders,
  Building,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTechnicianDrawerStore } from '../../store/useTechnicianDrawerStore';
import { useSupervisorDrawerStore } from '../../store/useSupervisorDrawerStore';
import { useAdminDrawerStore } from '../../store/useAdminDrawerStore';
import { TechnicianDrawerModal } from '../../components/navigation/TechnicianDrawerModal';
import { SupervisorDrawerModal } from '../../components/navigation/SupervisorDrawerModal';
import { AdminDrawerModal } from '../../components/navigation/AdminDrawerModal';
import { useAuthStore } from '../../store/useAuthStore';
import { useAttendanceStore } from '../../store/useAttendanceStore';
import { CONFIG } from '../../config';
import { AppBackButton } from '../../components/common/AppBackButton';
import { COLORS, RADII, SHADOWS } from '../../constants/theme';
import { AppCard } from '../../components/common/AppCard';
import { AppButton } from '../../components/common/AppButton';
import { StatusBadge } from '../../components/common/StatusBadge';

export const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const techDrawer = useTechnicianDrawerStore();
  const supDrawer = useSupervisorDrawerStore();
  const adminDrawer = useAdminDrawerStore();
  const { user, logout } = useAuthStore();
  const { pendingSyncCount, syncOfflineQueue } = useAttendanceStore();

  const userRole = user?.role || 'technician';
  const isAdmin = userRole === 'admin';
  const isSupervisor = userRole === 'supervisor';

  const handleOpenDrawer = () => {
    if (isAdmin) {
      adminDrawer.openDrawer('Profile');
    } else if (isSupervisor) {
      supDrawer.openDrawer('Profile');
    } else {
      techDrawer.openDrawer('Profile');
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of the Adani platform?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: logout,
      },
    ]);
  };

  const profileHeaderTitle = isAdmin
    ? 'Administrator Profile'
    : isSupervisor
    ? 'Supervisor Profile'
    : 'Employee Profile';

  return (
    <View style={[styles.screen, { paddingTop: Math.max(insets.top, 16) }]}>
      {/* Top Navigation Bar */}
      <View style={styles.topNavHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <AppBackButton />
          <TouchableOpacity
            style={styles.navHeaderBtn}
            onPress={handleOpenDrawer}
            activeOpacity={0.7}
          >
            <Menu size={20} color="#0F172A" />
          </TouchableOpacity>
        </View>
        <Text style={styles.navHeaderTitle}>{profileHeaderTitle}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Profile Hero Card */}
        <AppCard style={styles.heroCard}>
          <Image
            source={{
              uri:
                user?.avatar ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
            }}
            style={styles.avatar}
          />
          <Text style={styles.name}>{user?.name || 'Authorized User'}</Text>
          <Text style={styles.desig}>{user?.designation || (isAdmin ? 'Operations Admin' : isSupervisor ? 'Zonal Supervisor' : 'Field Technician')}</Text>
          <View style={styles.badgeRow}>
            <StatusBadge status={userRole} size="sm" />
            <View style={styles.empIdBadge}>
              <Text style={styles.empIdText}>{user?.employeeId || '--'}</Text>
            </View>
          </View>
        </AppCard>

        {/* NOTIFICATION & FIELD STATUS (Role-Aware) */}
        <AppCard style={styles.card}>
          <Text style={styles.sectionTitle}>NOTIFICATION & FIELD STATUS</Text>

          <View style={styles.infoRow}>
            <Bell size={16} color="#2563EB" />
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Push & In-App Alerts</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <View style={styles.statusDotLive} />
                <Text style={[styles.infoVal, { color: '#16A34A' }]}>Active • Instant Cloud Delivery</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Radio size={16} color="#059669" />
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Field Operational Status</Text>
              <Text style={styles.infoVal}>
                {isAdmin
                  ? 'HQ Central Command • Full Authority'
                  : isSupervisor
                  ? 'Zonal Oversight • Shift Clearance Active'
                  : 'On-Field Operational • Geofence Monitoring'}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Sliders size={16} color="#7C3AED" />
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Alert Preferences</Text>
              <Text style={styles.infoVal}>
                {isAdmin
                  ? 'System Audits, Roster Updates & Salary Reports'
                  : isSupervisor
                  ? 'Shift Authorizations, Attendance Alerts & Team Logs'
                  : 'Check-in Reminders, Shift Timers & Slip Uploads'}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <CheckCircle2 size={16} color="#0284C7" />
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Notification Channel Status</Text>
              <Text style={styles.infoVal}>FCM Connected • Live Synchronized</Text>
            </View>
          </View>
        </AppCard>

        {/* Contact & Department Information */}
        <AppCard style={styles.card}>
          <Text style={styles.sectionTitle}>ORGANIZATION DETAILS</Text>
          
          <View style={styles.infoRow}>
            <Shield size={16} color={COLORS.primary} />
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Department</Text>
              <Text style={styles.infoVal}>
                {user?.department || (isAdmin ? 'Executive Management' : isSupervisor ? 'Zonal Workforce Coordination' : 'Smart Meter Operations')}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Phone size={16} color={COLORS.primary} />
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Registered Mobile</Text>
              <Text style={styles.infoVal}>{user?.phone || '--'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Mail size={16} color={COLORS.primary} />
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Company Email</Text>
              <Text style={styles.infoVal}>{user?.email || '--'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Zap size={16} color={COLORS.primary} />
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Assigned Scope</Text>
              <Text style={styles.infoVal}>
                {isAdmin
                  ? 'Enterprise Multi-Site Command'
                  : user?.assignedSiteId || (user?.assignedSiteIds && user.assignedSiteIds.length > 0 ? `${user.assignedSiteIds.length} Assigned Sites` : 'All Zonal Sites')}
              </Text>
            </View>
          </View>
        </AppCard>

        {/* System & Telemetry Diagnostics */}
        <AppCard style={styles.card}>
          <Text style={styles.sectionTitle}>SYSTEM & TELEMETRY</Text>

          <View style={styles.infoRow}>
            <Database size={16} color={COLORS.textSecondary} />
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>FastAPI REST Backend</Text>
              <Text style={styles.infoVal}>{CONFIG.API_BASE_URL}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Smartphone size={16} color={COLORS.textSecondary} />
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Offline Queue Telemetry</Text>
              <Text style={styles.infoVal}>
                {pendingSyncCount > 0
                  ? `${pendingSyncCount} pending transactions (Offline Cache Active)`
                  : 'All transactions synchronized with cloud'}
              </Text>
            </View>
          </View>

          {pendingSyncCount > 0 ? (
            <AppButton
              title="Force Synchronize Pending Queue"
              onPress={syncOfflineQueue}
              variant="outline"
              size="sm"
              style={{ marginTop: 10 }}
            />
          ) : null}
        </AppCard>

        {/* Logout Action */}
        <View style={{ marginTop: 10, marginBottom: 30 }}>
          <AppButton
            title="Sign Out of Platform"
            onPress={handleLogout}
            variant="danger"
            size="lg"
            icon={<LogOut size={18} color="#FFFFFF" />}
          />
        </View>
      </ScrollView>

      {/* Render appropriate drawer based on role */}
      {isAdmin ? (
        <AdminDrawerModal />
      ) : isSupervisor ? (
        <SupervisorDrawerModal />
      ) : (
        <TechnicianDrawerModal />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  heroCard: {
    alignItems: 'center',
    padding: 24,
    marginBottom: 14,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.borderLight,
    marginBottom: 12,
  },
  name: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  desig: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  empIdBadge: {
    backgroundColor: COLORS.softBlue,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADII.sm,
  },
  empIdText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  card: {
    marginBottom: 14,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  infoCol: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  infoVal: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 1,
  },
  statusDotLive: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#16A34A',
  },
});
