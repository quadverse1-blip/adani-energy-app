import React, { useRef, useImperativeHandle, forwardRef, useMemo, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView as RNWebView } from 'react-native-webview';

const WebViewComponent: any = RNWebView;

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface MapViewProps {
  style?: any;
  initialRegion?: Region;
  region?: Region;
  children?: React.ReactNode;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  showsCompass?: boolean;
  provider?: string;
  mapType?: string;
  onPress?: (e: any) => void;
  onRegionChangeComplete?: (region: Region) => void;
}

export const PROVIDER_GOOGLE = 'default';
export const PROVIDER_DEFAULT = 'default';
export const PROVIDER_MAPPLS = 'mappls';

export interface MarkerProps {
  coordinate: LatLng;
  title?: string;
  description?: string;
  pinColor?: string;
  zIndex?: number;
  draggable?: boolean;
  onPress?: () => void;
  onDragEnd?: (e: any) => void;
  anchor?: { x: number; y: number };
  children?: React.ReactNode;
}
export const Marker: React.FC<MarkerProps> = () => null;

export interface CircleProps {
  center: LatLng;
  radius: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  zIndex?: number;
}
export const Circle: React.FC<CircleProps> = () => null;

export interface PolylineProps {
  coordinates: LatLng[];
  strokeColor?: string;
  strokeWidth?: number;
  lineDashPattern?: number[];
  lineCap?: string;
  lineJoin?: string;
  zIndex?: number;
}
export const Polyline: React.FC<PolylineProps> = () => null;

export const Callout: React.FC<any> = () => null;
export const Polygon: React.FC<any> = () => null;
export const Overlay: React.FC<any> = () => null;
export const Geojson: React.FC<any> = () => null;
export const UrlTile: React.FC<any> = () => null;
export const AnimatedRegion: any = class {};

export interface MapViewRef {
  animateToRegion: (region: Partial<Region>, duration?: number) => void;
  fitToCoordinates: (coordinates: LatLng[], options?: any) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  recenter: (lat?: number, lon?: number) => void;
}

export type MapView = MapViewRef;

