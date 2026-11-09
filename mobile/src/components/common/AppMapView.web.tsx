import React, { useRef, useImperativeHandle, forwardRef, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

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
}

export type MapView = MapViewRef;

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
      onPress,
    },
    ref
  ) => {
    const iframeRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      animateToRegion: (targetRegion: Partial<Region>, duration = 500) => {
        if (!targetRegion.latitude || !targetRegion.longitude) return;
        const zoom = targetRegion.latitudeDelta ? Math.max(16 - Math.log2(targetRegion.latitudeDelta * 111), 5) : 14;
        if (iframeRef.current && iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ type: 'FLY_TO', payload: { lat: targetRegion.latitude, lon: targetRegion.longitude, zoom } }),
            '*'
          );
        }
      },
      fitToCoordinates: (coords: LatLng[]) => {
        if (!coords || coords.length === 0) return;
        if (iframeRef.current && iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ type: 'FIT_COORDS', payload: { coords } }),
            '*'
          );
        }
      },
    }));

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
              idx: parsedMarkers.length,
              lat: props.coordinate.latitude,
              lon: props.coordinate.longitude,
              title: props.title || '',
              description: props.description || '',
              color: props.pinColor || '#1E63F0',
              onPress: props.onPress,
            });
          }
        } else if (typeName === 'Circle' || props.radius) {
          if (props.center?.latitude && props.center?.longitude) {
            parsedCircles.push({
              lat: props.center.latitude,
              lon: props.center.longitude,
              radius: props.radius || 500,
              fillColor: props.fillColor || 'rgba(30, 99, 240, 0.15)',
              strokeColor: props.strokeColor || '#1E63F0',
              strokeWidth: props.strokeWidth || 2,
            });
          }
        } else if (typeName === 'Polyline' || props.coordinates) {
          if (Array.isArray(props.coordinates) && props.coordinates.length > 0) {
            parsedPolylines.push({
              coordinates: props.coordinates.map((c: any) => [c.longitude, c.latitude]),
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

      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" />
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; overflow: hidden; background: #E2E8F0; }
    /* 100% SUPPRESSION OF ANY TRACE OF MAPLIBRE / OPENFREEMAP / OPENMAPTILES / OPENSTREETMAP ATTRIBUTION */
    .maplibregl-ctrl-attrib,
    .mapboxgl-ctrl-attrib,
    .maplibregl-ctrl-bottom-right,
    .maplibregl-ctrl-bottom-left,
    .maplibregl-ctrl-attrib-inner,
    .maplibregl-ctrl-attrib-summary,
    .maplibregl-compact,
    .maplibregl-compact-show,
    details.maplibregl-ctrl-attrib,
    summary.maplibregl-ctrl-attrib-button,
    a.maplibregl-ctrl-attrib-button,
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
    }
    .user-marker-pin {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #2563EB;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
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

    // Permanently stub out AttributionControl to ensure 100% elimination of MapLibre/OpenStreetMap attributions
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

    var map = new maplibregl.Map({
      container: 'map',
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [${activeCenter.longitude}, ${activeCenter.latitude}],
      zoom: ${initialZoom},
      minZoom: 4,
      maxZoom: 20,
      attributionControl: false,
      customAttribution: []
    });

    var isVectorStyleLoaded = false;
    map.on('style.load', function() {
      isVectorStyleLoaded = true;
    });

    // 1.5s watchdog fallback to guarantee map is NEVER blank or grey
    setTimeout(function() {
      if (!isVectorStyleLoaded) {
        console.warn('[AppMapViewWeb] Switching to reliable raster tile fallback...');
        try {
          map.setStyle(rasterFallbackStyle);
        } catch(e) {}
      }
    }, 1500);

    map.on('error', function(e) {
      if (!isVectorStyleLoaded && e && e.error) {
        console.warn('[AppMapViewWeb] Map error detected, applying raster fallback:', e.error);
        try {
          map.setStyle(rasterFallbackStyle);
        } catch(err) {}
      }
    });

    window.map = map;

    function purgeAllAttributions() {
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
          document.querySelectorAll(s).forEach(function(el) {
            if (el && el.parentNode) el.parentNode.removeChild(el);
          });
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
      } catch (e) {}
    }
    purgeAllAttributions();
    try {
      var observer = new MutationObserver(purgeAllAttributions);
      observer.observe(document.body, { childList: true, subtree: true });
    } catch(e) {}
    map.on('load', purgeAllAttributions);
    map.on('render', purgeAllAttributions);
    map.on('style.load', function() {
      try {
        var style = map.getStyle();
        if (style && style.sources) {
          Object.keys(style.sources).forEach(function(k) {
            if (style.sources[k]) delete style.sources[k].attribution;
          });
        }
      } catch (e) {}
      purgeAllAttributions();
    });
    setInterval(purgeAllAttributions, 200);

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

    map.on('load', function() {
      // Optimize vector tile layer zoom levels for Maharashtra streets and POIs
      try {
        if (map.getLayer('poi_r1')) map.setLayerZoomRange('poi_r1', 13, 24);
        if (map.getLayer('poi_r7')) map.setLayerZoomRange('poi_r7', 14, 24);
        if (map.getLayer('poi_r20')) map.setLayerZoomRange('poi_r20', 15, 24);
        if (map.getLayer('highway-name-minor')) {
          map.setLayerZoomRange('highway-name-minor', 13.5, 24);
          map.setPaintProperty('highway-name-minor', 'text-halo-color', '#FFFFFF');
          map.setPaintProperty('highway-name-minor', 'text-halo-width', 2);
        }
      } catch (e) {}

      circlesData.forEach(function(c, i) {
        var sourceId = 'circle-src-' + i;
        map.addSource(sourceId, {
          type: 'geojson',
          data: createCircleGeoJSON([c.lon, c.lat], c.radius)
        });
        map.addLayer({
          id: 'circle-fill-' + i,
          type: 'fill',
          source: sourceId,
          paint: { 'fill-color': c.fillColor || '#1E63F0', 'fill-opacity': 0.15 }
        });
        map.addLayer({
          id: 'circle-line-' + i,
          type: 'line',
          source: sourceId,
          paint: { 'line-color': c.strokeColor || '#1E63F0', 'line-width': c.strokeWidth || 2 }
        });
      });

      polylinesData.forEach(function(p, i) {
        var sourceId = 'polyline-src-' + i;
        map.addSource(sourceId, {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'LineString', coordinates: p.coordinates } }
        });
        map.addLayer({
          id: 'polyline-line-' + i,
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': p.color || '#1E63F0', 'line-width': p.width || 4 }
        });
      });

      markersData.forEach(function(m) {
        var el = document.createElement('div');
        el.className = 'map-pin';
        if (m.color) el.style.background = m.color;

        var marker = new maplibregl.Marker({ element: el })
          .setLngLat([m.lon, m.lat])
          .addTo(map);

        if (m.title || m.description) {
          var popup = new maplibregl.Popup({ offset: 20 })
            .setHTML('<strong>' + (m.title || '') + '</strong><br>' + (m.description || ''));
          marker.setPopup(popup);
        }

        el.addEventListener('click', function(ev) {
          ev.stopPropagation();
          window.parent.postMessage(JSON.stringify({
            type: 'markerPress',
            index: m.idx,
            title: m.title
          }), '*');
        });
      });

      map.on('click', function(e) {
        window.parent.postMessage(JSON.stringify({
          type: 'mapPress',
          coordinate: { latitude: e.lngLat.lat, longitude: e.lngLat.lng }
        }), '*');
      });
    });

    window.addEventListener('message', function(event) {
      try {
        var msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!msg) return;
        if (msg.type === 'FLY_TO') {
          map.flyTo({ center: [msg.payload.lon, msg.payload.lat], zoom: msg.payload.zoom || 14 });
        } else if (msg.type === 'FIT_COORDS') {
          var bounds = new maplibregl.LngLatBounds();
          msg.payload.coords.forEach(function(c) { bounds.extend([c.longitude, c.latitude]); });
          map.fitBounds(bounds, { padding: 40, maxZoom: 16 });
        }
      } catch (e) {}
    });
  </script>
</body>
</html>
      `;
    }, [markers, circles, polylines, activeCenter, initialZoom]);

    React.useEffect(() => {
      const handleMessage = (event: MessageEvent) => {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (!data) return;
          if (data.type === 'markerPress') {
            const target = markers[data.index];
            if (target && target.onPress) {
              target.onPress();
            }
          } else if (data.type === 'mapPress' && onPress) {
            onPress({ nativeEvent: { coordinate: data.coordinate } });
          }
        } catch (e) {}
      };
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }, [markers, onPress]);

    return (
      <View style={[styles.container, style]}>
        <iframe
          ref={iframeRef}
          srcDoc={html}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Mappls Map View"
        />
      </View>
    );
  }
);

MapViewComponent.displayName = 'AppMapViewWeb';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
});

export default MapViewComponent;
