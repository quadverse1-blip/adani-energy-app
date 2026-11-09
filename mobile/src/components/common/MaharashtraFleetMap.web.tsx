import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
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
import { routingService, RoadRouteResponse } from '../../services/routingService';
import { placesService, NearbyPlace, PlaceCategory } from '../../services/placesService';

export interface MaharashtraFleetMapProps {
  substations: Substation[];
  technicians: FleetTechnician[];
  selectedTech: FleetTechnician | null;
  onSelectTech?: (tech: FleetTechnician) => void;
  style?: any;
  showDistrictSelector?: boolean;
}

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
  substations = [],
  technicians = [],
  selectedTech,
  onSelectTech,
  style,
  showDistrictSelector = true,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const resizeObserverRef = useRef<any>(null);

  const [sdkStatus, setSdkStatus] = useState<'loading' | 'ready'>('loading');
  const [activeDistrict, setActiveDistrict] = useState<string>('Entire State');

  // Inspector card for clicked technician
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

  // Count telemetry metrics
  const validGpsTechs = useMemo(
    () => technicians.filter((t) => t.hasGps && t.latitude !== null && t.longitude !== null),
    [technicians]
  );
  const liveCount = useMemo(
    () => validGpsTechs.filter((t) => t.isLive || t.isOnline || t.status === 'online').length,
    [validGpsTechs]
  );
  const lastKnownCount = useMemo(
    () => validGpsTechs.length - liveCount,
    [validGpsTechs, liveCount]
  );

  // 1. Initialize Mappls Vector Map Engine immediately and ensure permanent visibility
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;

    const rasterFallbackStyle = {
      version: 8,
      sources: {
        'osm-raster-tiles': {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '',
        },
      },
      layers: [
        {
          id: 'osm-raster-layer',
          type: 'raster',
          source: 'osm-raster-tiles',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    };

    const initMap = async () => {
      if (typeof window === 'undefined') return;

      const container = containerRef.current;
      if (!container) {
        if (retryCount < 20 && isMounted) {
          retryCount++;
          setTimeout(initMap, 100);
        }
        return;
      }

      // Ensure MapLibre runtime is injected once
      if (!(window as any).maplibregl) {
        if (!document.getElementById('maplibre-gl-css')) {
          const cssLink = document.createElement('link');
          cssLink.id = 'maplibre-gl-css';
          cssLink.rel = 'stylesheet';
          cssLink.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
          document.head.appendChild(cssLink);
        }

        if (!document.getElementById('maplibre-gl-js')) {
          await new Promise<void>((resolve, reject) => {
            const glScript = document.createElement('script');
            glScript.id = 'maplibre-gl-js';
            glScript.src = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
            glScript.onload = () => resolve();
            glScript.onerror = () => reject(new Error('Failed to load Vector engine'));
            document.head.appendChild(glScript);
          });
        }
      }

      if (!isMounted) return;

      const maplibregl = (window as any).maplibregl;
      if (!maplibregl || !containerRef.current) return;

      // Permanently stub out AttributionControl to ensure 100% elimination of forbidden attributions
      if (maplibregl.AttributionControl) {
        maplibregl.AttributionControl = function () {
          return {
            onAdd: function () {
              const el = document.createElement('div');
              el.style.display = 'none';
              return el;
            },
            onRemove: function () {},
          };
        };
      }

      // Clean container if previously initialized
      if (mapInstanceRef.current?.map) {
        try {
          mapInstanceRef.current.map.remove();
        } catch {}
        mapInstanceRef.current = null;
      }

      const initialLat = selectedTech?.latitude || MAHARASHTRA_CENTER.latitude;
      const initialLon = selectedTech?.longitude || MAHARASHTRA_CENTER.longitude;
      const initialZoom = selectedTech?.latitude ? 14 : MAHARASHTRA_CENTER.zoom;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [initialLon, initialLat],
        zoom: initialZoom,
        minZoom: 4,
        maxZoom: 20,
        attributionControl: false,
        customAttribution: [],
        dragPan: true,
        scrollZoom: true,
        touchZoomRotate: true,
      });

      let isVectorStyleLoaded = false;
      map.on('style.load', () => {
        isVectorStyleLoaded = true;
        purgeAttribution();
        map.resize();
      });

      // 2.5s Watchdog fallback: switch to ultra-reliable raster tiles if vector style hangs
      setTimeout(() => {
        if (!isVectorStyleLoaded && isMounted) {
          console.warn('[Mappls Web] Vector style timeout, switching to raster fallback...');
          try {
            map.setStyle(rasterFallbackStyle);
          } catch (e) {}
        }
      }, 2500);

      map.on('error', (e: any) => {
        if (!isVectorStyleLoaded && e && e.error && isMounted) {
          console.warn('[Mappls Web] Style load error, applying raster fallback:', e.error);
          try {
            map.setStyle(rasterFallbackStyle);
          } catch (err) {}
        }
      });

      // Strict attribution suppression
      const purgeAttribution = () => {
        if (!containerRef.current) return;
        containerRef.current
          .querySelectorAll(
            '.maplibregl-ctrl-attrib, .mapboxgl-ctrl-attrib, a[href*="maplibre"], a[href*="openfreemap"], a[href*="openstreetmap"], a[href*="openmaptiles"]'
          )
          .forEach((el) => {
            if (el && el.parentNode) el.parentNode.removeChild(el);
          });
      };

      map.on('load', () => {
        purgeAttribution();
        map.resize();
        setSdkStatus('ready');
      });
      map.on('render', purgeAttribution);

      // Interactive Map Click: Load nearby real-world places around clicked coordinate
      map.on('click', (e: any) => {
        if (!e || !e.lngLat) return;
        handleFetchWebNearby(e.lngLat.lat, e.lngLat.lng);
      });

      // Force multiple resizes across layout settling ticks
      setTimeout(() => {
        if (map && map.resize) map.resize();
      }, 100);
      setTimeout(() => {
        if (map && map.resize) map.resize();
      }, 300);
      setTimeout(() => {
        if (map && map.resize) map.resize();
      }, 600);

      // Attach ResizeObserver to automatically resize map when container dimensions change
      if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
        try {
          if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
          const ro = new ResizeObserver(() => {
            if (map && map.resize) {
              map.resize();
            }
          });
          ro.observe(containerRef.current);
          resizeObserverRef.current = ro;
        } catch {}
      }

      mapInstanceRef.current = {
        map,
        setCenter: (lat: number, lon: number, zoom?: number) => {
          map.flyTo({ center: [lon, lat], zoom: zoom || 15, duration: 600 });
        },
        zoomIn: () => map.zoomIn({ duration: 250 }),
        zoomOut: () => map.zoomOut({ duration: 250 }),
        resize: () => map.resize(),
      };

      // Set ready immediately to prevent loading overlay from blocking the view
      setSdkStatus('ready');
    };

    // Execute immediately on mount
    initMap();

    // Safety watchdog: ensure loading overlay never stays visible past 1.5s
    const readyTimer = setTimeout(() => {
      if (isMounted) setSdkStatus('ready');
    }, 1500);

    return () => {
      isMounted = false;
      clearTimeout(readyTimer);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (mapInstanceRef.current?.map) {
        try {
          mapInstanceRef.current.map.remove();
        } catch {}
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Render Substation Geofences and Markers
  useEffect(() => {
    if (sdkStatus !== 'ready' || !mapInstanceRef.current) return;
    const { map } = mapInstanceRef.current;
    const maplibregl = (window as any).maplibregl;
    if (!maplibregl || !map) return;

    // Clear previous substation markers and circle layers
    Object.keys(markersRef.current).forEach((key) => {
      if (key.startsWith('sub-')) {
        if (markersRef.current[key]?.remove) markersRef.current[key].remove();
        delete markersRef.current[key];
      }
    });

    substations.forEach((sub, idx) => {
      if (!sub.latitude || !sub.longitude) return;

      const circleSourceId = `sub-circle-src-${sub.id || idx}`;
      const circleFillId = `sub-circle-fill-${sub.id || idx}`;
      const circleLineId = `sub-circle-line-${sub.id || idx}`;

      // Remove existing sources/layers if reloading
      if (map.getLayer(circleLineId)) map.removeLayer(circleLineId);
      if (map.getLayer(circleFillId)) map.removeLayer(circleFillId);
      if (map.getSource(circleSourceId)) map.removeSource(circleSourceId);

      const circleGeo = createCircleGeoJSON(
        [sub.longitude, sub.latitude],
        sub.radiusMeters || 500
      );

      try {
        map.addSource(circleSourceId, { type: 'geojson', data: circleGeo });
        map.addLayer({
          id: circleFillId,
          type: 'fill',
          source: circleSourceId,
          paint: { 'fill-color': '#DC2626', 'fill-opacity': 0.12 },
        });
        map.addLayer({
          id: circleLineId,
          type: 'line',
          source: circleSourceId,
          paint: {
            'line-color': '#DC2626',
            'line-width': 1.5,
            'line-dasharray': [3, 2],
          },
        });
      } catch {}

      // Substation Pin Element
      const el = document.createElement('div');
      el.style.cssText =
        'cursor:pointer;display:flex;align-items:center;background:#DC2626;color:#FFF;padding:3px 8px;border-radius:12px;font-family:sans-serif;font-size:11px;font-weight:700;box-shadow:0 2px 6px rgba(220,38,38,0.4);border:1.5px solid #FFF;white-space:nowrap;gap:4px;';
      el.innerHTML = `<span>⚡</span><span>${sub.name}</span>`;

      const popupHtml = `
        <div style="padding:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0F172A;min-width:210px;">
          <div style="font-size:9px;font-weight:800;color:#DC2626;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">⚡ Substation Facility</div>
          <div style="font-weight:800;font-size:14px;color:#0F172A;margin-bottom:2px;">${sub.name}</div>
          <div style="font-size:11px;color:#64748B;margin-bottom:6px;">${sub.code} • 500m Geofence Perimeter</div>
          <div style="background:#FEF2F2;border:1px solid #FCA5A5;padding:6px;border-radius:6px;font-size:10px;color:#991B1B;">
            <div>📍 <strong>Coordinates:</strong> ${Number(sub.latitude).toFixed(5)}, ${Number(sub.longitude).toFixed(5)}</div>
            ${sub.manager?.name ? `<div>👤 <strong>In-Charge:</strong> ${sub.manager.name}</div>` : ''}
            ${sub.manager?.phone ? `<div>📞 <strong>Contact:</strong> ${sub.manager.phone}</div>` : ''}
          </div>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 15 }).setHTML(popupHtml);

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([sub.longitude, sub.latitude])
        .setPopup(popup)
        .addTo(map);

      markersRef.current[`sub-${sub.id}`] = marker;
    });
  }, [sdkStatus, substations]);

  // 3. Render Technician Markers (Distinguishing Online / Live vs. Offline / Last Known)
  useEffect(() => {
    if (sdkStatus !== 'ready' || !mapInstanceRef.current) return;
    const { map } = mapInstanceRef.current;
    const maplibregl = (window as any).maplibregl;
    if (!maplibregl || !map) return;

    // Clear existing technician markers
    Object.keys(markersRef.current).forEach((key) => {
      if (key.startsWith('tech-')) {
        if (markersRef.current[key]?.remove) markersRef.current[key].remove();
        delete markersRef.current[key];
      }
    });

    technicians.forEach((tech) => {
      if (
        tech.latitude === null ||
        tech.latitude === undefined ||
        tech.longitude === null ||
        tech.longitude === undefined ||
        !tech.hasGps
      ) {
        return;
      }

      const lat = Number(tech.latitude);
      const lon = Number(tech.longitude);
      if (isNaN(lat) || isNaN(lon)) return;

      const isLive = Boolean(
        tech.isLive || tech.isOnline || tech.status === 'online' || tech.status === 'live_online'
      );

      const initials = (tech.name || 'T')
        .split(' ')
        .map((w) => w[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

      const badgeColor = isLive ? '#059669' : '#D97706';
      const statusBadgeText = isLive ? '🟢 ONLINE (LIVE GPS)' : '🕒 OFFLINE (LAST KNOWN)';
      const lastRecorded =
        tech.lastLocationUpdate ||
        (tech.lastLocationDate && tech.lastLocationTime
          ? `${tech.lastLocationDate} at ${tech.lastLocationTime}`
          : tech.lastSeen || 'Recent check-in');
      const locationText =
        tech.locationName ||
        (tech.assignedSiteName ? `Near ${tech.assignedSiteName}` : `${lat.toFixed(5)}, ${lon.toFixed(5)}`);

      // Custom Click Popup fulfilling all requirements:
      // Employee name, mobile number, status, last known location, and last updated time
      const popupHtml = `
        <div style="padding:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0F172A;min-width:240px;line-height:1.4;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:9px;font-weight:800;color:#FFF;background:${badgeColor};padding:2px 8px;border-radius:10px;letter-spacing:0.5px;">
              ${statusBadgeText}
            </span>
            <span style="font-size:10px;font-weight:700;color:#64748B;">${tech.employeeId}</span>
          </div>
          <div style="font-weight:800;font-size:15px;color:#0F172A;margin-bottom:2px;">${tech.name}</div>
          <div style="font-size:11px;color:#475569;margin-bottom:8px;">${tech.designation || 'Smart Meter Field Force'}</div>

          <div style="background:#F8FAFC;border:1px solid #E2E8F0;padding:8px;border-radius:8px;font-size:11px;color:#334155;display:flex;flex-direction:column;gap:5px;">
            <div>📞 <strong>Mobile:</strong> <a href="tel:${tech.phone || ''}" style="color:#2563EB;text-decoration:none;font-weight:700;">${tech.phone || 'Not Available'}</a></div>
            <div>📍 <strong>Location:</strong> <span style="font-weight:600;color:#0F172A;">${locationText}</span></div>
            <div>🕒 <strong>Last Updated:</strong> <span style="font-weight:600;color:#0F172A;">${lastRecorded}</span></div>
            <div>⚡ <strong>Assigned Site:</strong> <span style="font-weight:600;color:#0F172A;">${tech.assignedSiteName || 'General Field'}</span></div>
            <div>🎯 <strong>GPS Coordinates:</strong> <span style="font-family:monospace;font-size:10px;">${lat.toFixed(5)}, ${lon.toFixed(5)}</span></div>
          </div>
        </div>
      `;

      // Marker DOM Element
      const el = document.createElement('div');
      el.style.cssText = 'position:relative;cursor:pointer;';
      el.innerHTML = isLive
        ? `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;width:38px;height:38px;border-radius:50%;background:rgba(16,185,129,0.35);border:1.5px solid #10B981;animation:pulse 2s infinite;"></div>
            <div style="width:28px;height:28px;border-radius:50%;background:#059669;border:2.5px solid #FFF;display:flex;align-items:center;justify-content:center;color:#FFF;font-size:11px;font-weight:800;box-shadow:0 2px 6px rgba(0,0,0,0.35);z-index:2;">
              ${initials}
            </div>
          </div>
        `
        : `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;">
            <div style="width:26px;height:26px;border-radius:50%;background:#D97706;border:2.5px solid #FFF;display:flex;align-items:center;justify-content:center;color:#FFF;font-size:10px;font-weight:800;box-shadow:0 2px 5px rgba(0,0,0,0.25);">
              ${initials}
            </div>
          </div>
        `;

      const popup = new maplibregl.Popup({ offset: 18 }).setHTML(popupHtml);

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([lon, lat])
        .setPopup(popup)
        .addTo(map);

      el.addEventListener('click', () => {
        setInspectedTech(tech);
        if (onSelectTech) onSelectTech(tech);
      });

      markersRef.current[`tech-${tech.id}`] = marker;
    });

    // If a technician is currently selected, center the map on their location
    if (selectedTech?.hasGps && selectedTech?.latitude && selectedTech?.longitude) {
      map.flyTo({
        center: [Number(selectedTech.longitude), Number(selectedTech.latitude)],
        zoom: 15,
        duration: 500,
      });
    }
  }, [sdkStatus, technicians, selectedTech, onSelectTech]);

  // 4. Render Nearby Real-World POI Markers on Web Map
  useEffect(() => {
    if (sdkStatus !== 'ready' || !mapInstanceRef.current) return;
    const { map } = mapInstanceRef.current;
    const maplibregl = (window as any).maplibregl;
    if (!maplibregl || !map) return;

    // Clear previous POI markers
    Object.keys(markersRef.current).forEach((key) => {
      if (key.startsWith('poi-')) {
        if (markersRef.current[key]?.remove) markersRef.current[key].remove();
        delete markersRef.current[key];
      }
    });

    nearbyPlaces.forEach((p) => {
      if (!p.latitude || !p.longitude) return;

      const el = document.createElement('div');
      el.style.cssText = `
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${p.category_color || '#0284C7'};
        color: #FFFFFF;
        padding: 3px 8px;
        border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 11px;
        font-weight: 700;
        box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        border: 1.5px solid #FFFFFF;
        white-space: nowrap;
        gap: 4px;
      `;

      let glyph = '📍';
      if (p.category === 'healthcare') glyph = '🏥';
      else if (p.category === 'fuel') glyph = '⛽';
      else if (p.category === 'financial') glyph = '🏧';
      else if (p.category === 'food') glyph = '🍽️';
      else if (p.category === 'shop') glyph = '🛒';
      else if (p.category === 'transit') glyph = '🚆';
      else if (p.category === 'civic') glyph = '🏛️';
      else if (p.category === 'education') glyph = '🎓';

      el.innerHTML = `<span>${glyph}</span><span>${p.name}</span>`;

      const popupHtml = `
        <div style="padding:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0F172A;min-width:210px;line-height:1.4;">
          <div style="background:${p.category_color || '#0284C7'}20;color:${p.category_color || '#0284C7'};font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px;display:inline-block;margin-bottom:4px;text-transform:uppercase;">
            ${p.category_label || p.category}
          </div>
          <div style="font-weight:800;font-size:13px;color:#0F172A;margin-bottom:2px;">${p.name}</div>
          ${p.name_mr ? `<div style="font-size:11px;color:#64748B;margin-bottom:4px;">${p.name_mr}</div>` : ''}
          <div style="font-size:11px;color:#334155;margin-bottom:4px;">📍 <strong>Distance:</strong> ${p.formatted_distance}</div>
          <div style="font-size:10px;color:#64748B;line-height:1.3;margin-bottom:6px;">${p.address}</div>
          ${p.phone ? `<div style="font-size:11px;color:#2563EB;margin-bottom:4px;">📞 <a href="tel:${p.phone}" style="color:#2563EB;text-decoration:none;font-weight:700;">${p.phone}</a></div>` : ''}
          <a href="https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}" target="_blank" rel="noopener noreferrer" style="display:block;text-align:center;margin-top:6px;background:#2563EB;color:#FFFFFF;border-radius:6px;padding:6px;font-size:11px;font-weight:700;text-decoration:none;">🚗 Road Directions</a>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 15 }).setHTML(popupHtml);

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([p.longitude, p.latitude])
        .setPopup(popup)
        .addTo(map);

      el.addEventListener('click', () => {
        setSelectedPlace(p);
      });

      markersRef.current[`poi-${p.id}`] = marker;
    });
  }, [sdkStatus, nearbyPlaces]);

  // Center camera when selectedTech changes
  useEffect(() => {
    if (sdkStatus !== 'ready' || !mapInstanceRef.current || !selectedTech) return;
    if (selectedTech.latitude && selectedTech.longitude && selectedTech.hasGps) {
      mapInstanceRef.current.setCenter(Number(selectedTech.latitude), Number(selectedTech.longitude), 15);
    }
  }, [sdkStatus, selectedTech]);

  // District Quick Selection
  const handleSelectDistrict = (dist: (typeof MAHARASHTRA_DISTRICTS)[0]) => {
    setActiveDistrict(dist.name);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter(dist.lat, dist.lon, dist.zoom);
    }
  };

  // Zoom Controls
  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };
  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };
  const handleRecenter = () => {
    if (selectedTech && selectedTech.latitude && selectedTech.longitude) {
      mapInstanceRef.current?.setCenter(Number(selectedTech.latitude), Number(selectedTech.longitude), 15);
    } else {
      mapInstanceRef.current?.setCenter(MAHARASHTRA_CENTER.latitude, MAHARASHTRA_CENTER.longitude, 6);
    }
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

      {/* 2. Live Map Canvas Area */}
      <View style={styles.mapArea}>
        {/* DOM element directly rendered for Mappls Web Map */}
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: '#E2E8F0',
          }}
        />

        {/* Loading State Overlay */}
        {sdkStatus === 'loading' && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#1E63F0" />
            <Text style={styles.loadingOverlayText}>Initializing Mappls Web Fleet Radar...</Text>
            <Text style={styles.loadingOverlaySubtext}>
              Synchronizing real employee GPS telemetry ({technicians.length} personnel)
            </Text>
          </View>
        )}

        {/* Official Mappls Brand Badge (strictly replacing OpenStreetMap/MapLibre) */}
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            zIndex: 9999,
            display: 'inline-flex',
            alignItems: 'center',
            background: '#FFFFFF',
            padding: '4px 10px',
            borderRadius: '6px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '11px',
            fontWeight: 700,
            color: '#0F172A',
            border: '1px solid #CBD5E1',
            pointerEvents: 'none',
          }}
        >
          <span style={{ color: '#1E40AF', fontWeight: 800, marginRight: '2px', letterSpacing: '-0.2px' }}>
            Mappls
          </span>
          <span style={{ color: '#DC2626', fontWeight: 900, marginRight: '5px' }}>●</span>
          <span
            style={{
              color: '#64748B',
              fontSize: '10px',
              fontWeight: 600,
              borderLeft: '1px solid #CBD5E1',
              paddingLeft: '5px',
            }}
          >
            MapmyIndia
          </span>
        </div>

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
  loadingOverlay: {
    ...(StyleSheet.absoluteFill as any),
    backgroundColor: 'rgba(248, 250, 252, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    gap: 8,
  },
  loadingOverlayText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  loadingOverlaySubtext: {
    fontSize: 11,
    color: '#64748B',
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
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
    cursor: 'pointer',
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
    width: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 12,
    boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
    zIndex: 999,
  },
  techInspectorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
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
    padding: 2,
    cursor: 'pointer',
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
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  statusPillTextSmall: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  techInspectorDetails: {
    flexDirection: 'column',
    gap: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
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
