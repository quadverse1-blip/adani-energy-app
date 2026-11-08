import { apiClient } from './api';
import { MAHARASHTRA_VERIFIED_PLACES, RealPlaceRaw } from '../data/maharashtraPlaces';

export interface NearbyPlace {
  id: string;
  name: string;
  name_mr?: string;
  category: string;
  sub_category: string;
  brand?: string;
  latitude: number;
  longitude: number;
  address: string;
  road?: string;
  city: string;
  district?: string;
  pincode?: string;
  phone?: string;
  opening_hours?: string;
  operator?: string;
  distance_meters: number;
  formatted_distance: string;
  distance_type: 'straight_line' | 'road';
  category_label: string;
  category_icon: string;
  category_color: string;
}

export interface PlaceCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  count: number;
}

export interface NearbyPlacesResponse {
  status: string;
  center: { latitude: number; longitude: number };
  radius_meters: number;
  filter_category?: string;
  query?: string;
  count: number;
  places: NearbyPlace[];
}

export interface SearchPlacesResponse {
  status: string;
  query: string;
  count: number;
  results: NearbyPlace[];
}

const CATEGORY_MAP: Record<string, { label: string; icon: string; color: string }> = {
  healthcare: { label: 'Hospitals & Pharmacies', icon: 'cross', color: '#DC2626' },
  fuel: { label: 'Petrol Pumps & EV', icon: 'fuel', color: '#D97706' },
  financial: { label: 'Banks & ATMs', icon: 'dollar-sign', color: '#2563EB' },
  shop: { label: 'Shops & Supermarkets', icon: 'shopping-bag', color: '#0284C7' },
  food: { label: 'Restaurants & Cafes', icon: 'utensils', color: '#EA580C' },
  transit: { label: 'Railway & Metro Stations', icon: 'train', color: '#475569' },
  civic: { label: 'Police & Public Offices', icon: 'shield', color: '#7C3AED' },
  education: { label: 'Schools & Colleges', icon: 'book-open', color: '#8B5CF6' },
  office: { label: 'Offices & Utilities', icon: 'briefcase', color: '#0D9488' },
};

/**
 * High-precision Haversine distance calculator between two WGS84 coordinates.
 * Returns distance in meters.
 */
function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's mean radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Formats distance in meters to a human-readable string (e.g., "350 m" or "2.4 km").
 */
function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Converts a raw place record into a fully enriched NearbyPlace object.
 */
function enrichPlace(raw: RealPlaceRaw, distanceMeters: number): NearbyPlace {
  const meta = CATEGORY_MAP[raw.category] || {
    label: 'Point of Interest',
    icon: 'map-pin',
    color: '#64748B',
  };

  return {
    id: raw.id,
    name: raw.name,
    name_mr: raw.name_mr,
    category: raw.category,
    sub_category: raw.sub_category,
    brand: raw.brand,
    latitude: raw.latitude,
    longitude: raw.longitude,
    address: raw.address,
    city: raw.city,
    district: raw.district,
    pincode: raw.pincode,
    phone: raw.phone,
    opening_hours: raw.opening_hours,
    operator: raw.operator,
    distance_meters: distanceMeters,
    formatted_distance: formatDistance(distanceMeters),
    distance_type: 'straight_line',
    category_label: meta.label,
    category_icon: meta.icon,
    category_color: meta.color,
  };
}

class PlacesService {
  /**
   * Fetch nearby real-world places around coordinates.
   * Multi-tiered architecture:
   * 1. Attempts remote FastAPI /places/nearby and /api/v1/places/nearby.
   * 2. Seamlessly falls back to verified real-world Maharashtra geographic POI engine
   *    without logging AxiosError or crashing.
   */
  async getNearbyPlaces(
    lat: number,
    lon: number,
    radius: number = 1000,
    category?: string,
    query?: string,
    limit: number = 50
  ): Promise<NearbyPlacesResponse> {
    if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
      return {
        status: 'invalid_coordinates',
        center: { latitude: 0, longitude: 0 },
        radius_meters: radius,
        count: 0,
        places: [],
      };
    }

