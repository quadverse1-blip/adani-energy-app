import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import { FleetTechnician, Substation } from '../../types';

interface LeafletMapViewProps {
  style?: any;
  substations: Substation[];
  technicians: FleetTechnician[];
  selectedTech: FleetTechnician | null;
  onSelectTech?: (tech: FleetTechnician) => void;
  center?: { latitude: number; longitude: number; zoom?: number };
}

export const LeafletMapView: React.FC<LeafletMapViewProps> = ({
  style,
  substations,
  technicians,
  selectedTech,
  onSelectTech,
  center = { latitude: 19.7515, longitude: 75.7139, zoom: 6 },
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Filter technicians with active GPS coordinates
  const activeTechs = useMemo(
    () => technicians.filter((t) => t.hasGps && t.latitude !== null && t.longitude !== null),
    [technicians]
  );

  // Generate self-contained Leaflet HTML
  const htmlContent = useMemo(() => {
    const centerLat = center.latitude || 12.9626;
    const centerLon = center.longitude || 77.5936;
    const centerZoom = center.zoom || 16;

    const substationsData = JSON.stringify(
      substations.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        lat: s.latitude,
        lon: s.longitude,
        radius: s.radiusMeters || 500,
      }))
    );

    const techniciansData = JSON.stringify(
      activeTechs.map((t) => ({
        id: t.id,
        name: t.name,
        empId: t.employeeId,
        lat: t.latitude,
        lon: t.longitude,
        status: t.status,
        color: t.markerColor || 'green',
        siteName: t.assignedSiteName,
        checkInTime: t.checkInTime,
        isSelected: selectedTech?.id === t.id,
      }))
    );

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <style>
    * { box-sizing: border-box; }
    html, body, #map {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      overflow: hidden;
    }
    
    /* Custom Substation Marker */
    .substation-marker {
      background: #DC2626;
      color: #FFFFFF;
      padding: 5px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 800;
      box-shadow: 0 4px 14px rgba(220, 38, 38, 0.45);
      border: 2px solid #FFFFFF;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      cursor: pointer;
      transform: translate(-50%, -50%);
    }
    .substation-marker svg {
      width: 14px;
      height: 14px;
      fill: #FFFFFF;
    }

    /* Custom Technician Dark Pill Marker */
    .tech-marker {
      background: #0F172A;
      color: #FFFFFF;
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 800;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.4);
      border: 1.5px solid rgba(255, 255, 255, 0.35);
      display: inline-flex;
      align-items: center;
      gap: 7px;
      white-space: nowrap;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      transform: translate(-50%, -50%);
    }
    .tech-marker:hover {
      background: #1E293B;
      transform: translate(-50%, -50%) scale(1.08);
      border-color: #38BDF8;
      box-shadow: 0 6px 20px rgba(56, 189, 248, 0.4);
    }
    .tech-marker.selected {
      background: #1E40AF;
      border-color: #60A5FA;
      box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.4), 0 8px 24px rgba(30, 64, 175, 0.5);
      transform: translate(-50%, -50%) scale(1.12);
      z-index: 9999 !important;
    }
    .tech-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22C55E;
      box-shadow: 0 0 8px #22C55E;
      animation: pulse-dot 2s infinite ease-in-out;
    }
    .tech-dot.amber {
      background: #F59E0B;
      box-shadow: 0 0 8px #F59E0B;
    }
    @keyframes pulse-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.85); }
    }

    /* Zoom control styling matching image */
    .leaflet-control-zoom {
      border: none !important;
      box-shadow: 0 2px 10px rgba(0,0,0,0.15) !important;
      border-radius: 8px !important;
      overflow: hidden !important;
      margin-right: 14px !important;
      margin-bottom: 24px !important;
    }
    .leaflet-control-zoom a {
      background: #FFFFFF !important;
      color: #0F172A !important;
      font-weight: 800 !important;
      font-size: 16px !important;
      width: 32px !important;
      height: 32px !important;
      line-height: 32px !important;
      border-bottom: 1px solid #E2E8F0 !important;
    }
    .leaflet-control-zoom a:hover {
      background: #F8FAFC !important;
      color: #1E63F0 !important;
    }
    .leaflet-control-attribution,
    .leaflet-control-attribution a,
    div[class*="attrib"] {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
      width: 0 !important;
      height: 0 !important;
    }
    .mappls-brand-badge {
      position: absolute !important;
      bottom: 8px !important;
      left: 8px !important;
      z-index: 99999 !important;
      display: inline-flex !important;
      align-items: center !important;
      background: #FFFFFF !important;
      padding: 3px 8px !important;
      border-radius: 4px !important;
      box-shadow: 0 1px 4px rgba(0,0,0,0.22) !important;
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
    }
    .mappls-brand-badge .dot-accent {
      color: #DC2626;
      margin-right: 4px;
    }
    .mappls-brand-badge .sub-accent {
      color: #64748B;
      font-size: 10px;
      font-weight: 600;
      border-left: 1px solid #CBD5E1;
      padding-left: 4px;
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
    var map = L.map('map', {
      center: [${centerLat}, ${centerLon}],
      zoom: ${centerZoom},
      zoomControl: true,
      attributionControl: false
    });

    var osmTile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      attribution: ''
    }).addTo(map);

    osmTile.on('tileerror', function(error, tile) {
      if (tile && !tile.dataset.fallback) {
        tile.dataset.fallback = 'true';
        var z = error.coords.z;
        var x = error.coords.x;
        var y = error.coords.y;
        tile.src = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/' + z + '/' + y + '/' + x;
      }
    });

    var substations = ${substationsData};
    var technicians = ${techniciansData};
    var techMarkers = {};

    // 1. Render Substation Geofence & Label Pin
    substations.forEach(function(sub) {
      if (sub.lat && sub.lon) {
        // Geofence Circle
        L.circle([sub.lat, sub.lon], {
          radius: sub.radius || 500,
          color: '#DC2626',
          weight: 1.5,
          opacity: 0.65,
          fillColor: '#DC2626',
          fillOpacity: 0.08,
          dashArray: '4, 4'
        }).addTo(map);

        // Center Pin
        var subIcon = L.divIcon({
          className: '',
          html: '<div class="substation-marker">' +
                '<svg viewBox="0 0 24 24"><path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z"/></svg>' +
                '<span>' + sub.name + '</span>' +
                '</div>',
          iconSize: [140, 32],
          iconAnchor: [70, 16]
        });

        L.marker([sub.lat, sub.lon], { icon: subIcon, zIndexOffset: 500 })
          .addTo(map)
          .bindPopup('<b>' + sub.name + '</b><br>' + sub.code + '<br>Radius: ' + (sub.radius || 500) + 'm');
      }
    });

    // 2. Render Technician Markers with Dark Pill
    technicians.forEach(function(tech) {
      if (tech.lat && tech.lon) {
        var dotClass = tech.color === 'amber' ? 'tech-dot amber' : 'tech-dot';
        var selectedClass = tech.isSelected ? 'tech-marker selected' : 'tech-marker';

        var techIcon = L.divIcon({
          className: '',
          html: '<div id="tech-marker-' + tech.id + '" class="' + selectedClass + '">' +
                '<div class="' + dotClass + '"></div>' +
                '<span>' + tech.name + '</span>' +
                '</div>',
          iconSize: [120, 32],
          iconAnchor: [60, 16]
        });

        var marker = L.marker([tech.lat, tech.lon], {
          icon: techIcon,
          zIndexOffset: tech.isSelected ? 1000 : 800
        }).addTo(map);

        marker.on('click', function() {
          window.parent.postMessage({ type: 'SELECT_TECHNICIAN', techId: tech.id }, '*');
        });

        techMarkers[tech.id] = marker;
      }
    });

    // Handle messages from React Native
    window.addEventListener('message', function(event) {
      if (!event.data) return;
      if (event.data.type === 'PAN_TO') {
        map.flyTo([event.data.lat, event.data.lon], event.data.zoom || 16, {
          animate: true,
          duration: 1.2
        });
      } else if (event.data.type === 'VIEW_ALL') {
        var group = [];
        substations.forEach(function(s) { if (s.lat && s.lon) group.push([s.lat, s.lon]); });
        technicians.forEach(function(t) { if (t.lat && t.lon) group.push([t.lat, t.lon]); });
        if (group.length > 0) {
          map.fitBounds(group, { padding: [40, 40] });
        }
      }
    });
  </script>
</body>
</html>
    `;
  }, [substations, activeTechs, selectedTech, center]);

  // Handle message from iframe when a marker is clicked
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SELECT_TECHNICIAN' && onSelectTech) {
        const found = technicians.find((t) => t.id === event.data.techId);
        if (found) {
          onSelectTech(found);
        }
      }
    };

    if (Platform.OS === 'web') {
      window.addEventListener('message', handleWindowMessage);
      return () => window.removeEventListener('message', handleWindowMessage);
    }
  }, [technicians, onSelectTech]);

  // Send pan command to iframe when selectedTech changes
  useEffect(() => {
    if (selectedTech?.latitude && selectedTech?.longitude && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'PAN_TO',
          lat: selectedTech.latitude,
          lon: selectedTech.longitude,
          zoom: 17,
        },
        '*'
      );
    }
  }, [selectedTech]);

  return (
    <View style={[styles.container, style]}>
      <iframe
        ref={iframeRef as any}
        srcDoc={htmlContent}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
        title="Field Force Live Leaflet Map"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
});

export default LeafletMapView;
