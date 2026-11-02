import React, { useEffect, useState, useMemo } from 'react';
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
  ArrowLeft,
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

// Safely import react-native-webview for native devices
let WebView: any = null;
if (Platform.OS !== 'web') {
  try {
    const RNW = require('react-native-webview');
    WebView = RNW.default || RNW.WebView || RNW;
  } catch (e) {
    console.warn('react-native-webview not loaded:', e);
  }
}

interface SiteDetailsScreenProps {
  route: any;
  navigation: any;
}

export const SiteDetailsScreen: React.FC<SiteDetailsScreenProps> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useTechnicianDrawerStore();
  const { user } = useAuthStore();

  const [allSites, setAllSites] = useState<Substation[]>([]);
  const [activeSiteId, setActiveSiteId] = useState<string>(route.params?.siteId || '');
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);

  // Load all substations and set initial active site
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      try {
        const sites = await siteService.getSites();
        if (isMounted) {
          setAllSites(sites || []);

          // Determine initial selected site (Default: Surat ST-1 or Rohit's assigned site)
          const userSiteIds =
            user?.assignedSiteIds && user.assignedSiteIds.length > 0
              ? user.assignedSiteIds
              : user?.assignedSiteId
              ? [user.assignedSiteId]
              : ['site_surat_01', 'site_st_joseph'];

          const targetId = route.params?.siteId || user?.assignedSiteId || userSiteIds[0];
          setActiveSiteId(targetId);
        }

        // Fetch user location for proximity radar
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted' && isMounted) {
          const loc = await Location.getCurrentPositionAsync({});
          setUserCoords({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to load substation specifications');
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Compute all assigned sites for the logged-in technician (e.g. Rohit has 2 sites: Surat ST-1 & st. joseph)
  const assignedSites = useMemo(() => {
    if (!allSites || allSites.length === 0) return [];

    const userSiteIds =
      user?.assignedSiteIds && user.assignedSiteIds.length > 0
        ? user.assignedSiteIds
        : user?.assignedSiteId
        ? [user.assignedSiteId]
        : ['site_surat_01', 'site_st_joseph'];

    const matched = allSites.filter(
      (s) =>
        userSiteIds.includes(s.id) ||
        userSiteIds.includes((s as any)._id) ||
        userSiteIds.includes(s.code)
    );

    return matched.length > 0 ? matched : allSites.slice(0, 2);
  }, [allSites, user]);

  // Active selected substation
  const site: Substation | null = useMemo(() => {
    if (!allSites || allSites.length === 0) return null;
    return (
      allSites.find((s) => s.id === activeSiteId || (s as any)._id === activeSiteId) ||
      assignedSites[0] ||
      allSites[0]
    );
  }, [allSites, activeSiteId, assignedSites]);

  const handleCall = () => {
    if (site?.manager?.phone) {
      Linking.openURL(`tel:${site.manager.phone.replace(/\s+/g, '')}`);
    }
  };

  const handleEmail = () => {
    if (site?.manager?.email) {
      Linking.openURL(`mailto:${site.manager.email}`);
    }
  };

  const handleDirections = () => {
    if (!site) return;
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

  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [mgrImgFailed, setMgrImgFailed] = useState(false);

  // Reset image errors when switching sites
  useEffect(() => {
    setHeroImgFailed(false);
    setMgrImgFailed(false);
  }, [activeSiteId]);

  // Authentic high-voltage substation imagery (No graduation photos!)
  const heroImageUrl = useMemo(() => {
    if (!site) return 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=1000&q=85';
    const sId = site.id || (site as any)._id;

    if (heroImgFailed) {
      return 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1000&q=85';
    }

    if (sId === 'site_st_joseph') {
      return 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1000&q=85';
    }
    // High-voltage electrical substation equipment, transformers and power grid
    return 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=1000&q=85';
  }, [site, heroImgFailed]);

  // Professional manager photo
  const managerPhotoUrl = useMemo(() => {
    if (!site) return 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=600&q=85';
    const sId = site.id || (site as any)._id;

    if (mgrImgFailed) {
      return 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=85';
    }

    if (sId === 'site_st_joseph') {
      return 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=85';
    }
    // Professional corporate engineering executive Dhaval Patel in formal business suit
    return 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=600&q=85';
  }, [site, mgrImgFailed]);

  // Robust Interactive Geofence Radar Map HTML (Works on all mobile devices and web without API key issues)
  const radarMapHtml = useMemo(() => {
    if (!site) return '';

    const siteLat = site.latitude;
    const siteLon = site.longitude;
    const radius = site.radiusMeters || 500;
    const siteName = site.name.replace(/"/g, '\\"');
    const siteCode = site.code.replace(/"/g, '\\"');
    const userLat = userCoords?.latitude ?? 'null';
    const userLon = userCoords?.longitude ?? 'null';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #0B1120;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden;
    }
    #map {
      width: 100%;
      height: 100%;
      background: #0F172A;
    }
    /* Radar background scan effect while tiles load */
    .radar-bg {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 200px;
      height: 200px;
      margin: -100px 0 0 -100px;
      border-radius: 50%;
      border: 1px dashed rgba(67, 56, 202, 0.4);
      pointer-events: none;
      z-index: 1;
    }
    .radar-sweep {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: conic-gradient(from 0deg, rgba(67, 56, 202, 0.35) 0deg, transparent 60deg, transparent 360deg);
      animation: spin 3s linear infinite;
    }
    @keyframes spin {
      100% { transform: rotate(360deg); }
    }
    .substation-pill {
      background: #4338CA;
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1.5px solid #FFFFFF;
      box-shadow: 0 3px 8px rgba(0,0,0,0.45);
      white-space: nowrap;
      transform: translate(-50%, -100%);
      margin-top: -8px;
    }
    .substation-pin {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #4338CA;
      border: 3px solid #FFFFFF;
      box-shadow: 0 0 10px rgba(67, 56, 202, 0.8);
      position: absolute;
      top: -7px;
      left: -7px;
    }
    .user-pin-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      transform: translate(-50%, -50%);
    }
    .user-pin {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #10B981;
      border: 3px solid #FFFFFF;
      box-shadow: 0 0 10px #10B981;
    }
    .user-label {
      background: #0F172A;
      color: #34D399;
      font-size: 10px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
      margin-top: 3px;
      white-space: nowrap;
      border: 1px solid #10B981;
      box-shadow: 0 2px 5px rgba(0,0,0,0.4);
    }
    .geofence-tag {
      position: absolute;
      top: 10px;
      left: 10px;
      z-index: 1000;
      background: rgba(15, 23, 42, 0.9);
      color: #F8FAFC;
      font-size: 11px;
      font-weight: 700;
      padding: 5px 10px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.18);
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
    }
    .radar-dot {
      width: 7px;
      height: 7px;
      border-radius: 3.5px;
      background: #38BDF8;
      box-shadow: 0 0 6px #38BDF8;
    }
  </style>
</head>
<body>
  <div class="radar-bg"><div class="radar-sweep"></div></div>
  <div id="map"></div>
  
  <div class="geofence-tag">
    <div class="radar-dot"></div>
    <span>500m Geofence Perimeter Active</span>
  </div>

  <script>
    function startMap() {
      if (typeof L === 'undefined') {
        setTimeout(startMap, 80);
        return;
      }
      var siteLat = ${siteLat};
      var siteLon = ${siteLon};
      var radius = ${radius};
      var siteName = "${siteName}";
      var siteCode = "${siteCode}";
      var userLat = ${userLat};
      var userLon = ${userLon};

      var map = L.map('map', {
        zoomControl: true,
        attributionControl: false
      }).setView([siteLat, siteLon], 15);

      map.zoomControl.setPosition('bottomright');

      // Fast, beautiful CartoDB Voyager tiles with zero rate limits
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);

      // 500m Geofence Perimeter Circle
      var circle = L.circle([siteLat, siteLon], {
        radius: radius,
        color: '#4338CA',
        fillColor: '#4338CA',
        fillOpacity: 0.2,
        weight: 2.5
      }).addTo(map);

      // Substation Center Pin with high-visibility pill
      var subIcon = L.divIcon({
        className: '',
        html: '<div style="position:relative;"><div class="substation-pin"></div><div class="substation-pill">⚡ ' + siteName + ' (' + siteCode + ')</div></div>',
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });
      L.marker([siteLat, siteLon], { icon: subIcon, zIndexOffset: 1000 }).addTo(map);

      // User Location Pin
      if (userLat !== null && userLon !== null) {
        var userIcon = L.divIcon({
          className: '',
          html: '<div class="user-pin-wrap"><div class="user-pin"></div><div class="user-label">📍 You Are Here</div></div>',
          iconSize: [0, 0],
          iconAnchor: [0, 0]
        });
        L.marker([userLat, userLon], { icon: userIcon, zIndexOffset: 2000 }).addTo(map);

        var group = L.featureGroup([
          circle,
          L.marker([userLat, userLon])
        ]);
        map.fitBounds(group.getBounds(), { padding: [40, 40] });
      }
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      startMap();
    } else {
      window.addEventListener('DOMContentLoaded', startMap);
    }
  </script>
</body>
</html>`;
  }, [site, userCoords]);

  if (loading || !site) {
    return <LoadingSpinner message="Loading substation specifications..." />;
  }

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      {/* Top Navigation Bar */}
      <View style={styles.topNavHeader}>
        <TouchableOpacity delayPressIn={0}
          style={styles.navHeaderBtn}
          onPress={() => openDrawer('SiteDetails')}
          activeOpacity={0.7}
        >
          <Menu size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.navHeaderTitle}>Substation Specifications</Text>
        <TouchableOpacity delayPressIn={0}
          style={styles.navHeaderBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={18} color="#475569" />
        </TouchableOpacity>
      </View>

      {/* Multiple Assigned Sites Switcher Bar (Rohit's 2 assigned sites: Surat ST-1 & st. joseph) */}
      {assignedSites.length > 1 && (
        <View style={styles.siteSwitcherSection}>
          <Text style={styles.siteSwitcherHeader}>
            YOUR ASSIGNED SUBSTATIONS ({assignedSites.length})
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
                <TouchableOpacity delayPressIn={0}
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
        {/* Substation Hero Image with Real Power Equipment Photography */}
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: heroImageUrl }}
            style={styles.heroImage}
            resizeMode="cover"
            onError={() => setHeroImgFailed(true)}
          />
          <View style={styles.voltageOverlay}>
            <Zap size={14} color="#FFFFFF" />
            <Text style={styles.voltageText}>{site.voltageClass || '220 kV GIS Substation'}</Text>
          </View>
        </View>

        {/* Main Substation Specification Card */}
        <AppCard style={styles.card}>
          <View style={styles.codeRow}>
            <View style={styles.codeBadge}>
              <Text style={styles.codeText}>{site.code}</Text>
            </View>
            <View style={styles.activePill}>
              <CheckCircle size={11} color="#15803D" />
              <Text style={styles.activeText}>OPERATIONAL GRID</Text>
            </View>
          </View>

          <Text style={styles.name}>{site.name}</Text>
          <Text style={styles.address}>{site.address}</Text>

          <View style={styles.specsRow}>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>GEOFENCE RADIUS</Text>
              <Text style={styles.specValue}>{site.radiusMeters}m Allowed</Text>
            </View>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>COORDINATES</Text>
              <Text style={styles.specValue}>
                {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
              </Text>
            </View>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>ACTIVE CREW</Text>
              <Text style={styles.specValue}>
                {site.activeEngineersCount || 10} Engineers
              </Text>
            </View>
          </View>
        </AppCard>

        {/* Assignment Details & Assigner Authority Card */}
        {(site.assignedBy || (user as any)?.assignedBy || site.manager?.name) && (
          <AppCard style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <UserCheck size={16} color="#2563EB" />
                <Text style={styles.sectionTitle}>ASSIGNMENT AUTHORITY</Text>
              </View>
              <View style={{
                backgroundColor: ((site.assignedByRole || (user as any)?.assignedByRole || '').toLowerCase().includes('admin')) ? '#EFF6FF' : '#F5F3FF',
                borderColor: ((site.assignedByRole || (user as any)?.assignedByRole || '').toLowerCase().includes('admin')) ? '#BFDBFE' : '#DDD6FE',
                borderWidth: 1,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 6,
              }}>
                <Text style={{
                  fontSize: 9,
                  fontWeight: '800',
                  color: ((site.assignedByRole || (user as any)?.assignedByRole || '').toLowerCase().includes('admin')) ? '#1D4ED8' : '#6D28D9',
                }}>
                  {((site.assignedByRole || (user as any)?.assignedByRole || 'Supervisor')).toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>Assigned By</Text>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 1 }}>
                  {site.assignedBy || (user as any)?.assignedBy || site.manager?.name || 'Operations Lead'}
                </Text>
                {(site.assignedByPhone || (user as any)?.assignedByPhone || site.manager?.phone) ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Phone size={12} color="#059669" style={{ marginRight: 5 }} />
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748B', marginRight: 4 }}>Contact:</Text>
                    <TouchableOpacity
                      onPress={() => {
                        const p = (site.assignedByPhone || (user as any)?.assignedByPhone || site.manager?.phone || '').replace(/[^0-9+]/g, '');
                        if (p) Linking.openURL(`tel:${p}`);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#0284C7', textDecorationLine: 'underline' }}>
                        {site.assignedByPhone || (user as any)?.assignedByPhone || site.manager?.phone}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>

              {(site.assignedByPhone || (user as any)?.assignedByPhone || site.manager?.phone) ? (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#16A34A',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    marginLeft: 10,
                  }}
                  onPress={() => {
                    const p = (site.assignedByPhone || (user as any)?.assignedByPhone || site.manager?.phone || '').replace(/[^0-9+]/g, '');
                    if (p) Linking.openURL(`tel:${p}`);
                  }}
                  activeOpacity={0.8}
                >
                  <PhoneCall size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>Call Assigner</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </AppCard>
        )}

        {/* Substation Manager Profile Card with Real Image */}
        <AppCard style={styles.card}>
          <Text style={styles.sectionTitle}>SUBSTATION MANAGER & IN-CHARGE</Text>
          
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
              <Text style={styles.managerName}>{site.manager?.name || 'Site In-Charge'}</Text>
              <Text style={styles.managerDesig}>
                {site.manager?.designation || 'Zonal Grid Operations Lead'}
              </Text>
              
              <View style={styles.managerContactLine}>
                <Phone size={11} color="#64748B" />
                <Text style={styles.managerContactText}>{site.manager?.phone || '+91 98251 98765'}</Text>
              </View>

              <View style={styles.managerContactLine}>
                <Mail size={11} color="#64748B" />
                <Text style={styles.managerContactText}>{site.manager?.email || 'manager@adani.com'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.contactActionsRow}>
            <AppButton
              title="Call Manager"
              onPress={handleCall}
              variant="secondary"
              size="sm"
              icon={<Phone size={14} color={COLORS.primary} />}
              style={styles.contactBtn}
            />
            <AppButton
              title="Email Manager"
              onPress={handleEmail}
              variant="secondary"
              size="sm"
              icon={<Mail size={14} color={COLORS.primary} />}
              style={styles.contactBtn}
            />
          </View>
        </AppCard>

        {/* Interactive Geofence Radar Map */}
        <AppCard style={styles.card}>
          <Text style={styles.sectionTitle}>GEOFENCE RADAR & RADIAL BOUNDARY</Text>
          <View style={styles.mapContainer}>
            {Platform.OS === 'web' ? (
              <iframe
                title="Geofence Radar Map"
                srcDoc={radarMapHtml}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
              />
            ) : WebView ? (
              <WebView
                originWhitelist={['*']}
                source={{ html: radarMapHtml, baseUrl: 'https://unpkg.com' }}
                style={{ width: '100%', height: 220, backgroundColor: '#0F172A' }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                scalesPageToFit={false}
                scrollEnabled={false}
                nestedScrollEnabled={false}
                mixedContentMode="always"
                allowFileAccess={true}
                allowUniversalAccessFromFileURLs={true}
              />
            ) : (
              <View style={styles.mapFallbackNotice}>
                <MapPin size={24} color="#4338CA" />
                <Text style={styles.mapFallbackText}>
                  {site.name} • 500m Geofence Perimeter
                </Text>
              </View>
            )}
          </View>
        </AppCard>

        {/* Turn-by-Turn Navigation Action */}
        <View style={{ marginTop: 6, marginBottom: 24 }}>
          <AppButton
            title="Navigate to Substation"
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
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  navHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Substation Switcher Bar
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
  mapContainer: {
    height: 220,
    borderRadius: RADII.card,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  mapFallbackNotice: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  mapFallbackText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

export default SiteDetailsScreen;
