import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  Navigation,
  X,
  MapPin,
  Clock,
  ArrowRight,
  Layers,
  Compass,
  Milestone,
} from 'lucide-react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from './AppMapView';
import { routingService } from '../../services/routingService';

export interface ShiftRouteModalProps {
  visible: boolean;
  onClose: () => void;
  technicianName: string;
  formattedDate: string;
  checkInSiteName: string;
  checkInTime: string;
  checkOutSiteName?: string;
  checkOutTime?: string;
  distanceTraveled?: string;
  duration?: string;
  checkInCoords?: { latitude: number; longitude: number };
  checkOutCoords?: { latitude: number; longitude: number };
}

interface LatLng {
  latitude: number;
  longitude: number;
}

export const ShiftRouteModal: React.FC<ShiftRouteModalProps> = ({
  visible,
  onClose,
  technicianName,
  formattedDate,
  checkInSiteName,
  checkInTime,
  checkOutSiteName,
  checkOutTime,
  distanceTraveled,
  duration,
  checkInCoords,
  checkOutCoords,
}) => {
  const mapRef = useRef<any>(null);
  const [mapType, setMapType] = useState<'standard' | 'hybrid'>('standard');
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [loadingRoute, setLoadingRoute] = useState(false);

  // Check if shift is currently active (no check-out recorded yet)
  const isShiftActive =
    !checkOutCoords ||
    !checkOutCoords.latitude ||
    !checkOutCoords.longitude ||
    (checkOutCoords.latitude === checkInCoords?.latitude && checkOutCoords.longitude === checkInCoords?.longitude) ||
    !checkOutTime ||
    checkOutTime === '--:--';

  // Real check-in and destination coordinates
  const startLat = checkInCoords?.latitude || 12.962590;
  const startLon = checkInCoords?.longitude || 77.593617;
  const endLat = !isShiftActive && checkOutCoords ? checkOutCoords.latitude : startLat;
  const endLon = !isShiftActive && checkOutCoords ? checkOutCoords.longitude : startLon;

  const displayCheckInSite = checkInSiteName || 'Assigned Substation';
  const displayCheckOutSite = checkOutSiteName && checkOutSiteName !== '--' ? checkOutSiteName : (isShiftActive ? 'In Progress' : '--');
  const displayCheckInTime = checkInTime && checkInTime !== '--:--' ? checkInTime : '--:--';
  const displayCheckOutTime = checkOutTime && checkOutTime !== '--:--' ? checkOutTime : (isShiftActive ? 'Shift Active' : '--:--');
  const displayDistance = distanceTraveled && distanceTraveled !== '--' ? distanceTraveled : '0 m';
  const displayDuration = duration && duration !== '--' ? duration : (isShiftActive ? 'In Progress' : '--');

  // Initial Region centered on check-in or between check-in and check-out
  const initialRegion = useMemo(() => {
    if (isShiftActive) {
      return {
        latitude: startLat,
        longitude: startLon,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      };
    }
    const midLat = (startLat + endLat) / 2;
    const midLon = (startLon + endLon) / 2;
    const latDelta = Math.max(Math.abs(startLat - endLat) * 1.6, 0.012);
    const lonDelta = Math.max(Math.abs(startLon - endLon) * 1.6, 0.012);

    return {
      latitude: midLat,
      longitude: midLon,
      latitudeDelta: latDelta,
      longitudeDelta: lonDelta,
    };
  }, [isShiftActive, startLat, startLon, endLat, endLon]);

  // Fetch real road coordinates between check-in and check-out sites using OSRM
  useEffect(() => {
    let isMounted = true;

    if (isShiftActive) {
      setRouteCoords([]);
      setLoadingRoute(false);
      return;
    }

    const fetchRoadPath = async () => {
      setLoadingRoute(true);
      try {
        const routeData = await routingService.getRoadRoute(startLat, startLon, endLat, endLon);
        if (isMounted && routeData.coordinates && routeData.coordinates.length > 0) {
          const coords: LatLng[] = routeData.coordinates.map((pt) => ({
            latitude: pt[0],
            longitude: pt[1],
          }));
          setRouteCoords(coords);
          setLoadingRoute(false);
          return;
        }
      } catch (err) {
        console.warn('Backend OSRM route fetch failed, using fallback:', err);
      }

      if (isMounted) {
        const fallback: LatLng[] = [
          { latitude: startLat, longitude: startLon },
          { latitude: endLat, longitude: endLon },
        ];
        setRouteCoords(fallback);
        setLoadingRoute(false);
      }
    };

    fetchRoadPath();

    return () => {
      isMounted = false;
    };
  }, [isShiftActive, startLat, startLon, endLat, endLon]);

  // Auto-fit coordinates on native React Native MapView
  useEffect(() => {
    if (mapRef.current && routeCoords.length > 0 && Platform.OS !== 'web') {
      const timer = setTimeout(() => {
        mapRef.current?.fitToCoordinates(routeCoords, {
          edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
          animated: true,
        });
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [routeCoords]);

  // Clean Web Fallback (If accessed via Web Browser)
  const webLeafletHtml = useMemo(() => {
    if (Platform.OS !== 'web') return '';

    const coordsJson = JSON.stringify(routeCoords.map((c) => [c.latitude, c.longitude]));
    const isSat = mapType === 'hybrid';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; }
    html, body, #map {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #0f172a;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .pin-label {
      background: #0F172A;
      color: #FFFFFF;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 800;
      white-space: nowrap;
      border: 1px solid rgba(255,255,255,0.2);
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
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
    var coords = ${coordsJson};
    var startLat = ${startLat};
    var startLon = ${startLon};
    var endLat = ${endLat};
    var endLon = ${endLon};
    var isShiftActive = ${isShiftActive ? 'true' : 'false'};
    var isSat = ${isSat ? 'true' : 'false'};

    var centerLat = isShiftActive ? startLat : (startLat + endLat) / 2;
    var centerLon = isShiftActive ? startLon : (startLon + endLon) / 2;
    var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([centerLat, centerLon], isShiftActive ? 16 : 15);

    if (isSat) {
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map);
    } else {
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    }

    if (!isShiftActive && coords && coords.length > 0) {
      // Outer border stroke
      L.polyline(coords, { color: '#0F172A', weight: 8, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }).addTo(map);
      // Inner vibrant stroke
      var line = L.polyline(coords, { color: '#4338CA', weight: 5, opacity: 1.0, lineCap: 'round', lineJoin: 'round' }).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [50, 50] });
    }

    // Start marker / Current location marker
    var startText = isShiftActive ? '🟢 Live Location • ${displayCheckInSite}' : '• ${displayCheckInSite}';
    var startIcon = L.divIcon({
      html: '<div class="pin-label" style="border-color:#10B981;">' + startText + '</div>',
      iconAnchor: [30, 20]
    });
    L.marker([startLat, startLon], { icon: startIcon }).addTo(map);

    // End marker (only rendered if checkout occurred)
    if (!isShiftActive) {
      var endIcon = L.divIcon({
        html: '<div class="pin-label" style="border-color:#EF4444;">📍 ${displayCheckOutSite}</div>',
        iconAnchor: [30, 20]
      });
      L.marker([endLat, endLon], { icon: endIcon }).addTo(map);
    }
  </script>
</body>
</html>
    `;
  }, [routeCoords, mapType, isShiftActive, startLat, startLon, endLat, endLon, displayCheckInSite, displayCheckOutSite]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconBadge}>
                <Navigation size={20} color="#4338CA" />
              </View>
              <View style={styles.headerTitleWrap}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  Employee Travel Route
                </Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {technicianName} • {formattedDate}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              accessibilityLabel="Close"
            >
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Clean Transit Summary Card */}
          <View style={styles.tripSummaryCard}>
            {/* Top row: Check-In -> Check-Out Sites */}
            <View style={styles.tripLocationsRow}>
              <View style={styles.locationBlock}>
                <View style={styles.dotAndLabel}>
                  <View style={styles.greenDot} />
                  <Text style={styles.locationTypeLabel}>START (CHECK-IN)</Text>
                </View>
                <Text style={styles.locationName} numberOfLines={1}>
                  {displayCheckInSite}
                </Text>
                <Text style={styles.locationTime}>{displayCheckInTime}</Text>
              </View>

              <View style={styles.arrowBetween}>
                <ArrowRight size={18} color="#94A3B8" />
              </View>

              <View style={styles.locationBlock}>
                <View style={styles.dotAndLabel}>
                  <View style={styles.redDot} />
                  <Text style={styles.locationTypeLabelRed}>END (CHECK-OUT)</Text>
                </View>
                <Text style={styles.locationName} numberOfLines={1}>
                  {displayCheckOutSite}
                </Text>
                <Text style={styles.locationTime}>{displayCheckOutTime}</Text>
              </View>
            </View>

            {/* Bottom Row: Distance & Transit Stats (2 Clean KPI Cards) */}
            <View style={styles.tripStatsRow}>
              <View style={styles.statCard}>
                <View style={styles.statHeaderRow}>
                  <Milestone size={13} color="#4338CA" />
                  <Text style={styles.statLabel}>ROAD DISTANCE</Text>
                </View>
                <Text style={styles.statValueBold} numberOfLines={1}>
                  {displayDistance}
                </Text>
              </View>

              <View style={styles.statCard}>
                <View style={styles.statHeaderRow}>
                  <Clock size={13} color="#059669" />
                  <Text style={styles.statLabelGreen}>SHIFT DURATION</Text>
                </View>
                <Text style={styles.statValueBoldGreen} numberOfLines={1}>
                  {displayDuration}
                </Text>
              </View>
            </View>
          </View>

          {/* React Native Map Container */}
          <View style={styles.mapContainer}>
            {Platform.OS !== 'web' ? (
              <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
                initialRegion={initialRegion}
                mapType={mapType}
                showsCompass={true}
                showsMyLocationButton={false}
              >
                {/* Outer Dark Outline for Polyline */}
                {routeCoords.length > 0 && (
                  <Polyline
                    coordinates={routeCoords}
                    strokeColor="#0F172A"
                    strokeWidth={8}
                    lineCap="round"
                    lineJoin="round"
                    zIndex={1}
                  />
                )}

                {/* Inner Vibrant Purple-Blue Road Polyline */}
                {routeCoords.length > 0 && (
                  <Polyline
                    coordinates={routeCoords}
                    strokeColor="#4338CA"
                    strokeWidth={5}
                    lineCap="round"
                    lineJoin="round"
                    zIndex={2}
                  />
                )}

                {/* Start Marker (Live Check-In Site) */}
                <Marker
                  coordinate={{ latitude: startLat, longitude: startLon }}
                  title={displayCheckInSite}
                  description={isShiftActive ? `Live Site Location • Check-In: ${displayCheckInTime}` : `Check-In Time: ${displayCheckInTime}`}
                  pinColor="#10B981"
                  zIndex={10}
                >
                  <View style={styles.customMarkerWrap}>
                    <View style={styles.startMarkerPill}>
                      <View style={styles.markerInnerDotGreen} />
                      <Text style={styles.startMarkerText} numberOfLines={1}>
                        {isShiftActive ? `${displayCheckInSite} (Live Location)` : displayCheckInSite}
                      </Text>
                    </View>
                    <View style={styles.markerStem} />
                  </View>
                </Marker>

                {/* Destination Marker (Check-Out) - Only shown if shift completed */}
                {!isShiftActive && (
                  <Marker
                    coordinate={{ latitude: endLat, longitude: endLon }}
                    title={displayCheckOutSite}
                    description={`Check-Out Time: ${displayCheckOutTime}`}
                    pinColor="#EF4444"
                    zIndex={10}
                  >
                    <View style={styles.customMarkerWrap}>
                      <View style={styles.endMarkerPill}>
                        <MapPin size={12} color="#FFFFFF" fill="#FFFFFF" />
                        <Text style={styles.endMarkerText} numberOfLines={1}>
                          {displayCheckOutSite}
                        </Text>
                      </View>
                      <View style={styles.markerStemRed} />
                    </View>
                  </Marker>
                )}
              </MapView>
            ) : (
              // Web Fallback
              <iframe
                title="Employee Travel Route"
                srcDoc={webLeafletHtml}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
              />
            )}

            {/* Map Layer Switcher Button (Floating Top Right) */}
            <TouchableOpacity
              style={styles.mapTypeBtn}
              onPress={() => setMapType((prev) => (prev === 'standard' ? 'hybrid' : 'standard'))}
              activeOpacity={0.8}
            >
              <Layers size={14} color="#0F172A" />
              <Text style={styles.mapTypeBtnText}>
                {mapType === 'hybrid' ? 'Satellite' : 'Standard'}
              </Text>
            </TouchableOpacity>

            {/* Loading Indicator for Road Route */}
            {loadingRoute && (
              <View style={styles.loadingRouteBadge}>
                <ActivityIndicator size="small" color="#4338CA" />
                <Text style={styles.loadingRouteText}>Loading road geometry...</Text>
              </View>
            )}

            {/* Bottom Real Road Pill */}
            <View style={styles.bottomRoadPill}>
              <View style={styles.roadDot} />
              <Text style={styles.bottomRoadText}>
                Actual road trajectory: {displayDistance} via street network
              </Text>
            </View>
          </View>

          {/* Footer Action Row */}
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={styles.closeActionBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.closeActionBtnText}>Close Map</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.70)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 640,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  // Trip Summary Card
  tripSummaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  tripLocationsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  locationBlock: {
    flex: 1,
  },
  dotAndLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  greenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  redDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
  },
  locationTypeLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.4,
  },
  locationTypeLabelRed: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.4,
  },
  locationName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  locationTime: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  arrowBetween: {
    paddingHorizontal: 8,
  },
  tripStatsRow: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  statHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#4338CA',
    letterSpacing: 0.4,
  },
  statLabelGreen: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.4,
  },
  statValueBold: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  statValueBoldGreen: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },

  // Map Container
  mapContainer: {
    height: 360,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  mapTypeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 100,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mapTypeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  loadingRouteBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  loadingRouteText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4338CA',
  },
  bottomRoadPill: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    zIndex: 100,
    backgroundColor: 'rgba(15, 23, 42, 0.90)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38BDF8',
  },
  bottomRoadText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F8FAFC',
    flex: 1,
  },

  // Custom Markers
  customMarkerWrap: {
    alignItems: 'center',
  },
  startMarkerPill: {
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#10B981',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  markerInnerDotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  startMarkerText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    maxWidth: 110,
  },
  markerStem: {
    width: 2,
    height: 6,
    backgroundColor: '#10B981',
  },
  endMarkerPill: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#DC2626',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  endMarkerText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    maxWidth: 110,
  },
  markerStemRed: {
    width: 2,
    height: 6,
    backgroundColor: '#DC2626',
  },

  // Footer Row
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 12,
  },
  closeActionBtn: {
    backgroundColor: '#0F172A',
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  closeActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
});

export default ShiftRouteModal;
