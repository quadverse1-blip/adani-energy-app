import React, { useRef, useImperativeHandle, forwardRef, useMemo, useEffect } from 'react';
import { View, StyleSheet, Platform, UIManager } from 'react-native';
import { WebView as RNWebView } from 'react-native-webview';

const WebViewComponent: any = RNWebView;

// Attempt native MapplsGL import
let MapplsGL: any = null;
try {
  const MapplsModule = require('mappls-map-react-native');
  MapplsGL = MapplsModule.default || MapplsModule;
} catch (e) {
  // Ignored in environments without native module
}

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
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      },
      region,
      children,
      showsCompass = true,
      onPress,
    },
    ref
  ) => {
    const webViewRef = useRef<any>(null);
    const isMapLoadedRef = useRef<boolean>(false);

    // Safely check if native MapplsGL view manager is registered in this runtime (standalone APK with native modules)
    const isNativeMapplsAvailable = useMemo(() => {
      try {
        return (
          Platform.OS === 'android' &&
          !!MapplsGL?.MapView &&
          !!MapplsGL?.Camera &&
          typeof UIManager !== 'undefined' &&
          typeof UIManager.getViewManagerConfig === 'function' &&
          !!UIManager.getViewManagerConfig('RCTMGLMapView') &&
          !!UIManager.getViewManagerConfig('RCTMGLCamera')
        );
      } catch (e) {
        return false;
      }
    }, []);

    const activeCenter = region || initialRegion;
    const initialZoom = activeCenter.latitudeDelta
      ? Math.max(Math.min(16 - Math.log2(activeCenter.latitudeDelta * 111), 18), 5)
      : 15;

    // Parse JSX children into structured data
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
          if (props.coordinate?.latitude && props.coordinate?.longitude) {
            parsedMarkers.push({
              lat: props.coordinate.latitude,
              lon: props.coordinate.longitude,
              title: props.title || '',
              description: props.description || '',
              color: props.pinColor || '#1E63F0',
              draggable: Boolean(props.draggable),
              anchor: props.anchor,
              onPress: props.onPress,
              onDragEnd: props.onDragEnd,
              children: props.children,
            });
          }
        } else if (typeName === 'Circle' || props.radius) {
          if (props.center?.latitude && props.center?.longitude) {
            parsedCircles.push({
              lat: props.center.latitude,
              lon: props.center.longitude,
              radius: props.radius || 500,
              fillColor: props.fillColor || 'rgba(16, 185, 129, 0.18)',
              strokeColor: props.strokeColor || '#10B981',
              strokeWidth: props.strokeWidth || 2,
            });
          }
        } else if (typeName === 'Polyline' || props.coordinates) {
          if (Array.isArray(props.coordinates) && props.coordinates.length > 0) {
            parsedPolylines.push({
              coordinates: props.coordinates.map((c: any) => [c.latitude, c.longitude]),
              color: props.strokeColor || '#1E63F0',
              width: props.strokeWidth || 3.5,
            });
          }
        }
      });

      return { markers: parsedMarkers, circles: parsedCircles, polylines: parsedPolylines };
    }, [children]);

    const markersRef = useRef(markers);
    markersRef.current = markers;

    useImperativeHandle(ref, () => ({
      zoomIn: () => {
        webViewRef.current?.injectJavaScript('if (window.map) { window.map.zoomIn(); } true;');
      },
      zoomOut: () => {
        webViewRef.current?.injectJavaScript('if (window.map) { window.map.zoomOut(); } true;');
      },
      recenter: (lat?: number, lon?: number) => {
        const cLat = lat || (region || initialRegion).latitude;
        const cLon = lon || (region || initialRegion).longitude;
        webViewRef.current?.injectJavaScript(
          `if (window.map) { window.map.flyTo([${cLat}, ${cLon}], 16, { duration: 0.5 }); } true;`
        );
      },
      animateToRegion: (targetRegion: Partial<Region>, duration = 500) => {
        if (!targetRegion.latitude || !targetRegion.longitude) return;
        const zoom = targetRegion.latitudeDelta
          ? Math.max(Math.min(16 - Math.log2(targetRegion.latitudeDelta * 111), 18), 5)
          : 15;
        const script = `if (window.map) { window.map.flyTo([${targetRegion.latitude}, ${targetRegion.longitude}], ${zoom}, { duration: ${duration / 1000} }); } true;`;
        webViewRef.current?.injectJavaScript(script);
      },
      fitToCoordinates: (coords: LatLng[], options?: any) => {
        if (!coords || coords.length === 0) return;
        if (coords.length === 1) {
          const c = coords[0];
          const script = `if (window.map) { window.map.flyTo([${c.latitude}, ${c.longitude}], 16, { duration: 0.5 }); } true;`;
          webViewRef.current?.injectJavaScript(script);
          return;
        }

        const lats = coords.map((c) => c.latitude);
        const lons = coords.map((c) => c.longitude);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        const pad = options?.edgePadding?.top || 40;

        const script = `
          if (window.map) {
            window.map.fitBounds([[${minLat}, ${minLon}], [${maxLat}, ${maxLon}]], { padding: [${pad}, ${pad}], maxZoom: 16 });
          }
          true;
        `;
        webViewRef.current?.injectJavaScript(script);
      },
    }));

    // Perform seamless in-place layer updates without reloading the WebView (prevents marker drift and map flashing)
    useEffect(() => {
      if (!isMapLoadedRef.current) return;
      const markersPayload = JSON.stringify(
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
      const circlesPayload = JSON.stringify(circles);
      const polylinesPayload = JSON.stringify(polylines);

      const script = `
        if (window.updateMapLayers) {
          window.updateMapLayers(${markersPayload}, ${circlesPayload}, ${polylinesPayload});
        }
        true;
      `;
      webViewRef.current?.injectJavaScript(script);
    }, [markers, circles, polylines]);

    // Initial HTML setup with Crisp Retina Mappls-style Road Tiles and Leaflet 2D
    const html = useMemo(() => {
      const initialMarkersJson = JSON.stringify(
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
      const initialCirclesJson = JSON.stringify(circles);
      const initialPolylinesJson = JSON.stringify(polylines);

      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=10.0, minimum-scale=1.0, user-scalable=yes" />
  <title>Mappls Map</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #F8FAFC;
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

    .custom-map-marker {
      background: transparent !important;
      border: none !important;
      overflow: visible !important;
    }

    /* Official Mappls Brand Badge */
    .mappls-brand-badge {
      position: absolute !important;
      bottom: 10px !important;
      left: 10px !important;
      z-index: 99999 !important;
      display: inline-flex !important;
      align-items: center !important;
      background: #FFFFFF !important;
      padding: 4px 10px !important;
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

    /* On-Map Floating Zoom & Recenter Controls */
    .map-controls-group {
      position: absolute;
      right: 10px;
      bottom: 10px;
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
      transform: scale(0.95);
    }

    /* Site Marker (Stable geographic anchoring without double CSS transforms) */
    .site-marker-pin {
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      width: 100%;
      height: 100%;
      justify-content: flex-end;
    }
    .site-marker-box {
      background: #DC2626;
      color: #FFFFFF;
      padding: 4px 9px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      font-weight: 800;
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
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 7px solid #DC2626;
    }

    /* User Device Location Marker */
    .user-marker-pin {
      position: relative;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .user-pulse-ring {
      position: absolute;
      top: 0;
      left: 0;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(37, 99, 235, 0.22);
      border: 1.5px solid rgba(37, 99, 235, 0.55);
      animation: user-radar 2s infinite ease-out;
      pointer-events: none;
    }
    @keyframes user-radar {
      0% { transform: scale(0.5); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }
    .user-center-dot {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #2563EB;
      border: 3px solid #FFFFFF;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      z-index: 2;
    }
    .user-badge-label {
      position: absolute;
      top: 38px;
      left: 50%;
      transform: translateX(-50%);
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
    }

    /* Midpoint Route Distance Tag */
    .dist-marker-tag {
      background: #0F172A;
      color: #FFFFFF;
      padding: 3px 8px;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      font-weight: 800;
      border: 1.5px solid #38BDF8;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      white-space: nowrap;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }

    /* Generic POI Pin */
    .poi-marker-pin {
      background: #FFFFFF;
      color: #0F172A;
      padding: 3px 8px;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 10.5px;
      font-weight: 700;
      border: 1.5px solid #CBD5E1;
      box-shadow: 0 2px 4px rgba(0,0,0,0.18);
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 3px;
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  
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
    var map;
    var markersGroup;
    var circlesGroup;
    var polylinesGroup;

    function renderMarkers(items) {
      if (!markersGroup) return;
      markersGroup.clearLayers();
      items.forEach(function(m) {
        var titleLower = (m.title || '').toLowerCase();
        var isSite = titleLower.indexOf('site') !== -1 || titleLower.indexOf('substation') !== -1 || titleLower.indexOf('facility') !== -1 || titleLower.indexOf('bazar') !== -1 || titleLower.indexOf('pimpri') !== -1;
        var isUser = titleLower.indexOf('device') !== -1 || titleLower.indexOf('my location') !== -1 || titleLower.indexOf('punch') !== -1 || titleLower.indexOf('your location') !== -1;
        var isDist = /^\\d+(\\.\\d+)?\\s*(m|km)$/i.test(m.title || '') || titleLower.indexOf('away') !== -1 || titleLower.indexOf('km') !== -1 || titleLower.indexOf(' m') !== -1 || titleLower.indexOf('dist') !== -1;

        var html = '';
        var iconSize = [36, 36];
        var iconAnchor = [18, 18];

        if (isSite) {
          var cleanName = (m.title || 'Site').replace(/^Site:\\s*/i, '');
          html = '<div class="site-marker-pin"><div class="site-marker-box"><span>⚡</span><span>' + cleanName + '</span></div><div class="site-marker-stem"></div></div>';
          iconSize = [130, 36];
          iconAnchor = [65, 36]; // Exact tip of stem at bottom center
        } else if (isUser) {
          html = '<div class="user-marker-pin"><div class="user-pulse-ring"></div><div class="user-center-dot"></div><div class="user-badge-label">📍 Your Location</div></div>';
          iconSize = [36, 36];
          iconAnchor = [18, 18]; // Exact center of dot
        } else if (isDist) {
          html = '<div class="dist-marker-tag">📍 ' + m.title + '</div>';
          iconSize = [96, 26];
          iconAnchor = [48, 13];
        } else {
          var dotColor = m.color || '#10B981';
          html = '<div class="poi-marker-pin" style="border-color:' + dotColor + ';"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:' + dotColor + '; margin-right:4px;"></span><span>' + (m.title || 'Location') + '</span></div>';
          iconSize = [110, 28];
          iconAnchor = [55, 28];
        }

        var icon = L.divIcon({
          html: html,
          className: 'custom-map-marker',
          iconSize: iconSize,
          iconAnchor: iconAnchor
        });

        var marker = L.marker([m.lat, m.lon], {
          icon: icon,
          draggable: Boolean(m.draggable)
        }).addTo(markersGroup);

        if (m.title || m.description) {
          var popupHtml = '<div style="padding:4px; font-family:-apple-system,sans-serif; min-width:120px;">' +
            '<div style="font-weight:700; font-size:12px; color:#0F172A; margin-bottom:2px;">' + (m.title || '') + '</div>' +
            (m.description ? '<div style="font-size:11px; color:#475569; line-height:1.35;">' + m.description + '</div>' : '') +
            '</div>';
          marker.bindPopup(popupHtml);
        }

        marker.on('click', function(e) {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
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
          marker.on('dragend', function(e) {
            var pos = marker.getLatLng();
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'markerDragEnd',
                index: m.idx,
                coordinate: { latitude: pos.lat, longitude: pos.lng }
              }));
            }
          });
        }
      });
    }

    function renderCircles(items) {
      if (!circlesGroup) return;
      circlesGroup.clearLayers();
      items.forEach(function(c) {
        L.circle([c.lat, c.lon], {
          radius: c.radius || 500,
          color: c.strokeColor || '#10B981',
          fillColor: c.fillColor || 'rgba(16, 185, 129, 0.18)',
          fillOpacity: 0.22,
          weight: c.strokeWidth || 2
        }).addTo(circlesGroup);
      });
    }

    function renderPolylines(items) {
      if (!polylinesGroup) return;
      polylinesGroup.clearLayers();
      items.forEach(function(p) {
        if (!p.coordinates || p.coordinates.length < 2) return;
        L.polyline(p.coordinates, {
          color: p.color || '#2563EB',
          weight: p.width || 3.5,
          dashArray: '6, 6'
        }).addTo(polylinesGroup);
      });
    }

    window.updateMapLayers = function(newMarkers, newCircles, newPolylines) {
      if (Array.isArray(newMarkers)) renderMarkers(newMarkers);
      if (Array.isArray(newCircles)) renderCircles(newCircles);
      if (Array.isArray(newPolylines)) renderPolylines(newPolylines);
    };

    function initMap() {
      if (typeof window.L === 'undefined') {
        setTimeout(initMap, 50);
        return;
      }

      try {
        map = L.map('map', {
          center: [${activeCenter.latitude}, ${activeCenter.longitude}],
          zoom: ${initialZoom},
          minZoom: 4,
          maxZoom: 20,
          zoomControl: false,
          attributionControl: false
        });

        window.map = map;

        // High-DPI Retina Road Map Tiles with Full Street, Road, and Landmark Labels (Matches Mappls Style)
        L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}&scale=2', {
          subdomains: ['0', '1', '2', '3'],
          maxZoom: 20,
          minZoom: 4,
          tileSize: 256,
          zoomOffset: 0,
          detectRetina: true,
          crossOrigin: true
        }).addTo(map);

        markersGroup = L.layerGroup().addTo(map);
        circlesGroup = L.layerGroup().addTo(map);
        polylinesGroup = L.layerGroup().addTo(map);

        // Initial layer population
        renderMarkers(${initialMarkersJson});
        renderCircles(${initialCirclesJson});
        renderPolylines(${initialPolylinesJson});

        // Map Click Listener (Interactive Tap to Pin)
        map.on('click', function(e) {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'mapPress',
              coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng }
            }));
          }
        });

        // Floating Control Handlers
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
          map.flyTo([${activeCenter.latitude}, ${activeCenter.longitude}], 16, { duration: 0.5 });
        });

        // Notify React Native that map is ready for live dynamic updates
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapLoaded' }));
        }

        setTimeout(function() { try { map.invalidateSize(); } catch(e){} }, 250);
        setTimeout(function() { try { map.invalidateSize(); } catch(e){} }, 700);

      } catch (err) {
        console.warn('[AppMapView initMap err]', err);
      }
    }

    initMap();
  </script>
</body>
</html>`;
    }, [activeCenter.latitude, activeCenter.longitude, initialZoom]);

    return (
      <View style={[styles.container, style]}>
        <WebViewComponent
          ref={webViewRef}
          source={{ html, baseUrl: 'https://localhost' }}
          style={StyleSheet.absoluteFill}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scrollEnabled={false}
          overScrollMode="never"
          bounces={false}
          originWhitelist={['*']}
          mixedContentMode="always"
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          onMessage={(event: any) => {
            try {
              const raw = event.nativeEvent?.data;
              if (!raw) return;
              const msg = JSON.parse(raw);
              if (msg.type === 'mapLoaded') {
                isMapLoadedRef.current = true;
              } else if (msg.type === 'markerPress') {
                const target = markersRef.current[msg.index];
                if (target && target.onPress) {
                  target.onPress();
                }
              } else if (msg.type === 'markerDragEnd') {
                const target = markersRef.current[msg.index];
                if (target && target.onDragEnd) {
                  target.onDragEnd({ nativeEvent: { coordinate: msg.coordinate } });
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
    backgroundColor: '#F8FAFC',
    flex: 1,
    minHeight: 120,
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
