import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { apiClient, getStoredToken } from './api';

export interface HolidayItem {
  _id: string;
  name: string;
  date: string; // YYYY-MM-DD
  day: string;  // e.g. Monday
  description?: string;
  type: string; // e.g. National Gazetted, Gazetted, Regional
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface HolidayCreatePayload {
  name: string;
  date: string;
  description?: string;
  type?: string;
}

export const holidayService = {
  /**
   * Fetch all centralized holidays from database
   */
  async getHolidays(year?: number): Promise<HolidayItem[]> {
    const params: Record<string, any> = {};
    if (year) params.year = year;
    const res = await apiClient.get<{ status: string; holidays: HolidayItem[] }>('/holidays', { params });
    return res.data?.holidays || [];
  },

  /**
   * Add a new centralized holiday (Admin only)
   */
  async createHoliday(payload: HolidayCreatePayload): Promise<HolidayItem> {
    const res = await apiClient.post<{ status: string; holiday: HolidayItem }>('/holidays', payload);
    return res.data.holiday;
  },

  /**
   * Update an existing centralized holiday (Admin only)
   */
  async updateHoliday(id: string, payload: Partial<HolidayCreatePayload>): Promise<HolidayItem> {
    const res = await apiClient.put<{ status: string; holiday: HolidayItem }>(`/holidays/${id}`, payload);
    return res.data.holiday;
  },

  /**
   * Delete a holiday from centralized database (Admin only)
   */
  async deleteHoliday(id: string): Promise<boolean> {
    await apiClient.delete(`/holidays/${id}`);
    return true;
  },

  /**
   * Download the official gazetted holidays calendar PDF
   */
  async downloadHolidaysPdf(year = 2026): Promise<void> {
    const token = await getStoredToken();
    const filename = `Adani_Energy_Holidays_${year}_${Date.now()}.pdf`;

    if (Platform.OS === 'web') {
      try {
        const response = await apiClient.get('/dashboard/holidays/pdf', {
          params: { year },
          responseType: 'blob',
        });
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
        return;
      } catch (err) {
        let fallbackUrl = `${apiClient.defaults.baseURL}/dashboard/holidays/pdf?year=${year}`;
        if (token) fallbackUrl += `&token=${encodeURIComponent(token)}`;
        window.open(fallbackUrl, '_blank');
        return;
      }
    }

    // Native Mobile download
    try {
      const downloadUrl = `${apiClient.defaults.baseURL}/dashboard/holidays/pdf?year=${year}`;
      const docDir = (FileSystem as any).documentDirectory || '';
      const destUri = `${docDir}${filename}`;
      const res = await FileSystem.downloadAsync(downloadUrl, destUri, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      const fileUri = res.uri;

      const canShare = await Sharing.isAvailableAsync();
      if (canShare && fileUri) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Adani Gazetted Holidays ${year}`,
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (err) {
      console.warn('Native holidays PDF download error:', err);
      throw err;
    }
  },
};
