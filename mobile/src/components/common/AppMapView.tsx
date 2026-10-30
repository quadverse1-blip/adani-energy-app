import MapView, {
  Marker,
  Circle,
  Polygon,
  Polyline,
  Callout,
  Overlay,
  Geojson,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
  AnimatedRegion,
  LatLng,
  Region,
  MapViewProps,
  MapMarkerProps as MarkerProps,
  MapCircleProps as CircleProps,
} from 'react-native-maps';

// Safe dummy UrlTile component to prevent Property 'UrlTile' doesn't exist runtime errors
export const UrlTile: React.FC<any> = () => null;

export {
  Marker,
  Circle,
  Polygon,
  Polyline,
  Callout,
  Overlay,
  Geojson,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
  AnimatedRegion,
  LatLng,
  Region,
  MapViewProps,
  MarkerProps,
  CircleProps,
};

export default MapView;
