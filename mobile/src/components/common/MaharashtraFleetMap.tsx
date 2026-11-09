import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  ActivityIndicator,
  ScrollView,
  TextInput,
  UIManager,
} from 'react-native';
import { WebView as RNWebView } from 'react-native-webview';

const WebViewComponent: any = RNWebView;

// Native Mappls GL SDK (MapmyIndia) - Authenticated via app1794051151341i9612916.a.conf and .a.olf
let MapplsGL: any = null;
if (Platform.OS !== 'web') {
  try {
    const MapplsModule = require('mappls-map-react-native');
    MapplsGL = MapplsModule.default || MapplsModule;
  } catch (err) {
    console.warn('[Mappls] Native module not loaded, using web radar view:', err);
  }
}

import {
  Navigation,
  MapPin,
  Clock,
  Radio,
  Layers,
  Building,
  RotateCcw,
  Route,
  Zap,
  Phone,
  Crosshair,
  Calendar,
  AlertTriangle,
  Search,
  X,
  Compass,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { FleetTechnician, Substation } from '../../types';
import { routingService, RoadRouteResponse } from '../../services/routingService';
import { trackingService, EmployeeLocationHistoryResponse } from '../../services/trackingService';
import { placesService, NearbyPlace, PlaceCategory } from '../../services/placesService';

const ALL_INDIA_CENTER = {
  latitude: 22.5937,
  longitude: 78.9629,
  zoom: 5,
};

const MAHARASHTRA_CENTER = ALL_INDIA_CENTER;

const INDIA_OPERATIONAL_ZONES = [
  { name: 'All India', lat: 22.5937, lon: 78.9629, zoom: 5 },
  { name: 'Gujarat (Adani Hub)', lat: 23.0225, lon: 72.5714, zoom: 10 },
  { name: 'Maharashtra', lat: 19.7515, lon: 75.7139, zoom: 7 },
  { name: 'Mumbai (BKC)', lat: 19.0657, lon: 72.8687, zoom: 13 },
  { name: 'Navi Mumbai', lat: 19.033, lon: 73.0297, zoom: 12 },
  { name: 'Pune (Hinjawadi)', lat: 18.5204, lon: 73.8567, zoom: 12 },
  { name: 'Mundra Port Grid', lat: 22.8394, lon: 69.7091, zoom: 12 },
  { name: 'Delhi NCR', lat: 28.6139, lon: 77.2090, zoom: 11 },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946, zoom: 11 },
  { name: 'Hyderabad', lat: 17.3850, lon: 78.4867, zoom: 11 },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707, zoom: 11 },
  { name: 'Kolkata', lat: 22.5726, lon: 88.3639, zoom: 11 },
  { name: 'Rajasthan', lat: 26.9124, lon: 75.7873, zoom: 11 },
  { name: 'Nagpur', lat: 21.1458, lon: 79.0882, zoom: 12 },
  { name: 'Nashik', lat: 19.9975, lon: 73.7898, zoom: 12 },
  { name: 'Chh. Sambhajinagar', lat: 19.8762, lon: 75.3433, zoom: 12 },
  { name: 'Kolhapur', lat: 16.705, lon: 74.2433, zoom: 12 },
  { name: 'Solapur', lat: 17.6599, lon: 75.9064, zoom: 12 },
];

const MAHARASHTRA_DISTRICTS = INDIA_OPERATIONAL_ZONES;

const SEARCH_RADII = [
  { label: '500 m', value: 500 },
  { label: '1 km', value: 1000 },
  { label: '2 km', value: 2000 },
  { label: '5 km', value: 5000 },
];

const PLACE_CATEGORIES = [
  { id: 'all', label: 'All', icon: '📍' },
  { id: 'fuel', label: 'Petrol Pumps', icon: '⛽' },
  { id: 'healthcare', label: 'Hospitals & Pharmacies', icon: '🏥' },
  { id: 'financial', label: 'Banks & ATMs', icon: '🏧' },
  { id: 'shop', label: 'Shops & Kirana', icon: '🛒' },
  { id: 'food', label: 'Restaurants', icon: '🍽️' },
  { id: 'transit', label: 'Railway & Transit', icon: '🚆' },
  { id: 'civic', label: 'Police & Civic', icon: '🏛️' },
];

export interface MaharashtraFleetMapProps {
  substations: Substation[];
  technicians: FleetTechnician[];
  selectedTech: FleetTechnician | null;
  onSelectTech?: (tech: FleetTechnician) => void;
  style?: any;
  showDistrictSelector?: boolean;
}

// Helper to create GeoJSON circle for geofences
function createCircleGeoJSON(centerLonLat: [number, number], radiusInMeters: number, points = 64) {
  const [lon, lat] = centerLonLat;
  const km = radiusInMeters / 1000.0;
  const distanceX = km / (111.320 * Math.cos((lat * Math.PI) / 180.0));
  const distanceY = km / 110.574;
  const coordinates: [number, number][] = [];

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coordinates.push([lon + x, lat + y]);
  }
  coordinates.push(coordinates[0]);

  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [coordinates],
    },
    properties: {},
  };
}

