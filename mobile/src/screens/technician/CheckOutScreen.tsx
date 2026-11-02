import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import {
  Clock,
  MapPin,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { useAttendanceStore } from '../../store/useAttendanceStore';
import { attendanceService } from '../../services/attendanceService';
import { calculateHaversineDistance } from '../../utils/haversine';
import { triggerHaptic } from '../../utils/haptics';
import { COLORS, RADII } from '../../constants/theme';
import { AppCard } from '../../components/common/AppCard';
import { AppButton } from '../../components/common/AppButton';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { formatTimeIST } from '../../utils/shiftUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBackButton } from '../../components/common/AppBackButton';

interface CheckOutScreenProps {
  navigation: any;
}

export const CheckOutScreen: React.FC<CheckOutScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const {
    todayStatus,
    todayRecord,
    assignedSite,
    liveElapsedSeconds,
    fetchTodayAttendance,
    setShiftCompleted,
  } = useAttendanceStore();

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [distanceFromSite, setDistanceFromSite] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 1. Acquire current checkout GPS
  const obtainGps = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLatitude(loc.coords.latitude);
        setLongitude(loc.coords.longitude);
        setAccuracy(loc.coords.accuracy || 15);

        if (assignedSite) {
          const d = calculateHaversineDistance(
            loc.coords.latitude,
            loc.coords.longitude,
            assignedSite.latitude,
            assignedSite.longitude
          );
          setDistanceFromSite(d);
        }
      }
    } catch (e) {
      console.warn('CheckOut GPS error:', e);
    } finally {
      setGpsLoading(false);
    }
  };

  useEffect(() => {
    obtainGps();
  }, [assignedSite]);

  // Check if current time is before 06:00 PM (18:00)
  const now = new Date();
  const isEarlyCheckout = now.getHours() < 18;
  const isTechnician = user?.role === 'technician';

  // Format times and durations
  const checkInTimeStr = (todayRecord?.checkIn as any)?.timeIST || formatTimeIST(todayRecord?.checkIn?.time);

  const currentTimeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const hoursElapsed = Math.floor(liveElapsedSeconds / 3600);
  const minutesElapsed = Math.floor((liveElapsedSeconds % 3600) / 60);
  const workingDurationStr = `${hoursElapsed} hrs ${minutesElapsed} mins`;

  // 2. Perform Check-Out
  const handleConfirmCheckout = async () => {
    setSubmitting(true);
    try {
      const record = await attendanceService.checkOut({
        latitude: latitude || 18.5913,
        longitude: longitude || 73.7389,
        accuracy: accuracy || 15,
        remarks: isEarlyCheckout ? 'Early checkout requested' : 'Standard checkout',
      });

      setShiftCompleted(record);
      await fetchTodayAttendance();
      triggerHaptic('success');
      setShowConfirmModal(false);

      Alert.alert(
        'Shift Concluded',
        `Your shift has concluded with net duration of ${record.workingHoursFormatted || workingDurationStr}. Great job today!`,
        [{ text: 'Return to Dashboard', onPress: () => navigation.navigate('Dashboard') }]
      );
    } catch (err: any) {
      Alert.alert('Checkout Error', err.message || 'Failed to submit check-out');
    } finally {
      setSubmitting(false);
    }
  };

  if (todayStatus !== 'active') {
    return (
      <View style={styles.notActiveContainer}>
        <CheckCircle size={48} color={COLORS.primary} />
        <Text style={styles.notActiveTitle}>
          {todayStatus === 'completed' ? 'Shift Completed' : 'No Active Shift'}
        </Text>
        <Text style={styles.notActiveSub}>
          {todayStatus === 'completed'
            ? 'You have already concluded your shift attendance for today.'
            : 'You must first check in before checking out.'}
        </Text>
        <AppButton
          title="Return to Dashboard"
          onPress={() => navigation.navigate('Dashboard')}
          variant="primary"
          style={{ marginTop: 18 }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={{
        paddingTop: Math.max(insets.top, 16) + 8,
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}>
        <AppBackButton />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A' }}>Shift Check-Out</Text>
          <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '500' }}>
            Conclude working shift telemetry and log official departure
          </Text>
        </View>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Early departure warning banner if before 18:00 */}
      {isEarlyCheckout && isTechnician ? (
        <View style={styles.warningBanner}>
          <AlertTriangle size={22} color={COLORS.warningDark} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.warningTitle}>Early Departure Warning</Text>
            <Text style={styles.warningText}>
              Shift scheduled until 06:00 PM. Early check-out requires supervisor approval and will
              be flagged in compliance reports.
            </Text>
          </View>
        </View>
      ) : null}

      {/* Shift Live Working Summary Card */}
      <AppCard style={styles.summaryCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardHeaderTitle}>TODAY'S SHIFT SUMMARY</Text>
          <View style={styles.onDutyPill}>
            <Text style={styles.onDutyText}>ON DUTY</Text>
          </View>
        </View>

        <View style={styles.metricRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>PUNCH IN TIME</Text>
            <Text style={styles.metricValue}>{checkInTimeStr}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>CURRENT TIME</Text>
            <Text style={styles.metricValue}>{currentTimeStr}</Text>
          </View>
        </View>

        <View style={styles.durationBox}>
          <Clock size={18} color={COLORS.primary} />
          <Text style={styles.durationLabel}>TOTAL DURATION ACCRUED:</Text>
          <Text style={styles.durationValue}>{workingDurationStr}</Text>
        </View>
      </AppCard>

      {/* Location Telemetry Card */}
      <AppCard style={styles.locationCard}>
        <Text style={styles.cardHeaderTitle}>DEPARTURE GPS TELEMETRY</Text>

        <View style={styles.locationItem}>
          <MapPin size={16} color={COLORS.primary} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.locationLabel}>Assigned Substation</Text>
            <Text style={styles.locationValue}>
              {assignedSite?.name || 'Pune Phase 1 Substation'}
            </Text>
          </View>
        </View>

        <View style={styles.locationItem}>
          <ShieldCheck size={16} color={COLORS.successDark} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.locationLabel}>Current GPS Fix</Text>
            <Text style={styles.locationValue}>
              {latitude && longitude
                ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${accuracy?.toFixed(0)}m)`
                : gpsLoading
                ? 'Acquiring GPS fix...'
                : '18.591270, 73.738910 (High Accuracy)'}
            </Text>
          </View>
        </View>

        {distanceFromSite !== null ? (
          <View style={styles.distanceRow}>
            <Text style={styles.distanceLabel}>Distance from Substation:</Text>
            <Text style={styles.distanceVal}>{distanceFromSite.toFixed(0)} meters</Text>
          </View>
        ) : null}
      </AppCard>

      {/* Check Out CTA */}
      <View style={styles.ctaContainer}>
        <AppButton
          title="Conclude Shift & Check Out"
          onPress={() => setShowConfirmModal(true)}
          variant="danger"
          size="lg"
          icon={<ArrowRight size={18} color="#FFFFFF" />}
        />
      </View>

      {/* Section 12 Required Confirmation Modal */}
      <ConfirmationModal
        visible={showConfirmModal}
        title="Conclude Shift"
        message="Are you sure you want to conclude your shift?"
        confirmTitle="Confirm Check-Out"
        cancelTitle="Cancel"
        variant={isEarlyCheckout ? 'warning' : 'danger'}
        onConfirm={handleConfirmCheckout}
        onCancel={() => setShowConfirmModal(false)}
        loading={submitting}
      >
        <View style={styles.modalSummaryBox}>
          <View style={styles.modalRow}>
            <Text style={styles.modalRowLabel}>Total Working Duration:</Text>
            <Text style={styles.modalRowVal}>{workingDurationStr}</Text>
          </View>
          <View style={styles.modalRow}>
            <Text style={styles.modalRowLabel}>Check-In Time:</Text>
            <Text style={styles.modalRowVal}>{checkInTimeStr}</Text>
          </View>
          <View style={styles.modalRow}>
            <Text style={styles.modalRowLabel}>Current Time:</Text>
            <Text style={styles.modalRowVal}>{currentTimeStr}</Text>
          </View>
        </View>
      </ConfirmationModal>
    </ScrollView>
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
  screenHeader: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  screenSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: RADII.btn,
    padding: 14,
    marginBottom: 16,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.warningDark,
  },
  warningText: {
    fontSize: 12,
    color: '#92400E',
    marginTop: 2,
    lineHeight: 16,
  },
  summaryCard: {
    marginBottom: 14,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
  },
  onDutyPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADII.sm,
  },
  onDutyText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.successDark,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  durationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.softBlue,
    padding: 12,
    borderRadius: RADII.sm,
    gap: 8,
  },
  durationLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  durationValue: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.darkBlue,
  },
  locationCard: {
    marginBottom: 20,
    padding: 16,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  locationLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  locationValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 1,
  },
  distanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  distanceLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  distanceVal: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  ctaContainer: {
    marginTop: 8,
  },
  modalSummaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADII.sm,
    padding: 12,
    gap: 8,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalRowLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  modalRowVal: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  notActiveContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  notActiveTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 16,
    marginBottom: 6,
  },
  notActiveSub: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
