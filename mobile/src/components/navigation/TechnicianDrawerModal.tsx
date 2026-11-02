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
  Zap,
  MapPin,
  Banknote,
  LogOut,
  X,
  ChevronRight,
  List,
  User as UserIcon,
  ShieldCheck,
  Clock,
  Sparkles,
} from 'lucide-react-native';
import { useTechnicianDrawerStore } from '../../store/useTechnicianDrawerStore';
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

const TECHNICIAN_MENU_ITEMS: NavMenuItem[] = [
  {
    key: 'Dashboard',
    label: 'Field Desk',
    subLabel: 'Shift punch & live work hours',
    screenName: 'Dashboard',
    icon: LayoutDashboard,
    badge: 'LIVE',
    badgeColor: '#10B981',
  },
  {
    key: 'Today',
    label: "Today's Attendance Status",
    subLabel: 'Daily verified shift audit & telemetry',
    screenName: 'Today',
    icon: Clock,
    badge: 'AUDIT',
    badgeColor: '#F59E0B',
  },
  {
    key: 'CheckIn',
    label: 'Field Shift Check-In',
    subLabel: 'GPS radar & 500m geofence punch',
    screenName: 'CheckIn',
    icon: MapPin,
    badge: 'RADAR',
    badgeColor: '#EF4444',
  },
  {
    key: 'History',
    label: 'Attendance History',
    subLabel: 'Punctuality records & shift logs',
    screenName: 'History',
    icon: List,
    badge: 'LOGS',
    badgeColor: '#1E63F0',
  },
  {
    key: 'Salary',
    label: 'Compensation & Slip',
    subLabel: 'Verified monthly payout & slips',
    screenName: 'Salary',
    icon: Banknote,
    badge: 'PAYSLIP',
    badgeColor: '#059669',
  },
];

