import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import {
  Navigation,
  MapPin,
  Clock,
  Radio,
  Building,
  RotateCcw,
  Zap,
  Search,
  X,
  AlertTriangle,
  Compass,
  CheckCircle,
  ExternalLink,
  Phone,
} from 'lucide-react-native';
import { FleetTechnician, Substation } from '../../types';
import { placesService, NearbyPlace } from '../../services/placesService';

export interface MaharashtraFleetMapProps {
  substations: Substation[];
  technicians: FleetTechnician[];
  selectedTech: FleetTechnician | null;
  onSelectTech?: (tech: FleetTechnician) => void;
  style?: any;
  showDistrictSelector?: boolean;
}

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

export const MaharashtraFleetMap: React.FC<MaharashtraFleetMapProps> = ({
  substations = [],
  technicians = [],
  selectedTech,
  onSelectTech,
  style,
  showDistrictSelector = true,
}) => {
  const iframeRef = useRef<any>(null);
  const [activeDistrict, setActiveDistrict] = useState<string>('All India');
  const [inspectedTech, setInspectedTech] = useState<FleetTechnician | null>(selectedTech);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<NearbyPlace | null>(null);

  // Fetch verified real-world nearby places when map or coordinates are clicked
  const handleFetchWebNearby = useCallback(async (lat: number, lon: number) => {
    try {
      const res = await placesService.getNearbyPlaces(lat, lon, 2500, 'all', undefined, 20);
      if (res && res.places) {
        setNearbyPlaces(res.places);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (selectedTech) {
      setInspectedTech(selectedTech);
      if (selectedTech.latitude && selectedTech.longitude) {
        handleFetchWebNearby(Number(selectedTech.latitude), Number(selectedTech.longitude));
      }
    }
  }, [selectedTech, handleFetchWebNearby]);

  // Center camera when selectedTech changes via postMessage
  useEffect(() => {
    if (selectedTech?.hasGps && selectedTech?.latitude && selectedTech?.longitude && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          type: 'FLY_TO',
          lat: Number(selectedTech.latitude),
          lon: Number(selectedTech.longitude),
          zoom: 16,
          techId: selectedTech.id,
        }),
        '*'
      );
    }
  }, [selectedTech]);

  // PostMessage listener from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!msg || typeof msg !== 'object') return;

        if (msg.type === 'SELECT_TECH') {
          const found = technicians.find(
            (t) => t.id === msg.techId || t.employeeId === msg.techId
          );
          if (found) {
            setInspectedTech(found);
            if (onSelectTech) onSelectTech(found);
          }
        } else if (msg.type === 'MAP_CLICK') {
          if (typeof msg.lat === 'number' && typeof msg.lon === 'number') {
            handleFetchWebNearby(msg.lat, msg.lon);
          }
        }
      } catch {}
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('message', handleMessage);
      return () => {
        window.removeEventListener('message', handleMessage);
      };
    }
  }, [technicians, onSelectTech, handleFetchWebNearby]);

  // Send update data when technicians or substations change
  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      const payload = {
        type: 'UPDATE_DATA',
        substations: substations.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          lat: Number(s.latitude),
          lon: Number(s.longitude),
          radius: s.radiusMeters || 500,
          manager: s.manager?.name || 'Site In-Charge',
          phone: s.manager?.phone || '',
        })),
        technicians: technicians
          .filter((t) => t.hasGps && t.latitude && t.longitude)
          .map((t) => ({
            id: t.id,
            name: t.name,
            empId: t.employeeId,
            lat: Number(t.latitude),
            lon: Number(t.longitude),
            isLive: Boolean(t.isLive || t.isOnline || t.status === 'online' || t.status === 'live_online'),
            designation: t.designation || 'Smart Meter Technician',
            phone: t.phone || '',
            siteName: t.assignedSiteName || 'Field Operations',
            lastUpdate: t.lastLocationUpdate || t.lastSeen || 'Recent check-in',
            isSelected: selectedTech?.id === t.id,
          })),
        selectedTechId: selectedTech?.id || null,
      };
      iframeRef.current.contentWindow.postMessage(JSON.stringify(payload), '*');
    }
  }, [substations, technicians, selectedTech]);

  // District Quick Selection
  const handleSelectDistrict = (dist: (typeof MAHARASHTRA_DISTRICTS)[0]) => {
    setActiveDistrict(dist.name);
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          type: 'FLY_TO',
          lat: dist.lat,
          lon: dist.lon,
          zoom: dist.zoom,
        }),
        '*'
      );
    }
  };

  // Zoom Controls
  const handleZoomIn = () => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ type: 'ZOOM_IN' }), '*');
  };
  const handleZoomOut = () => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ type: 'ZOOM_OUT' }), '*');
  };
  const handleRecenter = () => {
    if (selectedTech && selectedTech.latitude && selectedTech.longitude) {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({
          type: 'FLY_TO',
          lat: Number(selectedTech.latitude),
          lon: Number(selectedTech.longitude),
          zoom: 16,
          techId: selectedTech.id,
        }),
        '*'
      );
    } else {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({
          type: 'FLY_TO',
          lat: ALL_INDIA_CENTER.latitude,
          lon: ALL_INDIA_CENTER.longitude,
          zoom: ALL_INDIA_CENTER.zoom,
        }),
        '*'
      );
    }
  };

  // Build the complete Leaflet HTML page for the iframe
  const htmlContent = useMemo(() => {
    const initialLat = selectedTech?.latitude ? Number(selectedTech.latitude) : ALL_INDIA_CENTER.latitude;
    const initialLon = selectedTech?.longitude ? Number(selectedTech.longitude) : ALL_INDIA_CENTER.longitude;
    const initialZoom = selectedTech?.latitude ? 15 : ALL_INDIA_CENTER.zoom;

    const initialSitesJson = JSON.stringify(
      substations.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        lat: Number(s.latitude),
        lon: Number(s.longitude),
        radius: s.radiusMeters || 500,
        manager: s.manager?.name || 'Site In-Charge',
        phone: s.manager?.phone || '',
      }))
    );

    const initialTechsJson = JSON.stringify(
      technicians
        .filter((t) => t.hasGps && t.latitude && t.longitude)
        .map((t) => ({
          id: t.id,
          name: t.name,
          empId: t.employeeId,
          lat: Number(t.latitude),
          lon: Number(t.longitude),
          isLive: Boolean(t.isLive || t.isOnline || t.status === 'online' || t.status === 'live_online'),
          designation: t.designation || 'Smart Meter Technician',
          phone: t.phone || '',
          siteName: t.assignedSiteName || 'Field Operations',
          lastUpdate: t.lastLocationUpdate || t.lastSeen || 'Recent check-in',
          isSelected: selectedTech?.id === t.id,
        }))
    );

    const initialSelectedId = JSON.stringify(selectedTech?.id || null);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
  <title>Adani Field Force Live Telemetry</title>
  <!-- Leaflet CSS -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
  <!-- Leaflet JS -->
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
      margin: 0;
      padding: 0;
      background: #E2E8F0;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .leaflet-container {
      background: #E2E8F0 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    
    /* Official Mappls Brand Badge */
    .mappls-brand-badge {
      position: absolute !important;
      bottom: 10px !important;
      left: 10px !important;
      z-index: 1000 !important;
      display: inline-flex !important;
      align-items: center !important;
      background: #FFFFFF !important;
      padding: 4px 10px !important;
      border-radius: 6px !important;
      box-shadow: 0 2px 6px rgba(0,0,0,0.22) !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      color: #0F172A !important;
      pointer-events: none !important;
      border: 1px solid #CBD5E1 !important;
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

    /* Live GPS marker with pulse animation */
    .live-pulse-container {
      position: relative;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .live-pulse-ring {
      position: absolute;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.4);
      animation: pulseAnim 2s infinite ease-out;
    }
    @keyframes pulseAnim {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }
    .live-marker-circle {
      position: relative;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #10B981;
      border: 2px solid #FFFFFF;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      color: #FFFFFF;
      font-size: 10px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
    }

    /* Last Known GPS marker */
    .lastknown-container {
      position: relative;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .lastknown-marker-circle {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #475569;
      border: 2px solid #FFFFFF;
      box-shadow: 0 2px 5px rgba(0,0,0,0.25);
      color: #FFFFFF;
      font-size: 9px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Selected marker halo */
    .selected-halo {
      position: absolute;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: 2.5px solid #1E63F0;
      animation: selectPulse 1.5s infinite;
    }
    @keyframes selectPulse {
      0% { transform: scale(0.9); opacity: 0.9; }
      50% { transform: scale(1.15); opacity: 0.3; }
      100% { transform: scale(0.9); opacity: 0.9; }
    }

    /* Substation pin */
    .substation-pin {
      background: #DC2626;
      color: #FFFFFF;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
      box-shadow: 0 2px 6px rgba(220,38,38,0.4);
      border: 1.5px solid #FFFFFF;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 3px;
      cursor: pointer;
    }

    /* Custom Leaflet popup overrides */
    .leaflet-popup-content-wrapper {
      border-radius: 10px !important;
      box-shadow: 0 4px 16px rgba(0,0,0,0.22) !important;
      padding: 0 !important;
      overflow: hidden !important;
    }
    .leaflet-popup-content {
      margin: 0 !important;
      line-height: 1.4 !important;
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
    var currentSites = ${initialSitesJson};
    var currentTechs = ${initialTechsJson};
    var selectedTechId = ${initialSelectedId};

    // Initialize Leaflet map
    var map = L.map('map', {
      center: [${initialLat}, ${initialLon}],
      zoom: ${initialZoom},
      zoomControl: false,
      attributionControl: false
    });

    // High-availability CartoDB Voyager 2x Raster Tile Layer
    var cartoLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
      detectRetina: true
    }).addTo(map);

    // Automatic fallback to OpenStreetMap if CartoDB experiences a tile failure
    var hasOsmFallback = false;
    cartoLayer.on('tileerror', function() {
      if (!hasOsmFallback) {
        hasOsmFallback = true;
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      }
    });

    // Layer groups for dynamic updating
    var substationsGroup = L.layerGroup().addTo(map);
    var techniciansGroup = L.layerGroup().addTo(map);

    function notifyParent(msg) {
      if (window.parent && window.parent.postMessage) {
        window.parent.postMessage(JSON.stringify(msg), '*');
      }
    }

    // Map Click Listener
    map.on('click', function(e) {
      notifyParent({ type: 'MAP_CLICK', lat: e.latlng.lat, lon: e.latlng.lng });
    });

    function renderSubstations(sites) {
      substationsGroup.clearLayers();
      sites.forEach(function(s) {
        if (!s.lat || !s.lon) return;

        // 500m geofence boundary circle
        L.circle([s.lat, s.lon], {
          radius: s.radius || 500,
          color: '#DC2626',
          fillColor: '#DC2626',
          fillOpacity: 0.12,
          weight: 1.5,
          dashArray: '4, 4'
        }).addTo(substationsGroup);

        // Substation Label Pin
        var subHtml = '<div class="substation-pin"><span>⚡</span><span>' + s.name + '</span></div>';
        var subIcon = L.divIcon({
          className: 'sub-pin-wrap',
          html: subHtml,
          iconSize: [110, 24],
          iconAnchor: [55, 24],
          popupAnchor: [0, -24]
        });

        var popupHtml = '<div style="padding:10px;font-family:-apple-system,BlinkMacSystemFont,\\'Segoe UI\\',Roboto,sans-serif;color:#0F172A;min-width:210px;">' +
          '<div style="font-size:9px;font-weight:800;color:#DC2626;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">⚡ Substation Facility</div>' +
          '<div style="font-weight:800;font-size:14px;color:#0F172A;margin-bottom:2px;">' + s.name + '</div>' +
          '<div style="font-size:11px;color:#64748B;margin-bottom:6px;">' + (s.code || '') + ' • ' + (s.radius || 500) + 'm Geofence Perimeter</div>' +
          '<div style="background:#FEF2F2;border:1px solid #FCA5A5;padding:6px;border-radius:6px;font-size:10px;color:#991B1B;">' +
          '<div>📍 <strong>Coordinates:</strong> ' + s.lat.toFixed(5) + ', ' + s.lon.toFixed(5) + '</div>' +
          (s.manager ? '<div>👤 <strong>In-Charge:</strong> ' + s.manager + '</div>' : '') +
          (s.phone ? '<div>📞 <strong>Contact:</strong> ' + s.phone + '</div>' : '') +
          '</div></div>';

        L.marker([s.lat, s.lon], { icon: subIcon })
          .bindPopup(popupHtml)
          .addTo(substationsGroup);
      });
    }

    function renderTechnicians(techs, activeSelId) {
      techniciansGroup.clearLayers();
      techs.forEach(function(t) {
        if (!t.lat || !t.lon) return;

        var isLive = Boolean(t.isLive);
        var isSel = (t.id === activeSelId);
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

        var popupHtml = '<div style="padding:10px;font-family:-apple-system,BlinkMacSystemFont,\\'Segoe UI\\',Roboto,sans-serif;color:#0F172A;min-width:230px;line-height:1.4;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">' +
            '<span style="font-size:9px;font-weight:800;color:#FFF;background:' + badgeBg + ';padding:2px 8px;border-radius:10px;letter-spacing:0.4px;">' + badgeText + '</span>' +
            '<span style="font-size:10px;font-weight:700;color:#64748B;">' + (t.empId || t.id) + '</span>' +
          '</div>' +
          '<div style="font-weight:800;font-size:14px;color:#0F172A;margin-bottom:2px;">' + t.name + '</div>' +
          '<div style="font-size:11px;color:#475569;margin-bottom:8px;">' + (t.designation || 'Smart Meter Technician') + '</div>' +
          '<div style="background:#F8FAFC;border:1px solid #E2E8F0;padding:8px;border-radius:8px;font-size:11px;color:#334155;display:flex;flex-direction:column;gap:4px;">' +
            (t.phone ? '<div>📞 <strong>Mobile:</strong> <a href="tel:' + t.phone + '" style="color:#2563EB;text-decoration:none;font-weight:700;">' + t.phone + '</a></div>' : '') +
            '<div>🕒 <strong>Last Recorded:</strong> <span style="font-weight:600;color:#0F172A;">' + (t.lastUpdate || 'Recent check-in') + '</span></div>' +
            '<div>⚡ <strong>Assigned Site:</strong> <span style="font-weight:600;color:#0F172A;">' + (t.siteName || 'Field Operations') + '</span></div>' +
            '<div>🎯 <strong>Coordinates:</strong> <span style="font-family:monospace;font-size:10px;">' + t.lat.toFixed(5) + ', ' + t.lon.toFixed(5) + '</span></div>' +
          '</div>' +
        '</div>';

        var marker = L.marker([t.lat, t.lon], { icon: icon })
          .bindPopup(popupHtml)
          .addTo(techniciansGroup);

        marker.on('click', function() {
          notifyParent({ type: 'SELECT_TECH', techId: t.id });
        });

        if (isSel) {
          setTimeout(function() { marker.openPopup(); }, 200);
        }
      });
    }

    // Initial render
    renderSubstations(currentSites);
    renderTechnicians(currentTechs, selectedTechId);

    // Invalidate size on load settling ticks
    setTimeout(function() { map.invalidateSize(); }, 100);
    setTimeout(function() { map.invalidateSize(); }, 300);
    setTimeout(function() { map.invalidateSize(); }, 800);
    window.addEventListener('resize', function() { map.invalidateSize(); });

    // Handle incoming messages from React parent
    window.addEventListener('message', function(event) {
      try {
        var msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!msg) return;

        if (msg.type === 'FLY_TO') {
          map.flyTo([msg.lat, msg.lon], msg.zoom || 15, { duration: 0.8 });
        } else if (msg.type === 'ZOOM_IN') {
          map.zoomIn();
        } else if (msg.type === 'ZOOM_OUT') {
          map.zoomOut();
        } else if (msg.type === 'UPDATE_DATA') {
          if (Array.isArray(msg.substations)) renderSubstations(msg.substations);
          if (Array.isArray(msg.technicians)) renderTechnicians(msg.technicians, msg.selectedTechId);
        }
      } catch (e) {}
    });
  </script>
</body>
</html>`;
  }, [substations, technicians, selectedTech]);

  return (
    <View style={[styles.container, style]}>
      {/* 1. Maharashtra & All India Operational Hub Quick-Selector Chips */}
      {showDistrictSelector && (
        <View style={styles.districtChipsBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.districtScroll}
          >
            {INDIA_OPERATIONAL_ZONES.map((dist) => {
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

      {/* 2. Live Map Canvas Area */}
      <View style={styles.mapArea}>
        <iframe
          ref={iframeRef}
          srcDoc={htmlContent}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          title="Adani Workforce Telemetry Radar"
        />

        {/* Floating Zoom & Recenter Controls */}
        <View style={styles.mapControlsGroup}>
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={handleZoomIn}
            activeOpacity={0.8}
            accessibilityLabel="Zoom In"
          >
            <Text style={styles.controlBtnText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={handleZoomOut}
            activeOpacity={0.8}
            accessibilityLabel="Zoom Out"
          >
            <Text style={styles.controlBtnText}>−</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={handleRecenter}
            activeOpacity={0.8}
            accessibilityLabel="Recenter"
          >
            <Compass size={16} color="#1E293B" />
          </TouchableOpacity>
        </View>

        {/* Selected / Clicked Employee Quick Inspector Card Overlay */}
        {inspectedTech && inspectedTech.hasGps && (
          <View style={styles.techInspectorCard}>
            <View style={styles.techInspectorHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <View
                    style={[
                      styles.statusPillSmall,
                      {
                        backgroundColor:
                          inspectedTech.isLive || inspectedTech.isOnline ? '#DCFCE7' : '#FEF3C7',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDotSmall,
                        {
                          backgroundColor:
                            inspectedTech.isLive || inspectedTech.isOnline ? '#059669' : '#D97706',
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusPillTextSmall,
                        {
                          color:
                            inspectedTech.isLive || inspectedTech.isOnline ? '#065F46' : '#92400E',
                        },
                      ]}
                    >
                      {inspectedTech.isLive || inspectedTech.isOnline ? 'LIVE GPS' : 'LAST KNOWN'}
                    </Text>
                  </View>
                  <Text style={styles.techInspectorId}>{inspectedTech.employeeId}</Text>
                </View>
                <Text style={styles.techInspectorName}>{inspectedTech.name}</Text>
                <Text style={styles.techInspectorRole}>
                  {inspectedTech.designation || 'Smart Meter Technician'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setInspectedTech(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.techInspectorClose}
              >
                <X size={15} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.techInspectorDetails}>
              {inspectedTech.phone ? (
                <View style={styles.techDetailRow}>
                  <Phone size={12} color="#2563EB" style={{ marginRight: 5 }} />
                  <Text style={styles.techDetailText}>
                    Mobile: <Text style={{ fontWeight: '700', color: '#2563EB' }}>{inspectedTech.phone}</Text>
                  </Text>
                </View>
              ) : null}
              <View style={styles.techDetailRow}>
                <Clock size={12} color="#64748B" style={{ marginRight: 5 }} />
                <Text style={styles.techDetailText}>
                  Recorded:{' '}
                  <Text style={{ fontWeight: '700' }}>
                    {inspectedTech.lastLocationUpdate || inspectedTech.lastSeen || 'Recent check-in'}
                  </Text>
                </Text>
              </View>
              {inspectedTech.latitude && inspectedTech.longitude && (
                <View style={styles.techDetailRow}>
                  <MapPin size={12} color="#1E63F0" style={{ marginRight: 5 }} />
                  <Text style={styles.techDetailText}>
                    GPS:{' '}
                    <Text style={{ fontWeight: '700' }}>
                      {Number(inspectedTech.latitude).toFixed(5)}, {Number(inspectedTech.longitude).toFixed(5)}
                    </Text>
                  </Text>
                </View>
              )}
              {inspectedTech.assignedSiteName && (
                <View style={styles.techDetailRow}>
                  <Building size={12} color="#059669" style={{ marginRight: 5 }} />
                  <Text style={styles.techDetailText}>
                    Assigned: <Text style={{ fontWeight: '700' }}>{inspectedTech.assignedSiteName}</Text>
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    position: 'relative',
    height: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  districtChipsBar: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    zIndex: 10,
  },
  districtScroll: {
    paddingHorizontal: 12,
    gap: 6,
  },
  districtChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
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
    minHeight: 460,
    width: '100%',
    position: 'relative',
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  mapControlsGroup: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 999,
    flexDirection: 'column',
    gap: 6,
  },
  controlBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  controlBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 20,
  },
  techInspectorCard: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    left: 12,
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    zIndex: 1000,
  },
  techInspectorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
    marginBottom: 8,
  },
  statusPillSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  statusDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillTextSmall: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  techInspectorId: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  techInspectorName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  techInspectorRole: {
    fontSize: 11,
    color: '#475569',
  },
  techInspectorClose: {
    padding: 4,
  },
  techInspectorDetails: {
    flexDirection: 'column',
    gap: 4,
  },
  techDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  techDetailText: {
    fontSize: 11,
    color: '#334155',
  },
});

export default MaharashtraFleetMap;
