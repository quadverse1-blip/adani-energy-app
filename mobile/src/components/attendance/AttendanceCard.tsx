import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Clock, ChevronRight } from 'lucide-react-native';
import { AttendanceRecord } from '../../types';
import { COLORS, RADII } from '../../constants/theme';
import { AppCard } from '../common/AppCard';
import { StatusBadge } from '../common/StatusBadge';

interface AttendanceCardProps {
  record: AttendanceRecord;
  onPress: () => void;
}

export const AttendanceCard: React.FC<AttendanceCardProps> = ({ record, onPress }) => {
  // Format day and date
  const dateObj = new Date(record.date);
  const dayName = isNaN(dateObj.getTime())
    ? ''
    : dateObj.toLocaleDateString('en-US', { weekday: 'short' });

  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  let monthText = 'OCT';
  if (record.date) {
    const parts = record.date.split('-');
    if (parts.length >= 2) {
      const mIdx = parseInt(parts[1], 10) - 1;
      if (mIdx >= 0 && mIdx < 12) monthText = monthNames[mIdx];
    }
  }

  const formatTime = (isoString?: string) => {
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

  const checkInTime = formatTime(record.checkIn?.time);
  const isCurrentlyActive = !!record.checkIn && !record.checkOut;
  const checkOutTime = isCurrentlyActive ? 'In Progress' : formatTime(record.checkOut?.time);

  const isHalfDay = Boolean(
    record.isHalfDay ||
    record.attendanceCategory === 'HALF_DAY' ||
    record.status === 'half_day' ||
    (record as any).shiftStatus === 'half_day'
  );
  const effectiveStatus = isHalfDay ? 'half_day' : record.status;

  const durationStr =
    record.workingMinutes > 0
      ? `${Math.floor(record.workingMinutes / 60)}h ${record.workingMinutes % 60}m`
      : isCurrentlyActive
      ? 'Active Shift'
      : '--';

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <AppCard style={styles.card}>
        <View style={styles.mainRow}>
          {/* Date Column */}
          <View style={styles.dateCol}>
            <Text style={styles.dayText}>{dayName.toUpperCase()}</Text>
            <Text style={styles.dateText}>{record.date.substring(8, 10)}</Text>
            <Text style={styles.monthText}>{monthText}</Text>
          </View>

          {/* Details Column */}
          <View style={styles.detailsCol}>
            <View style={styles.topDetailsRow}>
              <StatusBadge status={effectiveStatus} size="sm" />
              <View style={styles.durationRow}>
                <Clock size={12} color={isCurrentlyActive ? '#10B981' : COLORS.textSecondary} />
                <Text style={[styles.durationText, isCurrentlyActive && { color: '#059669', fontWeight: '800' }]}>
                  {durationStr}
                </Text>
              </View>
            </View>

            {record.siteName ? (
              <Text style={styles.siteNameText} numberOfLines={1}>
                {record.siteName}
              </Text>
            ) : null}

            <View style={styles.timesRow}>
              <View style={styles.timeBox}>
                <Text style={styles.timeLabel}>In</Text>
                <Text style={styles.timeVal}>{checkInTime}</Text>
              </View>
              <Text style={styles.divider}>→</Text>
              <View style={styles.timeBox}>
                <Text style={styles.timeLabel}>Out</Text>
                <Text style={[styles.timeVal, isCurrentlyActive && { color: '#059669', fontWeight: '700' }]}>
                  {checkOutTime}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.arrowCol}>
            <ChevronRight size={18} color={COLORS.textMuted} />
          </View>
        </View>
      </AppCard>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 12,
    marginBottom: 10,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateCol: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    paddingRight: 10,
  },
  dayText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  dateText: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  monthText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  detailsCol: {
    flex: 1,
    paddingHorizontal: 12,
  },
  topDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  siteNameText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.darkBlue,
    marginBottom: 4,
  },
  timesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  timeLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  timeVal: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  divider: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  arrowCol: {
    paddingLeft: 4,
  },
});
