import React, { forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MapPin } from 'lucide-react-native';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface Region extends LatLng {
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface MapViewProps {
  style?: any;
  children?: React.ReactNode;
  initialRegion?: Region;
  region?: Region;
  onRegionChange?: (region: Region) => void;
  onRegionChangeComplete?: (region: Region) => void;
  onPress?: (event: any) => void;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  provider?: any;
}

export interface MarkerProps {
  coordinate?: LatLng;
  title?: string;
  description?: string;
  pinColor?: string;
  onPress?: (event: any) => void;
  children?: React.ReactNode;
}

export interface CircleProps {
  center: LatLng;
  radius: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = 'default';

export class AnimatedRegion {
  latitude: any;
  longitude: any;
  latitudeDelta: any;
  longitudeDelta: any;
  constructor(opts?: any) {
    this.latitude = opts?.latitude ?? 0;
    this.longitude = opts?.longitude ?? 0;
    this.latitudeDelta = opts?.latitudeDelta ?? 0;
    this.longitudeDelta = opts?.longitudeDelta ?? 0;
  }
  setValue(val: any) {}
  timing(opts: any) {
    return { start: (cb?: any) => cb && cb() };
  }
}

export const Marker: React.FC<MarkerProps> = ({
  coordinate,
  title,
  description,
  pinColor = '#EF4444',
  onPress,
  children,
}) => {
  if (children) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        style={styles.customMarkerWrap}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={styles.defaultMarkerWrap}
    >
      <View style={[styles.pinCircle, { backgroundColor: pinColor }]}>
        <MapPin size={16} color="#FFFFFF" />
      </View>
      {title ? (
        <View style={styles.pinCallout}>
          <Text style={styles.pinTitle} numberOfLines={1}>
            {title}
          </Text>
          {description ? (
            <Text style={styles.pinDesc} numberOfLines={1}>
              {description}
            </Text>
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

export const Circle: React.FC<CircleProps> = ({
  center,
  radius,
  fillColor = 'rgba(37, 99, 235, 0.15)',
  strokeColor = '#2563EB',
  strokeWidth = 1.5,
}) => {
  return null;
};

export const Polygon: React.FC<any> = ({ children }) => <>{children || null}</>;
export const Polyline: React.FC<any> = () => null;
export const Callout: React.FC<any> = ({ children, onPress }) => (
  <TouchableOpacity onPress={onPress}>{children}</TouchableOpacity>
);
export const Overlay: React.FC<any> = () => null;
export const Geojson: React.FC<any> = () => null;
export const UrlTile: React.FC<any> = () => null;

const MapView = forwardRef<any, MapViewProps>((props, ref) => {
  const { style, children, initialRegion, region } = props;

  const centerCoords = region || initialRegion || { latitude: 23.1412, longitude: 72.5489 };
  const iframeRef = React.useRef<any>(null);

  useImperativeHandle(ref, () => ({
    animateToRegion: (r: Region, duration?: number) => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({
          type: 'PAN_TO',
          lat: r.latitude,
          lon: r.longitude,
          zoom: 16
        }, '*');
      }
    },
    fitToCoordinates: (coords: LatLng[], options?: any) => {
      if (iframeRef.current?.contentWindow && coords.length > 0) {
        iframeRef.current.contentWindow.postMessage({
          type: 'FIT_BOUNDS',
          bounds: coords.map(c => [c.latitude, c.longitude])
        }, '*');
      }
    },
    animateCamera: () => {},
    getCamera: async () => ({}),
    setCamera: () => {},
    fitToSuppliedMarkers: () => {},
    pointForCoordinate: () => ({ x: 0, y: 0 }),
    coordinateForPoint: () => ({ latitude: 0, longitude: 0 }),
  }));

  const markers: any[] = [];
  const circles: any[] = [];

  const extractItems = (nodes: React.ReactNode) => {
    React.Children.forEach(nodes, (child: any) => {
      if (!child) return;
      if (child.props?.coordinate && child.props.coordinate.latitude != null && child.props.coordinate.longitude != null) {
        markers.push({
          lat: Number(child.props.coordinate.latitude),
          lon: Number(child.props.coordinate.longitude),
          title: child.props.title || '',
          description: child.props.description || '',
          color: child.props.pinColor || '#2563EB',
        });
      }
      if (child.props?.center && child.props.center.latitude != null && child.props.center.longitude != null) {
        circles.push({
          lat: Number(child.props.center.latitude),
          lon: Number(child.props.center.longitude),
          radius: Number(child.props.radius || 500),
          fillColor: child.props.fillColor || 'rgba(37, 99, 235, 0.2)',
          strokeColor: child.props.strokeColor || '#2563EB',
          strokeWidth: Number(child.props.strokeWidth || 2),
        });
      }
      if (child.props?.children) {
        extractItems(child.props.children);
      }
    });
  };

  extractItems(children);

  const htmlContent = React.useMemo(() => {
    const lat = centerCoords.latitude || 23.1412;
    const lon = centerCoords.longitude || 72.5489;
    const markersJson = JSON.stringify(markers);
    const circlesJson = JSON.stringify(circles);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; }
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #e2e8f0; font-family: system-ui, -apple-system, sans-serif; }
    .custom-pin {
      width: 24px; height: 24px; border-radius: 50%;
      border: 2px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex; align-items: center; justify-content: center;
      transform: translate(-12px, -12px);
    }
    .custom-pin span { width: 8px; height: 8px; border-radius: 50%; background: #ffffff; }
    .leaflet-control-attribution,
    div[class*="attrib"] {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
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
    var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([${lat}, ${lon}], 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: ''
    }).addTo(map);

    var markersData = ${markersJson};
    var circlesData = ${circlesJson};

    circlesData.forEach(function(c) {
      L.circle([c.lat, c.lon], {
        radius: c.radius,
        fillColor: c.fillColor,
        fillOpacity: 0.25,
        color: c.strokeColor,
        weight: c.strokeWidth || 2
      }).addTo(map);
    });

    var bounds = [];
    markersData.forEach(function(m) {
      bounds.push([m.lat, m.lon]);
      var icon = L.divIcon({
        className: 'marker-wrap',
        html: '<div class="custom-pin" style="background-color: ' + (m.color || '#2563EB') + '"><span></span></div>',
        iconSize: [24, 24]
      });
      var marker = L.marker([m.lat, m.lon], { icon: icon }).addTo(map);
      if (m.title || m.description) {
        var content = '<b>' + (m.title || 'Location') + '</b>';
        if (m.description) content += '<br><small>' + m.description + '</small>';
        marker.bindPopup(content);
      }
    });

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }

    window.addEventListener('message', function(e) {
      if (!e.data) return;
      if (e.data.type === 'PAN_TO') {
        map.setView([e.data.lat, e.data.lon], e.data.zoom || 16, { animate: true });
      } else if (e.data.type === 'FIT_BOUNDS') {
        map.fitBounds(e.data.bounds, { padding: [30, 30], maxZoom: 16 });
      }
    });
  </script>
</body>
</html>`;
  }, [centerCoords.latitude, centerCoords.longitude, JSON.stringify(markers), JSON.stringify(circles)]);

  return (
    <View style={[styles.mapContainer, style]}>
      <iframe
        ref={iframeRef}
        srcDoc={htmlContent}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
        title="Adani Workforce Map"
      />
    </View>
  );
});

MapView.displayName = 'MapView';

const styles = StyleSheet.create({
  mapContainer: {
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    position: 'relative',
    minHeight: 200,
  },
  mapGridPattern: {
    ...StyleSheet.absoluteFill as any,
    backgroundColor: '#F1F5F9',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    padding: 10,
  },
  mapWatermark: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  mapWatermarkText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  overlayLayer: {
    ...StyleSheet.absoluteFill as any,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
  },
  defaultMarkerWrap: {
    alignItems: 'center',
    margin: 4,
  },
  pinCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  pinCallout: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxWidth: 140,
    alignItems: 'center',
  },
  pinTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  pinDesc: {
    fontSize: 9,
    color: '#64748B',
  },
});

export default MapView;
