import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Building2, MapPin, Radio, Pencil, Trash2 } from 'lucide-react-native';
import { User, Substation } from '../../types';

interface EmployeeCardProps {
  employee: User;
  sitesMap?: Record<string, Substation>;
  onEdit: () => void;
  onDelete: () => void;
  isLast?: boolean;
}

export const EmployeeCard: React.FC<EmployeeCardProps> = ({
  employee,
  sitesMap = {},
  onEdit,
  onDelete,
  isLast = false,
}) => {
  // Initials avatar e.g. RS, AK, SY
  const initials = employee.name
    ? employee.name
        .trim()
        .split(/\s+/)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'EM';

  // Assigned site names
  const siteIds =
    employee.assignedSiteIds && employee.assignedSiteIds.length > 0
      ? employee.assignedSiteIds
      : employee.assignedSiteId
      ? [employee.assignedSiteId]
      : [];

  const siteNames = siteIds.map((id) => sitesMap[id]?.name || id);

  const hasCoords =
    typeof employee.latitude === 'number' && typeof employee.longitude === 'number';

  const shiftStatus = employee.shiftStatus || 'Present';

  return (
    <View style={[styles.rowContainer, !isLast && styles.rowDivider]}>
      {/* 1. Initials Avatar */}
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarInitials}>{initials}</Text>
      </View>

      {/* 2. Middle Information */}
      <View style={styles.infoCol}>
        {/* Full Name */}
        <Text style={styles.nameText} numberOfLines={1}>
          {employee.name}
        </Text>

        {/* Employee ID & Designation */}
        <Text style={styles.subText} numberOfLines={1}>
          {employee.employeeId} | {employee.designation || 'Junior Engineer'}
        </Text>

        {/* Circle & Division */}
        {(employee.circle || employee.division) && (
          <Text style={styles.circleDivisionText} numberOfLines={1}>
            {[employee.circle ? `Circle: ${employee.circle}` : null, employee.division ? `Div: ${employee.division}` : null].filter(Boolean).join(' • ')}
          </Text>
        )}

        {/* Tags Row */}
        <View style={styles.tagsRow}>
          {/* Substation Badges */}
          {siteNames.map((siteName, index) => (
            <View key={index} style={styles.siteBadge}>
              <Building2 size={11} color="#2563EB" />
              <Text style={styles.siteBadgeText} numberOfLines={1}>
                {siteName}
              </Text>
            </View>
          ))}

          {/* Coordinates Badge */}
          {hasCoords && (
            <View style={styles.coordsBadge}>
              <MapPin size={11} color="#DC2626" />
              <Text style={styles.coordsBadgeText}>
                {employee.latitude?.toFixed(4)}, {employee.longitude?.toFixed(4)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* 3. Right Status Pill & Action Buttons */}
      <View style={styles.rightCol}>
        {/* Status Pill: ((•)) Present */}
        <View style={styles.statusPill}>
          <Radio size={12} color="#059669" />
          <Text style={styles.statusText}>{shiftStatus}</Text>
        </View>

        {/* Actions: Edit & Delete */}
        <View style={styles.actionIconsRow}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onEdit}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Pencil size={15} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onDelete}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={15} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 0.5,
  },
  infoCol: {
    flex: 1,
    marginRight: 12,
  },
  nameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  subText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 4,
  },
  circleDivisionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0284C7',
    marginBottom: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  siteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  siteBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E40AF',
  },
  coordsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  coordsBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  actionIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    padding: 3,
  },
});
