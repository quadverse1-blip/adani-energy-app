import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, RADII } from '../../constants/theme';

interface StatusBadgeProps {
  status: string;
  label?: string;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  style,
}) => {
  const norm = (status || '').toLowerCase().replace(/[\s-]/g, '_');

  let bg = COLORS.badgeGreyBg;
  let text = COLORS.badgeGreyText;
  let displayLabel = label || norm.replace('_', ' ').toUpperCase();

  switch (norm) {
    case 'present':
    case 'paid':
    case 'active':
    case 'inside_geofence':
    case 'on_duty_inside':
      bg = COLORS.badgeGreenBg;
      text = COLORS.badgeGreenText;
      break;

    case 'late':
    case 'warning':
    case 'processing':
    case 'on_duty_outside':
      bg = COLORS.badgeAmberBg;
      text = COLORS.badgeAmberText;
      break;

    case 'half_day':
    case 'half-day':
      bg = '#FFEDD5';
      text = '#C2410C';
      displayLabel = label || 'HALF DAY';
      break;

    case 'absent':
    case 'danger':
    case 'outside_geofence':
    case 'inactive':
      bg = COLORS.badgeRedBg;
      text = COLORS.badgeRedText;
      break;

    case 'on_duty':
    case 'completed':
    case 'technician':
    case 'supervisor':
      bg = COLORS.badgeBlueBg;
      text = COLORS.badgeBlueText;
      break;

    case 'weekly_off':
    case 'holiday':
    case 'offline':
    default:
      bg = COLORS.badgeGreyBg;
      text = COLORS.badgeGreyText;
      break;
  }

  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          paddingVertical: isSmall ? 3 : 5,
          paddingHorizontal: isSmall ? 8 : 12,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: text,
            fontSize: isSmall ? 10 : 12,
          },
        ]}
      >
        {displayLabel}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: RADII.pill,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
