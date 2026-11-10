import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
  Platform,
  LogBox,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';

LogBox.ignoreLogs([
  'Current location is unavailable',
  'User GPS location fetch error',
  'Location provider is unavailable',
]);
import {
  ArrowLeft,
  Users,
  Search,
  MapPin,
  Clock,
  RefreshCw,
  Copy,
  Navigation,
  Radio,
  ShieldCheck,
  Building,
  Menu,
  Check,
  X,
  Layers,
  Crosshair,
  Phone,
  PhoneCall,
} from 'lucide-react-native';
import MapView, { Marker, Circle } from '../../components/common/AppMapView';
import { calculateHaversineDistance } from '../../utils/haversine';
import { dashboardService, FleetRadarData } from '../../services/dashboardService';
import { FleetTechnician, Substation } from '../../types';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useAdminDrawerStore } from '../../store/useAdminDrawerStore';
import { AdminDrawerModal } from '../../components/navigation/AdminDrawerModal';
import { useSupervisorDrawerStore } from '../../store/useSupervisorDrawerStore';
import { SupervisorDrawerModal } from '../../components/navigation/SupervisorDrawerModal';
import { useAuthStore } from '../../store/useAuthStore';
import { AppBackButton } from '../../components/common/AppBackButton';

const { width } = Dimensions.get('window');

