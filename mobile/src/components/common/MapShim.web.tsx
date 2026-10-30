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

  useImperativeHandle(ref, () => ({
    animateToRegion: (r: Region, duration?: number) => {},
    fitToCoordinates: (coords: LatLng[], options?: any) => {},
    animateCamera: (camera: any, duration?: number) => {},
    getCamera: async () => ({}),
    setCamera: (camera: any) => {},
    fitToSuppliedMarkers: (markers: string[], options?: any) => {},
    pointForCoordinate: () => ({ x: 0, y: 0 }),
    coordinateForPoint: () => ({ latitude: 0, longitude: 0 }),
  }));

  const centerCoords = region || initialRegion || { latitude: 18.59127, longitude: 73.73891 };

  return (
    <View style={[styles.mapContainer, style]}>
      {/* Background Map Representation */}
      <View style={styles.mapGridPattern}>
        <View style={styles.mapWatermark}>
          <Text style={styles.mapWatermarkText}>
            Adani Live GIS Telemetry • Lat {centerCoords.latitude.toFixed(4)}, Lon {centerCoords.longitude.toFixed(4)}
          </Text>
        </View>
      </View>

      {/* Markers / Geofences / Custom Child Overlays */}
      <View style={styles.overlayLayer}>
        {children}
      </View>
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
