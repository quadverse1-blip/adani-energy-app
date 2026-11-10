import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { fetchRealDeviceLocation, subscribeRealDeviceLocationWatcher, DeviceCoordinates } from '../../utils/geolocationUtils';
import { dashboardService } from '../../services/dashboardService';
import {
  MapPin,
  Phone,
  Mail,
  Zap,
  Navigation,
  ShieldCheck,
  Menu,
  Building,
  CheckCircle,
  UserCheck,
  PhoneCall,
  AlertTriangle,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTechnicianDrawerStore } from '../../store/useTechnicianDrawerStore';
import { useAuthStore } from '../../store/useAuthStore';
import { TechnicianDrawerModal } from '../../components/navigation/TechnicianDrawerModal';
import { siteService } from '../../services/siteService';
import { Substation } from '../../types';
import { COLORS, RADII } from '../../constants/theme';
import { AppCard } from '../../components/common/AppCard';
import { AppButton } from '../../components/common/AppButton';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { AppBackButton } from '../../components/common/AppBackButton';
import MapView, { Marker, Circle, Polyline, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from '../../components/common/AppMapView';
import { calculateHaversineDistance } from '../../utils/haversine';

interface SiteDetailsScreenProps {
  route: any;
  navigation: any;
}

export const SiteDetailsScreen: React.FC<SiteDetailsScreenProps> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useTechnicianDrawerStore();
  const { user } = useAuthStore();
  const mapRef = useRef<any>(null);

  const [allSites, setAllSites] = useState<Substation[]>([]);
  const [activeSiteId, setActiveSiteId] = useState<string>(route.params?.siteId || '');
  const [userCoords, setUserCoords] = useState<DeviceCoordinates | null>(() => {
    if (user?.latitude && user?.longitude && user.latitude !== 0 && user.longitude !== 0) {
      return {
        latitude: user.latitude,
        longitude: user.longitude,
        accuracy: (user as any).accuracyMeters || 10,
        timestamp: Date.now(),
        isStale: false,
      };
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  // Sync live coordinates and telemetry
  const handleCoordsReceived = useCallback(
    (coords: DeviceCoordinates) => {
      if (!coords || (coords.latitude === 0 && coords.longitude === 0)) return;
      setUserCoords(coords);

      // Sync live telemetry to backend so Admin Tracking radar matches mobile immediately
      if (coords.latitude && coords.longitude) {
        dashboardService
          .pingLocation(
            coords.latitude,
            coords.longitude,
            coords.accuracy || 10,
            100,
            activeSiteId || undefined,
            undefined,
            0,
            0
          )
          .catch(() => {});
      }
    },
    [activeSiteId]
  );

  // Load all sites and set initial active site
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      try {
        const sites = await siteService.getSites();
        if (isMounted) {
          setAllSites(sites || []);

          // Determine initial selected site
          const userSiteIds =
            user?.assignedSiteIds && user.assignedSiteIds.length > 0
              ? user.assignedSiteIds
              : user?.assignedSiteId
              ? [user.assignedSiteId]
              : [];

          const targetId =
            route.params?.siteId ||
            user?.assignedSiteId ||
            (userSiteIds.length > 0 ? userSiteIds[0] : sites?.[0]?.id || '');
          setActiveSiteId(targetId);
        }

        // Trigger GPS permission & location checks
        requestGpsAndLocation();
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to load site specifications');
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Subscribe to real-time continuous GPS hardware watcher while viewing site specifications
  useEffect(() => {
    const unsub = subscribeRealDeviceLocationWatcher(
      handleCoordsReceived,
      (err) => {
        console.warn('Real-time location watcher notice:', err.message);
      }
    );
    return () => {
      if (unsub) unsub();
    };
  }, [handleCoordsReceived]);

  // Prompt and verify GPS location permissions & device location services
  const requestGpsAndLocation = useCallback(
    async (manual = false) => {
      try {
        await fetchRealDeviceLocation(
          {
            onCoordinatesAcquired: handleCoordsReceived,
            onGpsDisabled: () => {},
            onPermissionDenied: () => {},
          },
          manual
        );
      } catch (err: any) {
        console.warn('GPS location request error:', err);
      }
    },
    [handleCoordsReceived]
  );

  useFocusEffect(
    useCallback(() => {
      requestGpsAndLocation();
    }, [requestGpsAndLocation])
  );

  // Compute all assigned sites strictly for the logged-in employee
  const assignedSites = useMemo(() => {
    if (!allSites || allSites.length === 0) return [];

    if (user?.role === 'technician') {
      const userSiteIds =
        user?.assignedSiteIds && user.assignedSiteIds.length > 0
          ? user.assignedSiteIds
          : user?.assignedSiteId
          ? [user.assignedSiteId]
          : [];

      if (userSiteIds.length === 0) return [];

      return allSites.filter(
        (s) =>
          userSiteIds.includes(s.id) ||
          userSiteIds.includes((s as any)._id) ||
          userSiteIds.includes(s.code)
      );
    }

    return allSites;
  }, [allSites, user]);

  // Active selected site
  const site: Substation | null = useMemo(() => {
    if (assignedSites.length === 0) return null;
    return (
      assignedSites.find((s) => s.id === activeSiteId || (s as any)._id === activeSiteId) ||
      assignedSites[0] ||
      null
    );
  }, [activeSiteId, assignedSites]);

  // Active resolved user coordinates strictly from live GPS (never fake fallback to Bengaluru)
  const activeUserCoords = useMemo(() => {
    if (userCoords && userCoords.latitude !== 0 && userCoords.longitude !== 0) {
      return userCoords;
    }
    return null;
  }, [userCoords]);

  // Compute live Haversine distance, travel time, and geofence status between employee and site
  const distanceInfo = useMemo(() => {
    if (!activeUserCoords || !site) return null;
    const distMeters = calculateHaversineDistance(
      activeUserCoords.latitude,
      activeUserCoords.longitude,
      site.latitude,
      site.longitude
    );
    const radius = site.radiusMeters || 500;
    const isInside = distMeters <= radius;

    let formattedDistance = '';
    if (distMeters < 1000) {
      formattedDistance = `${Math.round(distMeters)} m`;
    } else {
      formattedDistance = `${(distMeters / 1000).toFixed(1)} km`;
    }

    const midCoord = {
      latitude: (activeUserCoords.latitude + site.latitude) / 2,
      longitude: (activeUserCoords.longitude + site.longitude) / 2,
    };

    const travelMinutes = Math.max(1, Math.round(distMeters / 667)); // ~40 km/h avg speed
    const travelTimeFormatted =
      travelMinutes >= 60
        ? `${Math.floor(travelMinutes / 60)}h ${travelMinutes % 60}m`
        : `${travelMinutes} min`;

    const isPoorAccuracy = Boolean(
      activeUserCoords.isPoorAccuracy || (activeUserCoords.accuracy && activeUserCoords.accuracy > 100)
    );
    const isStale = Boolean(activeUserCoords.isStale);

    return {
      distanceMeters: distMeters,
      formattedDistance,
      isInside,
      midCoord,
      travelTimeFormatted,
      accuracy: activeUserCoords.accuracy,
      isPoorAccuracy,
      isStale,
    };
  }, [activeUserCoords, site]);

  // Fit native map to site and employee user coordinates
  useEffect(() => {
    if (mapRef.current && site) {
      if (activeUserCoords && activeUserCoords.latitude !== 0 && activeUserCoords.longitude !== 0) {
        const dist = calculateHaversineDistance(
          activeUserCoords.latitude,
          activeUserCoords.longitude,
          site.latitude,
          site.longitude
        );
        // Only fit bounds if distance is reasonable (<= 500km across Maharashtra)
        // Never zoom out to the entire subcontinent if employee is distant
        if (dist <= 500000) {
          mapRef.current.fitToCoordinates(
            [
              { latitude: site.latitude, longitude: site.longitude },
              { latitude: activeUserCoords.latitude, longitude: activeUserCoords.longitude },
            ],
            {
              edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
              animated: true,
            }
          );
        } else {
          // Center on site at zoom level 15 so 500m geofence remains crisp
          mapRef.current.animateToRegion(
            {
              latitude: site.latitude,
              longitude: site.longitude,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            },
            600
          );
        }
      } else {
        mapRef.current.animateToRegion(
          {
            latitude: site.latitude,
            longitude: site.longitude,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          },
          500
        );
      }
    }
  }, [site, activeUserCoords]);

  const handleCall = () => {
    if (site?.manager?.phone) {
      Linking.openURL(`tel:${site.manager.phone}`);
    } else {
      Alert.alert('Notice', 'No manager phone number registered for this site.');
    }
  };

  const handleEmail = () => {
    if (site?.manager?.email) {
      Linking.openURL(`mailto:${site.manager.email}`);
    } else {
      Alert.alert('Notice', 'No manager email registered for this site.');
    }
  };

  const handleDirections = () => {
    if (!site) return;
    const scheme = Platform.select({
      ios: `maps://0,0?q=${site.latitude},${site.longitude}(${encodeURIComponent(site.name)})`,
      android: `geo:0,0?q=${site.latitude},${site.longitude}(${encodeURIComponent(site.name)})`,
    });
    const webUrl = `https://maps.mappls.com/?point=${site.latitude},${site.longitude}`;

    Linking.canOpenURL(scheme || webUrl)
      .then((supported) => {
        if (supported && scheme) {
          return Linking.openURL(scheme);
        }
        return Linking.openURL(webUrl);
      })
      .catch(() => Linking.openURL(webUrl));
  };

  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [mgrImgFailed, setMgrImgFailed] = useState(false);

  // Fallback high-res real power infrastructure photography
  const heroImageUrl = useMemo(() => {
    if (!site) return 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=1000&q=85';
    if (heroImgFailed) {
      return 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&w=1000&q=85';
    }
    if (site.photoUrl) return site.photoUrl;
    return 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=1000&q=85';
  }, [site, heroImgFailed]);

  // Professional manager photo
  const managerPhotoUrl = useMemo(() => {
    if (!site) return 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=600&q=85';
    if (mgrImgFailed) {
      return 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=85';
    }
    if (site.manager?.photoUrl) return site.manager.photoUrl;
    return 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=600&q=85';
  }, [site, mgrImgFailed]);

  if (loading) {
    return <LoadingSpinner message="Loading site specifications..." />;
  }

  if (!site) {
    return (
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.topNavHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AppBackButton />
            <TouchableOpacity
              delayPressIn={0}
              style={styles.navHeaderBtn}
              onPress={() => openDrawer('SiteDetails')}
              activeOpacity={0.7}
            >
              <Menu size={20} color="#0F172A" />
            </TouchableOpacity>
          </View>
          <Text style={styles.navHeaderTitle}>Assigned Site</Text>
          <View style={{ width: 38 }} />
        </View>

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: '#EFF6FF',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <Building size={32} color="#1E63F0" />
          </View>
          <Text
            style={{
              fontSize: 18,
              fontWeight: '800',
              color: '#0F172A',
              marginBottom: 8,
              textAlign: 'center',
            }}
          >
            No Site Assigned
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: '#64748B',
              textAlign: 'center',
              lineHeight: 20,
              maxWidth: 320,
            }}
          >
            You do not have an active work site assigned yet. Please contact your Supervisor or Operations Admin to allocate your designated site.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      {/* Top Navigation Bar */}
      <View style={styles.topNavHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <AppBackButton />
          <TouchableOpacity
            delayPressIn={0}
            style={styles.navHeaderBtn}
            onPress={() => openDrawer('SiteDetails')}
            activeOpacity={0.7}
          >
            <Menu size={20} color="#0F172A" />
          </TouchableOpacity>
        </View>
        <Text style={styles.navHeaderTitle}>Site Specifications</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Multiple Assigned Sites Switcher Bar */}
      {assignedSites.length > 1 && (
        <View style={styles.siteSwitcherSection}>
          <Text style={styles.siteSwitcherHeader}>
            YOUR ASSIGNED SITES ({assignedSites.length})
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.siteSwitcherRow}
          >
            {assignedSites.map((s) => {
              const sId = s.id || (s as any)._id;
              const isSelected = site.id === sId || (site as any)._id === sId;

              return (
                <TouchableOpacity
                  delayPressIn={0}
                  key={sId}
                  style={[styles.siteTabCard, isSelected && styles.siteTabCardActive]}
                  onPress={() => setActiveSiteId(sId)}
                  activeOpacity={0.8}
                >
                  <View style={styles.siteTabTop}>
                    <Building size={14} color={isSelected ? '#FFFFFF' : '#4338CA'} />
                    <Text
                      style={[styles.siteTabCode, isSelected && styles.siteTabCodeActive]}
                      numberOfLines={1}
                    >
                      {s.code}
                    </Text>
                  </View>
                  <Text
                    style={[styles.siteTabName, isSelected && styles.siteTabNameActive]}
                    numberOfLines={1}
                  >
                    {s.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {/* Site Hero Image */}
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: heroImageUrl }}
            style={styles.heroImage}
            resizeMode="cover"
            onError={() => setHeroImgFailed(true)}
          />
          {(site.voltageClass || (site as any).voltageLevel) && (
            <View style={styles.voltageOverlay}>
              <Zap size={14} color="#FBBF24" />
              <Text style={styles.voltageText}>{site.voltageClass || (site as any).voltageLevel}</Text>
            </View>
          )}
        </View>

        {/* Core Site Information */}
        <AppCard style={styles.card}>
          <View style={styles.codeRow}>
            <View style={styles.codeBadge}>
              <Text style={styles.codeText}>{site.code}</Text>
            </View>
            <View style={styles.activePill}>
              <CheckCircle size={12} color="#16A34A" />
              <Text style={styles.activeText}>Active Facility</Text>
            </View>
          </View>

          <Text style={styles.name}>{site.name}</Text>
          <Text style={styles.address}>{site.address}</Text>

          <View style={styles.specsGrid}>
            <View style={styles.specsGridRow}>
              <View style={styles.specBox}>
                <Text style={styles.specLabel}>DISTANCE TO SITE</Text>
                <Text
                  style={[
                    styles.specValue,
                    { color: distanceInfo?.isInside ? '#15803D' : '#1D4ED8', fontWeight: '800' },
                  ]}
                >
                  {distanceInfo ? distanceInfo.formattedDistance : 'Acquiring GPS...'}
                </Text>
              </View>
              <View style={styles.specBox}>
                <Text style={styles.specLabel}>GEOFENCE STATUS</Text>
                <Text
                  style={[
                    styles.specValue,
                    { color: distanceInfo?.isInside ? '#15803D' : '#D97706', fontWeight: '800' },
                  ]}
                >
                  {distanceInfo
                    ? distanceInfo.isInside
                      ? '✓ Inside Boundary'
                      : 'Outside Boundary'
                    : 'Verifying...'}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.specsGridRow,
                { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
              ]}
            >
              <View style={styles.specBox}>
                <Text style={styles.specLabel}>GEOFENCE RADIUS</Text>
                <Text style={styles.specValue}>{site.radiusMeters || 500}m</Text>
              </View>
              <View style={styles.specBox}>
                <Text style={styles.specLabel}>SITE GPS COORDINATES</Text>
                <Text style={styles.specValue}>
                  {site.latitude.toFixed(4)}° N, {site.longitude.toFixed(4)}° E
                </Text>
              </View>
            </View>
            {activeUserCoords?.accuracy && (
              <View
                style={[
                  styles.specsGridRow,
                  { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
                ]}
              >
                <View style={styles.specBox}>
                  <Text style={styles.specLabel}>GPS ACCURACY</Text>
                  <Text style={[styles.specValue, { color: distanceInfo?.isPoorAccuracy ? '#D97706' : '#15803D' }]}>
                    ±{Math.round(activeUserCoords.accuracy)}m {distanceInfo?.isPoorAccuracy ? '(Low)' : '(Lock)'}
                  </Text>
                </View>
                <View style={styles.specBox}>
                  <Text style={styles.specLabel}>GPS LOCK STATUS</Text>
                  <Text style={styles.specValue}>
                    {distanceInfo?.isStale ? 'Cached Position' : 'Live Hardware GPS'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </AppCard>

        {/* Assigner Info Banner */}
        {site.assignedBy && (
          <AppCard style={styles.assignerCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#64748B', letterSpacing: 0.5, marginBottom: 2 }}>
                  Assigned By
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
                  {typeof site.assignedBy === 'object' ? (site.assignedBy as any)?.name : site.assignedBy}
                </Text>
                {(site.assignedByPhone || (typeof site.assignedBy === 'object' ? (site.assignedBy as any)?.phone : null)) ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                    <Phone size={12} color="#1E63F0" />
                    <Text style={{ fontSize: 11, color: '#1E63F0', fontWeight: '700' }}>
                      Contact: {site.assignedByPhone || (typeof site.assignedBy === 'object' ? (site.assignedBy as any)?.phone : null)}
                    </Text>
                  </View>
                ) : null}
              </View>
              {(site.assignedByPhone || (typeof site.assignedBy === 'object' ? (site.assignedBy as any)?.phone : null)) ? (
                <AppButton
                  title="Call Assigner"
                  onPress={() => {
                    const phoneNum = site.assignedByPhone || (typeof site.assignedBy === 'object' ? (site.assignedBy as any)?.phone : null);
                    if (phoneNum) Linking.openURL(`tel:${phoneNum}`);
                  }}
                  variant="primary"
                  size="sm"
                  icon={<PhoneCall size={14} color="#FFFFFF" />}
                  style={{ backgroundColor: '#10B981', borderColor: '#10B981' }}
                />
              ) : null}
            </View>
          </AppCard>
        )}

        {/* Site Manager Profile Card - Strictly real assigned manager data (No dummy email/photo) */}
        {site.manager && (site.manager.name || site.manager.phone) ? (
          <AppCard style={styles.card}>
            <Text style={styles.sectionTitle}>SITE MANAGER & IN-CHARGE</Text>

            <View style={styles.managerProfileRow}>
              <View style={styles.managerPhotoContainer}>
                {site.manager.photoUrl && !mgrImgFailed ? (
                  <Image
                    source={{ uri: site.manager.photoUrl }}
                    style={styles.managerPhoto}
                    resizeMode="cover"
                    onError={() => setMgrImgFailed(true)}
                  />
                ) : (
                  <View style={[styles.managerPhoto, { backgroundColor: '#4338CA', alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 18 }}>
                      {(site.manager.name || 'M').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.managerVerifiedDot}>
                  <ShieldCheck size={12} color="#FFFFFF" />
                </View>
              </View>

              <View style={styles.managerDetails}>
                <Text style={styles.managerName}>{site.manager.name || 'Site In-Charge'}</Text>
                <Text style={styles.managerDesig}>
                  {site.manager.designation || 'Site Operations Lead'}
                </Text>

                {site.manager.phone ? (
                  <View style={styles.managerContactLine}>
                    <Phone size={11} color="#64748B" />
                    <Text style={styles.managerContactText}>{site.manager.phone}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {site.manager.phone ? (
              <View style={styles.contactActionsRow}>
                <AppButton
                  title="Call Manager"
                  onPress={handleCall}
                  variant="secondary"
                  size="sm"
                  icon={<Phone size={14} color={COLORS.primary} />}
                  style={styles.contactBtn}
                />
              </View>
            ) : null}
          </AppCard>
        ) : null}

        {/* Interactive Geofence Radar Map via Mappls Map */}
        <AppCard style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>GEOFENCE RADAR & RADIAL BOUNDARY</Text>
            {distanceInfo ? (
              <View
                style={[
                  styles.inlineDistBadge,
                  distanceInfo.isInside ? styles.inlineDistBadgeInside : styles.inlineDistBadgeOutside,
                ]}
              >
                <Navigation size={11} color={distanceInfo.isInside ? '#15803D' : '#1D4ED8'} />
                <Text
                  style={[
                    styles.inlineDistText,
                    distanceInfo.isInside ? styles.inlineDistTextInside : styles.inlineDistTextOutside,
                  ]}
                >
                  {distanceInfo.formattedDistance} away
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => requestGpsAndLocation(true)}
                style={styles.inlineLocateBtn}
                activeOpacity={0.7}
              >
                <MapPin size={11} color="#2563EB" />
                <Text style={styles.inlineLocateText}>Get Distance</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFill}
              provider={PROVIDER_DEFAULT}
              initialRegion={{
                latitude: site.latitude,
                longitude: site.longitude,
                latitudeDelta: 0.015,
                longitudeDelta: 0.015,
              }}
              mapType="standard"
              showsCompass={true}
              showsUserLocation={false}
            >
              {/* Geofence Perimeter Circle */}
              <Circle
                center={{
                  latitude: site.latitude,
                  longitude: site.longitude,
                }}
                radius={site.radiusMeters || 500}
                fillColor={
                  distanceInfo?.isInside ? 'rgba(16, 185, 129, 0.22)' : 'rgba(67, 56, 202, 0.16)'
                }
                strokeColor={distanceInfo?.isInside ? '#10B981' : '#4338CA'}
                strokeWidth={2}
                zIndex={2}
              />

              {/* Connecting Flight/Route Line Between Employee and Site */}
              {activeUserCoords && (
                <Polyline
                  coordinates={[
                    { latitude: activeUserCoords.latitude, longitude: activeUserCoords.longitude },
                    { latitude: site.latitude, longitude: site.longitude },
                  ]}
                  strokeColor="#2563EB"
                  strokeWidth={3}
                  lineDashPattern={[8, 4]}
                />
              )}

              {/* Midpoint Distance Marker Badge */}
              {activeUserCoords && distanceInfo && (
                <Marker
                  coordinate={distanceInfo.midCoord}
                  title={distanceInfo.formattedDistance}
                  description={`Direct distance between your location and ${site.name}`}
                  zIndex={12}
                />
              )}

              {/* Site Marker */}
              <Marker
                coordinate={{
                  latitude: site.latitude,
                  longitude: site.longitude,
                }}
                title={site.name}
                description={`${site.radiusMeters || 500}m Geofence Perimeter • ${site.code}`}
                zIndex={10}
              >
                <View style={styles.siteMarkerWrap}>
                  <View style={styles.siteMarkerPill}>
                    <Zap size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.siteMarkerPillText}>{site.name}</Text>
                  </View>
                  <View style={styles.siteMarkerPin} />
                </View>
              </Marker>

              {/* User Live Location Marker */}
              {activeUserCoords && (
                <Marker
                  coordinate={activeUserCoords}
                  title="My Location"
                  description="Your Current Device GPS Position"
                  pinColor="#2563EB"
                  zIndex={15}
                >
                  <View style={styles.userMarkerWrap}>
                    <View style={styles.userMarkerDot} />
                    <View style={styles.userMarkerPill}>
                      <Text style={styles.userMarkerPillText}>Your Location</Text>
                    </View>
                  </View>
                </Marker>
              )}
            </MapView>

            {/* Floating Live Distance & Geofence Status Badge */}
            <View style={styles.geofenceOverlayBadge}>
              <View
                style={[
                  styles.pulseDot,
                  distanceInfo?.isInside ? { backgroundColor: '#10B981' } : { backgroundColor: '#38BDF8' },
                ]}
              />
              <Text style={styles.geofenceOverlayText}>
                {distanceInfo
                  ? `Distance: ${distanceInfo.formattedDistance} • ${
                      distanceInfo.isInside ? 'Inside Geofence' : 'Outside Geofence'
                    }`
                  : `${site.radiusMeters || 500}m Geofence Perimeter Active`}
              </Text>
            </View>
          </View>

          {/* Real-time Distance & Telemetry Metrics Strip below the map */}
          {distanceInfo && (
            <View style={styles.mapTelemetryBar}>
              <View style={styles.mapTelemetryItem}>
                <Text style={styles.telemetryLabel}>CURRENT DISTANCE</Text>
                <Text style={styles.telemetryValue}>{distanceInfo.formattedDistance}</Text>
              </View>
              <View style={styles.mapTelemetryDivider} />
              <View style={styles.mapTelemetryItem}>
                <Text style={styles.telemetryLabel}>EST. TRAVEL TIME</Text>
                <Text style={styles.telemetryValue}>{distanceInfo.travelTimeFormatted}</Text>
              </View>
              <View style={styles.mapTelemetryDivider} />
              <View style={styles.mapTelemetryItem}>
                <Text style={styles.telemetryLabel}>GEOFENCE RADAR</Text>
                <Text
                  style={[
                    styles.telemetryValue,
                    { color: distanceInfo.isInside ? '#15803D' : '#D97706' },
                  ]}
                >
                  {distanceInfo.isInside ? 'INSIDE' : 'OUTSIDE'}
                </Text>
              </View>
            </View>
          )}

          {/* Low GPS Accuracy Warning */}
          {distanceInfo?.isPoorAccuracy && (
            <View style={styles.accuracyWarningBanner}>
              <AlertTriangle size={14} color="#B45309" />
              <Text style={styles.accuracyWarningText}>
                Low GPS accuracy (±{Math.round(distanceInfo.accuracy || 100)}m) • Move outdoors for precise distance
              </Text>
            </View>
          )}
        </AppCard>

        {/* Turn-by-Turn Navigation Action */}
        <View style={{ marginTop: 6, marginBottom: 24 }}>
          <AppButton
            title="Navigate to Site"
            onPress={handleDirections}
            variant="primary"
            size="lg"
            icon={<Navigation size={18} color="#FFFFFF" />}
          />
        </View>
      </ScrollView>

      <TechnicianDrawerModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topNavHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  navHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  navHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Site Switcher Bar
  siteSwitcherSection: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  siteSwitcherHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  siteSwitcherRow: {
    paddingHorizontal: 14,
    gap: 10,
  },
  siteTabCard: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    minWidth: 140,
  },
  siteTabCardActive: {
    backgroundColor: '#4338CA',
    borderColor: '#4338CA',
    shadowColor: '#4338CA',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  siteTabTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 6,
  },
  siteTabCode: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4338CA',
  },
  siteTabCodeActive: {
    color: '#E0E7FF',
  },
  siteTabName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  siteTabNameActive: {
    color: '#FFFFFF',
  },

  content: {
    padding: 16,
    paddingTop: 14,
    paddingBottom: 40,
  },
  imageWrapper: {
    position: 'relative',
    height: 190,
    borderRadius: RADII.card,
    overflow: 'hidden',
    marginBottom: 14,
    backgroundColor: '#0F172A',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  voltageOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  voltageText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  assignerCard: {
    marginBottom: 14,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  card: {
    marginBottom: 14,
    padding: 16,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  codeBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  codeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4338CA',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  address: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 14,
  },
  specsGrid: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  specsGridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  specsRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  specBox: {
    flex: 1,
  },
  specLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  specValue: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  inlineDistBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  inlineDistBadgeInside: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  inlineDistBadgeOutside: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  inlineDistText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  inlineDistTextInside: {
    color: '#15803D',
  },
  inlineDistTextOutside: {
    color: '#1D4ED8',
  },
  inlineLocateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  inlineLocateText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#2563EB',
  },

  // Manager Profile Section
  managerProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  managerPhotoContainer: {
    position: 'relative',
    width: 60,
    height: 60,
  },
  managerPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E2E8F0',
    borderWidth: 2,
    borderColor: '#4338CA',
  },
  managerVerifiedDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  managerDetails: {
    flex: 1,
  },
  managerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  managerDesig: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4338CA',
    marginBottom: 6,
  },
  managerContactLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  managerContactText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },

  contactActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  contactBtn: {
    flex: 1,
  },

  // Map Container & Native Map Elements
  mapContainer: {
    height: 240,
    borderRadius: RADII.card,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  geofenceOverlayBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 20,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38BDF8',
    marginRight: 6,
  },
  geofenceOverlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Map Markers
  siteMarkerWrap: {
    alignItems: 'center',
  },
  siteMarkerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4338CA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  siteMarkerPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  siteMarkerPin: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4338CA',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginTop: -2,
  },

  userMarkerWrap: {
    alignItems: 'center',
  },
  userMarkerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#2563EB',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#2563EB',
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  userMarkerPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  userMarkerPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },

  // Map Telemetry Bar
  mapTelemetryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mapTelemetryItem: {
    flex: 1,
    alignItems: 'center',
  },
  mapTelemetryDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#CBD5E1',
  },
  telemetryLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 2,
    letterSpacing: 0.4,
  },
  telemetryValue: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  accuracyWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 8,
    gap: 6,
  },
  accuracyWarningText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
  },
});

export default SiteDetailsScreen;
