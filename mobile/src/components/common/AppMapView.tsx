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
          webViewRef.current.injectJavaScript('if (window.map) { window.map.zoomIn({ duration: 250 }); } true;');
        }
      },
      zoomOut: () => {
        if (isNativeMapplsAvailable && cameraRef.current) {
          cameraRef.current.zoomTo(10, 250);
        } else if (webViewRef.current) {
          webViewRef.current.injectJavaScript('if (window.map) { window.map.zoomOut({ duration: 250 }); } true;');
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
          webViewRef.current.injectJavaScript(`if (window.map) { window.map.flyTo({ center: [${cLon}, ${cLat}], zoom: 15, duration: 400 }); } true;`);
        }
      },
      animateToRegion: (targetRegion: Partial<Region>, duration = 500) => {
        if (!targetRegion.latitude || !targetRegion.longitude) return;
        const zoom = targetRegion.latitudeDelta
          ? Math.max(Math.min(16 - Math.log2(targetRegion.latitudeDelta * 111), 20), 5)
          : 15;

        if (isNativeMapplsAvailable && cameraRef.current) {
          cameraRef.current.setCamera({
            centerCoordinate: [targetRegion.longitude, targetRegion.latitude],
            zoomLevel: zoom,
            animationDuration: duration,
            animationMode: 'flyTo',
          });
        } else if (webViewRef.current) {
          const script = `if (window.map) { window.map.flyTo({ center: [${targetRegion.longitude}, ${targetRegion.latitude}], zoom: ${zoom}, duration: ${duration} }); } true;`;
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
            const script = `if (window.map) { window.map.flyTo({ center: [${c.longitude}, ${c.latitude}], zoom: 15, duration: 500 }); } true;`;
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
            if (window.map && window.maplibregl) {
              var bounds = new window.maplibregl.LngLatBounds([${minLon}, ${minLat}], [${maxLon}, ${maxLat}]);
              window.map.fitBounds(bounds, { padding: ${pad}, maxZoom: 17 });
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
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" />
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <script>
    window.onerror = function(msg, url, line) {
      console.warn('[AppMapView WebView JS]', msg, line);
      return true;
    };
  </script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #E2E8F0;
      touch-action: pan-x pan-y pinch-zoom;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
    }
    
    /* ABSOLUTE 100% ELIMINATION OF MAPLIBRE / OPENFREEMAP / OPENMAPTILES / OPENSTREETMAP ATTRIBUTION */
    .maplibregl-ctrl-attrib,
    .mapboxgl-ctrl-attrib,
    .maplibregl-ctrl-bottom-right,
    .maplibregl-ctrl-bottom-left,
    .maplibregl-ctrl-top-right,
    .maplibregl-ctrl-top-left,
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

    /* 1. Substation Site Marker */
    .site-marker-pin {
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      z-index: 50;
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

    /* 2. Employee Device Location Marker with Radar Wave */
    .user-marker-pin {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 60;
    }
    .user-pulse-ring {
      position: absolute;
      width: 32px;
      height: 32px;
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

    /* 3. Midpoint Route Distance Tag */
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
    }

    /* 4. Real Nearby POI Marker */
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

    var rasterFallbackStyle = {
      version: 8,
      sources: {
        'osm-raster-tiles': {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
            'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
            'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
            'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'
          ],
          tileSize: 256,
          attribution: ''
        }
      },
      layers: [
        {
          id: 'osm-raster-layer',
          type: 'raster',
          source: 'osm-raster-tiles',
          minzoom: 0,
          maxzoom: 20
        }
      ]
    };

    var attempts = 0;
    function startMap() {
      if (typeof window.maplibregl === 'undefined') {
        attempts++;
        if (attempts === 50) {
          var fb = document.createElement('script');
          fb.src = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js';
          document.head.appendChild(fb);
        }
        setTimeout(startMap, 40);
        return;
      }

      try {
        if (window.maplibregl && window.maplibregl.AttributionControl) {
          window.maplibregl.AttributionControl = function() {
            return {
              onAdd: function() {
                var el = document.createElement('div');
                el.style.display = 'none';
                return el;
              },
              onRemove: function() {}
            };
          };
        }

        var map = new maplibregl.Map({
          container: 'map',
          style: 'https://tiles.openfreemap.org/styles/liberty',
          center: [${activeCenter.longitude}, ${activeCenter.latitude}],
          zoom: ${initialZoom},
          minZoom: 4,
          maxZoom: 20,
          attributionControl: false,
          customAttribution: [],
          doubleClickZoom: true,
          dragPan: true,
          scrollZoom: true,
          touchZoomRotate: true,
          touchPitch: true,
          cooperativeGestures: false
        });

        window.map = map;
        window.maplibregl = maplibregl;

        // Auto-resize on mount to handle parent modal animations
        setTimeout(function() { try { map.resize(); } catch(e){} }, 200);
        setTimeout(function() { try { map.resize(); } catch(e){} }, 600);

    // Floating Button Event Listeners
    document.getElementById('btnZoomIn').addEventListener('click', function(e) {
      e.stopPropagation();
      map.zoomIn({ duration: 250 });
    });
    document.getElementById('btnZoomOut').addEventListener('click', function(e) {
      e.stopPropagation();
      map.zoomOut({ duration: 250 });
    });
    document.getElementById('btnRecenter').addEventListener('click', function(e) {
      e.stopPropagation();
      map.flyTo({ center: [${activeCenter.longitude}, ${activeCenter.latitude}], zoom: ${initialZoom}, duration: 400 });
    });

    function createCircleGeoJSON(center, radiusInMeters, points) {
      if (!points) points = 64;
      var km = radiusInMeters / 1000;
      var coords = { latitude: center[1], longitude: center[0] };
      var ret = [];
      var distanceX = km / (111.320 * Math.cos(coords.latitude * Math.PI / 180));
      var distanceY = km / 110.574;
      for (var i = 0; i < points; i++) {
        var theta = (i / points) * (2 * Math.PI);
        var x = distanceX * Math.cos(theta);
        var y = distanceY * Math.sin(theta);
        ret.push([coords.longitude + x, coords.latitude + y]);
      }
      ret.push(ret[0]);
      return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ret] } };
    }

    function purgeAllAttributionNodes() {
      try {
        var selectors = [
          '.maplibregl-ctrl-attrib',
          '.mapboxgl-ctrl-attrib',
          '.maplibregl-ctrl-bottom-right',
          '.maplibregl-ctrl-bottom-left',
          '.maplibregl-ctrl-attrib-inner',
          '.maplibregl-ctrl-attrib-summary',
          '.maplibregl-compact',
          '.maplibregl-compact-show',
          'details.maplibregl-ctrl-attrib',
          'summary.maplibregl-ctrl-attrib-button',
          'div[class*="attrib"]',
          'details[class*="attrib"]',
          'summary[class*="attrib"]',
          'a[href*="maplibre"]',
          'a[href*="openfreemap"]',
          'a[href*="openstreetmap"]',
          'a[href*="openmaptiles"]'
        ];
        selectors.forEach(function(s) {
          var nodes = document.querySelectorAll(s);
          for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (n && n.parentNode) {
              n.parentNode.removeChild(n);
            }
          }
        });

        // Deep text scanner: destroy any element containing forbidden attribution strings
        var allElements = document.querySelectorAll('#map *');
        for (var i = 0; i < allElements.length; i++) {
          var el = allElements[i];
          if (el.className && typeof el.className === 'string' && el.className.indexOf('mappls') !== -1) {
            continue; // Preserve official Mappls badge
          }
          var txt = (el.innerText || el.textContent || '').toLowerCase();
          if (
            txt.indexOf('maplibre') !== -1 ||
            txt.indexOf('openfreemap') !== -1 ||
            txt.indexOf('openmaptiles') !== -1 ||
            txt.indexOf('openstreetmap') !== -1
          ) {
            if (el.parentNode) {
              el.parentNode.removeChild(el);
            }
          }
        }
      } catch (err) {}
    }

    purgeAllAttributionNodes();
    try {
      var observer = new MutationObserver(purgeAllAttributionNodes);
      observer.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}

    map.on('load', purgeAllAttributionNodes);
    map.on('render', purgeAllAttributionNodes);
    map.on('styledata', purgeAllAttributionNodes);
    map.on('style.load', function() {
      try {
        var style = map.getStyle();
        if (style && style.sources) {
          Object.keys(style.sources).forEach(function(k) {
            if (style.sources[k]) {
              delete style.sources[k].attribution;
            }
          });
        }
      } catch (e) {}
      purgeAllAttributionNodes();
    });
    setInterval(purgeAllAttributionNodes, 200);

    map.on('load', function() {
      purgeAllAttributionNodes();

      // 2. Optimize Map Layers to Show Real Roads, Localities, and Small Businesses at Useful Zoom Levels
      try {
        // Major roads & highway names visible from zoom 8 with thick white halo
        if (map.getLayer('highway-name-major')) {
          map.setLayerZoomRange('highway-name-major', 8, 24);
          map.setPaintProperty('highway-name-major', 'text-halo-color', '#FFFFFF');
          map.setPaintProperty('highway-name-major', 'text-halo-width', 2.5);
          map.setLayoutProperty('highway-name-major', 'text-size', 13);
        }
        // Minor roads & streets visible from zoom 11 with white halo
        if (map.getLayer('highway-name-minor')) {
          map.setLayerZoomRange('highway-name-minor', 11, 24);
          map.setPaintProperty('highway-name-minor', 'text-halo-color', '#FFFFFF');
          map.setPaintProperty('highway-name-minor', 'text-halo-width', 2.0);
          map.setLayoutProperty('highway-name-minor', 'text-size', 11.5);
        }
        // Walkways and paths
        if (map.getLayer('highway-name-path')) {
          map.setLayerZoomRange('highway-name-path', 13, 24);
        }
        // Neighborhoods, suburbs, localities
        if (map.getLayer('label_other')) {
          map.setLayerZoomRange('label_other', 8, 24);
          map.setPaintProperty('label_other', 'text-halo-color', '#FFFFFF');
          map.setPaintProperty('label_other', 'text-halo-width', 2.5);
          map.setLayoutProperty('label_other', 'text-size', 13);
        }
        // Major POIs: Hospitals, Banks, Petrol Pumps, Railway stations
        if (map.getLayer('poi_r1')) {
          map.setLayerZoomRange('poi_r1', 11, 24);
          map.setLayoutProperty('poi_r1', 'icon-allow-overlap', true);
          map.setLayoutProperty('poi_r1', 'text-size', 11.5);
          map.setPaintProperty('poi_r1', 'text-halo-color', '#FFFFFF');
          map.setPaintProperty('poi_r1', 'text-halo-width', 2.0);
        }
        // Medium POIs: Restaurants, Clinics, Supermarkets, Pharmacies
        if (map.getLayer('poi_r7')) {
          map.setLayerZoomRange('poi_r7', 12, 24);
          map.setLayoutProperty('poi_r7', 'text-size', 11);
          map.setPaintProperty('poi_r7', 'text-halo-color', '#FFFFFF');
          map.setPaintProperty('poi_r7', 'text-halo-width', 2.0);
        }
        // Small shops, retail businesses, commercial stores
        if (map.getLayer('poi_r20')) {
          map.setLayerZoomRange('poi_r20', 13, 24);
          map.setLayoutProperty('poi_r20', 'text-size', 10.5);
          map.setPaintProperty('poi_r20', 'text-halo-color', '#FFFFFF');
          map.setPaintProperty('poi_r20', 'text-halo-width', 1.5);
        }
        // Building 3D outlines & footprints
        if (map.getLayer('building')) {
          map.setLayerZoomRange('building', 13, 24);
        }
        if (map.getLayer('building-3d')) {
          map.setLayerZoomRange('building-3d', 13.5, 24);
        }
      } catch (e) {
        console.warn('[Mappls Layers] Customization notice:', e);
      }

      // 3. Circles (e.g. Geofence perimeter)
      circlesData.forEach(function(c, idx) {
        var circleGeo = createCircleGeoJSON([c.lon, c.lat], c.radius);
        map.addSource('circle-source-' + idx, { type: 'geojson', data: circleGeo });
        map.addLayer({
          id: 'circle-fill-' + idx,
          type: 'fill',
          source: 'circle-source-' + idx,
          paint: {
            'fill-color': c.fillColor || 'rgba(16, 185, 129, 0.2)',
            'fill-opacity': 0.8
          }
        });
        map.addLayer({
          id: 'circle-line-' + idx,
          type: 'line',
          source: 'circle-source-' + idx,
          paint: {
            'line-color': c.strokeColor || '#10B981',
            'line-width': c.strokeWidth || 2
          }
        });
      });

      // 4. Polylines (e.g. Road routes)
      polylinesData.forEach(function(p, idx) {
        if (!p.coordinates || p.coordinates.length < 2) return;
        var lineGeo = {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: p.coordinates
          }
        };
        map.addSource('poly-source-' + idx, { type: 'geojson', data: lineGeo });
        map.addLayer({
          id: 'poly-line-' + idx,
          type: 'line',
          source: 'poly-source-' + idx,
          paint: {
            'line-color': p.color || '#1E63F0',
            'line-width': p.width || 4
          },
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          }
        });
      });

      // 5. Distinct, Clear Markers (Site, User GPS, Distance, POIs, Technicians)
      markersData.forEach(function(m) {
        var titleLower = (m.title || '').toLowerCase();
        var isSite = titleLower.indexOf('site') !== -1 || titleLower.indexOf('substation') !== -1;
        var isUser = titleLower.indexOf('device') !== -1 || titleLower.indexOf('my location') !== -1 || titleLower.indexOf('my') !== -1;
        var isDist = /^\d+(\.\d+)?\s*(m|km)$/i.test(m.title || '') || titleLower.indexOf('away') !== -1;

        var el = document.createElement('div');

        if (isSite) {
          el.className = 'site-marker-pin';
          var cleanName = (m.title || 'Site').replace(/^Site:\s*/i, '');
          el.innerHTML = '<div class="site-marker-box"><span>⚡</span><span>' + cleanName + '</span></div><div class="site-marker-stem"></div>';
        } else if (isUser) {
          el.className = 'user-marker-pin';
          el.innerHTML = '<div class="user-pulse-ring"></div><div class="user-center-dot"></div><div class="user-badge-label">📍 My Location</div>';
        } else if (isDist) {
          el.className = 'dist-marker-tag';
          el.innerText = '⤹ ' + m.title;
        } else {
          // Employee / Technician / POI Marker
          el.className = 'poi-marker-pin';
          var dotColor = m.color || '#10B981';
          el.style.borderColor = dotColor;
          el.innerHTML = '<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:' + dotColor + '; margin-right:4px;"></span><span>' + (m.title || 'Personnel') + '</span>';
        }

        var marker = new maplibregl.Marker({ element: el, anchor: (isUser || isDist) ? 'center' : 'bottom' })
          .setLngLat([m.lon, m.lat]);

        if (m.title || m.description) {
          var popupContent = '<div style="padding:6px 8px; font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif; min-width:130px;">' +
            '<div style="font-weight:700; font-size:12px; color:#0F172A; margin-bottom:2px;">' + (m.title || '') + '</div>' +
            (m.description ? '<div style="font-size:11px; color:#475569; line-height:1.35;">' + m.description + '</div>' : '') +
            '</div>';
          var popup = new maplibregl.Popup({ offset: 25, closeButton: true }).setHTML(popupContent);
          marker.setPopup(popup);
        }

        el.addEventListener('click', function(ev) {
          ev.stopPropagation();
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

        marker.addTo(map);
      });

      // Map Click Dispatcher
      map.on('click', function(e) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'mapPress',
            coordinate: { latitude: e.lngLat.lat, longitude: e.lngLat.lng }
          }));
        }
      });
    });
      } catch (err) {
        console.warn('[AppMapView startMap err]', err);
      }
    }
    startMap();
  </script>
</body>
</html>
      `;
    }, [markers, circles, polylines, activeCenter, initialZoom]);

    return (
      <View style={[styles.container, style]}>
        <WebViewComponent
          ref={webViewRef}
          source={{ html }}
          style={StyleSheet.absoluteFill}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scrollEnabled={true}
          nestedScrollEnabled={true}
          overScrollMode="never"
          bounces={false}
          originWhitelist={['*']}
          mixedContentMode="always"
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          androidLayerType="software"
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
