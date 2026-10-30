import { Platform } from 'react-native';

export const COLORS = {
  primary: '#1E63F0',
  darkBlue: '#1541A7',
  softBlue: '#EFF6FF',
  
  success: '#22C55E',
  successDark: '#16A34A',
  
  danger: '#EF4444',
  dangerDark: '#DC2626',
  
  warning: '#F59E0B',
  warningDark: '#D97706',
  
  background: '#F8FAFC',
  card: '#FFFFFF',
  
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  
  badgeGreenBg: '#DCFCE7',
  badgeGreenText: '#15803D',
  badgeAmberBg: '#FEF3C7',
  badgeAmberText: '#B45309',
  badgeRedBg: '#FEE2E2',
  badgeRedText: '#B91C1C',
  badgeBlueBg: '#DBEAFE',
  badgeBlueText: '#1D4ED8',
  badgeGreyBg: '#F1F5F9',
  badgeGreyText: '#475569',
};

export const SHADOWS = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#1E63F0',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const FONTS = {
  regular: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }),
  medium: Platform.select({ ios: 'System', android: 'Roboto-Medium', default: 'System' }),
  bold: Platform.select({ ios: 'System', android: 'Roboto-Bold', default: 'System' }),
};

export const RADII = {
  sm: 8,
  btn: 12,
  card: 16,
  pill: 9999,
};
