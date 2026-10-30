import { apiClient } from './api';
import { Substation } from '../types';

export const siteService = {
  async getSites(): Promise<Substation[]> {
    const response = await apiClient.get<Substation[]>('/sites');
    return response.data;
  },

  async getSiteById(siteId: string): Promise<Substation> {
    const response = await apiClient.get<Substation>(`/sites/${siteId}`);
    return response.data;
  },

  async createSite(siteData: Partial<Substation>): Promise<Substation> {
    const response = await apiClient.post<Substation>('/sites', siteData);
    return response.data;
  },

  async updateSite(siteId: string, siteData: Partial<Substation>): Promise<Substation> {
    const response = await apiClient.put<Substation>(`/sites/${siteId}`, siteData);
    return response.data;
  },

  async deleteSite(siteId: string): Promise<void> {
    await apiClient.delete(`/sites/${siteId}`);
  },
};