export const TechnicianDrawerModal: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isOpen, activeRoute, closeDrawer } = useTechnicianDrawerStore();
  const { user, logout } = useAuthStore();

  if (!isOpen) return null;

  const handleNavigate = (screenName: string) => {
    closeDrawer();
    requestAnimationFrame(() => {
      navigation.navigate(screenName);
    });
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      `Sign out of technician account ${user?.employeeId || ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            closeDrawer();
            await logout();
          },
        },
      ]
    );
  };

  const initials = (user?.name || 'Rohit Sharma')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={closeDrawer}
    >
      <View style={styles.modalOverlay}>
        {/* Backdrop touchable to close */}
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
              paddingTop: Math.max(insets.top, 24),
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          {/* Header Bar */}
          <View style={styles.drawerHeader}>
            <View style={styles.brandRow}>
              <View style={styles.brandIconWrap}>
                <ShieldCheck size={18} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.brandTitle}>ADANI POWER</Text>
                <Text style={styles.brandSubtitle}>FIELD WORKFORCE PORTAL</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={closeDrawer}
              activeOpacity={0.7} delayPressIn={0}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={20} color="#475569" />
            </TouchableOpacity>
          </View>

          {/* User Profile Card */}
          <View style={styles.userCard}>
            <View style={styles.userAvatarWrap}>
              <Text style={styles.userInitials}>{initials}</Text>
            </View>
            <View style={styles.userInfoWrap}>
              <View style={styles.userNameBadgeRow}>
                <Text style={styles.userNameText} numberOfLines={1}>
                  {user?.name || 'Rohit Sharma'}
                </Text>
              </View>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>FIELD TECHNICIAN</Text>
              </View>
              <Text style={styles.userMetaText}>
                {user?.employeeId || 'b4S/Adani/01'}
              </Text>
              <View style={styles.siteMiniRow}>
                <MapPin size={10} color="#1E63F0" style={{ marginRight: 3 }} />
                <Text style={styles.siteMiniText} numberOfLines={1}>
                  {user?.assignedSiteId || 'st. joseph university'}
                </Text>
              </View>
            </View>
          </View>

          {/* Nav Section Label */}
          <View style={styles.sectionDivider}>
            <Text style={styles.sectionLabel}>TECHNICIAN NAVIGATION</Text>
          </View>

          {/* Menu Items List */}
          <ScrollView
            style={styles.menuScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.menuScrollContent}
          >
            {TECHNICIAN_MENU_ITEMS.map((item) => {
              const IconComp = item.icon;
              const isActive =
                activeRoute === item.key || activeRoute === item.screenName;

              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.menuItem,
                    isActive && styles.menuItemActive,
                  ]}
                  onPress={() => handleNavigate(item.screenName)}
                  activeOpacity={0.75}
                >
                  <View
                    style={[
                      styles.menuIconWrap,
                      isActive && styles.menuIconWrapActive,
                    ]}
                  >
                    <IconComp
                      size={18}
                      color={isActive ? '#FFFFFF' : '#475569'}
                    />
                  </View>

                  <View style={styles.menuTextWrap}>
                    <View style={styles.menuTitleRow}>
                      <Text
                        style={[
                          styles.menuLabel,
                          isActive && styles.menuLabelActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                      {item.badge && (
                        <View
                          style={[
                            styles.itemBadge,
                            {
                              backgroundColor:
                                item.badgeColor || '#1E63F0',
                            },
                          ]}
                        >
                          <Text style={styles.itemBadgeText}>
                            {item.badge}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.menuSubLabel,
                        isActive && styles.menuSubLabelActive,
                      ]}
                      numberOfLines={1}
                    >
                      {item.subLabel}
                    </Text>
                  </View>

                  <ChevronRight
                    size={16}
                    color={isActive ? '#1E63F0' : '#94A3B8'}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Shift Rules Info Box */}
          <View style={styles.shiftRuleCard}>
            <Clock size={14} color="#2563EB" style={{ marginRight: 6 }} />
            <Text style={styles.shiftRuleText}>
              Shift Window: 09:00 AM – 06:00 PM IST • Auto Checkout at 06:00 PM
            </Text>
          </View>

          {/* Footer Bar with Sign Out */}
          <View style={styles.drawerFooter}>
            <TouchableOpacity
              style={styles.signOutBtn}
              onPress={handleSignOut}
              activeOpacity={0.7} delayPressIn={0}
            >
              <LogOut size={16} color="#DC2626" />
              <Text style={styles.signOutBtnText}>Sign Out</Text>
            </TouchableOpacity>

            <Text style={styles.footerAppVersion}>
              Adani Field Service v2.4.0 • GPS Telemetry Active
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  drawerContainer: {
    width: DRAWER_WIDTH,
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 4, height: 0 },
    shadowRadius: 16,
    elevation: 20,
    zIndex: 9999,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandIconWrap: {
    width: 34,
    height: 34,
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
  brandSubtitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    marginHorizontal: 16,
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  userAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#93C5FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInitials: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E63F0',
  },
  userInfoWrap: {
    flex: 1,
  },
  userNameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  roleBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1E40AF',
    letterSpacing: 0.4,
  },
  userMetaText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  siteMiniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  siteMiniText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1E63F0',
  },
  sectionDivider: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  menuScroll: {
    flex: 1,
  },
  menuScrollContent: {
    paddingHorizontal: 12,
    gap: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 12,
  },
  menuItemActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIconWrapActive: {
    backgroundColor: '#1E63F0',
  },
  menuTextWrap: {
    flex: 1,
  },
  menuTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  menuLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  menuLabelActive: {
    fontWeight: '800',
    color: '#1E63F0',
  },
  menuSubLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  menuSubLabelActive: {
    color: '#3B82F6',
  },
  itemBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  itemBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  shiftRuleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    marginHorizontal: 14,
    marginVertical: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  shiftRuleText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '600',
    color: '#1E40AF',
    lineHeight: 14,
  },
  drawerFooter: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 11,
    borderRadius: 10,
    gap: 8,
  },
  signOutBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
  },
  footerAppVersion: {
    fontSize: 9,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
  },
});