export const TrackingScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { openDrawer: openAdminDrawer } = useAdminDrawerStore();
  const { openDrawer: openSupervisorDrawer } = useSupervisorDrawerStore();

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else if (user?.role === 'supervisor') {
      navigation.navigate('SupervisorDashboard');
    } else {
      navigation.navigate('AdminDashboard');
    }
  };

  const handleMenuPress = () => {
    if (user?.role === 'supervisor') {
      openSupervisorDrawer('Tracking');
    } else {
      openAdminDrawer('Tracking');
    }
  };

  const mapRef = useRef<any>(null);

  const [data, setData] = useState<FleetRadarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'live' | 'last_known' | 'no_location'>('all');
  const [selectedTech, setSelectedTech] = useState<FleetTechnician | null>(null);
  const [viewMode, setViewMode] = useState<'single' | 'all'>('single');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [mobileTab, setMobileTab] = useState<'map' | 'roster'>('map');

  const isWide = width >= 860;

  // 1. Fetch User's Real Device Live GPS Location (Silently and gracefully with zero warnings)
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const isServicesEnabled = await Location.hasServicesEnabledAsync().catch(() => false);
        if (!isServicesEnabled || !isMounted) return;

        const { status } = await Location.requestForegroundPermissionsAsync().catch(() => ({ status: 'denied' }));
        if (status !== 'granted' || !isMounted) return;

        // Try last known position first (fast, cached, non-blocking)
        const lastKnown = await Location.getLastKnownPositionAsync().catch(() => null);
        if (lastKnown?.coords && isMounted) {
          setUserLocation({
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
          });
        }

        // Only query provider if active
        const providerStatus = await Location.getProviderStatusAsync().catch(() => null);
        if (!providerStatus?.locationServicesEnabled || !isMounted) return;

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Lowest,
        }).catch(() => null);

        if (loc?.coords && isMounted) {
          setUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      } catch {
        // Silently swallow any native Android/iOS location errors
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedTechIdRef = useRef<string | null>(null);

  // Keep ref in sync whenever selectedTech changes
  useEffect(() => {
    selectedTechIdRef.current = selectedTech?.id || null;
  }, [selectedTech?.id]);

  // 2. Fetch Fleet Telemetry Data from Backend
  const fetchLiveTracking = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await dashboardService.getLiveFleetRadar();
      setData(res);

      const currentSelectedId = selectedTechIdRef.current;
      if (!currentSelectedId && res.technicians && res.technicians.length > 0) {
        // If technician user, highlight their own location first; otherwise select first active
        let targetTech: FleetTechnician | undefined;
        if (user?.employeeId) {
          const empCode = user.employeeId.toUpperCase();
          targetTech = res.technicians.find(
            (t) => (t.employeeId && t.employeeId.toUpperCase() === empCode) || t.id === user.id
          );
        }
        if (!targetTech) {
          targetTech = res.technicians.find((t) => t.hasGps) || res.technicians[0];
        }
        setSelectedTech(targetTech);
        selectedTechIdRef.current = targetTech.id;
      } else if (currentSelectedId && res.technicians) {
        // Keep currently selected technician's data live without resetting back to Rohit!
        const updated = res.technicians.find((t) => t.id === currentSelectedId);
        if (updated) setSelectedTech(updated);
      }
    } catch {
      // Silently swallow fetch errors
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLiveTracking();
    const interval = setInterval(() => {
      fetchLiveTracking();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const technicians = data?.technicians || [];
  const substations = data?.substations || [];

  const liveCount = useMemo(
    () => technicians.filter((t) => t.isLive || t.isOnline || t.status === 'online' || t.status === 'on_duty_inside' || t.status === 'on_duty_outside').length,
    [technicians]
  );
  const lastKnownCount = useMemo(
    () => technicians.filter((t) => t.isLastKnown || (t.hasGps && !t.isOnline && t.status !== 'online' && t.status !== 'on_duty_inside' && t.status !== 'on_duty_outside')).length,
    [technicians]
  );
  const noLocationCount = useMemo(
    () => technicians.filter((t) => !t.hasGps || t.latitude === null || t.longitude === null).length,
    [technicians]
  );

  // Display all employees with recorded GPS coordinates on the map (retains offline employee markers)
  const displayedTechnicians = useMemo(() => {
    return technicians.filter((t) => {
      if (t.latitude === null || t.latitude === undefined || t.longitude === null || t.longitude === undefined || !t.hasGps) {
        return false;
      }
      const isLive = Boolean(
        t.isLive ||
        t.isOnline ||
        t.status === 'online' ||
        t.status === 'live_online' ||
        t.status === 'on_duty_inside' ||
        t.status === 'on_duty_outside'
      );
      if (filterTab === 'live') return isLive;
      if (filterTab === 'last_known') return !isLive;
      if (filterTab === 'no_location') return false;
      return true;
    });
  }, [technicians, filterTab]);

  // Display relevant substation(s)
  const displayedSubstations = useMemo(() => {
    return substations;
  }, [substations]);

  const filteredTechnicians = useMemo(() => {
    return technicians.filter((t) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.employeeId.toLowerCase().includes(q) ||
        (t.designation && t.designation.toLowerCase().includes(q)) ||
        (t.assignedSiteName && t.assignedSiteName.toLowerCase().includes(q)) ||
        (t.locationName && t.locationName.toLowerCase().includes(q));

      if (!matchSearch) return false;

      const isLive = Boolean(
        t.isLive ||
        t.isOnline ||
        t.status === 'online' ||
        t.status === 'live_online' ||
        t.status === 'on_duty_inside' ||
        t.status === 'on_duty_outside'
      );
      const isLastKnown = Boolean(t.isLastKnown || (t.hasGps && !isLive));
      const hasNoLocation = Boolean(!t.hasGps || t.latitude === null || t.longitude === null);

      if (filterTab === 'live') return isLive;
      if (filterTab === 'last_known') return isLastKnown;
      if (filterTab === 'no_location') return hasNoLocation;
      return true;
    });
  }, [technicians, search, filterTab]);

  // Smooth animate map camera to frame BOTH selected technician and assigned site
  useEffect(() => {
    if (
      selectedTech?.hasGps &&
      selectedTech?.latitude !== null &&
      selectedTech?.latitude !== undefined &&
      selectedTech?.longitude !== null &&
      selectedTech?.longitude !== undefined &&
      mapRef.current
    ) {
      if (
        selectedTech.assignedSiteLatitude &&
        selectedTech.assignedSiteLongitude &&
        typeof mapRef.current.fitToCoordinates === 'function'
      ) {
        const dist = calculateHaversineDistance(
          selectedTech.latitude,
          selectedTech.longitude,
          selectedTech.assignedSiteLatitude,
          selectedTech.assignedSiteLongitude
        );
        if (dist <= 50000) {
          mapRef.current.fitToCoordinates(
            [
              { latitude: selectedTech.latitude, longitude: selectedTech.longitude },
              {
                latitude: selectedTech.assignedSiteLatitude,
                longitude: selectedTech.assignedSiteLongitude,
              },
            ],
            {
              edgePadding: { top: 70, right: 70, bottom: 70, left: 70 },
              animated: true,
            }
          );
          return;
        }
      }

      mapRef.current.animateToRegion(
        {
          latitude: selectedTech.latitude,
          longitude: selectedTech.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        500
      );
    }
  }, [
    selectedTech?.id,
    selectedTech?.latitude,
    selectedTech?.longitude,
    selectedTech?.assignedSiteLatitude,
    selectedTech?.assignedSiteLongitude,
  ]);

  const handleCopyGPS = () => {
    const lat = selectedTech?.latitude ?? userLocation?.latitude ?? substations[0]?.latitude ?? 18.852362;
    const lon = selectedTech?.longitude ?? userLocation?.longitude ?? substations[0]?.longitude ?? 73.884358;
    const text = `${Number(lat).toFixed(6)}, ${Number(lon).toFixed(6)}`;

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }

    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2200);
  };

  const handleRecenter = () => {
    if (selectedTech?.latitude && selectedTech?.longitude && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: selectedTech.latitude,
          longitude: selectedTech.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        500
      );
    } else if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        500
      );
    }
  };

  const handleFocusUserLocation = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        500
      );
    }
  };

  const handleViewAllOnMap = () => {
    setViewMode('all');
    if (mapRef.current) {
      const coords: Array<{ latitude: number; longitude: number }> = [];
      if (userLocation) coords.push(userLocation);
      substations.forEach((s) => coords.push({ latitude: s.latitude, longitude: s.longitude }));
      technicians.forEach((t) => {
        if (t.hasGps && t.latitude && t.longitude) {
          coords.push({ latitude: t.latitude, longitude: t.longitude });
        }
      });

      if (coords.length > 0 && mapRef.current.fitToCoordinates) {
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
          animated: true,
        });
      }
    }
    if (!isWide) setMobileTab('map');
  };

  const handleSelectTechnician = (tech: FleetTechnician) => {
    selectedTechIdRef.current = tech.id;
    setSelectedTech(tech);
    setViewMode('single');

    if (tech.hasGps && tech.latitude !== null && tech.latitude !== undefined && tech.longitude !== null && tech.longitude !== undefined && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: tech.latitude,
          longitude: tech.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        },
        500
      );
    }
    if (!isWide && mobileTab === 'roster') {
      setMobileTab('map');
    }
  };

  if (loading && !data) {
    return <LoadingSpinner message="Connecting to Live Telemetry Radar..." />;
  }

  const hasSelectedGps = Boolean(
    selectedTech?.hasGps &&
    selectedTech?.latitude !== null &&
    selectedTech?.latitude !== undefined &&
    selectedTech?.longitude !== null &&
    selectedTech?.longitude !== undefined
  );
  const activeLat = hasSelectedGps ? Number(selectedTech!.latitude).toFixed(6) : 'Not Available';
  const activeLon = hasSelectedGps ? Number(selectedTech!.longitude).toFixed(6) : 'Not Available';
  const activeSiteName = selectedTech?.assignedSiteName || 'Assigned Site';
  const activeTime = selectedTech?.checkInTime && selectedTech.checkInTime !== '--'
    ? selectedTech.checkInTime
    : selectedTech?.lastLocationTime || '--';
  const activeAccuracy = selectedTech?.accuracy || (hasSelectedGps ? '±8m - 25m Lock' : 'No GPS Signal');

  // Roster Component
  const renderRoster = () => (
    <View style={styles.rosterCard}>
      {/* Roster Header */}
      <View style={styles.rosterHeader}>
        <View style={styles.rosterHeaderLeft}>
          <Users size={17} color="#1E63F0" />
          <Text style={styles.rosterTitle}>Technicians Roster</Text>
        </View>
        <TouchableOpacity delayPressIn={0}
          style={styles.viewAllBtn}
          onPress={handleViewAllOnMap}
          activeOpacity={0.8}
        >
          <Text style={styles.viewAllBtnText}>View All on Map</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchBox}>
        <Search size={15} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search technician name, ID, or site..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity delayPressIn={0} onPress={() => setSearch('')}>
            <X size={15} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabsRow}>
        <TouchableOpacity delayPressIn={0}
          style={[styles.filterTab, filterTab === 'all' && styles.filterTabActive]}
          onPress={() => setFilterTab('all')}
        >
          <Text
            style={[
              styles.filterTabText,
              filterTab === 'all' && styles.filterTabTextActive,
            ]}
          >
            All ({technicians.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity delayPressIn={0}
          style={[styles.filterTab, filterTab === 'live' && styles.filterTabActive]}
          onPress={() => setFilterTab('live')}
        >
          <Text
            style={[
              styles.filterTabText,
              filterTab === 'live' && styles.filterTabTextActive,
            ]}
          >
            Active / Online ({liveCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity delayPressIn={0}
          style={[styles.filterTab, filterTab === 'last_known' && styles.filterTabActive]}
          onPress={() => setFilterTab('last_known')}
        >
          <Text
            style={[
              styles.filterTabText,
              filterTab === 'last_known' && styles.filterTabTextActive,
            ]}
          >
            Offline ({lastKnownCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity delayPressIn={0}
          style={[styles.filterTab, filterTab === 'no_location' && styles.filterTabActive]}
          onPress={() => setFilterTab('no_location')}
        >
          <Text
            style={[
              styles.filterTabText,
              filterTab === 'no_location' && styles.filterTabTextActive,
            ]}
          >
            No GPS ({noLocationCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Technician Cards List */}
      <ScrollView
        style={styles.rosterList}
        contentContainerStyle={styles.rosterListContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredTechnicians.map((tech) => {
          const isSelected = selectedTech?.id === tech.id;
          const initials = tech.name
            .split(' ')
            .map((w) => w[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();

          const isOnline = Boolean(tech.isOnline || tech.status === 'online' || tech.status === 'on_duty_inside' || tech.status === 'on_duty_outside');

          return (
            <TouchableOpacity delayPressIn={0}
              key={tech.id}
              style={[
                styles.techCard,
                isSelected && styles.techCardSelected,
              ]}
              onPress={() => handleSelectTechnician(tech)}
              activeOpacity={0.75}
            >
              {/* Avatar Initials */}
              <View
                style={[
                  styles.avatarWrap,
                  isSelected && { backgroundColor: '#DBEAFE', borderColor: '#3B82F6' },
                ]}
              >
                <Text
                  style={[
                    styles.avatarText,
                    isSelected && { color: '#1E40AF' },
                  ]}
                >
                  {initials}
                </Text>
                {isOnline && <View style={styles.onlineAvatarDot} />}
              </View>

              {/* Card Content */}
              <View style={styles.techCardBody}>
                {/* Name & Status Badge Row */}
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.techName} numberOfLines={1}>
                    {tech.name}{' '}
                    <Text style={styles.techEmpCode}>({tech.employeeId})</Text>
                  </Text>

                  {/* Online / Offline Status Badge */}
                  {isOnline ? (
                    <View style={styles.badgeOnline}>
                      <View style={styles.onlineMiniDot} />
                      <Text style={styles.badgeOnlineText}>Online</Text>
                    </View>
                  ) : (
                    <View style={styles.badgeOffline}>
                      <View style={styles.offlineMiniDot} />
                      <Text style={styles.badgeOfflineText}>Offline</Text>
                    </View>
                  )}
                </View>

                {/* Designation Row */}
                <View style={styles.designationRow}>
                  <Text style={styles.designationText} numberOfLines={1}>
                    {tech.designation || 'Field Staff'}
                  </Text>
                </View>

                {/* Location / Site Row */}
                <View style={styles.siteRow}>
                  <Building size={11} color="#64748B" />
                  <Text style={styles.siteName} numberOfLines={1}>
                    {tech.locationName || tech.assignedSiteName || 'Site Location'}
                  </Text>
                </View>

                {/* GPS & Timestamp Row */}
                <View style={styles.cardFooterRow}>
                  <View style={styles.gpsRow}>
                    <MapPin
                      size={11}
                      color={isOnline ? '#10B981' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.gpsText,
                        !tech.hasGps && styles.gpsTextMuted,
                      ]}
                      numberOfLines={1}
                    >
                      {tech.latitude !== null && tech.latitude !== undefined && tech.longitude !== null && tech.longitude !== undefined
                        ? `${Number(tech.latitude).toFixed(4)}, ${Number(tech.longitude).toFixed(4)}`
                        : 'No GPS Logged'}
                    </Text>
                  </View>

                  <View style={styles.timeRow}>
                    <Clock size={11} color="#94A3B8" />
                    <Text style={styles.timeText} numberOfLines={1}>
                      {tech.lastLocationTime || tech.lastSeen || '--'}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  // Map and Telemetry Component with React Native MapView
  const renderMapAndTelemetry = () => (
    <View style={styles.rightColumn}>
      {/* Interactive Map Container */}
      <View style={styles.mapFrame}>
        {/* Floating Warning Pill if Selected Tech has No GPS */}
        {selectedTech && !selectedTech.hasGps && (
          <View style={styles.noGpsFloatingBanner}>
            <MapPin size={13} color="#D97706" />
            <Text style={styles.noGpsFloatingText} numberOfLines={1}>
              {selectedTech.name} has no GPS logged yet
            </Text>
          </View>
        )}

        {/* Unified Official Mappls MapView (Identical Engine to Employee CheckIn & Site Screens) */}
        <MapView
          ref={mapRef}
          style={styles.mapView}
          initialRegion={{
            latitude:
              selectedTech?.hasGps && selectedTech?.latitude
                ? selectedTech.latitude
                : userLocation?.latitude
                ? userLocation.latitude
                : substations.length > 0 && substations[0].latitude
                ? substations[0].latitude
                : 19.7515,
            longitude:
              selectedTech?.hasGps && selectedTech?.longitude
                ? selectedTech.longitude
                : userLocation?.longitude
                ? userLocation.longitude
                : substations.length > 0 && substations[0].longitude
                ? substations[0].longitude
                : 75.7139,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
          }}
          showsCompass={true}
        >
          {/* Substation Geofence Perimeter Circles and Markers */}
          {substations.map((site) => (
            <React.Fragment key={`sub-${site.id}`}>
              <Circle
                center={{ latitude: site.latitude, longitude: site.longitude }}
                radius={site.radiusMeters || 500}
                fillColor="rgba(30, 99, 240, 0.15)"
                strokeColor="#1E63F0"
                strokeWidth={2}
              />
              <Marker
                coordinate={{ latitude: site.latitude, longitude: site.longitude }}
                title={`Site: ${site.name}`}
                description={`Substation Code: ${site.code || ''} • Geofence: ${site.radiusMeters || 500}m`}
                pinColor="#1E63F0"
              />
            </React.Fragment>
          ))}

          {/* Real Employee Markers (Distinguishing LIVE GPS and LAST KNOWN) */}
          {displayedTechnicians
            .filter(
              (tech) =>
                tech.hasGps &&
                tech.latitude !== null &&
                tech.latitude !== undefined &&
                tech.longitude !== null &&
                tech.longitude !== undefined
            )
            .map((tech) => {
              const isLive = Boolean(
                tech.isLive ||
                tech.isOnline ||
                tech.status === 'online' ||
                tech.status === 'live_online' ||
                tech.status === 'on_duty_inside'
              );
              return (
                <Marker
                  key={`tech-${tech.id}`}
                  coordinate={{ latitude: tech.latitude as number, longitude: tech.longitude as number }}
                  title={`${isLive ? '🟢' : '🔵'} ${tech.name}`}
                  description={`${isLive ? 'Live GPS' : 'Last Known'} • ${tech.lastLocationTime || tech.lastSeen || 'Logged'}${tech.assignedSiteName ? ' • ' + tech.assignedSiteName : ''}`}
                  pinColor={isLive ? '#10B981' : '#3B82F6'}
                  onPress={() => handleSelectTechnician(tech)}
                />
              );
            })}

          {/* Supervisor / Admin Device Location */}
          {userLocation && (
            <Marker
              coordinate={{ latitude: userLocation.latitude, longitude: userLocation.longitude }}
              title="My Location"
              description="Current Supervisor/Admin Device Location"
              pinColor="#2563EB"
            />
          )}
        </MapView>
      </View>

      {/* Quick Active Personnel Chips on Mobile */}
      {!isWide && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.techQuickChipsRow}
        >
          {technicians
            .filter((t) => t.hasGps)
            .map((t) => {
              const isSel = selectedTech?.id === t.id;
              return (
                <TouchableOpacity delayPressIn={0}
                  key={t.id}
                  style={[
                    styles.techQuickChip,
                    isSel && styles.techQuickChipSelected,
                  ]}
                  onPress={() => handleSelectTechnician(t)}
                >
                  <View style={[styles.techChipDot, isSel && { backgroundColor: '#38BDF8' }]} />
                  <Text style={[styles.techChipText, isSel && styles.techChipTextSelected]}>
                    {t.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
        </ScrollView>
      )}

      {/* Bottom Card: Active Fleet Telemetry Summary */}
      <View style={styles.telemetryCard}>
        {/* Card Header Row */}
        <View style={styles.telemetryHeader}>
          <View style={styles.telemetryHeaderLeft}>
            <View style={styles.telemetryIconBadge}>
              <Radio size={16} color="#1E63F0" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.telemetryTitle}>Active Fleet Telemetry Summary</Text>
              <Text style={styles.telemetrySub} numberOfLines={1}>
                Synchronized in real-time with satellite positioning and Firebase Cloud Database.
              </Text>
            </View>
          </View>

          <View style={styles.telemetryHeaderActions}>
            {userLocation && (
              <TouchableOpacity delayPressIn={0}
                style={styles.myLocationBtn}
                onPress={handleFocusUserLocation}
                activeOpacity={0.8}
              >
                <Crosshair size={13} color="#1D4ED8" />
                <Text style={styles.myLocationBtnText}>My Location</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity delayPressIn={0}
              style={[styles.copyBtn, copyFeedback && styles.copyBtnSuccess]}
              onPress={handleCopyGPS}
              activeOpacity={0.8}
            >
              {copyFeedback ? (
                <Check size={13} color="#15803D" />
              ) : (
                <Copy size={13} color="#0F172A" />
              )}
              <Text
                style={[
                  styles.copyBtnText,
                  copyFeedback && { color: '#15803D', fontWeight: '800' },
                ]}
              >
                {copyFeedback ? 'Copied!' : 'Copy GPS'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity delayPressIn={0}
              style={styles.recenterBtn}
              onPress={handleRecenter}
              activeOpacity={0.8}
            >
              <Navigation size={13} color="#FFFFFF" />
              <Text style={styles.recenterBtnText}>Recenter Map</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Prominent Employee Details & Last Known Location Inspection Card */}
        {selectedTech && (
          <View style={styles.techInspectionCard}>
            {/* Header: Avatar, Name, Employee ID, Designation & Quick Call */}
            <View style={styles.inspectionHeader}>
              <View style={styles.inspectionAvatarWrap}>
                <Text style={styles.inspectionAvatarText}>
                  {(selectedTech.name || 'Technician')
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase()}
                </Text>
              </View>

              <View style={{ flex: 1, marginLeft: 10 }}>
                <View style={styles.inspectionNameRow}>
                  <Text style={styles.inspectionNameText} numberOfLines={1}>
                    {selectedTech.name}
                  </Text>
                  {/* Online/Offline Status Badge */}
                  {selectedTech.isOnline || selectedTech.status === 'online' ? (
                    <View style={styles.badgeOnline}>
                      <View style={styles.onlinePulseDot} />
                      <Text style={styles.badgeOnlineText}>Online (Live)</Text>
                    </View>
                  ) : (
                    <View style={styles.badgeOffline}>
                      <View style={styles.offlineMiniDot} />
                      <Text style={styles.badgeOfflineText}>Offline (Last Known)</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.inspectionSubText} numberOfLines={1}>
                  {selectedTech.employeeId} • {selectedTech.designation || 'Field Staff'}
                </Text>
              </View>

              {/* Quick Call Button */}
              {selectedTech.phone ? (
                <TouchableOpacity delayPressIn={0}
                  style={styles.inspectionCallBtn}
                  onPress={() => Linking.openURL(`tel:${selectedTech.phone}`)}
                  activeOpacity={0.8}
                >
                  <Phone size={13} color="#FFFFFF" />
                  <Text style={styles.inspectionCallBtnText}>Call</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* 4 Details Grid (Name, Phone, Status, Location, Date & Time) */}
            <View style={styles.inspectionDetailsGrid}>
              {/* 1. Contact Number */}
              <View style={styles.inspectionDetailRow}>
                <View style={styles.inspectionIconCircle}>
                  <Phone size={13} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inspectionFieldLabel}>CONTACT NUMBER</Text>
                  <TouchableOpacity delayPressIn={0}
                    onPress={() => selectedTech.phone && Linking.openURL(`tel:${selectedTech.phone}`)}
                    disabled={!selectedTech.phone}
                  >
                    <Text style={[styles.inspectionFieldValue, selectedTech.phone && styles.phoneLinkText]}>
                      {selectedTech.phone || 'No phone registered'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 2. Online / Offline Status */}
              <View style={styles.inspectionDetailRow}>
                <View style={styles.inspectionIconCircle}>
                  <Radio size={13} color={selectedTech.isOnline ? '#10B981' : '#64748B'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inspectionFieldLabel}>ONLINE / OFFLINE STATUS</Text>
                  <Text style={[styles.inspectionFieldValue, { color: selectedTech.isOnline ? '#059669' : '#475569', fontWeight: '800' }]}>
                    {selectedTech.isOnline ? 'Online • Real-Time GPS Tracking Active' : 'Offline • Last Recorded Location Retained'}
                  </Text>
                </View>
              </View>

              {/* 3. Last Known Location */}
              <View style={styles.inspectionDetailRow}>
                <View style={styles.inspectionIconCircle}>
                  <MapPin size={13} color={hasSelectedGps ? '#D97706' : '#94A3B8'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inspectionFieldLabel}>LAST KNOWN LOCATION</Text>
                  <Text style={[styles.inspectionFieldValue, !hasSelectedGps && { color: '#64748B' }]} numberOfLines={2}>
                    {hasSelectedGps
                      ? (selectedTech.locationName || selectedTech.assignedSiteName || 'Site Location')
                      : 'LOCATION NOT AVAILABLE - No GPS telemetry logged yet'}
                  </Text>
                  <Text style={styles.inspectionCoordsSub}>
                    GPS: {hasSelectedGps ? `${activeLat}, ${activeLon}` : 'Coordinates Not Available'}
                  </Text>
                </View>
                {hasSelectedGps && (
                  <TouchableOpacity delayPressIn={0}
                    style={[styles.copyGpsInlineBtn, copyFeedback && styles.copyGpsInlineSuccess]}
                    onPress={handleCopyGPS}
                    activeOpacity={0.8}
                  >
                    {copyFeedback ? <Check size={11} color="#15803D" /> : <Copy size={11} color="#475569" />}
                    <Text style={[styles.copyGpsInlineText, copyFeedback && { color: '#15803D' }]}>
                      {copyFeedback ? 'Copied' : 'Copy'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* 4. Last Location Update Date and Time */}
              <View style={styles.inspectionDetailRow}>
                <View style={styles.inspectionIconCircle}>
                  <Clock size={13} color="#7C3AED" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inspectionFieldLabel}>LAST LOCATION UPDATE DATE & TIME</Text>
                  <Text style={styles.inspectionFieldValue}>
                    {hasSelectedGps
                      ? (selectedTech.lastLocationUpdate || `${selectedTech.lastLocationDate || 'Today'} at ${selectedTech.lastLocationTime || selectedTech.lastSeen || '--'}`)
                      : 'No updates recorded'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* 3 Metric Summary Boxes */}
        <View style={styles.metricsGrid}>
          {/* Metric 1 */}
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>LAST KNOWN GPS COORDINATES</Text>
            <Text style={[styles.metricCoords, !hasSelectedGps && { fontSize: 11, color: '#64748B' }]} numberOfLines={1}>
              {hasSelectedGps ? `${activeLat}, ${activeLon}` : 'LOCATION NOT AVAILABLE'}
            </Text>
            <View style={styles.metricSubRow}>
              <View style={[styles.greenMiniDot, !hasSelectedGps && { backgroundColor: '#94A3B8' }]} />
              <Text style={styles.metricSubText} numberOfLines={1}>
                {hasSelectedGps ? `Accuracy: ${activeAccuracy}` : 'No GPS telemetry logged yet'}
              </Text>
            </View>
          </View>

          {/* Metric 2 */}
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>ASSIGNED SUBSTATION SITE</Text>
            <Text style={styles.metricSiteName} numberOfLines={1}>
              {activeSiteName}
            </Text>
            <View style={styles.metricSubRow}>
              <ShieldCheck size={12} color="#10B981" />
              <Text style={styles.metricSubText} numberOfLines={1}>
                500m Geofence Verified
              </Text>
            </View>
          </View>

          {/* Metric 3 */}
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>LAST RECORDED TELEMETRY SIGNAL</Text>
            <Text style={styles.metricTime} numberOfLines={1}>
              {selectedTech?.lastLocationTime || activeTime}
            </Text>
            <View style={styles.metricSubRow}>
              <Radio size={12} color="#3B82F6" />
              <Text style={styles.metricSubText} numberOfLines={1}>
                Signal: {selectedTech?.isOnline ? 'Real-Time Live Signal' : 'Retained Last Known'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: Math.max(insets.top, 12) }]}>
      {/* 1. Responsive Header */}
      {isWide ? (
        // Desktop Wide Header
        <View style={styles.desktopHeader}>
          <View style={styles.desktopHeaderLeft}>
            <AppBackButton onPress={handleBack} style={{ marginRight: 8 }} />

            <View style={styles.desktopHeaderTitleWrap}>
              <View style={styles.desktopTitleRow}>
                <Text style={styles.headerTitle}>Field Force Live Telemetry</Text>
                <View style={styles.liveBadge}>
                  <View style={styles.livePulseDot} />
                  <Text style={styles.liveBadgeText} numberOfLines={1}>
                    LIVE 10s TELEMETRY RADAR
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.desktopHeaderRight}>
            <View style={styles.onDutyPill}>
              <View style={styles.greenMiniDot} />
              <Text style={styles.onDutyText}>{liveCount} Live GPS</Text>
            </View>

            <View style={[styles.onDutyPill, { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }]}>
              <View style={[styles.greenMiniDot, { backgroundColor: '#3B82F6' }]} />
              <Text style={[styles.onDutyText, { color: '#1E293B' }]}>{lastKnownCount} Last Known</Text>
            </View>

            <View style={styles.standbyPill}>
              <Text style={styles.standbyText}>{noLocationCount} No GPS</Text>
            </View>

            <TouchableOpacity delayPressIn={0}
              style={styles.syncBtn}
              onPress={() => fetchLiveTracking(true)}
              activeOpacity={0.8}
            >
              <RefreshCw
                size={14}
                color="#0F172A"
                style={refreshing ? { transform: [{ rotate: '45deg' }] } : undefined}
              />
              <Text style={styles.syncBtnText}>Sync GPS</Text>
            </TouchableOpacity>

            <TouchableOpacity delayPressIn={0}
              style={styles.menuBtn}
              onPress={handleMenuPress}
              activeOpacity={0.8}
              accessibilityLabel="Open Menu"
            >
              <Menu size={18} color="#0F172A" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // Mobile Header
        <View style={styles.mobileHeader}>
          {/* Mobile Row 1: Back, Title, Sync, Menu */}
          <View style={styles.mobileHeaderRow1}>
            <AppBackButton onPress={handleBack} style={{ marginRight: 8 }} />

            <View style={styles.mobileTitleBlock}>
              <Text style={styles.mobileTitleText} numberOfLines={1}>
                Field Force Live Telemetry
              </Text>
            </View>

            <View style={styles.mobileActionButtons}>
              <TouchableOpacity delayPressIn={0}
                style={styles.syncBtnCompact}
                onPress={() => fetchLiveTracking(true)}
                activeOpacity={0.8}
              >
                <RefreshCw
                  size={13}
                  color="#0F172A"
                  style={refreshing ? { transform: [{ rotate: '45deg' }] } : undefined}
                />
                <Text style={styles.syncBtnCompactText}>Sync</Text>
              </TouchableOpacity>

              <TouchableOpacity delayPressIn={0}
                style={styles.menuBtn}
                onPress={handleMenuPress}
                activeOpacity={0.8}
                accessibilityLabel="Open Menu"
              >
                <Menu size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Mobile Row 2: Status Pills in Safe Horizontal Row */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.mobilePillsRow}
          >
            <View style={styles.liveBadge}>
              <View style={styles.livePulseDot} />
              <Text style={styles.liveBadgeText} numberOfLines={1}>
                {liveCount} LIVE GPS
              </Text>
            </View>

            <View style={[styles.onDutyPill, { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }]}>
              <View style={[styles.greenMiniDot, { backgroundColor: '#3B82F6' }]} />
              <Text style={[styles.onDutyText, { color: '#1E293B' }]} numberOfLines={1}>
                {lastKnownCount} Last Known
              </Text>
            </View>

            <View style={styles.standbyPill}>
              <Text style={styles.standbyText} numberOfLines={1}>
                {noLocationCount} No GPS
              </Text>
            </View>
          </ScrollView>

          {/* Mobile Row 3: Tab Selector */}
          <View style={styles.mobileTabBar}>
            <TouchableOpacity delayPressIn={0}
              style={[styles.mobileTabBtn, mobileTab === 'map' && styles.mobileTabBtnActive]}
              onPress={() => setMobileTab('map')}
            >
              <MapPin size={14} color={mobileTab === 'map' ? '#1E63F0' : '#64748B'} />
              <Text
                style={[
                  styles.mobileTabBtnText,
                  mobileTab === 'map' && styles.mobileTabBtnTextActive,
                ]}
              >
                Live Map ({liveCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity delayPressIn={0}
              style={[styles.mobileTabBtn, mobileTab === 'roster' && styles.mobileTabBtnActive]}
              onPress={() => setMobileTab('roster')}
            >
              <Users size={14} color={mobileTab === 'roster' ? '#1E63F0' : '#64748B'} />
              <Text
                style={[
                  styles.mobileTabBtnText,
                  mobileTab === 'roster' && styles.mobileTabBtnTextActive,
                ]}
              >
                Roster ({technicians.length})
              </Text>
            </TouchableOpacity>


          </View>
        </View>
      )}

      {/* 2. Content Area */}
      {isWide ? (
        // Desktop Split View
        <View style={styles.desktopBody}>
          <View style={styles.desktopLeftCol}>{renderRoster()}</View>
          <View style={styles.desktopRightCol}>{renderMapAndTelemetry()}</View>
        </View>
      ) : (
        // Mobile Tabbed / Scrollable View
        <ScrollView
          style={styles.mobileBodyScroll}
          contentContainerStyle={styles.mobileBodyContent}
          showsVerticalScrollIndicator={false}
        >
          {mobileTab === 'map' && renderMapAndTelemetry()}
          {mobileTab === 'roster' && renderRoster()}
        </ScrollView>
      )}

      {/* Navigation Drawer Modal */}
      {user?.role === 'supervisor' ? <SupervisorDrawerModal /> : <AdminDrawerModal />}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Desktop Header
  desktopHeader: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  desktopHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  desktopHeaderTitleWrap: {
    flex: 1,
  },
  desktopTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'nowrap',
  },
  desktopHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Mobile Header
  mobileHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 8,
  },
  mobileHeaderRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  mobileTitleBlock: {
    flex: 1,
    marginHorizontal: 4,
  },
  mobileTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  mobileSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  mobileActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncBtnCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  syncBtnCompactText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  mobilePillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingBottom: 2,
  },
  mobileTabBar: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    marginTop: 10,
    gap: 4,
  },
  mobileTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 6,
    borderRadius: 8,
  },
  mobileTabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  mobileTabBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  mobileTabBtnTextActive: {
    fontWeight: '800',
    color: '#1E63F0',
  },

  // Shared Header Elements
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
    flexShrink: 0,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#16A34A',
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
    letterSpacing: 0.4,
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
  },
  onDutyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
    flexShrink: 0,
  },
  greenMiniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  blueMiniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
  },
  onDutyText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#166534',
  },
  standbyPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
    flexShrink: 0,
  },
  standbyText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  syncBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Desktop Body
  desktopBody: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  desktopLeftCol: {
    width: 360,
  },
  desktopRightCol: {
    flex: 1,
  },

  // Mobile Body
  mobileBodyScroll: {
    flex: 1,
  },
  mobileBodyContent: {
    padding: 12,
    paddingBottom: 24,
  },

  // Roster Styles
  rosterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    height: '100%',
    minHeight: 450,
  },
  rosterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  rosterHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rosterTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  viewAllBtn: {
    backgroundColor: '#1E63F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  viewAllBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 36,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 11.5,
    color: '#0F172A',
    padding: 0,
  },
  filterTabsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#0F172A',
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  rosterList: {
    flex: 1,
  },
  rosterListContent: {
    gap: 8,
    paddingBottom: 8,
  },
  techCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    gap: 10,
    alignItems: 'flex-start',
  },
  techCardSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#F0F7FF',
    borderWidth: 1.5,
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  techCardBody: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  techName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  techEmpCode: {
    fontSize: 10.5,
    fontWeight: '500',
    color: '#64748B',
  },
  designationRow: {
    marginTop: 2,
    marginBottom: 2,
  },
  designationText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  onlineAvatarDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#16A34A',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeOnline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  badgeOnlineText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#15803D',
  },
  onlineMiniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  onlinePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  badgeOffline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  badgeOfflineText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
  },
  offlineMiniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
  },
  greyMiniDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#94A3B8',
  },
  badgeLate: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeLateText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#B45309',
  },
  badgeHalfDay: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeHalfDayText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#C2410C',
  },
  badgeNotCheckedIn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeNotCheckedInText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
  },
  badgeBattery: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeBatteryText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#15803D',
  },
  badgeOnDuty: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeOnDutyText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#15803D',
  },
  techInspectionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  inspectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  inspectionAvatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inspectionAvatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  inspectionNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  inspectionNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  inspectionSubText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  inspectionCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#16A34A',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  inspectionCallBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  inspectionDetailsGrid: {
    marginTop: 10,
    gap: 9,
  },
  inspectionDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 9,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  inspectionIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inspectionFieldLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  inspectionFieldValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 1,
  },
  phoneLinkText: {
    color: '#2563EB',
    textDecorationLine: 'underline',
  },
  inspectionCoordsSub: {
    fontSize: 10.5,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
  },
  copyGpsInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  copyGpsInlineSuccess: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  copyGpsInlineText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },
  siteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  siteName: {
    fontSize: 10.5,
    color: '#475569',
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 6,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  gpsText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0F172A',
  },
  gpsTextMuted: {
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },

  // Map & Telemetry Column
  rightColumn: {
    flexDirection: 'column',
    gap: 12,
  },
  mapFrame: {
    height: 560,
    minHeight: 520,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F1F5F9',
  },
  mapView: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  mapFloatingTopBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
    maxWidth: '90%',
  },
  mapFloatingTopText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  floatingShowAllBtn: {
    backgroundColor: '#1E63F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 6,
  },
  floatingShowAllText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  noGpsFloatingBanner: {
    position: 'absolute',
    top: 48,
    left: 12,
    right: 12,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 3,
  },
  noGpsFloatingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    flex: 1,
  },
  mapFloatingBottomBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 3,
    maxWidth: '90%',
  },
  mapFloatingBottomText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },

  // Quick Chips on Mobile
  techQuickChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  techQuickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  techQuickChipSelected: {
    backgroundColor: '#1E40AF',
    borderColor: '#60A5FA',
  },
  techChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  techChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  techChipTextSelected: {
    color: '#FFFFFF',
  },

  // Telemetry Card
  telemetryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  telemetryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 10,
    flexWrap: 'wrap',
  },
  telemetryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 200,
  },
  telemetryIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  telemetryTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  telemetrySub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },
  telemetryHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 9,
  },
  copyBtnSuccess: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  copyBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  recenterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E63F0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
  },
  recenterBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  metricBox: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
  },
  metricLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  metricCoords: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
  },
  metricSiteName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  metricTime: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  metricSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  metricSubText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#15803D',
  },
  locationNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  locationNameText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#4F46E5',
    flex: 1,
  },
  myLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
  },
  myLocationBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  lastLocationCardBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  lastLocationPinCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  lastLocationTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  lastLocationTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284C7',
    letterSpacing: 0.5,
  },
  lastLocationTimeTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369A1',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lastLocationMainAddress: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 18,
  },
  lastLocationCoordsText: {
    fontSize: 10.5,
    color: '#475569',
    marginTop: 3,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

export default TrackingScreen;
