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
import { useAdminDrawerStore } from '../../store/useAdminDrawerStore';
import { useAuthStore } from '../../store/useAuthStore';
import { COLORS, RADII, SHADOWS } from '../../constants/theme';

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

const MENU_ITEMS: NavMenuItem[] = [
  {
    key: 'AdminDashboard',
    label: 'Dashboard',
    subLabel: 'KPI metrics & live stats',
    screenName: 'AdminDashboard',
    icon: LayoutDashboard,
  },
  {
    key: 'Employees',
    label: 'Employees',
    subLabel: 'Workforce & GPS locations',
    screenName: 'Employees',
    icon: Users,
    badge: 'Active',
    badgeColor: '#10B981',
  },
  {
    key: 'Sites',
    label: 'Substations',
    subLabel: 'Grid infrastructure & zones',
    screenName: 'Sites',
    icon: Zap,
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
    label: 'Attendance Logs',
    subLabel: 'Shift ledger & adjustments',
    screenName: 'AttendanceLogs',
    icon: List,
    badge: 'LEDGER',
    badgeColor: '#F59E0B',
  },
  {
    key: 'Reports',
    label: 'Reports & Export',
    subLabel: 'Muster roll & Excel export',
    screenName: 'Reports',
    icon: FileSpreadsheet,
    badge: 'EXCEL',
    badgeColor: '#059669',
  },
  {
    key: 'Salary',
    label: 'Compensation',
    subLabel: 'Shift wages & overtime',
    screenName: 'Salary',
    icon: Banknote,
  },
];

export const AdminDrawerModal: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isOpen, activeRoute, closeDrawer } = useAdminDrawerStore();
  const { user, logout } = useAuthStore();

  if (!isOpen) return null;

  const handleNavigate = (screenName: string) => {
    closeDrawer();
    if (screenName === 'AdminDashboard') {
      navigation.reset({
        index: 0,
        routes: [{ name: 'AdminDashboard' }],
      });
    } else {
      navigation.reset({
        index: 1,
        routes: [
          { name: 'AdminDashboard' },
          { name: screenName },
        ],
      });
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of the Operations Admin account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          closeDrawer();
          logout();
        },
      },
    ]);
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={closeDrawer}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop: click to close */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={closeDrawer}
        />

        {/* Drawer Container */}
        <View
          style={[
            styles.drawerContainer,
            {
              width: DRAWER_WIDTH,
              paddingTop: Math.max(insets.top, 24),
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          {/* Header Profile Section */}
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View style={styles.logoBadge}>
                <Shield size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.brandTitle}>ADANI POWER</Text>
                <Text style={styles.brandSub}>Operations Control Portal</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={closeDrawer}
                activeOpacity={0.7}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Admin User Card */}
            <View style={styles.userCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>AD</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.userName} numberOfLines={1}>
                  {user?.name || 'Operations Admin'}
                </Text>
                <Text style={styles.userRole}>
                  {user?.employeeId || 'b4S/Adani/Admin'} • Administrator
                </Text>
              </View>
              <View style={styles.liveIndicator}>
                <View style={styles.pulsingGreen} />
              </View>
            </View>
          </View>

          {/* Navigation Items List */}
          <ScrollView
            style={styles.menuScroll}
            contentContainerStyle={styles.menuScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionHeader}>NAVIGATION PAGES</Text>

            {MENU_ITEMS.map((item) => {
              const IconComp = item.icon;
              const isActive = activeRoute === item.key;

              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.menuItem, isActive && styles.menuItemActive]}
                  onPress={() => handleNavigate(item.screenName)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.iconWrap,
                      isActive && styles.iconWrapActive,
                    ]}
                  >
                    <IconComp
                      size={20}
                      color={isActive ? '#FFFFFF' : '#475569'}
                    />
                  </View>

                  <View style={styles.menuItemBody}>
                    <View style={styles.menuItemTitleRow}>
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
              activeOpacity={0.8}
            >
              <LogOut size={18} color="#EF4444" />
              <Text style={styles.logoutText}>Sign Out of Admin</Text>
            </TouchableOpacity>

            <View style={styles.versionRow}>
              <Activity size={12} color="#94A3B8" />
              <Text style={styles.versionText}>Adani Smart Grid OS • v2.4.0</Text>
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
    backgroundColor: '#FFFFFF',
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 16,
    zIndex: 999,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1E63F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  brandSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#3730A3',
  },
  userName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  userRole: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
  },
  liveIndicator: {
    padding: 4,
  },
  pulsingGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 8,
  },
  menuScroll: {
    flex: 1,
  },
  menuScrollContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 4,
  },
  menuItemActive: {
    backgroundColor: '#EFF6FF',
    borderLeftWidth: 3,
    borderLeftColor: '#1E63F0',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconWrapActive: {
    backgroundColor: '#1E63F0',
  },
  menuItemBody: {
    flex: 1,
  },
  menuItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  menuItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  menuItemTitleActive: {
    fontWeight: '800',
    color: '#1E63F0',
  },
  menuItemSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    paddingVertical: 11,
    borderRadius: 10,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  versionText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
