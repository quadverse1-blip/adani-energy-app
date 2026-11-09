import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { WebView as RNWebView } from 'react-native-webview';

const WebViewComponent: any = RNWebView;

import {
  Navigation,
  Clock,
  Zap,
} from 'lucide-react-native';
import { FleetTechnician, Substation } from '../../types';
import { routingService, RoadRouteResponse } from '../../services/routingService';
import { trackingService, EmployeeLocationHistoryResponse } from '../../services/trackingService';

const MAHARASHTRA_CENTER = {
  latitude: 19.7515,
  longitude: 75.7139,
  zoom: 6,
};

const MAHARASHTRA_DISTRICTS = [
  { name: 'Entire State', lat: 19.7515, lon: 75.7139, zoom: 6 },
  { name: 'Mumbai (BKC)', lat: 19.0657, lon: 72.8687, zoom: 13 },
  { name: 'Navi Mumbai', lat: 19.033, lon: 73.0297, zoom: 12 },
  { name: 'Thane', lat: 19.2183, lon: 72.9781, zoom: 12 },
  { name: 'Pune', lat: 18.5204, lon: 73.8567, zoom: 12 },
  { name: 'Nashik', lat: 19.9975, lon: 73.7898, zoom: 12 },
  { name: 'Nagpur', lat: 21.1458, lon: 79.0882, zoom: 12 },
  { name: 'Chh. Sambhajinagar', lat: 19.8762, lon: 75.3433, zoom: 12 },
  { name: 'Kolhapur', lat: 16.705, lon: 74.2433, zoom: 12 },
  { name: 'Solapur', lat: 17.6599, lon: 75.9064, zoom: 12 },
];

export interface MaharashtraFleetMapProps {
  substations: Substation[];
  technicians: FleetTechnician[];
  selectedTech: FleetTechnician | null;
  onSelectTech?: (tech: FleetTechnician) => void;
  style?: any;
  showDistrictSelector?: boolean;
}