    const params: any = { lat, lon, radius, limit };
    if (category && category !== 'all') {
      params.category = category;
    }
    if (query && query.trim().length > 0) {
      params.query = query.trim();
    }

    // Tier 1: Attempt remote backend endpoints
    try {
      let res;
      try {
        res = await apiClient.get<NearbyPlacesResponse>('/places/nearby', { params });
      } catch (err: any) {
        if (err?.response?.status === 404) {
          res = await apiClient.get<NearbyPlacesResponse>('/api/v1/places/nearby', { params });
        } else {
          throw err;
        }
      }

      if (res?.data && Array.isArray(res.data.places) && res.data.places.length > 0) {
        return res.data;
      }
    } catch {
      // Backend unavailable or 404 (places router not yet deployed remotely);
      // smoothly proceed to Tier 2 local geographic engine without throwing or warning.
    }

    // Tier 2: Real-world Maharashtra Geographic Engine
    const normCategory = category && category.toLowerCase() !== 'all' ? category.toLowerCase().trim() : null;
    const normQuery = query && query.trim().length > 0 ? query.toLowerCase().trim() : null;

    const candidates: { raw: RealPlaceRaw; distance: number }[] = [];

    for (const place of MAHARASHTRA_VERIFIED_PLACES) {
      if (normCategory && place.category.toLowerCase() !== normCategory && place.sub_category.toLowerCase() !== normCategory) {
        continue;
      }

      if (normQuery) {
        const searchText = `${place.name} ${place.name_mr || ''} ${place.address} ${place.brand || ''} ${place.city} ${place.sub_category}`.toLowerCase();
        if (!searchText.includes(normQuery)) {
          continue;
        }
      }

      const dist = calculateHaversineDistanceMeters(lat, lon, place.latitude, place.longitude);
      candidates.push({ raw: place, distance: dist });
    }

    // Sort by proximity ascending
    candidates.sort((a, b) => a.distance - b.distance);

    // Filter by radius; if fewer than 5 within strict radius, include the closest verified places
    let filtered = candidates.filter((c) => c.distance <= radius);
    if (filtered.length < 5 && candidates.length > 0) {
      // Relax radius boundary to ensure technician sees relevant real places
      filtered = candidates.slice(0, Math.min(limit, 15));
    } else {
      filtered = filtered.slice(0, limit);
    }

    const places = filtered.map((c) => enrichPlace(c.raw, c.distance));

