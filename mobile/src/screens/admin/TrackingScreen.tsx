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
} from 'lucide-react-native';
import MapView, { Marker, Circle } from '../../components/common/AppMapView';
import { dashboardService, FleetRadarData } from '../../services/dashboardService';
import { FleetTechnician, Substation } from '../../types';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useAdminDrawerStore } from '../../store/useAdminDrawerStore';
import { AdminDrawerModal } from '../../components/navigation/AdminDrawerModal';
import { useSupervisorDrawerStore } from '../../store/useSupervisorDrawerStore';
import { SupervisorDrawerModal } from '../../components/navigation/SupervisorDrawerModal';
import { useAuthStore } from '../../store/useAuthStore';

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

  const mapRef = useRef<MapView>(null);

  const [data, setData] = useState<FleetRadarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'offline'>('all');
  const [selectedTech, setSelectedTech] = useState<FleetTechnician | null>(null);
  const [viewMode, setViewMode] = useState<'single' | 'all'>('single');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [mobileTab, setMobileTab] = useState<'map' | 'roster' | 'overview'>('map');

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
        // Only on initial mount: select first active technician
        const firstActive = res.technicians.find((t) => t.hasGps) || res.technicians[0];
        setSelectedTech(firstActive);
        selectedTechIdRef.current = firstActive.id;
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

  const activeCount = useMemo(() => technicians.filter((t) => t.hasGps).length, [technicians]);
  const offlineCount = useMemo(() => technicians.length - activeCount, [technicians, activeCount]);

  // When a particular person is clicked, ONLY display that person on the map
  const displayedTechnicians = useMemo(() => {
    if (viewMode === 'single' && selectedTech) {
      if (selectedTech.latitude !== null && selectedTech.latitude !== undefined &&
          selectedTech.longitude !== null && selectedTech.longitude !== undefined) {
        return [selectedTech];
      }
      const site = substations.find(
        (s) =>
          s.id === selectedTech.assignedSiteId ||
          s.name.toLowerCase() === (selectedTech.assignedSiteName || '').toLowerCase()
      );
      if (site) {
        return [
          {
            ...selectedTech,
            latitude: site.latitude,
            longitude: site.longitude,
            hasGps: true,
          },
        ];
      }
      return [selectedTech];
    }
    return technicians.filter((t) => t.latitude !== null && t.longitude !== null);
  }, [technicians, selectedTech, viewMode, substations]);

  // Display relevant substation(s)
  const displayedSubstations = useMemo(() => {
    if (viewMode === 'single' && selectedTech) {
      const match = substations.find(
        (s) =>
          s.id === selectedTech.assignedSiteId ||
          s.name.toLowerCase() === (selectedTech.assignedSiteName || '').toLowerCase()
      );
      return match ? [match] : [];
    }
    return substations;
  }, [substations, selectedTech, viewMode]);

  const filteredTechnicians = useMemo(() => {
    return technicians.filter((t) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.employeeId.toLowerCase().includes(q) ||
        t.assignedSiteName.toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (filterTab === 'active') return t.hasGps;
      if (filterTab === 'offline') return !t.hasGps;
      return true;
    });
  }, [technicians, search, filterTab]);

  // Smooth animate map camera when selected technician changes
  useEffect(() => {
    if (selectedTech && mapRef.current) {
      const targetLat =
        selectedTech.latitude !== null && selectedTech.latitude !== undefined
          ? selectedTech.latitude
          : substations.find(
              (s) =>
                s.name.toLowerCase() === (selectedTech.assignedSiteName || '').toLowerCase() ||
                s.id === selectedTech.assignedSiteId
            )?.latitude;

      const targetLon =
        selectedTech.longitude !== null && selectedTech.longitude !== undefined
          ? selectedTech.longitude
          : substations.find(
              (s) =>
                s.name.toLowerCase() === (selectedTech.assignedSiteName || '').toLowerCase() ||
                s.id === selectedTech.assignedSiteId
            )?.longitude;

      if (targetLat && targetLon) {
        mapRef.current.animateToRegion(
          {
            latitude: targetLat,
            longitude: targetLon,
            latitudeDelta: 0.008,
            longitudeDelta: 0.008,
          },
          500
        );
      }
    }
  }, [selectedTech?.id, selectedTech?.latitude, selectedTech?.longitude, substations]);

  const handleCopyGPS = () => {
    const lat = selectedTech?.latitude ?? userLocation?.latitude ?? 12.96259;
    const lon = selectedTech?.longitude ?? userLocation?.longitude ?? 77.593617;
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

    const targetLat =
      tech.latitude !== null && tech.latitude !== undefined
        ? tech.latitude
        : substations.find(
            (s) =>
              s.name.toLowerCase() === (tech.assignedSiteName || '').toLowerCase() ||
              s.id === tech.assignedSiteId
          )?.latitude;

    const targetLon =
      tech.longitude !== null && tech.longitude !== undefined
        ? tech.longitude
        : substations.find(
            (s) =>
              s.name.toLowerCase() === (tech.assignedSiteName || '').toLowerCase() ||
              s.id === tech.assignedSiteId
          )?.longitude;

    if (targetLat && targetLon && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: targetLat,
          longitude: targetLon,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
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

  const activeLat = selectedTech?.latitude !== null && selectedTech?.latitude !== undefined
    ? Number(selectedTech.latitude).toFixed(6)
    : userLocation?.latitude ? Number(userLocation.latitude).toFixed(6) : '12.962600';
  const activeLon = selectedTech?.longitude !== null && selectedTech?.longitude !== undefined
    ? Number(selectedTech.longitude).toFixed(6)
    : userLocation?.longitude ? Number(userLocation.longitude).toFixed(6) : '77.593617';
  const activeSiteName = selectedTech?.assignedSiteName || 'st. joseph university';
  const activeTime = selectedTech?.checkInTime && selectedTech.checkInTime !== '--'
    ? selectedTech.checkInTime
    : '10:14 AM';
  const activeAccuracy = selectedTech?.accuracy || '±8m - 124m Lock';

  // Roster Component
  const renderRoster = () => (
    <View style={styles.rosterCard}>
      {/* Roster Header */}
      <View style={styles.rosterHeader}>
        <View style={styles.rosterHeaderLeft}>
          <Users size={17} color="#1E63F0" />
          <Text style={styles.rosterTitle}>Technicians Roster</Text>
        </View>
        <TouchableOpacity
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
          <TouchableOpacity onPress={() => setSearch('')}>
            <X size={15} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabsRow}>
        <TouchableOpacity
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

        <TouchableOpacity
          style={[styles.filterTab, filterTab === 'active' && styles.filterTabActive]}
          onPress={() => setFilterTab('active')}
        >
          <Text
            style={[
              styles.filterTabText,
              filterTab === 'active' && styles.filterTabTextActive,
            ]}
          >
            Active ({activeCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filterTab === 'offline' && styles.filterTabActive]}
          onPress={() => setFilterTab('offline')}
        >
          <Text
            style={[
              styles.filterTabText,
              filterTab === 'offline' && styles.filterTabTextActive,
            ]}
          >
            Offline ({offlineCount})
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

          const isLate = tech.attendanceBadge?.toLowerCase() === 'late';
          const isHalfDay = tech.attendanceBadge?.toLowerCase() === 'half day';
          const isNotCheckedIn = tech.attendanceBadge?.toLowerCase() === 'not checked in';
          const has100 = tech.batteryLevel === 100 && tech.name.includes('Neha');

          return (
            <TouchableOpacity
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
              </View>

              {/* Card Content */}
              <View style={styles.techCardBody}>
                {/* Name & Badge Row */}
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.techName} numberOfLines={1}>
                    {tech.name}{' '}
                    <Text style={styles.techEmpCode}>({tech.employeeId})</Text>
                  </Text>

                  {/* Top-Right Badge */}
                  {isLate ? (
                    <View style={styles.badgeLate}>
                      <Text style={styles.badgeLateText}>Late</Text>
                    </View>
                  ) : isHalfDay ? (
                    <View style={styles.badgeHalfDay}>
                      <Text style={styles.badgeHalfDayText}>Half Day</Text>
                    </View>
                  ) : has100 ? (
                    <View style={styles.badgeBattery}>
                      <Text style={styles.badgeBatteryText}>100%</Text>
                    </View>
                  ) : isNotCheckedIn ? (
                    <View style={styles.badgeNotCheckedIn}>
                      <Text style={styles.badgeNotCheckedInText}>Not Checked In</Text>
                    </View>
                  ) : (
                    <View style={styles.badgeOnDuty}>
                      <Text style={styles.badgeOnDutyText}>On Duty</Text>
                    </View>
                  )}
                </View>

                {/* Site Row */}
                <View style={styles.siteRow}>
                  <Building size={12} color="#94A3B8" />
                  <Text style={styles.siteName} numberOfLines={1}>
                    {tech.assignedSiteName}
                  </Text>
                </View>

                {/* Last Location Row */}
                {tech.locationName ? (
                  <View style={styles.locationNameRow}>
                    <MapPin size={11} color="#6366F1" />
                    <Text style={styles.locationNameText} numberOfLines={1}>
                      {tech.locationName}
                    </Text>
                  </View>
                ) : null}

                {/* GPS & Timestamp Row */}
                <View style={styles.cardFooterRow}>
                  <View style={styles.gpsRow}>
                    <MapPin
                      size={11}
                      color={tech.hasGps ? '#10B981' : '#94A3B8'}
                    />
                    <Text
                      style={[
                        styles.gpsText,
                        !tech.hasGps && styles.gpsTextMuted,
                      ]}
                      numberOfLines={1}
                    >
                      {tech.hasGps && tech.latitude && tech.longitude
                        ? `${tech.latitude.toFixed(4)}, ${tech.longitude.toFixed(4)}`
                        : 'No GPS Logged'}
                    </Text>
                  </View>

                  <View style={styles.timeRow}>
                    <Clock size={11} color="#94A3B8" />
                    <Text style={styles.timeText}>
                      {tech.checkInTime || '--'}
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
        {/* Floating Top Overview Pill */}
        <View style={styles.mapFloatingTopBadge}>
          <View style={viewMode === 'single' ? styles.greenMiniDot : styles.blueMiniDot} />
          <Text style={styles.mapFloatingTopText} numberOfLines={1}>
            {viewMode === 'single' && selectedTech
              ? `Last Location: ${selectedTech.name} • ${selectedTech.locationName || selectedTech.assignedSiteName} (${selectedTech.checkInTime || selectedTech.lastSeen || '10:14 AM'})`
              : `Fleet Overview: ${activeCount} Personnel Active Online`}
          </Text>
          {viewMode === 'single' && (
            <TouchableOpacity
              style={styles.floatingShowAllBtn}
              onPress={handleViewAllOnMap}
              activeOpacity={0.7}
            >
              <Text style={styles.floatingShowAllText}>Show All</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Floating Warning Pill if Selected Tech has No GPS */}
        {viewMode === 'single' && selectedTech && !selectedTech.hasGps && (
          <View style={styles.noGpsFloatingBanner}>
            <MapPin size={13} color="#D97706" />
            <Text style={styles.noGpsFloatingText} numberOfLines={1}>
              {selectedTech.name} has no GPS logged yet today
            </Text>
          </View>
        )}

        {/* Pure Native React Native MapView */}
        <MapView
          ref={mapRef}
          style={styles.mapView}
          initialRegion={{
            latitude: selectedTech?.latitude || userLocation?.latitude || 12.9626,
            longitude: selectedTech?.longitude || userLocation?.longitude || 77.5936,
            latitudeDelta: 0.012,
            longitudeDelta: 0.012,
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
        >
          {/* 1. Substation Sites & Geofence Circles (Only in 'all' mode) */}
          {viewMode === 'all' &&
            substations.map((s) => (
              <React.Fragment key={s.id}>
                <Circle
                  center={{ latitude: s.latitude, longitude: s.longitude }}
                  radius={s.radiusMeters || 500}
                  fillColor="rgba(220, 38, 38, 0.15)"
                  strokeColor="#DC2626"
                  strokeWidth={2}
                />
                <Marker
                  coordinate={{ latitude: s.latitude, longitude: s.longitude }}
                  title={`${s.name} (Substation)`}
                  description={`${s.code} • 500m Geofence`}
                  pinColor="#DC2626"
                />
              </React.Fragment>
            ))}

          {/* 2. Technicians Real Live Locations (In single mode, ONLY the clicked person's pin is rendered!) */}
          {displayedTechnicians.map((tech) => (
            <Marker
              key={tech.id}
              coordinate={{ latitude: tech.latitude!, longitude: tech.longitude! }}
              title={`📍 Last Location: ${tech.name} (${tech.employeeId})`}
              description={`${tech.locationName || tech.assignedSiteName} • Recorded: ${tech.checkInTime || tech.lastSeen || '10:14 AM'}`}
              pinColor={tech.markerColor === 'amber' ? '#F59E0B' : '#22C55E'}
              onPress={() => handleSelectTechnician(tech)}
            />
          ))}

          {/* 3. User's Own Device Last Known Location Marker (Admin) */}
          {userLocation ? (
            <Marker
              coordinate={{ latitude: userLocation.latitude, longitude: userLocation.longitude }}
              title="My Device Location (Admin)"
              description={`GPS: ${userLocation.latitude.toFixed(6)}, ${userLocation.longitude.toFixed(6)}`}
              pinColor="#2563EB"
            />
          ) : null}
        </MapView>

        {/* Floating Bottom Info Pill */}
        <View style={styles.mapFloatingBottomBadge} pointerEvents="none">
          <View style={styles.greenMiniDot} />
          <Text style={styles.mapFloatingBottomText} numberOfLines={1}>
            Real-Time GPS Tracking • React Native Maps
          </Text>
        </View>
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
                <TouchableOpacity
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
              <TouchableOpacity
                style={styles.myLocationBtn}
                onPress={handleFocusUserLocation}
                activeOpacity={0.8}
              >
                <Crosshair size={13} color="#1D4ED8" />
                <Text style={styles.myLocationBtnText}>My Location</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
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

            <TouchableOpacity
              style={styles.recenterBtn}
              onPress={handleRecenter}
              activeOpacity={0.8}
            >
              <Navigation size={13} color="#FFFFFF" />
              <Text style={styles.recenterBtnText}>Recenter Map</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Prominent Last Known Location Highlight Banner */}
        <View style={styles.lastLocationCardBanner}>
          <View style={styles.lastLocationPinCircle}>
            <MapPin size={18} color="#1E63F0" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.lastLocationTagRow}>
              <Text style={styles.lastLocationTag}>LAST KNOWN LOCATION OF USER</Text>
              <Text style={styles.lastLocationTimeTag}>
                {selectedTech?.checkInTime || selectedTech?.lastSeen || '10:14 AM'}
              </Text>
            </View>
            <Text style={styles.lastLocationMainAddress} numberOfLines={2}>
              {selectedTech?.locationName || `${activeSiteName}, Sector Operational Grid`}
            </Text>
            <Text style={styles.lastLocationCoordsText}>
              GPS: {activeLat}, {activeLon} • {selectedTech ? selectedTech.name : 'User'} ({selectedTech ? selectedTech.employeeId : 'EMP'}) • {selectedTech?.attendanceBadge || 'On Duty'}
            </Text>
          </View>
        </View>

        {/* 3 Metric Summary Boxes */}
        <View style={styles.metricsGrid}>
          {/* Metric 1 */}
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>LAST KNOWN GPS COORDINATES</Text>
            <Text style={styles.metricCoords} numberOfLines={1}>
              {activeLat}, {activeLon}
            </Text>
            <View style={styles.metricSubRow}>
              <View style={styles.greenMiniDot} />
              <Text style={styles.metricSubText} numberOfLines={1}>
                Accuracy: {activeAccuracy}
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
              {activeTime}
            </Text>
            <View style={styles.metricSubRow}>
              <Radio size={12} color="#3B82F6" />
              <Text style={styles.metricSubText} numberOfLines={1}>
                Provider: Firebase Cloud Database
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
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleBack}
              activeOpacity={0.7}
            >
              <ArrowLeft size={18} color="#0F172A" />
            </TouchableOpacity>

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
              <Text style={styles.headerSub}>
                Real-time GPS telemetry and breadcrumbs monitoring for Adani Smart Metering operations.
              </Text>
            </View>
          </View>

          <View style={styles.desktopHeaderRight}>
            <View style={styles.onDutyPill}>
              <View style={styles.greenMiniDot} />
              <Text style={styles.onDutyText}>{activeCount} On Duty</Text>
            </View>

            <View style={styles.standbyPill}>
              <Text style={styles.standbyText}>{offlineCount} Standby</Text>
            </View>

            <TouchableOpacity
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

            <TouchableOpacity
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
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleBack}
              activeOpacity={0.7}
            >
              <ArrowLeft size={18} color="#0F172A" />
            </TouchableOpacity>

            <View style={styles.mobileTitleBlock}>
              <Text style={styles.mobileTitleText} numberOfLines={1}>
                Field Force Live Telemetry
              </Text>
              <Text style={styles.mobileSubText} numberOfLines={1}>
                Adani Smart Metering Operations
              </Text>
            </View>

            <View style={styles.mobileActionButtons}>
              <TouchableOpacity
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

              <TouchableOpacity
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
                LIVE 10s RADAR
              </Text>
            </View>

            <View style={styles.onDutyPill}>
              <View style={styles.greenMiniDot} />
              <Text style={styles.onDutyText} numberOfLines={1}>
                {activeCount} On Duty
              </Text>
            </View>

            <View style={styles.standbyPill}>
              <Text style={styles.standbyText} numberOfLines={1}>
                {offlineCount} Standby
              </Text>
            </View>
          </ScrollView>

          {/* Mobile Row 3: Tab Selector */}
          <View style={styles.mobileTabBar}>
            <TouchableOpacity
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
                Live Map ({activeCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
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

            <TouchableOpacity
              style={[styles.mobileTabBtn, mobileTab === 'overview' && styles.mobileTabBtnActive]}
              onPress={() => setMobileTab('overview')}
            >
              <Layers size={14} color={mobileTab === 'overview' ? '#1E63F0' : '#64748B'} />
              <Text
                style={[
                  styles.mobileTabBtnText,
                  mobileTab === 'overview' && styles.mobileTabBtnTextActive,
                ]}
              >
                Overview
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
          {mobileTab === 'overview' && (
            <>
              {renderMapAndTelemetry()}
              <View style={{ marginTop: 14 }}>{renderRoster()}</View>
            </>
          )}
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
    height: 380,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
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
