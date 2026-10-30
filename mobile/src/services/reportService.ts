import { Paths, File as ExpoFile } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { apiClient, getStoredToken } from './api';

export interface MusterRecord {
  sr: number;
  employeeCode: string;
  employeeName: string;
  designation: string;
  circle: string;
  division: string;
  days: Record<number, string>;
  summary: {
    P: number;
    WOP: number;
    A: number;
    OD: number;
    WO: number;
    PL: number;
    PH: number;
    Total: number;
  };
}

export interface MusterRollResponse {
  month: number;
  year: number;
  monthName: string;
  daysInMonth: number;
  stats: {
    totalShifts: number;
    present: number;
    lateArrivals: number;
    halfDays: number;
    avgDuration: string;
    compliance: string;
  };
  records: MusterRecord[];
  company: string;
  locationTitle: string;
}

export const reportService = {
  async getMusterRoll(month = 10, year = 2026, siteId?: string): Promise<MusterRollResponse> {
    const params: Record<string, any> = { month, year };
    if (siteId && siteId !== 'all') params.siteId = siteId;
    const response = await apiClient.get<MusterRollResponse>('/reports/muster-roll', { params });
    return response.data;
  },

  async downloadMusterRollExcel(month = 10, year = 2026, siteId?: string): Promise<void> {
    const token = await getStoredToken();
    const filename = `b4S_Attendance_Muster_Roll_October_${year}.xlsx`;

    if (Platform.OS === 'web') {
      try {
        const response = await apiClient.get('/reports/export', {
          params: {
            type: 'muster',
            month,
            year,
            siteId: siteId && siteId !== 'all' ? siteId : undefined,
          },
          responseType: 'blob',
        });
        const blob = new Blob([response.data], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
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
        // Fallback: direct window download
        let fallbackUrl = `${apiClient.defaults.baseURL}/reports/export?type=muster&month=${month}&year=${year}`;
        if (token) fallbackUrl += `&token=${encodeURIComponent(token)}`;
        window.open(fallbackUrl, '_blank');
        return;
      }
    }

    // Native Mobile (iOS/Android)
    try {
      let downloadUrl = `${apiClient.defaults.baseURL}/reports/export?type=muster&month=${month}&year=${year}`;
      if (siteId && siteId !== 'all') downloadUrl += `&siteId=${encodeURIComponent(siteId)}`;

      const destination = new ExpoFile(Paths.document, filename);

      const downloadedFile = await ExpoFile.downloadFileAsync(downloadUrl, destination, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(downloadedFile.uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Export b4S Attendance Muster Roll',
          UTI: 'com.microsoft.excel.xlsx',
        });
      }
    } catch (error: any) {
      console.error('Muster roll export error:', error);
      throw error;
    }
  },

  async downloadDetailedLogsExcel(siteId?: string, status?: string): Promise<void> {
    const token = await getStoredToken();
    const filename = `b4S_Shift_Audit_Logs_${Date.now()}.xlsx`;

    if (Platform.OS === 'web') {
      try {
        const response = await apiClient.get('/reports/export', {
          params: {
            type: 'logs',
            siteId: siteId && siteId !== 'all' ? siteId : undefined,
            status,
          },
          responseType: 'blob',
        });
        const blob = new Blob([response.data], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
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
        let fallbackUrl = `${apiClient.defaults.baseURL}/reports/export?type=logs`;
        if (token) fallbackUrl += `&token=${encodeURIComponent(token)}`;
        window.open(fallbackUrl, '_blank');
        return;
      }
    }

    try {
      let downloadUrl = `${apiClient.defaults.baseURL}/reports/export?type=logs`;
      if (siteId && siteId !== 'all') downloadUrl += `&siteId=${encodeURIComponent(siteId)}`;
      if (status) downloadUrl += `&status=${encodeURIComponent(status)}`;

      const destination = new ExpoFile(Paths.document, filename);

      const downloadedFile = await ExpoFile.downloadFileAsync(downloadUrl, destination, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(downloadedFile.uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Export b4S Shift Activity Logs',
          UTI: 'com.microsoft.excel.xlsx',
        });
      }
    } catch (error: any) {
      console.error('Detailed logs export error:', error);
      throw error;
    }
  },

  async downloadAndShareExcelReport(siteId?: string, status?: string): Promise<void> {
    return this.downloadMusterRollExcel(10, 2026, siteId);
  },
};