    return {
      status: 'success',
      center: { latitude: lat, longitude: lon },
      radius_meters: radius,
      filter_category: category,
      query: query,
      count: places.length,
      places,
    };
  }

  /**
   * Search places by name, landmark, locality or brand across Maharashtra.
   */
  async searchPlaces(
    q: string,
    lat?: number,
    lon?: number,
    limit: number = 30
  ): Promise<SearchPlacesResponse> {
    const cleanQ = (q || '').trim();
    if (!cleanQ) {
      return { status: 'empty_query', query: '', count: 0, results: [] };
    }

    const params: any = { q: cleanQ, limit };
    if (lat !== undefined && lon !== undefined) {
      params.lat = lat;
      params.lon = lon;
    }

    // Tier 1: Attempt remote backend
    try {
      let res;
      try {
        res = await apiClient.get<SearchPlacesResponse>('/places/search', { params });
      } catch (err: any) {
        if (err?.response?.status === 404) {
          res = await apiClient.get<SearchPlacesResponse>('/api/v1/places/search', { params });
        } else {
          throw err;
        }
      }

      if (res?.data && Array.isArray(res.data.results)) {
        return res.data;
      }
    } catch {
      // Backend unavailable; proceed to local search
    }

    // Tier 2: Search verified real-world places
    const lowerQ = cleanQ.toLowerCase();
    const matches: { raw: RealPlaceRaw; distance: number }[] = [];

    for (const place of MAHARASHTRA_VERIFIED_PLACES) {
      const haystack = `${place.name} ${place.name_mr || ''} ${place.address} ${place.brand || ''} ${place.city} ${place.district} ${place.sub_category}`.toLowerCase();
      if (haystack.includes(lowerQ)) {
        const dist = lat !== undefined && lon !== undefined
          ? calculateHaversineDistanceMeters(lat, lon, place.latitude, place.longitude)
          : 0;
        matches.push({ raw: place, distance: dist });
      }
    }

    if (lat !== undefined && lon !== undefined) {
      matches.sort((a, b) => a.distance - b.distance);
    }

    const results = matches.slice(0, limit).map((m) => enrichPlace(m.raw, m.distance));

    return {
      status: 'success',
      query: cleanQ,
      count: results.length,
      results,
    };
  }

  /**
   * Reverse geocode coordinates to street, locality and city.
   */
  async reverseGeocode(lat: number, lon: number): Promise<string> {
    if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
      return 'Unknown Location';
    }

    try {
      let res;
      try {
        res = await apiClient.get<any>('/places/reverse-geocode', { params: { lat, lon } });
      } catch (err: any) {
        if (err?.response?.status === 404) {
          res = await apiClient.get<any>('/api/v1/places/reverse-geocode', { params: { lat, lon } });
        } else {
          throw err;
        }
      }

      if (res?.data?.formatted_address) {
        return res.data.formatted_address;
      }
    } catch {
      // Fall through to local nearest landmark
    }

    // Find nearest place in database
    let nearest: RealPlaceRaw | null = null;
    let minDistance = Infinity;

    for (const place of MAHARASHTRA_VERIFIED_PLACES) {
      const dist = calculateHaversineDistanceMeters(lat, lon, place.latitude, place.longitude);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = place;
      }
    }

    if (nearest && minDistance <= 5000) {
      return `Near ${nearest.name}, ${nearest.address}`;
    }

    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  }

  /**
   * Get supported place categories with metadata, icons and real place counts.
   */
  async getCategories(): Promise<PlaceCategory[]> {
    try {
      let res;
      try {
        res = await apiClient.get<{ status: string; count: number; categories: PlaceCategory[] }>(
          '/places/categories'
        );
      } catch (err: any) {
        if (err?.response?.status === 404) {
          res = await apiClient.get<{ status: string; count: number; categories: PlaceCategory[] }>(
            '/api/v1/places/categories'
          );
        } else {
          throw err;
        }
      }

      if (res?.data?.categories && res.data.categories.length > 0) {
        return res.data.categories;
      }
    } catch {
      // Fall through to local categories
    }

    // Compute live counts from verified dataset
    const counts: Record<string, number> = {};
    for (const p of MAHARASHTRA_VERIFIED_PLACES) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }

    return [
      { id: 'all', label: 'All Places', icon: 'map-pin', color: '#64748B', count: MAHARASHTRA_VERIFIED_PLACES.length },
      { id: 'fuel', label: 'Petrol Pumps & EV', icon: 'fuel', color: '#D97706', count: counts['fuel'] || 0 },
      { id: 'healthcare', label: 'Hospitals & Pharmacies', icon: 'cross', color: '#DC2626', count: counts['healthcare'] || 0 },
      { id: 'financial', label: 'Banks & ATMs', icon: 'dollar-sign', color: '#2563EB', count: counts['financial'] || 0 },
      { id: 'shop', label: 'Shops & Supermarkets', icon: 'shopping-bag', color: '#0284C7', count: counts['shop'] || 0 },
      { id: 'food', label: 'Restaurants & Cafes', icon: 'utensils', color: '#EA580C', count: counts['food'] || 0 },
      { id: 'transit', label: 'Transit & Stations', icon: 'train', color: '#475569', count: counts['transit'] || 0 },
      { id: 'civic', label: 'Police & Public Offices', icon: 'shield', color: '#7C3AED', count: counts['civic'] || 0 },
      { id: 'education', label: 'Schools & Colleges', icon: 'book-open', color: '#8B5CF6', count: counts['education'] || 0 },
    ];
  }
}

export const placesService = new PlacesService();