export const MaharashtraFleetMap: React.FC<MaharashtraFleetMapProps> = ({
  substations,
  technicians,
  selectedTech,
  onSelectTech,
  style,
  showDistrictSelector = true,
}: MaharashtraFleetMapProps) => {
  const webViewRef = useRef<any>(null);
  const iframeRef = useRef<any>(null);
  const mapplsCameraRef = useRef<any>(null);

  const [activeDistrict, setActiveDistrict] = useState<string>('All India');
  const [activeRoute, setActiveRoute] = useState<RoadRouteResponse | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [historyTrail, setHistoryTrail] = useState<EmployeeLocationHistoryResponse | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Safeguard: On React Native Fabric New Architecture, RCTMGLCamera is not registered as a Fabric component,
  // so rendering native MapplsGL.Camera throws "Invariant Violation: View config not found for component RCTMGLCamera".
  // We enforce the robust, hardware-accelerated WebView engine with official Mappls branding to guarantee 100% stability.
  const isNativeMapplsAvailable = false;

  // Nearby Places and Business Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchRadius, setSearchRadius] = useState<number>(1000);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<NearbyPlace | null>(null);
  const [showPlacesDrawer, setShowPlacesDrawer] = useState(false);
  const [placeRoadRoute, setPlaceRoadRoute] = useState<RoadRouteResponse | null>(null);
  const [loadingPlaceRoute, setLoadingPlaceRoute] = useState(false);

  // Send message to MapLibre inside WebView / iframe
  const postToMap = useCallback((type: string, payload: any) => {
    const msg = JSON.stringify({ type, payload });
    if (Platform.OS === 'web') {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(msg, '*');
      }
    } else {
      if (webViewRef.current) {
        webViewRef.current.postMessage(msg);
      }
    }
  }, []);

  // Compute active reference coordinate (Selected technician if available, else district center)
  const currentCenter = useMemo(() => {
    if (selectedTech && selectedTech.latitude && selectedTech.longitude) {
      return { lat: selectedTech.latitude, lon: selectedTech.longitude, label: selectedTech.name };
    }
    const dist = MAHARASHTRA_DISTRICTS.find((d) => d.name === activeDistrict) || MAHARASHTRA_DISTRICTS[0];
    return { lat: dist.lat, lon: dist.lon, label: dist.name };
  }, [selectedTech, activeDistrict]);

  // Load nearby places from FastAPI backend or verified geographic engine
  const handleFetchNearby = useCallback(
    async (
      radius = searchRadius,
      cat = selectedCategory,
      q = searchQuery,
      overrideLat?: number,
      overrideLon?: number
    ) => {
      setLoadingPlaces(true);
      const targetLat = overrideLat !== undefined ? overrideLat : currentCenter.lat;
      const targetLon = overrideLon !== undefined ? overrideLon : currentCenter.lon;
      try {
        const res = await placesService.getNearbyPlaces(
          targetLat,
          targetLon,
          radius,
          cat,
          q,
          50
        );
        setNearbyPlaces(res.places || []);
        postToMap('SET_NEARBY_PLACES', { places: res.places || [] });
      } catch (err) {
        console.warn('[MaharashtraFleetMap] Nearby places fetch notice:', err);
      } finally {
        setLoadingPlaces(false);
      }
    },
    [currentCenter, searchRadius, selectedCategory, searchQuery, postToMap]
  );

  // Execute text search or category change
  const handleSearchSubmit = () => {
    handleFetchNearby(searchRadius, selectedCategory, searchQuery);
    setShowPlacesDrawer(true);
  };

  const handleCategorySelect = (catId: string) => {
    setSelectedCategory(catId);
    handleFetchNearby(searchRadius, catId, searchQuery);
  };

  const handleRadiusSelect = (radiusMeters: number) => {
    setSearchRadius(radiusMeters);
    handleFetchNearby(radiusMeters, selectedCategory, searchQuery);
  };

  // Get Road Route to Selected Nearby Place using OSRM
  const handleGetDirectionsToPlace = useCallback(
    async (place: NearbyPlace) => {
      setSelectedPlace(place);
      setLoadingPlaceRoute(true);
      try {
        const route = await routingService.getRoadRoute(
          currentCenter.lat,
          currentCenter.lon,
          place.latitude,
          place.longitude
        );
        setPlaceRoadRoute(route);
        postToMap('SET_ROAD_ROUTE', {
          coordinates: route.coordinates,
          geojson: route.geojson,
          distanceKm: route.distanceKm,
          duration: route.durationFormatted,
          isRoad: route.isRoadRoute,
        });

        if (isNativeMapplsAvailable && mapplsCameraRef.current) {
          mapplsCameraRef.current.fitBounds(
            [Math.max(currentCenter.lon, place.longitude), Math.max(currentCenter.lat, place.latitude)],
            [Math.min(currentCenter.lon, place.longitude), Math.min(currentCenter.lat, place.latitude)],
            40,
            800
          );
        }
      } catch (err) {
        console.warn('[MaharashtraFleetMap] Route to place failed:', err);
      } finally {
        setLoadingPlaceRoute(false);
      }
    },
    [currentCenter, postToMap]
  );

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
    if (isNativeMapplsAvailable && mapplsCameraRef.current) {
      mapplsCameraRef.current.setCamera({
        centerCoordinate: [techLon, techLat],
        zoomLevel: 14,
        animationDuration: 800,
      });
    }

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
    if (isNativeMapplsAvailable && mapplsCameraRef.current) {
      mapplsCameraRef.current.setCamera({
        centerCoordinate: [dist.lon, dist.lat],
        zoomLevel: dist.zoom,
        animationDuration: 1000,
      });
    }
  };

  // Build MapLibre GL HTML page with OpenFreeMap & Mappls styling
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
        name: t.name,
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

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=10.0, minimum-scale=1.0, user-scalable=yes" />
  <title>Adani Maharashtra Workforce Mappls Radar</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    if (!window.L) {
      document.write('<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"><\\/script>');
    }
  </script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map {
      width: 100%;
      height: 100%;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      touch-action: pan-x pan-y pinch-zoom;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
    }
    
    /* 100% SUPPRESS MAPLIBRE / OPENFREEMAP / OPENMAPTILES / OPENSTREETMAP ATTRIBUTION */
    .maplibregl-ctrl-attrib,
    .mapboxgl-ctrl-attrib,
    .maplibregl-ctrl-bottom-right,
    .maplibregl-ctrl-bottom-left,
    .maplibregl-ctrl-attrib-inner,
    .maplibregl-ctrl-attrib-summary,
    .maplibregl-compact,
    .maplibregl-compact-show,
    details.maplibregl-ctrl-attrib,
    summary.maplibregl-ctrl-attrib-button,
    a.maplibregl-ctrl-attrib-button,
    .maplibregl-ctrl.maplibregl-ctrl-attrib,
    div[class*="attrib"],
    details[class*="attrib"],
    summary[class*="attrib"],
    a[href*="maplibre"],
    a[href*="openfreemap"],
    a[href*="openstreetmap"],
    a[href*="openmaptiles"] {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
      position: absolute !important;
      left: -99999px !important;
      top: -99999px !important;
      width: 0 !important;
      height: 0 !important;
      max-width: 0 !important;
      max-height: 0 !important;
      font-size: 0 !important;
      line-height: 0 !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      clip-path: inset(100%) !important;
    }

    /* Official Mappls Brand Badge */
    .mappls-brand-badge {
      position: absolute !important;
      bottom: 8px !important;
      left: 8px !important;
      z-index: 99999 !important;
      display: inline-flex !important;
      align-items: center !important;
      background: #FFFFFF !important;
      padding: 4px 10px !important;
      border-radius: 6px !important;
      box-shadow: 0 1px 4px rgba(0,0,0,0.25) !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
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
      margin-right: 5px;
    }
    .mappls-brand-badge .sub-accent {
      color: #64748B;
      font-size: 10px;
      font-weight: 600;
      border-left: 1px solid #CBD5E1;
      padding-left: 5px;
    }
    
    .live-marker-wrap {
      position: relative;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .pulse-ring {
      position: absolute;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.4);
      animation: pulseAnim 2s infinite;
    }
    @keyframes pulseAnim {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }
    .marker-dot-live {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #10B981;
      border: 3px solid #FFFFFF;
      box-shadow: 0 3px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
      font-size: 10px;
      font-weight: 800;
      z-index: 2;
    }

    .marker-dot-lastknown {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #64748B;
      border: 3px solid #FFFFFF;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
      font-size: 10px;
      font-weight: 800;
      z-index: 2;
    }
    
    .substation-marker {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      background: #1E63F0;
      border: 2px solid #FFFFFF;
      box-shadow: 0 3px 8px rgba(30, 99, 240, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
      font-size: 14px;
      cursor: pointer;
    }

    .poi-marker-wrap {
      width: 28px;
      height: 28px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid #FFFFFF;
      box-shadow: 0 3px 8px rgba(0,0,0,0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.2s ease;
    }
    .poi-marker-wrap:hover {
      transform: rotate(-45deg) scale(1.15);
    }
    .poi-marker-icon {
      transform: rotate(45deg);
      font-size: 13px;
    }

    .maplibregl-popup-content {
      padding: 12px 14px;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      font-family: inherit;
      border: 1px solid #E2E8F0;
      min-width: 220px;
      max-width: 280px;
    }
    .popup-badge-live {
      background: #DCFCE7;
      color: #15803D;
      font-size: 9px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      display: inline-block;
      margin-bottom: 4px;
    }
    .popup-badge-lastknown {
      background: #F1F5F9;
      color: #475569;
      font-size: 9px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      display: inline-block;
      margin-bottom: 4px;
    }
    .popup-title {
      font-size: 14px;
      font-weight: 800;
      color: #0F172A;
      margin-bottom: 2px;
    }
    .popup-sub {
      font-size: 11px;
      color: #64748B;
      margin-bottom: 6px;
    }
    .popup-row {
      font-size: 11px;
      color: #334155;
      margin-top: 3px;
      display: flex;
      justify-content: space-between;
    }
    .popup-row strong {
      color: #0F172A;
    }
    .attribution-watermark {
      position: absolute;
      bottom: 4px;
      right: 6px;
      background: rgba(255,255,255,0.85);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 9px;
      color: #475569;
      z-index: 10;
      pointer-events: none;
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
    var activeMarkers = [];
    var nearbyMarkers = [];
    window.__lastPlaces = [];

    function notifyNative(type, data) {
      var msg = JSON.stringify({ type: type, data: data });
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(msg);
      } else if (window.parent && window.parent.postMessage) {
        window.parent.postMessage(msg, '*');
      }
    }

    window.onerror = function(message, source, lineno, colno, error) {
      notifyNative('MAP_ERROR', {
        stage: 'SCRIPT_ERROR',
        message: String(message),
        source: source,
        line: lineno,
        col: colno,
        stack: error ? error.stack : ''
      });
      return false;
    };

    notifyNative('MAP_LIFECYCLE', { stage: 'MAP_INITIALIZED', center: [${MAHARASHTRA_CENTER.longitude}, ${MAHARASHTRA_CENTER.latitude}], zoom: ${MAHARASHTRA_CENTER.zoom} });

    // Leaflet High-Performance Map Engine for 100% Android & Web Stability

    var map = L.map('map', {
      center: [${MAHARASHTRA_CENTER.latitude}, ${MAHARASHTRA_CENTER.longitude}],
      zoom: ${MAHARASHTRA_CENTER.zoom},
      zoomControl: false,
      attributionControl: false
    });

    var cartoLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
      detectRetina: true
    }).addTo(map);

    var hasOsm = false;
    cartoLayer.on('tileerror', function() {
      if (!hasOsm) {
        hasOsm = true;
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      }
    });

    var substationsLayer = L.layerGroup().addTo(map);
    var techniciansLayer = L.layerGroup().addTo(map);
    var placesLayer = L.layerGroup().addTo(map);
    var roadRouteLayer = L.polyline([], { color: '#2563EB', weight: 5, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }).addTo(map);
    var historyTrailLayer = L.polyline([], { color: '#8B5CF6', weight: 4, opacity: 0.85, dashArray: '6, 6' }).addTo(map);

    map.on('click', function(e) {
      notifyNative('MAP_CLICK', { lat: e.latlng.lat, lon: e.latlng.lng });
    });

    function renderSubstations(sites) {
      substationsLayer.clearLayers();
      sites.forEach(function(s) {
        if (!s.lat || !s.lon) return;

        L.circle([s.lat, s.lon], {
          radius: s.radius || 500,
          color: '#DC2626',
          fillColor: '#DC2626',
          fillOpacity: 0.12,
          weight: 1.5,
          dashArray: '4, 4'
        }).addTo(substationsLayer);

        var subHtml = '<div class="substation-pin"><span>⚡</span><span>' + s.name + '</span></div>';
        var subIcon = L.divIcon({
          className: 'sub-pin-wrap',
          html: subHtml,
          iconSize: [110, 24],
          iconAnchor: [55, 24],
          popupAnchor: [0, -24]
        });

        var popupHtml = '<div style="padding:10px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;color:#0F172A;min-width:210px;">' +
          '<div style="font-size:9px;font-weight:800;color:#DC2626;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">⚡ Substation Facility</div>' +
          '<div style="font-weight:800;font-size:14px;color:#0F172A;margin-bottom:2px;">' + s.name + '</div>' +
          '<div style="font-size:11px;color:#64748B;margin-bottom:6px;">' + (s.code || '') + ' • ' + (s.radius || 500) + 'm Geofence Perimeter</div>' +
          '<div style="background:#FEF2F2;border:1px solid #FCA5A5;padding:6px;border-radius:6px;font-size:10px;color:#991B1B;">' +
          '<div>📍 <strong>Coordinates:</strong> ' + Number(s.lat).toFixed(5) + ', ' + Number(s.lon).toFixed(5) + '</div>' +
          (s.manager ? '<div>👤 <strong>In-Charge:</strong> ' + s.manager + '</div>' : '') +
          (s.phone ? '<div>📞 <strong>Contact:</strong> ' + s.phone + '</div>' : '') +
          '</div></div>';

        L.marker([s.lat, s.lon], { icon: subIcon })
          .bindPopup(popupHtml)
          .addTo(substationsLayer);
      });
    }

    function renderTechnicians(techs) {
      techniciansLayer.clearLayers();
      techs.forEach(function(t) {
        if (!t.lat || !t.lon) return;

        var isLive = Boolean(t.isLive);
        var isSel = Boolean(t.isSelected);
        var initials = (t.name || 'T').split(' ').map(function(w){return w[0];}).join('').substring(0,2).toUpperCase();

        var markerHtml = '';
        if (isLive) {
          markerHtml = '<div class="live-pulse-container">' +
            (isSel ? '<div class="selected-halo"></div>' : '') +
            '<div class="live-pulse-ring"></div>' +
            '<div class="live-marker-circle">' + initials + '</div>' +
            '</div>';
        } else {
          markerHtml = '<div class="lastknown-container">' +
            (isSel ? '<div class="selected-halo"></div>' : '') +
            '<div class="lastknown-marker-circle">' + initials + '</div>' +
            '</div>';
        }

        var icon = L.divIcon({
          className: 'tech-marker-wrapper',
          html: markerHtml,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -18]
        });

        var badgeBg = isLive ? '#059669' : '#D97706';
        var badgeText = isLive ? '🟢 ONLINE (LIVE GPS)' : '🕒 OFFLINE (LAST KNOWN)';

        var popupHtml = '<div style="padding:10px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;color:#0F172A;min-width:230px;line-height:1.4;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">' +
            '<span style="font-size:9px;font-weight:800;color:#FFF;background:' + badgeBg + ';padding:2px 8px;border-radius:10px;letter-spacing:0.4px;">' + badgeText + '</span>' +
            '<span style="font-size:10px;font-weight:700;color:#64748B;">' + (t.empId || t.id) + '</span>' +
          '</div>' +
          '<div style="font-weight:800;font-size:14px;color:#0F172A;margin-bottom:2px;">' + t.name + '</div>' +
          '<div style="background:#F8FAFC;border:1px solid #E2E8F0;padding:8px;border-radius:8px;font-size:11px;color:#334155;display:flex;flex-direction:column;gap:4px;">' +
            (t.phone ? '<div>📞 <strong>Mobile:</strong> <a href="tel:' + t.phone + '" style="color:#2563EB;text-decoration:none;font-weight:700;">' + t.phone + '</a></div>' : '') +
            '<div>🕒 <strong>Last Recorded:</strong> <span style="font-weight:600;color:#0F172A;">' + (t.timeAgo || 'Recent check-in') + '</span></div>' +
            '<div>⚡ <strong>Assigned Site:</strong> <span style="font-weight:600;color:#0F172A;">' + (t.siteName || 'Field Operations') + '</span></div>' +
            '<div>🎯 <strong>Coordinates:</strong> <span style="font-family:monospace;font-size:10px;">' + Number(t.lat).toFixed(5) + ', ' + Number(t.lon).toFixed(5) + '</span></div>' +
          '</div>' +
        '</div>';

        var marker = L.marker([t.lat, t.lon], { icon: icon })
          .bindPopup(popupHtml)
          .addTo(techniciansLayer);

        marker.on('click', function() {
          notifyNative('SELECT_TECH', t);
        });

        if (isSel) {
          setTimeout(function() { marker.openPopup(); }, 200);
        }
      });
    }

    function renderNearbyPoiMarkers(places) {
      placesLayer.clearLayers();
      window.__lastPlaces = places || [];
      if (!Array.isArray(places)) return;

      places.forEach(function(p) {
        if (!p.latitude || !p.longitude) return;

        var glyph = '📍';
        if (p.category === 'healthcare') glyph = '🏥';
        else if (p.category === 'fuel') glyph = '⛽';
        else if (p.category === 'financial') glyph = '🏧';
        else if (p.category === 'food') glyph = '🍽️';
        else if (p.category === 'shop') glyph = '🛒';
        else if (p.category === 'transit') glyph = '🚆';
        else if (p.category === 'civic') glyph = '🏛️';
        else if (p.category === 'education') glyph = '🎓';

        var poiHtml = '<div class="poi-pin-badge" style="background:' + (p.category_color || '#0284C7') + ';"><span>' + glyph + '</span><span>' + p.name + '</span></div>';
        var poiIcon = L.divIcon({
          className: 'poi-wrap',
          html: poiHtml,
          iconSize: [120, 22],
          iconAnchor: [60, 22],
          popupAnchor: [0, -22]
        });

        var popupHtml = '<div style="padding:10px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;color:#0F172A;min-width:210px;">' +
          '<div style="font-size:9px;font-weight:800;color:' + (p.category_color || '#0284C7') + ';text-transform:uppercase;margin-bottom:2px;">' + (p.category_label || p.category) + '</div>' +
          '<div style="font-weight:800;font-size:13px;color:#0F172A;margin-bottom:2px;">' + p.name + '</div>' +
          '<div style="font-size:11px;color:#475569;margin-bottom:4px;">📍 ' + (p.formatted_distance || '') + ' • ' + (p.address || '') + '</div>' +
          '<button onclick="window.__onPlaceDirections(\'' + p.id + '\')" style="margin-top:6px;width:100%;background:#1E63F0;color:#FFF;border:none;border-radius:6px;padding:6px;font-size:11px;font-weight:700;cursor:pointer;">🚗 Road Directions</button>' +
        '</div>';

        var marker = L.marker([p.latitude, p.longitude], { icon: poiIcon })
          .bindPopup(popupHtml)
          .addTo(placesLayer);

        marker.on('click', function() {
          notifyNative('SELECT_PLACE', p);
        });
      });
    }

    window.__onPlaceDirections = function(id) {
      var found = window.__lastPlaces.find(function(p) { return p.id === id; });
      if (found) {
        notifyNative('GET_PLACE_DIRECTIONS', found);
      }
    };

    renderSubstations(sitesData);
    renderTechnicians(techsData);

    setTimeout(function() { map.invalidateSize(); }, 100);
    setTimeout(function() { map.invalidateSize(); }, 300);
    setTimeout(function() { map.invalidateSize(); }, 800);
    window.addEventListener('resize', function() { map.invalidateSize(); });

    function handleIncomingMessage(event) {
      try {
        var msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!msg || !msg.type) return;

        if (msg.type === 'FLY_TO') {
          map.flyTo([msg.payload.lat, msg.payload.lon], msg.payload.zoom || 14, { duration: 0.8 });
        } else if (msg.type === 'SET_NEARBY_PLACES') {
          renderNearbyPoiMarkers(msg.payload.places);
        } else if (msg.type === 'CLEAR_NEARBY_PLACES') {
          renderNearbyPoiMarkers([]);
        } else if (msg.type === 'SET_ROAD_ROUTE') {
          if (Array.isArray(msg.payload.coordinates) && msg.payload.coordinates.length > 0) {
            roadRouteLayer.setLatLngs(msg.payload.coordinates);
            map.fitBounds(msg.payload.coordinates, { padding: [40, 40], maxZoom: 16 });
          }
        } else if (msg.type === 'CLEAR_ROUTE') {
          roadRouteLayer.setLatLngs([]);
        } else if (msg.type === 'SET_HISTORY_TRAIL') {
          if (Array.isArray(msg.payload.coordinates) && msg.payload.coordinates.length > 0) {
            historyTrailLayer.setLatLngs(msg.payload.coordinates);
            map.fitBounds(msg.payload.coordinates, { padding: [40, 40], maxZoom: 16 });
          }
        } else if (msg.type === 'CLEAR_HISTORY') {
          historyTrailLayer.setLatLngs([]);
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

  // Handle message from WebView/iframe
  const handleMessage = (event: any) => {
    try {
      const dataStr = event.nativeEvent ? event.nativeEvent.data : event.data;
      const parsed = typeof dataStr === 'string' ? JSON.parse(dataStr) : dataStr;
      if (parsed.type === 'SELECT_TECH' && onSelectTech) {
        const found = technicians.find((t) => t.id === parsed.data.id);
        if (found) onSelectTech(found);
      } else if (parsed.type === 'SELECT_PLACE') {
        setSelectedPlace(parsed.data);
      } else if (parsed.type === 'GET_PLACE_DIRECTIONS') {
        handleGetDirectionsToPlace(parsed.data);
      } else if (parsed.type === 'MAP_CLICK') {
        const { lat, lon } = parsed.data || {};
        if (typeof lat === 'number' && typeof lon === 'number') {
          handleFetchNearby(searchRadius, selectedCategory, searchQuery, lat, lon);
          setShowPlacesDrawer(true);
        }
      } else if (parsed.type === 'MAP_LIFECYCLE') {
        console.log('[Mappls Radar Lifecycle]', parsed.data?.stage, parsed.data);
      } else if (parsed.type === 'MAP_ERROR') {
        console.warn('[Mappls Radar Error]', parsed.data?.stage || parsed.data?.message, parsed.data);
      }
    } catch {}
  };

  return (
    <View style={[styles.container, style]}>
      {/* 1. Interactive Nearby Places Search & Category Bar */}
      <View style={styles.searchHeaderBar}>
        <View style={styles.searchInputRow}>
          <View style={styles.searchBox}>
            <Search size={16} color="#64748B" style={{ marginRight: 6 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search shops, petrol, hospitals, ATMs..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  handleFetchNearby(searchRadius, selectedCategory, '');
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={15} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.searchActionBtn}
            onPress={handleSearchSubmit}
            activeOpacity={0.8}
            disabled={loadingPlaces}
          >
            {loadingPlaces ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.searchActionBtnText}>Search</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Category Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {PLACE_CATEGORIES.map((cat) => {
            const isCatActive = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, isCatActive && styles.categoryChipActive]}
                onPress={() => handleCategorySelect(cat.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.categoryChipIcon}>{cat.icon}</Text>
                <Text
                  style={[
                    styles.categoryChipText,
                    isCatActive && styles.categoryChipTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Search Radius & Results Count Sub-Bar */}
        <View style={styles.radiusBarRow}>
          <Text style={styles.radiusLabel}>
            Radius ({currentCenter.label}):
          </Text>
          <View style={styles.radiusChipsWrap}>
            {SEARCH_RADII.map((r) => {
              const isRadActive = searchRadius === r.value;
              return (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.radiusChip, isRadActive && styles.radiusChipActive]}
                  onPress={() => handleRadiusSelect(r.value)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.radiusChipText,
                      isRadActive && styles.radiusChipTextActive,
                    ]}
                  >
                    {r.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {nearbyPlaces.length > 0 && (
            <TouchableOpacity
              style={styles.drawerToggleBtn}
              onPress={() => setShowPlacesDrawer(!showPlacesDrawer)}
              activeOpacity={0.7}
            >
              <Text style={styles.drawerToggleBtnText}>
                {nearbyPlaces.length} places {showPlacesDrawer ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 2. Maharashtra District Quick-Selector Chips */}
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

      {/* 3. Map Render: Native Mappls GL SDK (Android) / Interactive Web View */}
      <View style={styles.mapArea}>
        {isNativeMapplsAvailable && MapplsGL?.MapView ? (
          <MapplsGL.MapView
            style={styles.nativeMapplsMap}
            mapplsStyle="standard"
            logoEnabled={true}
            attributionEnabled={true}
          >
            <MapplsGL.Camera
              ref={mapplsCameraRef}
              centerCoordinate={[currentCenter.lon, currentCenter.lat]}
              zoomLevel={activeDistrict === 'Entire State' ? 6 : 13}
              animationMode="flyTo"
              animationDuration={800}
            />

            {/* Substation Geofences & Markers */}
            {substations.map((site) => {
              if (!site.latitude || !site.longitude) return null;
              const circleGeo = createCircleGeoJSON([site.longitude, site.latitude], site.radiusMeters || 500);
              return (
                <React.Fragment key={`mappls-substation-${site.id}`}>
                  <MapplsGL.ShapeSource id={`sub-shape-${site.id}`} shape={circleGeo}>
                    <MapplsGL.FillLayer
                      id={`sub-fill-${site.id}`}
                      style={{ fillColor: '#1E63F0', fillOpacity: 0.12 }}
                    />
                    <MapplsGL.LineLayer
                      id={`sub-line-${site.id}`}
                      style={{ lineColor: '#1E63F0', lineWidth: 2, lineDasharray: [2, 2] }}
                    />
                  </MapplsGL.ShapeSource>

                  <MapplsGL.PointAnnotation
                    id={`sub-pin-${site.id}`}
                    coordinate={[site.longitude, site.latitude]}
                  >
                    <View style={styles.substationMarker}>
                      <Text style={{ fontSize: 13, color: '#FFFFFF' }}>⚡</Text>
                    </View>
                  </MapplsGL.PointAnnotation>
                </React.Fragment>
              );
            })}

            {/* Technician Live vs Last Known Markers */}
            {technicians.map((tech) => {
              if (!tech.latitude || !tech.longitude) return null;
              return (
                <MapplsGL.PointAnnotation
                  key={`mappls-tech-${tech.id}`}
                  id={`tech-pin-${tech.id}`}
                  coordinate={[tech.longitude, tech.latitude]}
                  onSelected={() => onSelectTech && onSelectTech(tech)}
                >
                  {tech.isLive ? (
                    <View style={styles.liveMarkerWrap}>
                      <View style={styles.pulseRing} />
                      <View style={styles.markerDotLive}>
                        <Text style={styles.markerDotText}>{tech.name.charAt(0)}</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.markerDotLastKnown}>
                      <Text style={styles.markerDotText}>{tech.name.charAt(0)}</Text>
                    </View>
                  )}
                </MapplsGL.PointAnnotation>
              );
            })}

            {/* Active Road Route */}
            {activeRoute && activeRoute.geojson && (
              <MapplsGL.ShapeSource id="roadRouteSource" shape={activeRoute.geojson}>
                <MapplsGL.LineLayer
                  id="roadRouteCasing"
                  style={{
                    lineColor: '#1E3A8A',
                    lineWidth: 7,
                    lineOpacity: 0.7,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
                <MapplsGL.LineLayer
                  id="roadRouteLayer"
                  style={{
                    lineColor: '#3B82F6',
                    lineWidth: 4,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              </MapplsGL.ShapeSource>
            )}

            {/* Nearby POI Markers */}
            {nearbyPlaces.map((p) => {
              if (!p.latitude || !p.longitude) return null;
              const glyph =
                p.category === 'healthcare'
                  ? '🏥'
                  : p.category === 'fuel'
                  ? '⛽'
                  : p.category === 'financial'
                  ? '🏧'
                  : p.category === 'food'
                  ? '🍽️'
                  : p.category === 'shop'
                  ? '🛒'
                  : p.category === 'transit'
                  ? '🚆'
                  : '📍';
              return (
                <MapplsGL.PointAnnotation
                  key={`mappls-place-${p.id}`}
                  id={`place-pin-${p.id}`}
                  coordinate={[p.longitude, p.latitude]}
                  onSelected={() => setSelectedPlace(p)}
                >
                  <View style={[styles.poiMarkerWrapNative, { backgroundColor: p.category_color || '#0284C7' }]}>
                    <Text style={styles.poiMarkerIconNative}>{glyph}</Text>
                  </View>
                </MapplsGL.PointAnnotation>
              );
            })}
          </MapplsGL.MapView>
        ) : Platform.OS === 'web' ? (
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
          />
        )}
      </View>

      {/* 4. Collapsible Nearby Places List Drawer */}
      {showPlacesDrawer && nearbyPlaces.length > 0 && (
        <View style={styles.placesListDrawer}>
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>
              Nearby Verified Places ({nearbyPlaces.length})
            </Text>
            <TouchableOpacity
              onPress={() => setShowPlacesDrawer(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={16} color="#64748B" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.drawerScroll} nestedScrollEnabled={true}>
            {nearbyPlaces.map((place) => (
              <TouchableOpacity
                key={place.id}
                style={[
                  styles.placeRowCard,
                  selectedPlace?.id === place.id && styles.placeRowCardActive,
                ]}
                onPress={() => {
                  setSelectedPlace(place);
                  postToMap('FLY_TO', { lat: place.latitude, lon: place.longitude, zoom: 16 });
                  if (isNativeMapplsAvailable && mapplsCameraRef.current) {
                    mapplsCameraRef.current.setCamera({
                      centerCoordinate: [place.longitude, place.latitude],
                      zoomLevel: 16,
                      animationDuration: 800,
                    });
                  }
                }}
                activeOpacity={0.8}
              >
                <View style={styles.placeRowHeader}>
                  <View style={styles.placeNameCol}>
                    <Text style={styles.placeRowName} numberOfLines={1}>
                      {place.name}
                    </Text>
                    {place.name_mr && (
                      <Text style={styles.placeRowMrName}>{place.name_mr}</Text>
                    )}
                  </View>
                  <View
                    style={[
                      styles.placeCategoryPill,
                      { backgroundColor: `${place.category_color}18` },
                    ]}
                  >
                    <Text
                      style={[
                        styles.placeCategoryPillText,
                        { color: place.category_color },
                      ]}
                    >
                      {place.category_label}
                    </Text>
                  </View>
                </View>

                <Text style={styles.placeRowAddress} numberOfLines={1}>
                  {place.address}
                </Text>

                <View style={styles.placeRowFooter}>
                  <Text style={styles.placeDistanceText}>
                    🎯 {place.formatted_distance} (straight-line)
                  </Text>
                  <TouchableOpacity
                    style={styles.directRouteBtn}
                    onPress={() => handleGetDirectionsToPlace(place)}
                    activeOpacity={0.7}
                  >
                    <Route size={12} color="#1E63F0" style={{ marginRight: 4 }} />
                    <Text style={styles.directRouteBtnText}>Road Directions</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 5. Selected Place Road Route Details Card */}
      {selectedPlace && (
        <View style={styles.selectedPlaceCard}>
          <View style={styles.placeCardHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.placeBadgeRow}>
                <View
                  style={[
                    styles.placeCategoryPill,
                    { backgroundColor: `${selectedPlace.category_color}20` },
                  ]}
                >
                  <Text
                    style={[
                      styles.placeCategoryPillText,
                      { color: selectedPlace.category_color },
                    ]}
                  >
                    {selectedPlace.category_label}
                  </Text>
                </View>
                <Text style={styles.straightLineBadge}>
                  {selectedPlace.formatted_distance} straight-line
                </Text>
              </View>
              <Text style={styles.selectedPlaceName} numberOfLines={1}>
                {selectedPlace.name}
              </Text>
              {selectedPlace.name_mr && (
                <Text style={styles.selectedPlaceMr}>{selectedPlace.name_mr}</Text>
              )}
            </View>

            <TouchableOpacity
              onPress={() => {
                setSelectedPlace(null);
                setPlaceRoadRoute(null);
                postToMap('CLEAR_ROUTE', {});
              }}
              style={styles.closePlaceBtn}
            >
              <X size={16} color="#64748B" />
            </TouchableOpacity>
          </View>

          <Text style={styles.selectedPlaceAddr} numberOfLines={2}>
            📍 {selectedPlace.address}
          </Text>

          {/* Road Directions Telemetry Row */}
          {placeRoadRoute && (
            <View style={styles.roadTelemetryPill}>
              <View style={styles.roadTelemetryItem}>
                <Text style={styles.roadTelemetryLabel}>ROAD DISTANCE</Text>
                <Text style={styles.roadTelemetryVal}>
                  {placeRoadRoute.distanceKm} km
                </Text>
              </View>
              <View style={styles.roadTelemetryDivider} />
              <View style={styles.roadTelemetryItem}>
                <Text style={styles.roadTelemetryLabel}>EST. TRAVEL TIME</Text>
                <Text style={styles.roadTelemetryVal}>
                  {placeRoadRoute.durationFormatted}
                </Text>
              </View>
              <View style={styles.roadTelemetryDivider} />
              <View style={styles.roadTelemetryItem}>
                <Text style={styles.roadTelemetryLabel}>ROUTING ENGINE</Text>
                <Text style={styles.roadTelemetryVal}>OSRM Street Network</Text>
              </View>
            </View>
          )}

          <View style={styles.placeActionRow}>
            <TouchableOpacity
              style={styles.getRouteActionBtn}
              onPress={() => handleGetDirectionsToPlace(selectedPlace)}
              activeOpacity={0.8}
              disabled={loadingPlaceRoute}
            >
              {loadingPlaceRoute ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Navigation size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.getRouteActionBtnText}>
                    {placeRoadRoute ? 'Recalculate Road Route' : 'Get Road Directions'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 6. Floating Road Route / Distance / Travel Time Card for Selected Technician */}
      {selectedTech && !selectedPlace && (
        <View style={styles.floatingRouteCard}>
          <View style={styles.floatingRouteHeader}>
            <View style={styles.floatingRouteTitleWrap}>
              <View
                style={[
                  styles.statusIndicatorDot,
                  { backgroundColor: selectedTech.hasGps ? (selectedTech.isLive ? '#10B981' : '#64748B') : '#94A3B8' },
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
                    : 'LOCATION NOT AVAILABLE'}
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

            <View style={styles.telemetryCol}>
              <Text style={styles.telemetryLabel}>ROAD DISTANCE</Text>
              <Text style={styles.telemetryValHighlight}>
                {selectedTech.hasGps && (activeRoute?.distanceKm || selectedTech.roadDistanceKm)
                  ? `${activeRoute?.distanceKm || selectedTech.roadDistanceKm} km`
                  : 'NOT AVAILABLE'}
              </Text>
            </View>

            <View style={styles.telemetryCol}>
              <Text style={styles.telemetryLabel}>EST. TRAVEL TIME</Text>
              <Text style={styles.telemetryValHighlight}>
                {selectedTech.hasGps && (activeRoute?.durationFormatted || selectedTech.estimatedTravelTime) && selectedTech.estimatedTravelTime !== 'Not Available'
                  ? `${activeRoute?.durationFormatted || selectedTech.estimatedTravelTime}`
                  : 'NOT AVAILABLE'}
              </Text>
            </View>

            <View style={styles.telemetryCol}>
              <Text style={styles.telemetryLabel}>LAST RECORDED</Text>
              <Text style={styles.telemetryVal} numberOfLines={1}>
                {selectedTech.timeAgo || selectedTech.lastLocationUpdate || (selectedTech.hasGps ? 'Logged' : 'No GPS Logged')}
              </Text>
            </View>
          </View>

          {/* Historical GPS Distance summary if active */}
          {showHistory && historyTrail && (
            <View style={styles.historySummaryBar}>
              <Text style={styles.historySummaryText}>
                📌 Recorded Movement Today:{' '}
                <Text style={{ fontWeight: '800' }}>
                  {historyTrail.totalDistanceFormatted}
                </Text>{' '}
                ({historyTrail.totalPoints} GPS pings • {historyTrail.stops.length} stops)
              </Text>
            </View>
          )}
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
  searchHeaderBar: {
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    zIndex: 15,
  },
  searchInputRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    alignItems: 'center',
    marginBottom: 6,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    paddingVertical: 0,
  },
  searchActionBtn: {
    backgroundColor: '#1E63F0',
    borderRadius: 8,
    paddingHorizontal: 14,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  categoryScroll: {
    paddingHorizontal: 12,
    gap: 6,
    paddingBottom: 4,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#1E63F0',
  },
  categoryChipIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  categoryChipTextActive: {
    color: '#1E63F0',
    fontWeight: '800',
  },
  radiusBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 4,
    justifyContent: 'space-between',
  },
  radiusLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  radiusChipsWrap: {
    flexDirection: 'row',
    gap: 4,
  },
  radiusChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  radiusChipActive: {
    backgroundColor: '#1E63F0',
    borderColor: '#1E63F0',
  },
  radiusChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  radiusChipTextActive: {
    color: '#FFFFFF',
  },
  drawerToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#EEF2FF',
    borderRadius: 4,
  },
  drawerToggleBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4338CA',
  },
  districtChipsBar: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    zIndex: 10,
  },
  districtScroll: {
    paddingHorizontal: 12,
    gap: 6,
  },
  districtChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  districtChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  districtChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  districtChipTextActive: {
    color: '#FFFFFF',
  },
  mapArea: {
    flex: 1,
  },
  nativeMapplsMap: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: '#E2E8F0',
  },
  substationMarker: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#1E63F0',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1E63F0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  liveMarkerWrap: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(16, 185, 129, 0.35)',
  },
  markerDotLive: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#10B981',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerDotLastKnown: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#64748B',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerDotText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  poiMarkerWrapNative: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  poiMarkerIconNative: {
    fontSize: 12,
  },
  placesListDrawer: {
    position: 'absolute',
    top: 130,
    left: 12,
    right: 12,
    maxHeight: 260,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 25,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 6,
  },
  drawerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  drawerScroll: {
    maxHeight: 210,
  },
  placeRowCard: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  placeRowCardActive: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  placeRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  placeNameCol: {
    flex: 1,
    marginRight: 8,
  },
  placeRowName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  placeRowMrName: {
    fontSize: 10,
    color: '#64748B',
  },
  placeCategoryPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  placeCategoryPillText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  placeRowAddress: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  placeRowFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  placeDistanceText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  directRouteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#EFF6FF',
  },
  directRouteBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E63F0',
  },
  selectedPlaceCard: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 30,
  },
  placeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  placeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  straightLineBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  selectedPlaceName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  selectedPlaceMr: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  closePlaceBtn: {
    padding: 4,
  },
  selectedPlaceAddr: {
    fontSize: 11,
    color: '#475569',
    marginTop: 4,
  },
  roadTelemetryPill: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  roadTelemetryItem: {
    alignItems: 'center',
  },
  roadTelemetryLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  roadTelemetryVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E63F0',
    marginTop: 2,
  },
  roadTelemetryDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#CBD5E1',
  },
  placeActionRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  getRouteActionBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E63F0',
    borderRadius: 8,
    paddingVertical: 9,
  },
  getRouteActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  floatingRouteCard: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 20,
  },
  floatingRouteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  floatingRouteTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  floatingRouteTechName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginRight: 6,
    maxWidth: 140,
  },
  statusBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeLive: {
    backgroundColor: '#DCFCE7',
  },
  badgeLastKnown: {
    backgroundColor: '#F1F5F9',
  },
  statusBadgeTextSmall: {
    fontSize: 9,
    fontWeight: '800',
  },
  badgeLiveText: {
    color: '#15803D',
  },
  badgeLastKnownText: {
    color: '#475569',
  },
  historyToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  historyToggleBtnActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#7C3AED',
  },
  historyToggleBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  telemetryGrid: {
    flexDirection: 'row',
    marginTop: 8,
    justifyContent: 'space-between',
  },
  telemetryCol: {
    flex: 1,
    alignItems: 'center',
  },
  telemetryLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  telemetryVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  telemetryValHighlight: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E63F0',
  },
  historySummaryBar: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    alignItems: 'center',
  },
  historySummaryText: {
    fontSize: 10,
    color: '#6D28D9',
  },
});
