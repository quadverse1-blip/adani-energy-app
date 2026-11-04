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
import MapView, { Marker, Circle, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from '../../components/common/AppMapView';

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
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);

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

  // Prompt and verify GPS location permissions & device location services
  const requestGpsAndLocation = useCallback(async () => {
    try {
      // 1. Check and request location permission
      let perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        perm = await Location.requestForegroundPermissionsAsync();
      }

      if (perm.status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Adani Workforce requires location permission to show your current location and calculate distance to this site.',
          [
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }

      // 2. Check if device Location (GPS) toggle is turned ON
      try {
        const hasServices = await Location.hasServicesEnabledAsync();
        if (!hasServices) {
          if (Platform.OS === 'android') {
            try {
              // Prompts native Google Play Services dialog: "To continue, turn on device location..."
              await Location.enableNetworkProviderAsync();
            } catch (_) {
              Alert.alert(
                'Turn ON Device Location',
                'Please enable Location (GPS) in your phone settings or quick settings to view your position relative to the site.',
                [
                  { text: 'Open Settings', onPress: () => Linking.openSettings() },
                  { text: 'Cancel', style: 'cancel' },
                ]
              );
              return;
            }
          } else {
            Alert.alert(
              'Turn ON Device Location',
              'Please enable Location in device settings to view your position relative to the site.',
              [
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
            return;
          }
        }
      } catch (svcErr) {
        console.warn('hasServicesEnabledAsync check failed:', svcErr);
      }

      // 3. Acquire location: instant cached first (<500ms), then fresh
      try {
        const cached = await Location.getLastKnownPositionAsync({ maxAge: 86400000 });
        if (cached?.coords && cached.coords.latitude !== 0 && cached.coords.longitude !== 0) {
          setUserCoords({
            latitude: cached.coords.latitude,
            longitude: cached.coords.longitude,
          });
        }
      } catch (_) {}

      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (loc?.coords && loc.coords.latitude !== 0 && loc.coords.longitude !== 0) {
          setUserCoords({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      } catch (_) {}
    } catch (err: any) {
      console.warn('GPS location request error:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      requestGpsAndLocation();
    }, [requestGpsAndLocation])
  );

  // Compute all assigned sites strictly for the logged-in employee
  const assignedSites = useMemo(() => {
    if (!allSites || allSites.length === 0) return [];

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

  // Fit native map to site and user coordinates
  useEffect(() => {
    if (mapRef.current && site) {
      if (userCoords && userCoords.latitude !== 0 && userCoords.longitude !== 0) {
        mapRef.current.fitToCoordinates(
          [
            { latitude: site.latitude, longitude: site.longitude },
            { latitude: userCoords.latitude, longitude: userCoords.longitude },
          ],
          {
            edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
            animated: true,
          }
        );
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
  }, [site, userCoords]);

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
    const webUrl = `https://www.google.com/maps/search/?api=1&query=${site.latitude},${site.longitude}`;

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

          <View style={styles.specsRow}>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>GEOFENCE RADIUS</Text>
              <Text style={styles.specValue}>{site.radiusMeters || 500}m</Text>
            </View>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>GPS LATITUDE</Text>
              <Text style={styles.specValue}>{site.latitude.toFixed(4)}° N</Text>
            </View>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>GPS LONGITUDE</Text>
              <Text style={styles.specValue}>{site.longitude.toFixed(4)}° E</Text>
            </View>
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

        {/* Site Manager Profile Card */}
        {site.manager && (site.manager.name || site.manager.phone) ? (
          <AppCard style={styles.card}>
            <Text style={styles.sectionTitle}>SITE MANAGER & IN-CHARGE</Text>

            <View style={styles.managerProfileRow}>
              <View style={styles.managerPhotoContainer}>
                <Image
                  source={{ uri: managerPhotoUrl }}
                  style={styles.managerPhoto}
                  resizeMode="cover"
                  onError={() => setMgrImgFailed(true)}
                />
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

                {site.manager.email && !site.manager.email.includes('manager@adani.com') ? (
                  <View style={styles.managerContactLine}>
                    <Mail size={11} color="#64748B" />
                    <Text style={styles.managerContactText}>{site.manager.email}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.contactActionsRow}>
              {site.manager.phone ? (
                <AppButton
                  title="Call Manager"
                  onPress={handleCall}
                  variant="secondary"
                  size="sm"
                  icon={<Phone size={14} color={COLORS.primary} />}
                  style={styles.contactBtn}
                />
              ) : null}
              {site.manager.email && !site.manager.email.includes('manager@adani.com') ? (
                <AppButton
                  title="Email Manager"
                  onPress={handleEmail}
                  variant="secondary"
                  size="sm"
                  icon={<Mail size={14} color={COLORS.primary} />}
                  style={styles.contactBtn}
                />
              ) : null}
            </View>
          </AppCard>
        ) : null}

        {/* Interactive Geofence Radar Map via Native react-native-maps */}
        <AppCard style={styles.card}>
          <Text style={styles.sectionTitle}>GEOFENCE RADAR & RADIAL BOUNDARY</Text>
          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFill}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
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
                fillColor="rgba(67, 56, 202, 0.16)"
                strokeColor="#4338CA"
                strokeWidth={2}
                zIndex={2}
              />

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
              {userCoords && userCoords.latitude !== 0 && userCoords.longitude !== 0 && (
                <Marker
                  coordinate={userCoords}
                  title="Your Current Location"
                  description="Real Device Live GPS"
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

            {/* Floating Geofence Perimeter Active Badge */}
            <View style={styles.geofenceOverlayBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.geofenceOverlayText}>
                {site.radiusMeters || 500}m Geofence Perimeter Active
              </Text>
            </View>
          </View>
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
  },
  specValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 12,
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
});

export default SiteDetailsScreen;