const MapViewComponent = forwardRef<MapViewRef, MapViewProps>(
  (
    {
      style,
      initialRegion = {
        latitude: 18.8524,
        longitude: 73.8844,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      region,
      children,
      onPress,
    },
    ref
  ) => {
    const webViewRef = useRef<any>(null);

    const activeCenter = region || initialRegion;
    const centerLat = Number(activeCenter?.latitude) || 18.8524;
    const centerLon = Number(activeCenter?.longitude) || 73.8844;
    const initialZoom = activeCenter?.latitudeDelta
      ? Math.max(Math.min(16 - Math.log2(activeCenter.latitudeDelta * 111), 18), 5)
      : 14;

    useImperativeHandle(ref, () => ({
      zoomIn: () => {
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript('if (window.map) { window.map.zoomIn(); } true;');
        }
      },
      zoomOut: () => {
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript('if (window.map) { window.map.zoomOut(); } true;');
        }
      },
      recenter: (lat?: number, lon?: number) => {
        const cLat = lat || centerLat;
        const cLon = lon || centerLon;
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`if (window.map) { window.map.flyTo([${cLat}, ${cLon}], 15, { duration: 0.4 }); } true;`);
        }
      },
      animateToRegion: (targetRegion: Partial<Region>, duration = 500) => {
        if (!targetRegion.latitude || !targetRegion.longitude) return;
        const zoom = targetRegion.latitudeDelta
          ? Math.max(Math.min(16 - Math.log2(targetRegion.latitudeDelta * 111), 19), 5)
          : 15;
        if (webViewRef.current) {
          const durSec = duration / 1000;
          webViewRef.current.injectJavaScript(`if (window.map) { window.map.flyTo([${targetRegion.latitude}, ${targetRegion.longitude}], ${zoom}, { duration: ${durSec} }); } true;`);
        }
      },
      fitToCoordinates: (coords: LatLng[], options?: any) => {
        if (!coords || coords.length === 0) return;
        if (coords.length === 1) {
          const c = coords[0];
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(`if (window.map) { window.map.flyTo([${c.latitude}, ${c.longitude}], 15, { duration: 0.5 }); } true;`);
          }
          return;
        }

        const lats = coords.map((c) => c.latitude).filter((n) => typeof n === 'number' && isFinite(n));
        const lons = coords.map((c) => c.longitude).filter((n) => typeof n === 'number' && isFinite(n));
        if (lats.length === 0 || lons.length === 0) return;

        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        const pad = options?.edgePadding?.top || 40;

        if (webViewRef.current) {
          const script = `
            if (window.map && window.L) {
              var b = window.L.latLngBounds([[${minLat}, ${minLon}], [${maxLat}, ${maxLon}]]);
              window.map.fitBounds(b, { padding: [${pad}, ${pad}], maxZoom: 17 });
            }
            true;
          `;
          webViewRef.current.injectJavaScript(script);
        }
      },
    }));

    const lastRegionRef = useRef<string>('');
    useEffect(() => {
      if (region && typeof region.latitude === 'number' && typeof region.longitude === 'number') {
        const key = `${region.latitude.toFixed(5)},${region.longitude.toFixed(5)}`;
        if (key !== lastRegionRef.current) {
          lastRegionRef.current = key;
          const zoom = region.latitudeDelta
            ? Math.max(Math.min(16 - Math.log2(region.latitudeDelta * 111), 19), 5)
            : 15;
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(`if (window.map) { window.map.flyTo([${region.latitude}, ${region.longitude}], ${zoom}, { duration: 0.4 }); } true;`);
          }
        }
      }
    }, [region]);

    const { markers, circles, polylines } = useMemo(() => {
      const parsedMarkers: any[] = [];
      const parsedCircles: any[] = [];
      const parsedPolylines: any[] = [];

      const flattenChildren = (ch: React.ReactNode): React.ReactElement[] => {
        const result: React.ReactElement[] = [];
        React.Children.forEach(ch, (child) => {
          if (!React.isValidElement(child)) return;
          if (child.type === React.Fragment) {
            result.push(...flattenChildren((child.props as any)?.children));
          } else {
            result.push(child);
          }
        });
        return result;
      };

      const allChildren = flattenChildren(children);

      allChildren.forEach((child) => {
        const typeName = (child.type as any)?.name || (child.type as any)?.displayName || '';
        const props: any = child.props || {};

        if (typeName === 'Marker' || props.coordinate) {
          const lat = Number(props.coordinate?.latitude);
          const lon = Number(props.coordinate?.longitude);
          if (isFinite(lat) && isFinite(lon)) {
            parsedMarkers.push({
              lat,
              lon,
              title: props.title || '',
              description: props.description || '',
              color: props.pinColor || '#1E63F0',
              draggable: Boolean(props.draggable),
              anchor: props.anchor,
              onPress: props.onPress,
              onDragEnd: props.onDragEnd,
            });
          }
        } else if (typeName === 'Circle' || props.radius) {
          const lat = Number(props.center?.latitude);
          const lon = Number(props.center?.longitude);
          if (isFinite(lat) && isFinite(lon)) {
            parsedCircles.push({
              lat,
              lon,
              radius: Number(props.radius) || 500,
              fillColor: props.fillColor || 'rgba(16, 185, 129, 0.2)',
              strokeColor: props.strokeColor || '#10B981',
              strokeWidth: Number(props.strokeWidth) || 2,
            });
          }
        } else if (typeName === 'Polyline' || props.coordinates) {
          if (Array.isArray(props.coordinates) && props.coordinates.length > 0) {
            const validCoords = props.coordinates
              .map((c: any) => [Number(c.longitude), Number(c.latitude)])
              .filter(([lon, lat]: [number, number]) => isFinite(lon) && isFinite(lat));

            if (validCoords.length >= 2) {
              parsedPolylines.push({
                coordinates: validCoords,
                strokeColor: props.strokeColor || '#1E63F0',
                strokeWidth: Number(props.strokeWidth) || 4,
              });
            }
          }
        }
      });

      return { markers: parsedMarkers, circles: parsedCircles, polylines: parsedPolylines };
    }, [children]);

    const html = useMemo(() => {
      const markersJson = JSON.stringify(
        markers.map((m, idx) => ({
          idx,
          lat: m.lat,
          lon: m.lon,
          title: m.title,
          description: m.description,
          color: m.color,
          draggable: m.draggable,
        }))
      );
      const circlesJson = JSON.stringify(
        circles.map((c) => ({
          lat: c.lat,
          lon: c.lon,
          radius: c.radius,
          fillColor: c.fillColor,
          strokeColor: c.strokeColor,
          strokeWidth: c.strokeWidth,
        }))
      );
      const polylinesJson = JSON.stringify(
        polylines.map((p) => ({
          coordinates: p.coordinates,
          color: p.strokeColor,
          width: p.strokeWidth,
        }))
      );

      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=10.0, minimum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" onerror="this.onerror=null;this.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" onerror="var s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';document.head.appendChild(s);"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #F1F5F9;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
    }
    
    .leaflet-control-attribution,
    .leaflet-control-zoom {
      display: none !important;
      visibility: hidden !important;
    }

    .mappls-brand-badge {
      position: absolute !important;
      bottom: 12px !important;
      left: 10px !important;
      z-index: 9999 !important;
      display: inline-flex !important;
      align-items: center !important;
      background: #FFFFFF !important;
      padding: 5px 10px !important;
      border-radius: 6px !important;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2) !important;
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

    .map-controls-group {
      position: absolute;
      right: 12px;
      bottom: 12px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .map-control-btn {
      width: 38px;
      height: 38px;
      background: #FFFFFF;
      border: 1px solid #CBD5E1;
      border-radius: 8px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.18);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 19px;
      font-weight: 700;
      color: #1E293B;
      cursor: pointer;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    .map-control-btn:active {
      background: #F1F5F9;
      transform: scale(0.96);
    }

    .leaflet-div-icon {
      background: transparent !important;
      border: none !important;
    }

    .site-marker-pin {
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
    }
    .site-marker-box {
      background: #DC2626;
      color: #FFFFFF;
      padding: 4px 9px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      font-weight: 700;
      box-shadow: 0 2px 6px rgba(220, 38, 38, 0.45);
      border: 1.5px solid #FFFFFF;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .site-marker-stem {
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 6px solid #DC2626;
    }

    .user-marker-pin {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .user-pulse-ring {
      position: absolute;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(37, 99, 235, 0.25);
      border: 1.5px solid rgba(37, 99, 235, 0.6);
      animation: user-radar 2s infinite ease-out;
      pointer-events: none;
      top: 50%;
      left: 50%;
      margin-top: -18px;
      margin-left: -18px;
    }
    @keyframes user-radar {
      0% { transform: scale(0.5); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }
    .user-center-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #2563EB;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      z-index: 2;
    }
    .user-badge-label {
      margin-top: 3px;
      background: #1E293B;
      color: #FFFFFF;
      padding: 2px 6px;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 10px;
      font-weight: 700;
      white-space: nowrap;
      border: 1px solid #FFFFFF;
      box-shadow: 0 1px 3px rgba(0,0,0,0.25);
      z-index: 3;
    }

    .dist-marker-tag {
      background: #FFFFFF;
      color: #1E40AF;
      padding: 3px 8px;
      border-radius: 10px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 10px;
      font-weight: 800;
      border: 1.5px solid #93C5FD;
      box-shadow: 0 2px 5px rgba(0,0,0,0.18);
      white-space: nowrap;
      display: inline-block;
    }

    .poi-marker-pin {
      background: #FFFFFF;
      color: #0F172A;
      padding: 3px 7px;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 10px;
      font-weight: 700;
      border: 1.5px solid #CBD5E1;
      box-shadow: 0 2px 4px rgba(0,0,0,0.18);
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 3px;
    }

    @keyframes map-spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div id="map"></div>

  <div id="map-loader" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:-apple-system,sans-serif;font-size:12px;font-weight:600;color:#64748B;display:flex;align-items:center;gap:6px;pointer-events:none;z-index:1000;">
    <span style="display:inline-block;width:14px;height:14px;border:2px solid #CBD5E1;border-top-color:#1E63F0;border-radius:50%;animation:map-spin 0.8s linear infinite;"></span>
    <span>Loading Map...</span>
  </div>
  
  <div class="mappls-brand-badge">
    <span class="logo-accent">Mappls</span><span class="dot-accent">●</span>
    <span class="sub-accent">MapmyIndia</span>
  </div>

  <div class="map-controls-group">
    <button class="map-control-btn" id="btnZoomIn" title="Zoom In">+</button>
    <button class="map-control-btn" id="btnZoomOut" title="Zoom Out">−</button>
    <button class="map-control-btn" id="btnRecenter" title="Recenter" style="font-size: 16px;">⌖</button>
  </div>

  <script>
    var markersData = ${markersJson};
    var circlesData = ${circlesJson};
    var polylinesData = ${polylinesJson};
    var centerLat = ${centerLat};
    var centerLon = ${centerLon};
    var initialZoom = ${initialZoom};

    var attempts = 0;
    function startMap() {
      if (typeof window.L === 'undefined') {
        attempts++;
        if (attempts === 40) {
          var s2 = document.createElement('script');
          s2.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
          document.head.appendChild(s2);
        }
        setTimeout(startMap, 50);
        return;
      }

      try {
        var loader = document.getElementById('map-loader');
        if (loader) loader.style.display = 'none';

        var map = L.map('map', {
          center: [centerLat, centerLon],
          zoom: initialZoom,
          minZoom: 4,
          maxZoom: 19,
          zoomControl: false,
          attributionControl: false
        });

        window.map = map;
        window.L = L;

        // Primary: CartoDB Voyager Retina
        var primaryTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          subdomains: 'abcd',
          maxZoom: 20,
          r: window.devicePixelRatio > 1 ? '@2x' : ''
        });

        // Fallback: OpenStreetMap
        var osmFallback = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          subdomains: 'abc',
          maxZoom: 19
        });

        var tileLoaded = false;
        primaryTiles.on('tileload', function() { tileLoaded = true; });
        primaryTiles.addTo(map);

        setTimeout(function() {
          if (!tileLoaded) {
            try { osmFallback.addTo(map); } catch(e){}
          }
        }, 2200);

        // Circles (Geofences)
        circlesData.forEach(function(c) {
          L.circle([c.lat, c.lon], {
            radius: c.radius,
            color: c.strokeColor || '#10B981',
            fillColor: c.fillColor || 'rgba(16, 185, 129, 0.2)',
            fillOpacity: 0.25,
            weight: c.strokeWidth || 2
          }).addTo(map);
        });

        // Polylines (Road routes)
        polylinesData.forEach(function(p) {
          if (!p.coordinates || p.coordinates.length < 2) return;
          var latLngs = p.coordinates.map(function(c) { return [c[1], c[0]]; });
          L.polyline(latLngs, {
            color: p.color || '#1E63F0',
            weight: p.width || 4,
            lineJoin: 'round',
            lineCap: 'round',
            opacity: 0.9
          }).addTo(map);
        });

        // Markers
        markersData.forEach(function(m) {
          var titleLower = (m.title || '').toLowerCase();
          var isSite = titleLower.indexOf('site') !== -1 || titleLower.indexOf('substation') !== -1;
          var isUser = titleLower.indexOf('device') !== -1 || titleLower.indexOf('my location') !== -1 || titleLower.indexOf('my') !== -1;
          var isDist = /^\\d+(\\.\\d+)?\\s*(m|km)$/i.test(m.title || '') || titleLower.indexOf('away') !== -1;

          var iconHtml = '';
          var iconSize = [30, 30];
          var iconAnchor = [15, 15];

          if (isSite) {
            var cleanName = (m.title || 'Site').replace(/^Site:\\s*/i, '');
            iconHtml = '<div class="site-marker-pin"><div class="site-marker-box"><span>⚡</span><span>' + cleanName + '</span></div><div class="site-marker-stem"></div></div>';
            iconSize = [140, 38];
            iconAnchor = [70, 38];
          } else if (isUser) {
            iconHtml = '<div class="user-marker-pin"><div class="user-pulse-ring"></div><div class="user-center-dot"></div><div class="user-badge-label">📍 My Location</div></div>';
            iconSize = [100, 60];
            iconAnchor = [50, 30];
          } else if (isDist) {
            iconHtml = '<div class="dist-marker-tag">⤹ ' + m.title + '</div>';
            iconSize = [90, 26];
            iconAnchor = [45, 13];
          } else {
            var dotColor = m.color || '#10B981';
            iconHtml = '<div class="poi-marker-pin" style="border-color:' + dotColor + ';"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:' + dotColor + '; margin-right:4px;"></span><span>' + (m.title || 'Personnel') + '</span></div>';
            iconSize = [110, 28];
            iconAnchor = [55, 28];
          }

          var customIcon = L.divIcon({
            className: 'custom-map-icon',
            html: iconHtml,
            iconSize: iconSize,
            iconAnchor: iconAnchor
          });

          var marker = L.marker([m.lat, m.lon], {
            icon: customIcon,
            draggable: Boolean(m.draggable)
          });

          if (m.title || m.description) {
            var popupContent = '<div style="padding:6px 8px; font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif; min-width:130px;">' +
              '<div style="font-weight:700; font-size:12px; color:#0F172A; margin-bottom:2px;">' + (m.title || '') + '</div>' +
              (m.description ? '<div style="font-size:11px; color:#475569; line-height:1.35;">' + m.description + '</div>' : '') +
              '</div>';
            marker.bindPopup(popupContent, { offset: [0, -iconAnchor[1] / 2] });
          }

          marker.on('click', function(ev) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'markerPress',
                index: m.idx,
                title: m.title,
                lat: m.lat,
                lon: m.lon
              }));
            }
          });

          if (m.draggable) {
            marker.on('dragend', function(ev) {
              var pos = ev.target.getLatLng();
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'markerDragEnd',
                  index: m.idx,
                  coordinate: { latitude: pos.lat, longitude: pos.lng }
                }));
              }
            });
          }

          marker.addTo(map);
        });

        // Map Click
        map.on('click', function(e) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'mapPress',
              coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng }
            }));
          }
        });

        // Controls
        document.getElementById('btnZoomIn').addEventListener('click', function(e) {
          e.stopPropagation();
          map.zoomIn();
        });
        document.getElementById('btnZoomOut').addEventListener('click', function(e) {
          e.stopPropagation();
          map.zoomOut();
        });
        document.getElementById('btnRecenter').addEventListener('click', function(e) {
          e.stopPropagation();
          map.flyTo([centerLat, centerLon], initialZoom, { duration: 0.4 });
        });

        // Invalidate size for Modals, Tabs, BottomSheets
        setTimeout(function() { try { map.invalidateSize(); } catch(e){} }, 100);
        setTimeout(function() { try { map.invalidateSize(); } catch(e){} }, 300);
        setTimeout(function() { try { map.invalidateSize(); } catch(e){} }, 800);
        window.addEventListener('resize', function() { try { map.invalidateSize(); } catch(e){} });

      } catch (err) {
        console.warn('[Leaflet Map Init Error]', err);
      }
    }
    startMap();
  </script>
