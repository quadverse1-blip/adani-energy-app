import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, RADII, SHADOWS } from '../../constants/theme';

interface AppCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const AppCard: React.FC<AppCardProps> = ({ children, style }) => {
  return <View style={[styles.card, SHADOWS.sm, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
});
