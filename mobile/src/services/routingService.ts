import { apiClient } from './api';

export interface RouteStep {
  instruction: string;
  name?: string;
  distance: number;
  duration: number;
}

export interface RoadRouteResponse {
  success: boolean;
  isRoadRoute: boolean;
  source: 'osrm' | 'fallback_interpolation';
  distanceKm: number;
  distanceMeters: number;
  straightLineKm: number;
  durationMinutes: number;
  durationFormatted: string;
  coordinates: [number, number][]; // [lat, lon]
  geojson?: any;
  steps: RouteStep[];
}

export interface MatchGpsResponse {
  success: boolean;
  snapped: boolean;
  source: string;
  distanceKm: number;
  distanceMeters: number;
  durationFormatted?: string;
  coordinates: [number, number][]; // [lat, lon]
  geojson?: any;
}

export interface MaharashtraMapConfig {
  state: string;
  country: string;
  center: {
    latitude: number;
    longitude: number;
    zoom: number;
    minZoom: number;
    maxZoom: number;
  };
  bbox: {
    minLatitude: number;
    maxLatitude: number;
    minLongitude: number;
    maxLongitude: number;
  };
  districts: Array<{
    name: string;
    latitude: number;
    longitude: number;
    code: string;
  }>;
  tileProvider: string;
  styleUrl: string;
}

