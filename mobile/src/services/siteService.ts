import { apiClient } from './api';
import { Substation } from '../types';

let cachedSitesList: Substation[] = [];

export const siteService = {
  getCachedSites(): Substation[] {
    return cachedSitesList;
  },

  async getSites(forceRefresh = false): Promise<Substation[]> {
    if (!forceRefresh && cachedSitesList.length > 0) {
      return cachedSitesList;
    }
    const response = await apiClient.get<Substation[]>('/sites');
    if (response.data && Array.isArray(response.data)) {
      cachedSitesList = response.data;
    }
    return response.data;
  },

  async getSiteById(siteId: string): Promise<Substation> {
    const hit = cachedSitesList.find((s) => s.id === siteId || (s as any)._id === siteId);
    if (hit) return hit;
    const response = await apiClient.get<Substation>(`/sites/${siteId}`);
    return response.data;
  },

  async createSite(siteData: Partial<Substation>): Promise<Substation> {
    cachedSitesList = [];
    const response = await apiClient.post<Substation>('/sites', siteData);
    return response.data;
  },

  async updateSite(siteId: string, siteData: Partial<Substation>): Promise<Substation> {
    cachedSitesList = [];
    const response = await apiClient.put<Substation>(`/sites/${siteId}`, siteData);
    return response.data;
  },

  async deleteSite(siteId: string): Promise<void> {
    cachedSitesList = [];
    await apiClient.delete(`/sites/${siteId}`);
  },

  async searchPlaces(query: string, lat?: number, lon?: number): Promise<any[]> {
    try {
      const params: any = { q: query };
      if (typeof lat === 'number' && typeof lon === 'number') {
        params.lat = lat;
        params.lon = lon;
      }
      const response = await apiClient.get<{ results: any[] }>('/places/search', { params });
      return response.data?.results || [];
    } catch (e) {
      console.warn('Place search service error:', e);
      return [];
    }
  },

  async reverseGeocode(lat: number, lon: number): Promise<any> {
    try {
      const response = await apiClient.get('/places/reverse-geocode', { params: { lat, lon } });
      return response.data;
    } catch (e) {
      console.warn('Reverse geocode service error:', e);
      return null;
    }
  },
};