</body>
</html>`;
    }, [markers, circles, polylines, centerLat, centerLon, initialZoom]);

    return (
      <View style={[styles.container, style]}>
        <WebViewComponent
          ref={webViewRef}
          source={{ html, baseUrl: 'https://maps.mappls.com' }}
          style={StyleSheet.absoluteFill}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scrollEnabled={false}
          nestedScrollEnabled={false}
          overScrollMode="never"
          bounces={false}
          originWhitelist={['*']}
          mixedContentMode="always"
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          androidLayerType="hardware"
          onMessage={(event: any) => {
            try {
              const raw = event.nativeEvent?.data;
              if (!raw) return;
              const msg = JSON.parse(raw);
              if (msg.type === 'markerPress') {
                const target = markers[msg.index];
                if (target && target.onPress) {
                  target.onPress();
                }
              } else if (msg.type === 'markerDragEnd') {
                const target = markers[msg.index];
                if (target && target.onDragEnd) {
                  target.onDragEnd({ nativeEvent: { coordinate: msg.coordinate } });
                } else if (onPress) {
                  onPress({ nativeEvent: { coordinate: msg.coordinate } });
                }
              } else if (msg.type === 'mapPress' && onPress) {
                onPress({ nativeEvent: { coordinate: msg.coordinate } });
              }
            } catch (err) {
              // ignore
            }
          }}
          onError={(err: any) => console.warn('[AppMapView] WebView error:', err)}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    flex: 1,
    minHeight: 120,
    width: '100%',
  },
  defaultPin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1E63F0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  defaultPinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
});

MapViewComponent.displayName = 'AppMapView';

export default MapViewComponent;