export const routingService = {
  /**
   * Fetches accurate road-based navigation route between two coordinates using OSRM + OSM.
   */
  async getRoadRoute(
    startLat: number,
    startLon: number,
    endLat: number,
    endLon: number,
    alternatives = false
  ): Promise<RoadRouteResponse> {
    // 1. Direct OSRM public API query for high-performance road-following routing
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson&steps=true`;
      const res = await fetch(osrmUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const distKm = Math.round((route.distance / 1000.0) * 100) / 100;
          const durMins = Math.max(Math.round(route.duration / 60.0), 1);
          const coords: [number, number][] =
            route.geometry?.coordinates?.map((c: [number, number]) => [c[1], c[0]]) || [];
          return {
            success: true,
            isRoadRoute: true,
            source: 'osrm',
            distanceKm: distKm,
            distanceMeters: Math.round(route.distance),
            straightLineKm: Math.round(Math.hypot(endLat - startLat, endLon - startLon) * 111.0 * 100) / 100,
            durationMinutes: durMins,
            durationFormatted: durMins < 60 ? `${durMins} mins` : `${Math.floor(durMins / 60)}h ${durMins % 60}m`,
            coordinates: coords,
            geojson: {
              type: 'Feature',
              properties: {},
              geometry: route.geometry,
            },
            steps: [],
          };
        }
      }
    } catch {
      // Direct OSRM failed, try backend proxy
    }

    // 2. Secondary Backend API query
    try {
      const response = await apiClient.get<RoadRouteResponse>('/routing/route', {
        params: {
          start_lat: startLat,
          start_lon: startLon,
          end_lat: endLat,
          end_lon: endLon,
          alternatives,
        },
      });
      return response.data;
    } catch {
      // Client-side fallback if network offline
      const dLat = endLat - startLat;
      const dLon = endLon - startLon;
      const straightKm = Math.sqrt(dLat * dLat + dLon * dLon) * 111.0;
      const roadKm = Math.round(straightKm * 1.25 * 100) / 100;
      const durMins = Math.max(Math.round((roadKm / 35.0) * 60), 2);
      return {
        success: true,
        isRoadRoute: false,
        source: 'fallback_interpolation',
        distanceKm: roadKm,
        distanceMeters: Math.round(roadKm * 1000),
        straightLineKm: Math.round(straightKm * 100) / 100,
        durationMinutes: durMins,
        durationFormatted: durMins < 60 ? `${durMins} mins` : `${Math.floor(durMins / 60)}h ${durMins % 60}m`,
        coordinates: [
          [startLat, startLon],
          [(startLat + endLat) / 2 + 0.005, (startLon + endLon) / 2 - 0.005],
          [endLat, endLon],
        ],
        steps: [{ instruction: `Proceed towards destination (${roadKm} km)`, distance: roadKm * 1000, duration: durMins * 60 }],
      };
    }
  },

  /**
   * Snaps GPS breadcrumbs to the road network using OSRM Match
   */
  async matchGpsTrail(points: Array<{ latitude: number; longitude: number; timestamp?: string }>): Promise<MatchGpsResponse> {
    try {
      const response = await apiClient.post<MatchGpsResponse>('/routing/match', { points });
      return response.data;
    } catch {
      return {
        success: true,
        snapped: false,
        source: 'raw_gps',
        distanceKm: 0,
        distanceMeters: 0,
        coordinates: points.map((p) => [p.latitude, p.longitude]),
      };
    }
  },

  /**
   * Returns India initial view coordinates, bounding box, and major operational zones
   */
  async getMaharashtraConfig(): Promise<MaharashtraMapConfig> {
    try {
      const response = await apiClient.get<MaharashtraMapConfig>('/routing/india');
      return response.data;
    } catch {
      try {
        const response = await apiClient.get<MaharashtraMapConfig>('/routing/maharashtra');
        return response.data;
      } catch {
        return {
          state: 'All India',
          country: 'India',
          center: {
            latitude: 22.5937,
            longitude: 78.9629,
            zoom: 5,
            minZoom: 4,
            maxZoom: 20,
          },
          bbox: {
            minLatitude: 8.0883,
            maxLatitude: 37.0841,
            minLongitude: 68.1766,
            maxLongitude: 97.4026,
          },
          districts: [
            { name: 'All India', latitude: 22.5937, longitude: 78.9629, code: 'IND' },
            { name: 'Delhi NCR', latitude: 28.6139, longitude: 77.2090, code: 'DEL' },
            { name: 'Gujarat (Adani Hub)', latitude: 23.0225, longitude: 72.5714, code: 'GUJ' },
            { name: 'Mundra Port Grid', latitude: 22.8394, longitude: 69.7091, code: 'MND' },
            { name: 'Maharashtra', latitude: 19.7515, longitude: 75.7139, code: 'MH' },
            { name: 'Mumbai City', latitude: 18.9388, longitude: 72.8354, code: 'MUM' },
            { name: 'Mumbai Suburban (BKC)', latitude: 19.0657, longitude: 72.8687, code: 'BKC' },
            { name: 'Navi Mumbai', latitude: 19.033, longitude: 73.0297, code: 'NVM' },
            { name: 'Thane', latitude: 19.2183, longitude: 72.9781, code: 'THN' },
            { name: 'Pune (Hinjawadi)', latitude: 18.5204, longitude: 73.8567, code: 'PUN' },
            { name: 'Bengaluru', latitude: 12.9716, longitude: 77.5946, code: 'BLR' },
            { name: 'Hyderabad', latitude: 17.3850, longitude: 78.4867, code: 'HYD' },
            { name: 'Chennai', latitude: 13.0827, longitude: 80.2707, code: 'MAA' },
            { name: 'Kolkata', latitude: 22.5726, longitude: 88.3639, code: 'CCU' },
            { name: 'Rajasthan (Jaipur)', latitude: 26.9124, longitude: 75.7873, code: 'JAI' },
            { name: 'Nashik', latitude: 19.9975, longitude: 73.7898, code: 'NSK' },
            { name: 'Nagpur', latitude: 21.1458, longitude: 79.0882, code: 'NGP' },
            { name: 'Chhatrapati Sambhajinagar', latitude: 19.8762, longitude: 75.3433, code: 'CSN' },
            { name: 'Kolhapur', latitude: 16.705, longitude: 74.2433, code: 'KLP' },
            { name: 'Solapur', latitude: 17.6599, longitude: 75.9064, code: 'SLP' },
          ],
          tileProvider: 'Mappls',
          styleUrl: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        };
      }
    }
  },
};

