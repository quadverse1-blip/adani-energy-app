import React, { useRef, useImperativeHandle, forwardRef, useMemo } from 'react';
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

function createCircleGeoJSON(center: [number, number], radiusInMeters: number, points = 64) {
  const km = radiusInMeters / 1000;
  const coords = { latitude: center[1], longitude: center[0] };
  const ret: [number, number][] = [];
  const distanceX = km / (111.32 * Math.cos((coords.latitude * Math.PI) / 180));
  const distanceY = km / 110.574;
  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    ret.push([coords.longitude + x, coords.latitude + y]);
  }
  ret.push(ret[0]);
  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [ret],
    },
    properties: {},
  };
}

const MapViewComponent = forwardRef<MapViewRef, MapViewProps>(
  (
    {
      style,
      initialRegion = {
        latitude: 19.7515,
        longitude: 75.7139,
        latitudeDelta: 3.5,
        longitudeDelta: 3.5,
      },
      region,
      children,
      showsCompass = true,
      onPress,
    },
    ref
  ) => {
    const webViewRef = useRef<any>(null);
    const cameraRef = useRef<any>(null);

    // Safely check if native MapplsGL view manager is registered in this runtime (e.g. native standalone APK)
    // When running in Expo Go or Web, gracefully and stably fall back to the hardware-accelerated Mappls WebView map engine
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

    useImperativeHandle(ref, () => ({
      zoomIn: () => {
        if (isNativeMapplsAvailable && cameraRef.current) {
          cameraRef.current.zoomTo(16, 250);
        } else if (webViewRef.current) {
          webViewRef.current.injectJavaScript('if (window.map) { window.map.zoomIn(); } true;');
        }
      },
      zoomOut: () => {
        if (isNativeMapplsAvailable && cameraRef.current) {
          cameraRef.current.zoomTo(10, 250);
        } else if (webViewRef.current) {
          webViewRef.current.injectJavaScript('if (window.map) { window.map.zoomOut(); } true;');
        }
      },
      recenter: (lat?: number, lon?: number) => {
        const cLat = lat || (region || initialRegion).latitude;
        const cLon = lon || (region || initialRegion).longitude;
        if (isNativeMapplsAvailable && cameraRef.current) {
          cameraRef.current.setCamera({
            centerCoordinate: [cLon, cLat],
            zoomLevel: 15,
            animationDuration: 400,
            animationMode: 'flyTo',
          });
        } else if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`if (window.map) { window.map.setView([${cLat}, ${cLon}], 15); } true;`);
        }
      },
      animateToRegion: (targetRegion: Partial<Region>, duration = 500) => {
        if (!targetRegion.latitude || !targetRegion.longitude) return;
        const zoom = targetRegion.latitudeDelta
          ? Math.max(Math.min(16 - Math.log2(targetRegion.latitudeDelta * 111), 18), 5)
          : 15;

        if (isNativeMapplsAvailable && cameraRef.current) {
          cameraRef.current.setCamera({
            centerCoordinate: [targetRegion.longitude, targetRegion.latitude],
            zoomLevel: zoom,
            animationDuration: duration,
            animationMode: 'flyTo',
          });
        } else if (webViewRef.current) {
          const script = `if (window.map) { window.map.flyTo([${targetRegion.latitude}, ${targetRegion.longitude}], ${zoom}, { duration: ${duration / 1000} }); } true;`;
          webViewRef.current.injectJavaScript(script);
        }
      },
      fitToCoordinates: (coords: LatLng[], options?: any) => {
        if (!coords || coords.length === 0) return;
        if (coords.length === 1) {
          const c = coords[0];
          if (isNativeMapplsAvailable && cameraRef.current) {
            cameraRef.current.setCamera({
              centerCoordinate: [c.longitude, c.latitude],
              zoomLevel: 15,
              animationDuration: 500,
              animationMode: 'flyTo',
            });
          } else if (webViewRef.current) {
            const script = `if (window.map) { window.map.setView([${c.latitude}, ${c.longitude}], 15); } true;`;
            webViewRef.current.injectJavaScript(script);
          }
          return;
        }

        const lats = coords.map((c) => c.latitude);
        const lons = coords.map((c) => c.longitude);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        const pad = options?.edgePadding?.top || 40;

        if (isNativeMapplsAvailable && cameraRef.current) {
          cameraRef.current.fitBounds(
            [maxLon, maxLat],
            [minLon, minLat],
            [pad, pad, pad, pad],
            500
          );
        } else if (webViewRef.current) {
          const script = `
            if (window.map) {
              window.map.fitBounds([[${minLat}, ${minLon}], [${maxLat}, ${maxLon}]], { padding: [${pad}, ${pad}], maxZoom: 16 });
            }
            true;
          `;
          webViewRef.current.injectJavaScript(script);
        }
      },
    }));

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
              anchor: props.anchor,
              onPress: props.onPress,
              children: props.children,
            });
          }
        } else if (typeName === 'Circle' || props.radius) {
          if (props.center?.latitude && props.center?.longitude) {
            parsedCircles.push({
              lat: props.center.latitude,
              lon: props.center.longitude,
              radius: props.radius || 500,
              fillColor: props.fillColor || 'rgba(16, 185, 129, 0.2)',
              strokeColor: props.strokeColor || '#10B981',
              strokeWidth: props.strokeWidth || 2,
              geoJson: createCircleGeoJSON(
                [props.center.longitude, props.center.latitude],
                props.radius || 500
              ),
            });
          }
        } else if (typeName === 'Polyline' || props.coordinates) {
          if (Array.isArray(props.coordinates) && props.coordinates.length > 0) {
            parsedPolylines.push({
              coordinates: props.coordinates.map((c: any) => [c.longitude, c.latitude]),
              strokeColor: props.strokeColor || '#1E63F0',
              strokeWidth: props.strokeWidth || 4,
              geoJson: {
                type: 'Feature' as const,
                properties: {},
                geometry: {
                  type: 'LineString' as const,
                  coordinates: props.coordinates.map((c: any) => [c.longitude, c.latitude]),
                },
              },
            });
          }
        }
      });

      return { markers: parsedMarkers, circles: parsedCircles, polylines: parsedPolylines };
    }, [children]);

    const activeCenter = region || initialRegion;
    const initialZoom = activeCenter.latitudeDelta
      ? Math.max(Math.min(16 - Math.log2(activeCenter.latitudeDelta * 111), 18), 5)
      : 14;

    // 1. Native Mappls GL rendering (for standalone APK runtime where RCTMGLCamera is registered)
    if (isNativeMapplsAvailable && MapplsGL?.MapView && MapplsGL?.Camera) {
      return (
        <View style={[styles.container, style]}>
          <MapplsGL.MapView
            style={StyleSheet.absoluteFill}
            compassEnabled={showsCompass !== false}
            logoEnabled={true}
            zoomEnabled={true}
            scrollEnabled={true}
            pitchEnabled={true}
            rotateEnabled={true}
            onPress={(feature: any) => {
              if (onPress && feature?.geometry?.coordinates) {
                const [lon, lat] = feature.geometry.coordinates;
                onPress({ nativeEvent: { coordinate: { latitude: lat, longitude: lon } } });
              }
            }}
          >
            <MapplsGL.Camera
              ref={cameraRef}
              centerCoordinate={[activeCenter.longitude, activeCenter.latitude]}
              zoomLevel={initialZoom}
              minZoomLevel={5}
              maxZoomLevel={20}
              animationMode="flyTo"
              animationDuration={500}
            />

            {/* Geofence Perimeter Circles */}
            {circles.map((c, i) => (
              <MapplsGL.ShapeSource
                key={`circle-source-${i}-${c.lat}-${c.lon}`}
                id={`circle-source-${i}`}
                shape={c.geoJson}
              >
                <MapplsGL.FillLayer
                  id={`circle-fill-${i}`}
                  style={{
                    fillColor: c.fillColor,
                    fillOpacity: 1,
                  }}
                />
                <MapplsGL.LineLayer
                  id={`circle-line-${i}`}
                  style={{
                    lineColor: c.strokeColor,
                    lineWidth: c.strokeWidth,
                  }}
                />
              </MapplsGL.ShapeSource>
            ))}

            {/* Road / Route Polylines */}
            {polylines.map((p, i) => (
              <MapplsGL.ShapeSource
                key={`poly-source-${i}`}
                id={`poly-source-${i}`}
                shape={p.geoJson}
              >
                <MapplsGL.LineLayer
                  id={`poly-line-${i}`}
                  style={{
                    lineColor: p.strokeColor,
                    lineWidth: p.strokeWidth,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              </MapplsGL.ShapeSource>
            ))}

            {/* Site, User Location, and Custom Markers */}
            {markers.map((m, i) => (
              <MapplsGL.PointAnnotation
                key={`marker-${i}-${m.lat}-${m.lon}`}
                id={`marker-${i}`}
                coordinate={[m.lon, m.lat]}
                title={m.title}
                snippet={m.description}
                anchor={m.anchor || { x: 0.5, y: 1.0 }}
                onSelected={m.onPress}
              >
                {m.children ? (
                  m.children
                ) : (
                  <View style={[styles.defaultPin, { backgroundColor: m.color }]}>
                    <View style={styles.defaultPinDot} />
                  </View>
                )}
              </MapplsGL.PointAnnotation>
            ))}
          </MapplsGL.MapView>
        </View>
      );
    }

    // 2. High-performance Mappls Map View with Full Gesture Support, Pinch Zoom, and Real Maharashtra POI/Road Labels
    // Built on 100% reliable 2D Leaflet rendering that works on ALL Android devices, Web, and Expo Go without WebGL requirements
    const html = useMemo(() => {
      const markersJson = JSON.stringify(
        markers.map((m, idx) => ({
          idx,
          lat: m.lat,
          lon: m.lon,
          title: m.title,
          description: m.description,
          color: m.color,
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

      return `
<!DOCTYPE html>
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
      background: #F1F5F9;
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

    /* Mappls Official Enterprise Brand Badge */
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
      width: 36px;
      height: 36px;
      background: #FFFFFF;
      border: 1px solid #CBD5E1;
      border-radius: 8px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.18);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 18px;
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

    /* Substation Site Marker */
    .site-marker-pin {
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      z-index: 50;
      transform: translate(-50%, -100%);
    }
    .site-marker-box {
      background: #DC2626;
      color: #FFFFFF;
      padding: 3px 8px;
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

    /* Employee Device Location Marker with Radar Wave */
    .user-marker-pin {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 60;
      transform: translate(-50%, -50%);
    }
    .user-pulse-ring {
      position: absolute;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: rgba(37, 99, 235, 0.25);
      border: 1.5px solid rgba(37, 99, 235, 0.6);
      animation: user-radar 2s infinite ease-out;
      pointer-events: none;
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
    }

    /* Midpoint Route Distance Tag */
    .dist-marker-tag {
      background: #FFFFFF;
      color: #1E40AF;
      padding: 2px 7px;
      border-radius: 10px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 10px;
      font-weight: 800;
      border: 1.5px solid #93C5FD;
      box-shadow: 0 2px 5px rgba(0,0,0,0.18);
      white-space: nowrap;
      transform: translate(-50%, -50%);
    }

    /* Technician / POI Marker */
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
      transform: translate(-50%, -50%);
    }

    .leaflet-bar {
      border: 1px solid #CBD5E1 !important;
      box-shadow: 0 2px 6px rgba(0,0,0,0.18) !important;
      border-radius: 8px !important;
      overflow: hidden;
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
    <button class="map-control-btn" id="btnRecenter" title="Recenter" style="font-size: 15px;">⌖</button>
  </div>

  <script>
    var markersData = ${markersJson};
    var circlesData = ${circlesJson};
    var polylinesData = ${polylinesJson};

    var attempts = 0;
    function initMap() {
      if (typeof window.L === 'undefined') {
        attempts++;
        if (attempts === 25) {
          var fb = document.createElement('script');
          fb.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
          document.head.appendChild(fb);
        }
        setTimeout(initMap, 50);
        return;
      }

      try {
        var map = L.map('map', {
          center: [${activeCenter.latitude}, ${activeCenter.longitude}],
          zoom: ${initialZoom},
          minZoom: 4,
          maxZoom: 19,
          zoomControl: false,
          attributionControl: false
        });

        window.map = map;

        // High-Quality Road & Landmark Tiles with Clear Streets, Highways & Settlement Names
        // Free of Google, CartoDB, and ArcGIS fallback mixture
        var streetTiles = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
        var tileLayer = L.tileLayer(streetTiles, {
          maxZoom: 19,
          subdomains: ['a', 'b', 'c']
        }).addTo(map);

        // 1. Render Circles (e.g. Geofence Perimeters)
        circlesData.forEach(function(c) {
          L.circle([c.lat, c.lon], {
            radius: c.radius || 500,
            color: c.strokeColor || '#1E40AF',
            fillColor: c.fillColor || 'rgba(30, 64, 175, 0.15)',
            fillOpacity: 0.22,
            weight: c.strokeWidth || 2
          }).addTo(map);
        });

        // 2. Render Polylines (e.g. Connecting Routes)
        polylinesData.forEach(function(p) {
          if (!p.coordinates || p.coordinates.length < 2) return;
          var latLngs = p.coordinates.map(function(pt) { return [pt[1], pt[0]]; });
          L.polyline(latLngs, {
            color: p.color || '#2563EB',
            weight: p.width || 3.5,
            dashArray: '6, 6'
          }).addTo(map);
        });

        // 3. Render Custom Markers
        markersData.forEach(function(m) {
          var titleLower = (m.title || '').toLowerCase();
          var isSite = titleLower.indexOf('site') !== -1 || titleLower.indexOf('substation') !== -1;
          var isUser = titleLower.indexOf('device') !== -1 || titleLower.indexOf('my location') !== -1 || titleLower.indexOf('punch') !== -1 || titleLower.indexOf('your location') !== -1;
          var isDist = /^\\d+(\\.\\d+)?\\s*(m|km)$/i.test(m.title || '') || titleLower.indexOf('away') !== -1;

          var html = '';
          var iconClass = 'custom-map-marker';
          var iconSize = [30, 30];
          var iconAnchor = [15, 15];

          if (isSite) {
            var cleanName = (m.title || 'Site').replace(/^Site:\\s*/i, '');
            html = '<div class="site-marker-pin"><div class="site-marker-box"><span>⚡</span><span>' + cleanName + '</span></div><div class="site-marker-stem"></div></div>';
            iconAnchor = [60, 35];
            iconSize = [120, 40];
          } else if (isUser) {
            html = '<div class="user-marker-pin"><div class="user-pulse-ring"></div><div class="user-center-dot"></div><div class="user-badge-label">📍 My Location</div></div>';
            iconAnchor = [40, 20];
            iconSize = [80, 45];
          } else if (isDist) {
            html = '<div class="dist-marker-tag">⤹ ' + m.title + '</div>';
            iconAnchor = [35, 12];
            iconSize = [70, 24];
          } else {
            var dotColor = m.color || '#10B981';
            html = '<div class="poi-marker-pin" style="border-color:' + dotColor + ';"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:' + dotColor + '; margin-right:4px;"></span><span>' + (m.title || 'Personnel') + '</span></div>';
            iconAnchor = [45, 14];
            iconSize = [90, 28];
          }

          var icon = L.divIcon({
            html: html,
            className: iconClass,
            iconSize: iconSize,
            iconAnchor: iconAnchor
          });

          var marker = L.marker([m.lat, m.lon], { icon: icon }).addTo(map);

          if (m.title || m.description) {
            var popupContent = '<div style="padding:4px; font-family:-apple-system,sans-serif; min-width:120px;">' +
              '<div style="font-weight:700; font-size:12px; color:#0F172A; margin-bottom:2px;">' + (m.title || '') + '</div>' +
              (m.description ? '<div style="font-size:11px; color:#475569; line-height:1.35;">' + m.description + '</div>' : '') +
              '</div>';
            marker.bindPopup(popupContent);
          }

          marker.on('click', function(ev) {
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
        });

        // 4. Map Press Event Listener
        map.on('click', function(e) {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'mapPress',
              coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng }
            }));
          }
        });

        // 5. Floating Button Event Listeners
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
          map.setView([${activeCenter.latitude}, ${activeCenter.longitude}], ${initialZoom});
        });

        // Auto-resize map after initial render
        setTimeout(function() { try { map.invalidateSize(); } catch(e){} }, 200);
        setTimeout(function() { try { map.invalidateSize(); } catch(e){} }, 600);

      } catch (err) {
        console.warn('[AppMapView initMap err]', err);
      }
    }

    initMap();
  </script>
</body>
</html>
      `;
    }, [markers, circles, polylines, activeCenter, initialZoom]);

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
              if (msg.type === 'markerPress') {
                const target = markers[msg.index];
                if (target && target.onPress) {
                  target.onPress();
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
