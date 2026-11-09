import React, {
  useRef,
  useImperativeHandle,
  forwardRef,
  useMemo,
} from 'react';
import {
  View,
  StyleSheet,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';

// Fallback component when native WebView is unavailable
const FallbackView: React.FC<any> = ({ style, children }) => (
  <View style={[style, { backgroundColor: '#E2E8F0' }]}>{children}</View>
);

const WebViewComponent = WebView || FallbackView;

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
  zoomIn: () => void;
  zoomOut: () => void;
  recenter: (lat?: number, lon?: number) => void;
  animateToRegion: (region: Partial<Region>, duration?: number) => void;
  fitToCoordinates: (coordinates: LatLng[], options?: any) => void;
}

export type MapView = MapViewRef;

const MapViewComponent = forwardRef<MapViewRef, MapViewProps>(
  (
    {
      style,
      initialRegion = {
        latitude: 22.5937,
        longitude: 78.9629,
        latitudeDelta: 16.0,
        longitudeDelta: 16.0,
      },
      region,
      children,
      onPress,
      onRegionChangeComplete,
    },
    ref
  ) => {
    const webViewRef = useRef<any>(null);

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
        webViewRef.current?.injectJavaScript(`if (window.map) { window.map.flyTo([${cLat}, ${cLon}], 15); } true;`);
      },
      animateToRegion: (targetRegion: Partial<Region>, duration = 500) => {
        if (!targetRegion.latitude || !targetRegion.longitude) return;
        const zoom = targetRegion.latitudeDelta
          ? Math.max(Math.min(16 - Math.log2(targetRegion.latitudeDelta * 111), 20), 5)
          : 15;
        const script = `if (window.map) { window.map.flyTo([${targetRegion.latitude}, ${targetRegion.longitude}], ${zoom}); } true;`;
        webViewRef.current?.injectJavaScript(script);
      },
      fitToCoordinates: (coords: LatLng[], options?: any) => {
        if (!coords || coords.length === 0) return;
        if (coords.length === 1) {
          const c = coords[0];
          const script = `if (window.map) { window.map.flyTo([${c.latitude}, ${c.longitude}], 15); } true;`;
          webViewRef.current?.injectJavaScript(script);
          return;
        }

        const latlngs = coords.map((c) => `[${c.latitude}, ${c.longitude}]`).join(',');
        const pad = options?.edgePadding?.top || 40;
        const script = `if (window.map) { window.map.fitBounds([${latlngs}], { padding: [${pad}, ${pad}], maxZoom: 17 }); } true;`;
        webViewRef.current?.injectJavaScript(script);
      },
    }));

    // Parse JSX children into data structures
    const { markers, circles, polylines } = useMemo(() => {
      const parsedMarkers: any[] = [];
      const parsedCircles: any[] = [];
      const parsedPolylines: any[] = [];

      React.Children.forEach(children, (child) => {
        if (!React.isValidElement(child)) return;
        const typeName = (child.type as any)?.name || '';
        const props: any = child.props || {};

        if (typeName === 'Marker' || props.coordinate) {
          if (props.coordinate?.latitude && props.coordinate?.longitude) {
            parsedMarkers.push({
              lat: Number(props.coordinate.latitude),
              lon: Number(props.coordinate.longitude),
              title: props.title || '',
              description: props.description || '',
              color: props.pinColor || '#1E63F0',
            });
          }
        } else if (typeName === 'Circle' || props.radius) {
          if (props.center?.latitude && props.center?.longitude) {
            parsedCircles.push({
              lat: Number(props.center.latitude),
              lon: Number(props.center.longitude),
              radius: props.radius || 500,
              fillColor: props.fillColor || 'rgba(30, 99, 240, 0.15)',
              strokeColor: props.strokeColor || '#1E63F0',
              strokeWidth: props.strokeWidth || 2,
            });
          }
        } else if (typeName === 'Polyline' || props.coordinates) {
          if (Array.isArray(props.coordinates) && props.coordinates.length > 0) {
            parsedPolylines.push({
              coordinates: props.coordinates.map((c: any) => [c.latitude, c.longitude]),
              color: props.strokeColor || '#1E63F0',
              width: props.strokeWidth || 4,
            });
          }
        }
      });

      return { markers: parsedMarkers, circles: parsedCircles, polylines: parsedPolylines };
    }, [children]);

    const activeCenter = region || initialRegion;
    const initialZoom = activeCenter.latitudeDelta
      ? Math.max(Math.min(16 - Math.log2(activeCenter.latitudeDelta * 111), 18), 5)
      : 7;

    const html = useMemo(() => {
      const markersJson = JSON.stringify(markers);
      const circlesJson = JSON.stringify(circles);
      const polylinesJson = JSON.stringify(polylines);

      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
  <title>Mappls Enterprise Map</title>
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
      background: #E2E8F0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .leaflet-container { background: #E2E8F0 !important; }
    
    /* Official Mappls Brand Badge */
    .mappls-brand-badge {
      position: absolute !important;
      bottom: 8px !important;
      left: 8px !important;
      z-index: 1000 !important;
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
      border: 1px solid #CBD5E1 !important;
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

    .site-marker-pin {
      background: #DC2626;
      color: #FFFFFF;
      padding: 3px 8px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      border: 1.5px solid #FFFFFF;
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .user-marker-pin {
      position: relative;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #2563EB;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
    .user-pulse {
      position: absolute;
      top: -6px;
      left: -6px;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: rgba(37, 99, 235, 0.35);
      animation: pulse 1.8s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(1.5); opacity: 0; }
    }
    .leaflet-popup-content-wrapper {
      border-radius: 8px !important;
      box-shadow: 0 3px 12px rgba(0,0,0,0.2) !important;
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
    var markersData = ${markersJson};
    var circlesData = ${circlesJson};
    var polylinesData = ${polylinesJson};

    var map = L.map('map', {
      center: [${activeCenter.latitude}, ${activeCenter.longitude}],
      zoom: ${initialZoom},
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

    circlesData.forEach(function(c) {
      L.circle([c.lat, c.lon], {
        radius: c.radius || 500,
        fillColor: c.fillColor || 'rgba(30, 99, 240, 0.15)',
        color: c.strokeColor || '#1E63F0',
        weight: c.strokeWidth || 2
      }).addTo(map);
    });

    polylinesData.forEach(function(p) {
      L.polyline(p.coordinates, {
        color: p.color || '#1E63F0',
        weight: p.width || 4,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
    });

    markersData.forEach(function(m) {
      var isSite = (m.title && m.title.toLowerCase().indexOf('substation') !== -1);
      var iconHtml = isSite
        ? '<div class="site-marker-pin"><span>⚡</span><span>' + m.title + '</span></div>'
        : '<div class="user-marker-pin" style="background:' + (m.color || '#2563EB') + '"><div class="user-pulse"></div></div>';

      var customIcon = L.divIcon({
        className: 'appmap-pin-wrap',
        html: iconHtml,
        iconSize: isSite ? [100, 24] : [22, 22],
        iconAnchor: isSite ? [50, 24] : [11, 11],
        popupAnchor: [0, isSite ? -24 : -11]
      });

      var marker = L.marker([m.lat, m.lon], { icon: customIcon }).addTo(map);
      if (m.title || m.description) {
        marker.bindPopup('<div style="padding:6px;font-size:12px;"><strong>' + (m.title || '') + '</strong><br>' + (m.description || '') + '</div>');
      }
    });

    setTimeout(function() { map.invalidateSize(); }, 100);
    setTimeout(function() { map.invalidateSize(); }, 300);
    setTimeout(function() { map.invalidateSize(); }, 800);
    window.addEventListener('resize', function() { map.invalidateSize(); });

    map.on('click', function(e) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_CLICK', coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng } }));
      }
    });
  </script>
</body>
</html>`;
    }, [markers, circles, polylines, activeCenter, initialZoom]);

    const handleWebViewMessage = (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'MAP_CLICK' && onPress) {
          onPress({ nativeEvent: { coordinate: data.coordinate } });
        }
      } catch {}
    };

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
          onMessage={handleWebViewMessage}
          onError={(err: any) => console.warn('[AppMapView] WebView notice:', err)}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    width: '100%',
    height: '100%',
  },
});

MapViewComponent.displayName = 'AppMapView';

export default MapViewComponent;
