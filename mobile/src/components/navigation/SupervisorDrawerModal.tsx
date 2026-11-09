import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  LayoutDashboard,
  Users,
  Zap,
  MapPin,
  FileSpreadsheet,
  Banknote,
  Shield,
  LogOut,
  X,
  ChevronRight,
  Activity,
  List,
} from 'lucide-react-native';
import { useSupervisorDrawerStore } from '../../store/useSupervisorDrawerStore';
import { useAuthStore } from '../../store/useAuthStore';
import { COLORS, RADII } from '../../constants/theme';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(width * 0.82, 340);

interface NavMenuItem {
  key: string;
  label: string;
  subLabel: string;
  screenName: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  badge?: string;
  badgeColor?: string;
}

const SUPERVISOR_MENU_ITEMS: NavMenuItem[] = [
  {
    key: 'SupervisorDashboard',
    label: 'Supervisor Desk',
    subLabel: 'Shift punch & live field operations',
    screenName: 'SupervisorDashboard',
    icon: LayoutDashboard,
  },
  {
    key: 'Tracking',
    label: 'Location Tracking',
    subLabel: 'Real-time GPS telemetry & roster',
    screenName: 'Tracking',
    icon: MapPin,
    badge: 'LIVE',
    badgeColor: '#10B981',
  },
  {
    key: 'AttendanceLogs',
    label: 'Attendance History',
    subLabel: 'Shift history, duration & punctuality',
    screenName: 'AttendanceLogs',
    icon: List,
    badge: 'HISTORY',
    badgeColor: '#1E63F0',
  },
  {
    key: 'Sites',
    label: 'Site Management',
    subLabel: 'Assign staff substations & zones',
    screenName: 'Sites',
    icon: Zap,
    badge: 'MANAGE',
    badgeColor: '#1E63F0',
  },
  {
    key: 'Salary',
    label: 'Salary Slip',
    subLabel: 'Retrieve verified monthly salary slips',
    screenName: 'Salary',
    icon: Banknote,
  },
];

export const SupervisorDrawerModal: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isOpen, activeRoute, closeDrawer } = useSupervisorDrawerStore();
  const { user, logout } = useAuthStore();

  if (!isOpen) return null;

  const handleNavigate = (screenName: string) => {
    closeDrawer();
    requestAnimationFrame(() => {
      navigation.navigate(screenName);
    });
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to log out of the Operations Supervisor account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            closeDrawer();
            logout();
          },
        },
      ]
    );
  };

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'SP';

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={closeDrawer}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={closeDrawer}
        />

        <View
          style={[
            styles.drawerContainer,
            { paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.logoBadge}>
                <Shield size={18} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.brandTitle}>ADANI ELECTRICITY</Text>
                <Text style={styles.brandSub}>Area Operations Supervisor</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={closeDrawer}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Supervisor Info Card */}
            <View style={styles.userCard}>
              <View style={styles.avatarWrap}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName} numberOfLines={1}>
                  {user?.name || 'Suresh Patil'}
                </Text>
                <Text style={styles.userRole}>
                  {user?.employeeId || 'SUPER01'} • {user?.designation || 'Area Operations Supervisor'}
                </Text>
              </View>
            </View>
          </View>

          {/* Navigation Items */}
          <ScrollView
            style={styles.menuScroll}
            contentContainerStyle={styles.menuScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionTitle}>SUPERVISOR FIELD COMMAND</Text>

            {SUPERVISOR_MENU_ITEMS.map((item) => {
              const IconComp = item.icon;
              const isActive = activeRoute === item.screenName;

              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.menuItem, isActive && styles.menuItemActive]}
                  onPress={() => handleNavigate(item.screenName)}
                  activeOpacity={0.7} delayPressIn={0}
                >
                  <View
                    style={[
                      styles.iconWrap,
                      isActive && styles.iconWrapActive,
                    ]}
                  >
                    <IconComp
                      size={18}
                      color={isActive ? '#1E63F0' : '#475569'}
                    />
                  </View>

                  <View style={styles.menuTextCol}>
                    <View style={styles.menuLabelRow}>
                      <Text
                        style={[
                          styles.menuItemTitle,
                          isActive && styles.menuItemTitleActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                      {item.badge && (
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: item.badgeColor || '#2563EB' },
                          ]}
                        >
                          <Text style={styles.badgeText}>{item.badge}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.menuItemSub} numberOfLines={1}>
                      {item.subLabel}
                    </Text>
                  </View>

                  <ChevronRight
                    size={16}
                    color={isActive ? '#1E63F0' : '#CBD5E1'}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Footer Sign Out */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogout}
              activeOpacity={0.7} delayPressIn={0}
            >
              <LogOut size={18} color="#EF4444" />
              <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>

            <View style={styles.versionRow}>
              <Activity size={12} color="#94A3B8" />
              <Text style={styles.versionText}>Adani Field Command • v2.4.0</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  drawerContainer: {
    width: DRAWER_WIDTH,
    backgroundColor: '#FFFFFF',
    height: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 4, height: 0 },
    shadowRadius: 16,
    elevation: 20,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1E63F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  brandSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E63F0',
    letterSpacing: 0.2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  avatarText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1E63F0',
  },
  userName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  userRole: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },

  menuScroll: {
    flex: 1,
  },
  menuScrollContent: {
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  menuItemActive: {
    backgroundColor: '#EFF6FF',
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapActive: {
    backgroundColor: '#DBEAFE',
  },
  menuTextCol: {
    flex: 1,
  },
  menuLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  menuItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  menuItemTitleActive: {
    color: '#1E63F0',
    fontWeight: '800',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  menuItemSub: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 1,
  },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 10,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 10,
    borderRadius: 10,
  },
  logoutText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#EF4444',
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  versionText: {
    fontSize: 10.5,
    color: '#94A3B8',
  },
});
