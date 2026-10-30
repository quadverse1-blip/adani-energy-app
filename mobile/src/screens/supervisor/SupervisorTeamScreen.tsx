import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  RefreshControl,
} from 'react-native';
import {
  Users,
  ShieldCheck,
  Clock,
  AlertTriangle,
  Zap,
  CheckCircle,
  FileText,
  Menu,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useSupervisorDrawerStore } from '../../store/useSupervisorDrawerStore';
import { SupervisorDrawerModal } from '../../components/navigation/SupervisorDrawerModal';
import { employeeService } from '../../services/employeeService';
import { siteService } from '../../services/siteService';
import { User, Substation } from '../../types';
import { COLORS, RADII, SHADOWS } from '../../constants/theme';
import { AppCard } from '../../components/common/AppCard';
import { AppButton } from '../../components/common/AppButton';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const SupervisorTeamScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { openDrawer } = useSupervisorDrawerStore();
  const [team, setTeam] = useState<User[]>([]);
  const [sites, setSites] = useState<Substation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const emps = await employeeService.getEmployees({ role: 'technician' });
      setTeam(emps);
      const s = await siteService.getSites();
      setSites(s);
    } catch (e) {
      console.warn('Supervisor team error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleShiftOverride = (member: User) => {
    Alert.alert(
      'Supervisor Shift Timing Override',
      `Authorize emergency early checkout or grace period extension for ${member.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Authorize Override',
          onPress: () => {
            Alert.alert(
              'Override Approved',
              `Shift exception logged for ${member.name}. They may now check out without compliance flag.`
            );
          },
        },
      ]
    );
  };

  if (loading) {
    return <LoadingSpinner message="Loading zonal workforce team..." />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => openDrawer('SupervisorTeam')}
            activeOpacity={0.7}
          >
            <Menu size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerSub}>ZONAL SUPERVISOR DESK</Text>
            <Text style={styles.headerTitle}>Team & Shift Authorization</Text>
          </View>
          <TouchableOpacity
            style={styles.manageSitesBtn}
            onPress={() => navigation.navigate('Sites')}
            activeOpacity={0.7}
          >
            <Zap size={13} color="#FFFFFF" />
            <Text style={styles.manageSitesBtnText}>Manage Sites</Text>
          </TouchableOpacity>
        </View>

      {/* Managed Substations Quick Bar */}
      <Text style={styles.sectionTitle}>ASSIGNED SUBSTATIONS ({sites.length})</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sitesScroll}>
        {sites.map((site) => (
          <View key={site.id} style={[styles.siteChip, SHADOWS.sm]}>
            <Zap size={14} color={COLORS.primary} />
            <View>
              <Text style={styles.siteChipName}>{site.name}</Text>
              <Text style={styles.siteChipCode}>{site.code} • 500m</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Team Members List */}
      <Text style={styles.sectionTitle}>FIELD WORKFORCE ({team.length})</Text>
      {team.map((member) => (
        <AppCard key={member.id} style={styles.memberCard}>
          <View style={styles.memberRow}>
            <Image
              source={{
                uri:
                  member.avatar ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
              }}
              style={styles.avatar}
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={styles.nameRow}>
                <Text style={styles.memberName}>{member.name}</Text>
                <StatusBadge status="active" size="sm" />
              </View>
              <Text style={styles.memberDesig}>{member.designation}</Text>
              <Text style={styles.memberEmpId}>{member.employeeId}</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <AppButton
              title="Shift Override"
              onPress={() => handleShiftOverride(member)}
              variant="outline"
              size="sm"
              icon={<Clock size={14} color={COLORS.primary} />}
              style={{ flex: 1, marginRight: 8 }}
            />
            <AppButton
              title="Change Sites"
              onPress={() => navigation.navigate('Sites')}
              variant="primary"
              size="sm"
              icon={<Zap size={14} color="#FFF" />}
              style={{ flex: 1 }}
            />
          </View>
        </AppCard>
      ))}
      </ScrollView>
      <SupervisorDrawerModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingTop: 48,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  menuBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 8,
  },
  sitesScroll: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  siteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADII.btn,
    padding: 12,
    marginRight: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  siteChipName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  siteChipCode: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  memberCard: {
    marginBottom: 12,
    padding: 14,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.borderLight,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  memberDesig: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  memberEmpId: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  manageSitesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E63F0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  manageSitesBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