export const MaharashtraFleetMap: React.FC<MaharashtraFleetMapProps> = ({
  substations = [],
  technicians = [],
  selectedTech,
  onSelectTech,
  style,
  showDistrictSelector = true,
}: MaharashtraFleetMapProps) => {
  const webViewRef = useRef<any>(null);
  const iframeRef = useRef<any>(null);

  const [activeDistrict, setActiveDistrict] = useState<string>('Entire State');
  const [activeRoute, setActiveRoute] = useState<RoadRouteResponse | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [historyTrail, setHistoryTrail] = useState<EmployeeLocationHistoryResponse | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Send message to Leaflet inside WebView / iframe
  const postToMap = useCallback((type: string, payload: any) => {
    const msg = JSON.stringify({ type, payload });
    if (Platform.OS === 'web') {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(msg, '*');
      }
    } else if (webViewRef.current) {
      webViewRef.current.postMessage(msg);
    }
  }, []);

  // When selectedTech changes, calculate OSRM road route to assigned substation
  useEffect(() => {
    if (!selectedTech || selectedTech.latitude === null || selectedTech.longitude === null) {
      setActiveRoute(null);
      setHistoryTrail(null);
      setShowHistory(false);
      postToMap('CLEAR_ROUTE', {});
      postToMap('CLEAR_HISTORY', {});
      return;
    }

    const techLat = selectedTech.latitude;
    const techLon = selectedTech.longitude;

    // Center map on selected technician
    postToMap('FLY_TO', { lat: techLat, lon: techLon, zoom: 14 });

    // Find destination substation
    const destSite =
      substations.find(
        (s) => s.id === selectedTech.assignedSiteId || s.code === selectedTech.assignedSiteCode
      ) || substations[0];

    if (destSite && destSite.latitude && destSite.longitude) {
      setLoadingRoute(true);
      routingService
        .getRoadRoute(techLat, techLon, destSite.latitude, destSite.longitude)
        .then((route) => {
          setActiveRoute(route);
          postToMap('SET_ROAD_ROUTE', {
            coordinates: route.coordinates,
            geojson: route.geojson,
            distanceKm: route.distanceKm,
            duration: route.durationFormatted,
            isRoad: route.isRoadRoute,
          });
        })
        .catch(() => {
          setActiveRoute(null);
        })
        .finally(() => {
          setLoadingRoute(false);
        });
    }
  }, [selectedTech, substations, postToMap]);

  // Load employee location history for today
  const handleToggleHistory = async () => {
    if (!selectedTech) return;
    if (showHistory) {
      setShowHistory(false);
      postToMap('CLEAR_HISTORY', {});
      return;
    }

    setLoadingHistory(true);
    try {
      const hist = await trackingService.getEmployeeLocationHistory(selectedTech.id);
      setHistoryTrail(hist);
      setShowHistory(true);
      postToMap('SET_HISTORY_TRAIL', {
        coordinates: hist.coordinates,
        points: hist.points,
        stops: hist.stops,
        startPoint: hist.startPoint,
        endPoint: hist.endPoint,
        totalKm: hist.totalDistanceKm,
      });
    } catch (e: any) {
      console.warn('Failed to load history trail:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Jump to specific Maharashtra district
  const handleSelectDistrict = (dist: (typeof MAHARASHTRA_DISTRICTS)[0]) => {
    setActiveDistrict(dist.name);
    postToMap('FLY_TO', { lat: dist.lat, lon: dist.lon, zoom: dist.zoom });
  };

  // Build the high-reliability Leaflet HTML with Google & Esri tiles
  const htmlContent = useMemo(() => {
    const sitesJson = JSON.stringify(
      substations.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        lat: s.latitude,
        lon: s.longitude,
        radius: s.radiusMeters || 500,
        voltage: s.voltageClass || '33/11 kV Substation',
        manager: s.manager?.name || 'Site In-Charge',
        phone: s.manager?.phone || '',
      }))
    );

    const techsJson = JSON.stringify(
      technicians.map((t) => ({
        id: t.id,
        name: t.name || 'Technician',
        empId: t.employeeId,
        lat: t.latitude,
        lon: t.longitude,
        status: t.status,
        isOnline: Boolean(t.isOnline),
        isLive: Boolean(t.isLive),
        displayLabel: t.displayLabel || (t.isLive ? 'LIVE LOCATION' : 'LAST KNOWN LOCATION'),
        timeAgo: t.timeAgo || t.lastLocationUpdate || 'Logged',
        speed: t.speed ? `${Math.round(t.speed)} km/h` : null,
        accuracy: t.accuracy || '±8m',
        siteName: t.assignedSiteName,
        phone: t.phone,
        isSelected: selectedTech?.id === t.id,
        markerColor: t.isLive ? '#10B981' : t.isOnline ? '#3B82F6' : '#64748B',
      }))
    );

    const initialLat = selectedTech?.latitude ? selectedTech.latitude : MAHARASHTRA_CENTER.latitude;
    const initialLon = selectedTech?.longitude ? selectedTech.longitude : MAHARASHTRA_CENTER.longitude;
    const initialZoom = selectedTech?.latitude ? 14 : MAHARASHTRA_CENTER.zoom;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=10.0, minimum-scale=1.0, user-scalable=yes" />
  <title>Adani Maharashtra Workforce Mappls Radar</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #E5E7EB;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      touch-action: pan-x pan-y pinch-zoom;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
    }
    
    .leaflet-control-attribution,
    div[class*="attrib"] {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
    }

    .custom-leaflet-marker {
      background: transparent !important;
      border: none !important;
      overflow: visible !important;
    }

    /* Substation Marker */
    .substation-marker-wrap {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      position: relative;
      left: -50%;
      top: -100%;
    }
    .substation-marker-box {
      background: #1E40AF;
      color: #FFFFFF;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 800;
      box-shadow: 0 3px 8px rgba(0,0,0,0.3);
      border: 1.5px solid #FFFFFF;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .substation-marker-stem {
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 7px solid #1E40AF;
    }

    /* Technician Marker */
    .tech-marker-wrap {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      position: relative;
      left: -50%;
      top: -50%;
    }
    .pulse-ring {
      position: absolute;
      top: -8px;
      left: 50%;
      margin-left: -24px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.3);
      border: 2px solid rgba(16, 185, 129, 0.8);
      animation: tech-radar-pulse 2s infinite ease-out;
      pointer-events: none;
    }
    @keyframes tech-radar-pulse {
      0% { transform: scale(0.5); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }
    .tech-marker-dot {
      width: 32px;
      height: 32px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 800;
      color: #FFFFFF;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 3px 8px rgba(0,0,0,0.35);
      position: relative;
      z-index: 2;
    }
    .tech-marker-dot-live {
      background: #10B981;
    }
    .tech-marker-dot-lastknown {
      background: #2563EB;
    }
    .tech-marker-dot-offline {
      background: #64748B;
    }
    .tech-marker-badge {
      margin-top: 3px;
      background: #0F172A;
      color: #FFFFFF;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.3);
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .tech-marker-badge-selected {
      background: #1E3A8A;
      border-color: #60A5FA;
    }

    /* Mappls Official Brand Badge */
    .mappls-brand-badge {
      position: absolute !important;
      bottom: 8px !important;
      left: 8px !important;
      z-index: 9999 !important;
      display: inline-flex !important;
      align-items: center !important;
      background: #FFFFFF !important;
      padding: 4px 10px !important;
      border-radius: 6px !important;
      box-shadow: 0 1px 4px rgba(0,0,0,0.25) !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      color: #0F172A !important;
      pointer-events: none !important;
      border: 1px solid #E2E8F0 !important;
    }
    .mappls-brand-badge .logo-accent {
      color: #1E40AF;
      font-weight: 800;
      margin-right: 2px;
      letter-spacing: -0.2px;
    }
    .mappls-brand-badge .dot-accent {
      color: #DC2626;
      font-weight: 900;
      margin-right: 4px;
    }
    .mappls-brand-badge .sub-accent {
      color: #64748B;
      font-size: 10px;
      font-weight: 600;
      border-left: 1px solid #CBD5E1;
      padding-left: 5px;
    }

    .leaflet-bar {
      border: 1px solid #CBD5E1 !important;
      box-shadow: 0 2px 6px rgba(0,0,0,0.18) !important;
      border-radius: 8px !important;
      overflow: hidden;
    }
    .leaflet-bar a {
      background-color: #FFFFFF !important;
      color: #1E293B !important;
      font-weight: 700 !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  
  <div class="mappls-brand-badge">
    <span class="logo-accent">Mappls</span><span class="dot-accent">●</span>
    <span class="sub-accent">MapmyIndia</span>
  </div>

  <script>
    var sitesData = ${sitesJson};
    var techsData = ${techsJson};

    function notifyNative(type, data) {
      var msg = JSON.stringify({ type: type, data: data });
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(msg);
      } else if (window.parent && window.parent.postMessage) {
        window.parent.postMessage(msg, '*');
      }
    }

    // Initialize Leaflet Map
    var map = L.map('map', {
      zoomControl: true,
      attributionControl: false
    }).setView([${initialLat}, ${initialLon}], ${initialZoom});

    // Primary High-Performance Road Tiles (Google Maps Roadmap - Fast, Zero-Blocking CDN in India)
    var primaryTiles = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    var fallbackTiles = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
    var fallbackTiles2 = 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';

    var tileLayer = L.tileLayer(primaryTiles, {
      maxZoom: 20
    }).addTo(map);

    tileLayer.on('tileerror', function(e) {
      if (e && e.tile && !e.tile.getAttribute('data-fb')) {
        e.tile.setAttribute('data-fb', '1');
        e.tile.src = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/' + e.coords.z + '/' + e.coords.y + '/' + e.coords.x;
      } else if (e && e.tile && e.tile.getAttribute('data-fb') === '1') {
        e.tile.setAttribute('data-fb', '2');
        e.tile.src = 'https://a.basemaps.cartocdn.com/rastertiles/voyager/' + e.coords.z + '/' + e.coords.x + '/' + e.coords.y + '.png';
      }
    });

    // 1. Render Substation Geofence Circles & Substation Pins
    sitesData.forEach(function(site) {
      if (!site.lat || !site.lon) return;

      L.circle([site.lat, site.lon], {
        radius: site.radius || 500,
        color: '#1E40AF',
        weight: 2,
        opacity: 0.85,
        dashArray: '5, 5',
        fillColor: '#1E40AF',
        fillOpacity: 0.12
      }).addTo(map);

      var pinHtml = '<div class="substation-marker-wrap">' +
        '<div class="substation-marker-box">⚡ ' + site.name + '</div>' +
        '<div class="substation-marker-stem"></div>' +
        '</div>';

      var subIcon = L.divIcon({
        html: pinHtml,
        className: 'custom-leaflet-marker',
        iconSize: [0, 0]
      });

      L.marker([site.lat, site.lon], { icon: subIcon, zIndexOffset: 100 }).addTo(map);
    });

    // 2. Render Field Technicians
    var techMarkers = [];
    techsData.forEach(function(tech) {
      if (tech.lat === null || tech.lon === null || tech.lat === undefined || tech.lon === undefined) return;

      var isLive = tech.isLive;
      var isOnline = tech.isOnline;
      var dotClass = isLive ? 'tech-marker-dot-live' : (isOnline ? 'tech-marker-dot-lastknown' : 'tech-marker-dot-offline');
      var pulseHtml = isLive ? '<div class="pulse-ring"></div>' : '';
      var badgeClass = tech.isSelected ? 'tech-marker-badge tech-marker-badge-selected' : 'tech-marker-badge';
      var statusIcon = isLive ? '🟢' : '🔵';
      var initial = (tech.name || 'T').charAt(0).toUpperCase();

      var markerHtml = '<div class="tech-marker-wrap">' +
        pulseHtml +
        '<div class="tech-marker-dot ' + dotClass + '">' + initial + '</div>' +
        '<div class="' + badgeClass + '">' + tech.name + ' ' + statusIcon + '</div>' +
        '</div>';

      var techIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-leaflet-marker',
        iconSize: [0, 0]
      });

      var marker = L.marker([tech.lat, tech.lon], {
        icon: techIcon,
        zIndexOffset: tech.isSelected ? 1000 : 500
      }).addTo(map);

      marker.on('click', function() {
        notifyNative('SELECT_TECH', { id: tech.id });
      });

      techMarkers.push({ id: tech.id, marker: marker });
    });

    // 3. Road Route & History Trail State
    var activeRouteLine = null;
    var activeRouteCasing = null;
    var historyTrailLine = null;

    function setRoadRoute(coords) {
      clearRoadRoute();
      if (!coords || coords.length === 0) return;

      var latLngs = coords.map(function(c) {
        if (Array.isArray(c)) {
          return [c[1], c[0]];
        }
        return [c.latitude, c.longitude];
      });

      activeRouteCasing = L.polyline(latLngs, {
        color: '#1E3A8A',
        weight: 7,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      activeRouteLine = L.polyline(latLngs, {
        color: '#3B82F6',
        weight: 4,
        opacity: 1.0,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      map.fitBounds(activeRouteLine.getBounds(), { padding: [40, 40] });
    }

    function clearRoadRoute() {
      if (activeRouteCasing) { map.removeLayer(activeRouteCasing); activeRouteCasing = null; }
      if (activeRouteLine) { map.removeLayer(activeRouteLine); activeRouteLine = null; }
    }

    function setHistoryTrail(coords) {
      clearHistoryTrail();
      if (!coords || coords.length === 0) return;

      var latLngs = coords.map(function(c) {
        if (Array.isArray(c)) return [c[1], c[0]];
        return [c.latitude, c.longitude];
      });

      historyTrailLine = L.polyline(latLngs, {
        color: '#8B5CF6',
        weight: 4,
        opacity: 0.9,
        dashArray: '6, 6',
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      map.fitBounds(historyTrailLine.getBounds(), { padding: [40, 40] });
    }

    function clearHistoryTrail() {
      if (historyTrailLine) { map.removeLayer(historyTrailLine); historyTrailLine = null; }
    }

    // 4. Message Handler for Dynamic Updates
    function handleIncomingMessage(e) {
      try {
        var raw = e.data;
        if (typeof raw === 'string') {
          var msg = JSON.parse(raw);
          if (msg.type === 'FLY_TO') {
            map.flyTo([msg.payload.lat, msg.payload.lon], msg.payload.zoom || 14, { duration: 0.8 });
          } else if (msg.type === 'SET_ROAD_ROUTE') {
            setRoadRoute(msg.payload.coordinates);
          } else if (msg.type === 'CLEAR_ROUTE') {
            clearRoadRoute();
          } else if (msg.type === 'SET_HISTORY_TRAIL') {
            setHistoryTrail(msg.payload.coordinates);
          } else if (msg.type === 'CLEAR_HISTORY') {
            clearHistoryTrail();
          }
        }
      } catch (err) {}
    }

    window.addEventListener('message', handleIncomingMessage);
    document.addEventListener('message', handleIncomingMessage);
  </script>
</body>
</html>
    `;
  }, [substations, technicians, selectedTech]);

  // Handle messages from WebView/iframe
  const handleMessage = (event: any) => {
    try {
      const dataStr = event.nativeEvent ? event.nativeEvent.data : event.data;
      const parsed = typeof dataStr === 'string' ? JSON.parse(dataStr) : dataStr;
      if (parsed.type === 'SELECT_TECH' && onSelectTech) {
        const found = technicians.find((t) => t.id === parsed.data.id);
        if (found) onSelectTech(found);
      }
    } catch {}
  };

  return (
    <View style={[styles.container, style]}>
      {/* 1. Maharashtra District Quick-Selector Chips */}
      {showDistrictSelector && (
        <View style={styles.districtChipsBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.districtScroll}
          >
            {MAHARASHTRA_DISTRICTS.map((dist) => {
              const isSelected = activeDistrict === dist.name;
              return (
                <TouchableOpacity
                  key={dist.name}
                  style={[styles.districtChip, isSelected && styles.districtChipActive]}
                  onPress={() => handleSelectDistrict(dist)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.districtChipText,
                      isSelected && styles.districtChipTextActive,
                    ]}
                  >
                    {dist.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* 2. Map Render: High-Reliability Leaflet WebView / Web iframe */}
      <View style={styles.mapArea}>
        {Platform.OS === 'web' ? (
          <iframe
            ref={iframeRef}
            srcDoc={htmlContent}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Maharashtra Mappls Fleet Radar"
          />
        ) : (
          <WebViewComponent
            ref={webViewRef}
            source={{ html: htmlContent }}
            style={styles.webView}
            onMessage={handleMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            originWhitelist={['*']}
            mixedContentMode="always"
            allowFileAccess={true}
            allowUniversalAccessFromFileURLs={true}
            androidLayerType="hardware"
            onError={(syntheticEvent: any) => {
              const { nativeEvent } = syntheticEvent;
              console.warn('[MaharashtraFleetMap] WebView error: ', nativeEvent);
            }}
          />
        )}
      </View>

      {/* 3. Floating Road Route / Distance / Travel Time Card for Selected Technician */}
      {selectedTech && (
        <View style={styles.floatingRouteCard}>
          <View style={styles.floatingRouteHeader}>
            <View style={styles.floatingRouteTitleWrap}>
              <View
                style={[
                  styles.statusIndicatorDot,
                  { backgroundColor: selectedTech.hasGps ? (selectedTech.isLive ? '#10B981' : '#2563EB') : '#94A3B8' },
                ]}
              />
              <Text style={styles.floatingRouteTechName} numberOfLines={1}>
                {selectedTech.name}
              </Text>
              <View
                style={[
                  styles.statusBadgeSmall,
                  selectedTech.hasGps
                    ? (selectedTech.isLive ? styles.badgeLive : styles.badgeLastKnown)
                    : { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeTextSmall,
                    selectedTech.hasGps
                      ? (selectedTech.isLive ? styles.badgeLiveText : styles.badgeLastKnownText)
                      : { color: '#64748B' },
                  ]}
                >
                  {selectedTech.hasGps
                    ? (selectedTech.isLive ? 'LIVE GPS' : 'LAST KNOWN')
                    : 'NO GPS'}
                </Text>
              </View>
            </View>

            {/* History Trail Toggle Button */}
            {selectedTech.hasGps ? (
              <TouchableOpacity
                style={[styles.historyToggleBtn, showHistory && styles.historyToggleBtnActive]}
                onPress={handleToggleHistory}
                disabled={loadingHistory}
                activeOpacity={0.8}
              >
                {loadingHistory ? (
                  <ActivityIndicator size="small" color="#8B5CF6" />
                ) : (
                  <>
                    <Clock
                      size={12}
                      color={showHistory ? '#FFFFFF' : '#8B5CF6'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.historyToggleBtnText,
                        showHistory && { color: '#FFFFFF' },
                      ]}
                    >
                      {showHistory ? 'Hide Trail' : 'GPS Trail'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={[styles.historyToggleBtn, { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
                <Text style={[styles.historyToggleBtnText, { color: '#94A3B8' }]}>No History</Text>
              </View>
            )}
          </View>

          {/* Road Telemetry Grid */}
          <View style={styles.telemetryGrid}>
            <View style={styles.telemetryCol}>
              <Text style={styles.telemetryLabel}>DESTINATION SITE</Text>
              <Text style={styles.telemetryVal} numberOfLines={1}>
                {selectedTech.assignedSiteName || 'General Field'}
              </Text>
            </View>

            <View style={styles.telemetryDivider} />

            <View style={styles.telemetryCol}>
              <Text style={styles.telemetryLabel}>ROAD DISTANCE</Text>
              <Text style={styles.telemetryValBold}>
                {loadingRoute ? '...' : activeRoute ? `${activeRoute.distanceKm} km` : '--'}
              </Text>
            </View>

            <View style={styles.telemetryDivider} />

            <View style={styles.telemetryCol}>
              <Text style={styles.telemetryLabel}>EST. TRAVEL TIME</Text>
              <Text style={styles.telemetryValBlue}>
                {loadingRoute ? '...' : activeRoute ? activeRoute.durationFormatted : '--'}
              </Text>
            </View>

            <View style={styles.telemetryDivider} />

            <View style={styles.telemetryCol}>
              <Text style={styles.telemetryLabel}>LAST RECORDED</Text>
              <Text style={styles.telemetryVal} numberOfLines={1}>
                {selectedTech.timeAgo || selectedTech.lastLocationUpdate || 'Logged'}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    position: 'relative',
  },
  districtChipsBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 8,
  },
  districtScroll: {
    paddingHorizontal: 10,
    gap: 6,
  },
  districtChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  districtChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  districtChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  districtChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  mapArea: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },

  // Floating Road Route Card
  floatingRouteCard: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
  floatingRouteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  floatingRouteTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  statusIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  floatingRouteTechName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    maxWidth: 140,
  },
  statusBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeLive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  badgeLiveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
  },
  badgeLastKnown: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  badgeLastKnownText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1E40AF',
  },
  statusBadgeTextSmall: {
    fontSize: 9,
    fontWeight: '800',
  },
  historyToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  historyToggleBtnActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  historyToggleBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8B5CF6',
  },

  // Telemetry Grid
  telemetryGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  telemetryCol: {
    flex: 1,
    alignItems: 'center',
  },
  telemetryDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#E2E8F0',
  },
  telemetryLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  telemetryVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  telemetryValBold: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E40AF',
  },
  telemetryValBlue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563EB',
  },
});

export default MaharashtraFleetMap;
