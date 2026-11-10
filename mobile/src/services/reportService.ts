import { Paths, File as ExpoFile } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { apiClient, getStoredToken } from './api';

export interface MusterDay {
  day: number;
  date: string;
  dayName: string;
  label: string;
  isSunday: boolean;
  isHoliday: boolean;
  holidayName?: string;
  isToday: boolean;
}

export interface MusterCompensation {
  monthlySalary: number;
  dailyRate: number;
  absentDeductionRate: number;
  halfDayDeductionRate: number;
  absentDeductionTotal: number;
  halfDayDeductionTotal: number;
  totalDeductions: number;
  netPayableSalary: number;
  status: string;
  referenceNumber?: string | null;
}

export interface MusterRecord {
  sr: number;
  employeeId?: string;
  employeeCode: string;
  employeeName: string;
  designation: string;
  circle: string;
  division: string;
  days: Record<number, string>;
  dayHolidayNames?: Record<number, string>;
  summary: {
    P: number;
    HD?: number;
    A: number;
    WO: number;
    PH: number;
    Total: number;
  };
  compensation?: MusterCompensation;
}

export interface MusterRollResponse {
  month: number;
  year: number;
  monthName: string;
  daysInMonth: number;
  currentDay?: number | null;
  days: MusterDay[];
  stats: {
    totalShifts: number;
    present: number;
    absent: number;
    weeklyOff: number;
    publicHolidays: number;
    lateArrivals?: number;
    halfDays?: number;
    avgDuration: string;
    compliance: string;
  };
  records: MusterRecord[];
  company: string;
  locationTitle: string;
}

export const reportService = {
  async getMusterRoll(month?: number, year?: number, siteId?: string): Promise<MusterRollResponse> {
    const now = new Date();
    const m = month !== undefined ? month : now.getMonth() + 1;
    const y = year !== undefined ? year : now.getFullYear();

    const params: Record<string, any> = { month: m, year: y };
    if (siteId && siteId !== 'all') params.siteId = siteId;
    const response = await apiClient.get<MusterRollResponse>('/reports/muster-roll', { params });
    return response.data;
  },

  async downloadMusterRollExcel(month?: number, year?: number, siteId?: string): Promise<void> {
    const now = new Date();
    const m = month !== undefined ? month : now.getMonth() + 1;
    const y = year !== undefined ? year : now.getFullYear();

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[(m - 1) % 12];
    const filename = `b4S_Attendance_Muster_Roll_${monthName}_${y}.xlsx`;

    const token = await getStoredToken();

    if (Platform.OS === 'web') {
      try {
        const response = await apiClient.get('/reports/export', {
          params: {
            type: 'muster',
            month: m,
            year: y,
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
        let fallbackUrl = `${apiClient.defaults.baseURL}/reports/export?type=muster&month=${m}&year=${y}`;
        if (siteId && siteId !== 'all') fallbackUrl += `&siteId=${encodeURIComponent(siteId)}`;
        if (token) fallbackUrl += `&token=${encodeURIComponent(token)}`;
        window.open(fallbackUrl, '_blank');
        return;
      }
    }

    // Native Mobile (iOS/Android)
    try {
      let downloadUrl = `${apiClient.defaults.baseURL}/reports/export?type=muster&month=${m}&year=${y}`;
      if (siteId && siteId !== 'all') downloadUrl += `&siteId=${encodeURIComponent(siteId)}`;

      const destination = new ExpoFile(Paths.document, filename);
      if (destination.exists) {
        await destination.delete();
      }

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
        const response = await apiClient.get('/reports/export-logs', {
          params: {
            siteId: siteId && siteId !== 'all' ? siteId : undefined,
            status: status && status !== 'all' ? status : undefined,
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
        let fallbackUrl = `${apiClient.defaults.baseURL}/reports/export-logs`;
        if (token) fallbackUrl += `?token=${encodeURIComponent(token)}`;
        window.open(fallbackUrl, '_blank');
        return;
      }
    }

    try {
      let downloadUrl = `${apiClient.defaults.baseURL}/reports/export-logs`;
      const destination = new ExpoFile(Paths.document, filename);
      if (destination.exists) {
        await destination.delete();
      }
      if (destination.exists) {
        await destination.delete();
      }

      const downloadedFile = await ExpoFile.downloadFileAsync(downloadUrl, destination, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(downloadedFile.uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Export b4S Shift Logs',
          UTI: 'com.microsoft.excel.xlsx',
        });
      }
    } catch (error: any) {
      console.error('Detailed logs export error:', error);
      throw error;
    }
  },

  async downloadMusterRollPdf(month?: number, year?: number, siteId?: string): Promise<void> {
    const now = new Date();
    const m = month !== undefined ? month : now.getMonth() + 1;
    const y = year !== undefined ? year : now.getFullYear();

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[(m - 1) % 12];
    const filename = `Adani_Muster_Roll_${monthName}_${y}_${Date.now()}.pdf`;
    const token = await getStoredToken();

    if (Platform.OS === 'web') {
      try {
        const response = await apiClient.get('/reports/export-pdf', {
          params: { month: m, year: y, siteId: siteId && siteId !== 'all' ? siteId : undefined },
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
        let fallbackUrl = `${apiClient.defaults.baseURL}/reports/export-pdf?month=${m}&year=${y}`;
        if (siteId && siteId !== 'all') fallbackUrl += `&siteId=${encodeURIComponent(siteId)}`;
        if (token) fallbackUrl += `&token=${encodeURIComponent(token)}`;
        window.open(fallbackUrl, '_blank');
        return;
      }
    }

    try {
      let downloadUrl = `${apiClient.defaults.baseURL}/reports/export-pdf?month=${m}&year=${y}`;
      if (siteId && siteId !== 'all') downloadUrl += `&siteId=${encodeURIComponent(siteId)}`;
      if (token) downloadUrl += `&token=${encodeURIComponent(token)}`;

      let fileUri = '';
      try {
        const destination = new ExpoFile(Paths.document, filename);
        if (destination.exists) {
          try { await destination.delete(); } catch (_) {}
        }

        const downloadedFile = await ExpoFile.downloadFileAsync(downloadUrl, destination, {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
        });
        fileUri = downloadedFile.uri;
      } catch (fileErr) {
        console.warn('ExpoFile download failed, attempting FileSystemLegacy fallback:', fileErr);
        const FileSystemLegacy = require('expo-file-system/legacy');
        const dest = `${FileSystemLegacy.documentDirectory}${filename}`;
        const res = await FileSystemLegacy.downloadAsync(downloadUrl, dest, {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
        });
        fileUri = res.uri;
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare && fileUri) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Export Adani Attendance Register (${monthName} ${y})`,
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (error: any) {
      console.error('Muster roll PDF export error:', error);
      throw error;
    }
  },
};
