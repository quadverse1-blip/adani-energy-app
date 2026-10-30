import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { MapPin, Navigation, Phone, Mail, Zap } from 'lucide-react-native';
import { Substation } from '../../types';
import { COLORS, RADII } from '../../constants/theme';
import { AppCard } from '../common/AppCard';
import { AppButton } from '../common/AppButton';

interface SiteCardProps {
  site: Substation;
  distanceMeters?: number;
  onPressDetails?: () => void;
  showDirectionsButton?: boolean;
}

export const SiteCard: React.FC<SiteCardProps> = ({
  site,
  distanceMeters,
  onPressDetails,
  showDirectionsButton = true,
}) => {
  const openDirections = () => {
    const lat = site.latitude;
    const lon = site.longitude;
    const label = encodeURIComponent(site.name);
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lon}`,
      android: `geo:0,0?q=${lat},${lon}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
    });
    Linking.openURL(url);
  };

  const formattedDistance =
    distanceMeters !== undefined
      ? distanceMeters < 1000
        ? `${Math.round(distanceMeters)}m away`
        : `${(distanceMeters / 1000).toFixed(1)} km away`
      : null;

  return (
    <AppCard style={styles.card}>
      <TouchableOpacity activeOpacity={0.85} onPress={onPressDetails}>
        <View style={styles.topRow}>
          <View style={styles.badgeRow}>
            <View style={styles.voltageBadge}>
              <Zap size={12} color={COLORS.primary} />
              <Text style={styles.voltageText}>{site.voltageClass || '220 kV'}</Text>
            </View>
            <Text style={styles.siteCode}>{site.code}</Text>
          </View>
          {formattedDistance ? (
            <View style={styles.distanceBadge}>
              <MapPin size={12} color={COLORS.successDark} />
              <Text style={styles.distanceText}>{formattedDistance}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.siteName}>{site.name}</Text>
        <Text style={styles.address} numberOfLines={2}>
          {site.address}
        </Text>

        <View style={styles.managerInfo}>
          <Text style={styles.managerLabel}>Manager: </Text>
          <Text style={styles.managerName}>{site.manager?.name || 'Assigned Lead'}</Text>
        </View>
      </TouchableOpacity>

      {showDirectionsButton ? (
        <View style={styles.actionRow}>
          <AppButton
            title="Get Directions"
            onPress={openDirections}
            variant="outline"
            size="sm"
            icon={<Navigation size={14} color={COLORS.primary} />}
            style={styles.dirBtn}
          />
          {onPressDetails ? (
            <AppButton
              title="View Details"
              onPress={onPressDetails}
              variant="secondary"
              size="sm"
              style={styles.detailsBtn}
            />
          ) : null}
        </View>
      ) : null}
    </AppCard>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voltageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.softBlue,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADII.sm,
    gap: 4,
  },
  voltageText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  siteCode: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADII.sm,
    gap: 4,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.successDark,
  },
  siteName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  address: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  managerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  managerLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  managerName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  dirBtn: {
    flex: 1,
  },
  detailsBtn: {
    flex: 1,
  },
});
