import { apiClient } from './api';
import { AttendanceRecord, AttendanceSummary, Substation } from '../types';

export interface CheckInPayload {
  siteId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  remarks?: string;
  photoUrl?: string;
}

export interface CheckOutPayload {
  latitude: number;
  longitude: number;
  accuracy: number;
  remarks?: string;
}

export interface TodayAttendanceResult {
  status: 'not_started' | 'active' | 'completed';
  liveElapsedMinutes: number;
  record: AttendanceRecord | null;
  site: Substation | null;
  sites?: Substation[];
  assignedBy?: string;
  assignedByPhone?: string;
  assignedByRole?: string;
  assignedAt?: string;
}

export interface HistoryResult {
  summary: AttendanceSummary;
  records: AttendanceRecord[];
}

let cachedLogsMap: Record<string, { logs: any[]; total: number; timestamp: number }> = {};

export const attendanceService = {
  async uploadPhoto(photoUri: string): Promise<string> {
    if (!photoUri) {
      throw new Error('Photo URI is required');
    }

    // 1. If it's already a Base64 data URI, send via fast JSON payload
    if (photoUri.startsWith('data:')) {
      const response = await apiClient.post<{ photoUrl: string; photoPath?: string }>('/attendance/upload-photo', {
        photoBase64: photoUri,
      });
      return response.data.photoUrl || photoUri;
    }

    // 2. If it's a file URI, upload via FormData (do NOT set explicit Content-Type header so Axios calculates boundary)
    const formData = new FormData();
    const filename = photoUri.split('/').pop() || `selfie_${Date.now()}.jpg`;
    
    // @ts-ignore
    formData.append('photo', {
      uri: photoUri,
      name: filename,
      type: 'image/jpeg',
    });

    const response = await apiClient.post<{ photoUrl: string; photoPath?: string }>('/attendance/upload-photo', formData);
    return response.data.photoUrl || photoUri;
  },

  async checkIn(payload: CheckInPayload): Promise<AttendanceRecord> {
    const response = await apiClient.post<AttendanceRecord>('/attendance/check-in', payload);
    return response.data;
  },

  async checkOut(payload: CheckOutPayload): Promise<AttendanceRecord> {
    const response = await apiClient.post<AttendanceRecord>('/attendance/check-out', payload);
    return response.data;
  },

  async getTodayAttendance(): Promise<TodayAttendanceResult> {
    const response = await apiClient.get<TodayAttendanceResult>('/attendance/today');
    return response.data;
  },

  async getHistory(month?: number, year?: number, employeeId?: string): Promise<HistoryResult> {
    const params: Record<string, any> = {};
    if (month) params.month = month;
    if (year) params.year = year;
    if (employeeId) params.employeeId = employeeId;
    const response = await apiClient.get<HistoryResult>('/attendance/history', { params });
    return response.data;
  },

  getCachedAllLogs(month?: number, year?: number, period?: string, employeeId?: string): { logs: any[]; total: number } | null {
    const key = `${month || ''}_${year || ''}_${period || ''}_${employeeId || ''}`;
    const hit = cachedLogsMap[key];
    if (hit && Date.now() - hit.timestamp < 60000) {
      return hit;
    }
    return null;
  },

  async getAllLogs(month?: number, year?: number, period?: string, employeeId?: string, forceRefresh = false): Promise<{ logs: any[]; total: number }> {
    const key = `${month || ''}_${year || ''}_${period || ''}_${employeeId || ''}`;
    if (!forceRefresh && cachedLogsMap[key] && Date.now() - cachedLogsMap[key].timestamp < 60000) {
      return cachedLogsMap[key];
    }
    const params: Record<string, any> = {};
    if (month) params.month = month;
    if (year) params.year = year;
    if (period) params.period = period;
    if (employeeId) params.employeeId = employeeId;
    const response = await apiClient.get<{ logs: any[]; total: number }>('/attendance/admin/all-logs', { params });
    if (response.data) {
      cachedLogsMap[key] = { ...response.data, timestamp: Date.now() };
    }
    return response.data;
  },

  async adjustAttendance(payload: {
    recordId?: string;
    employeeId: string;
    date: string;
    status: string;
    siteName?: string;
    checkInTime?: string;
    checkOutTime?: string;
    duration?: string;
    adminRemarks?: string;
  }): Promise<{ success: boolean; message: string; record: any }> {
    cachedLogsMap = {};
    const response = await apiClient.post<{ success: boolean; message: string; record: any }>('/attendance/admin/adjust', payload);
    return response.data;
  },

  async markAttendance(payload: {
    employeeId: string;
    date: string;
    status: 'P' | 'A' | 'HD' | 'present' | 'absent' | 'half_day';
    isHalfDay?: boolean;
    attendanceCategory?: string;
    adminRemarks?: string;
  }): Promise<{ success: boolean; message: string; record: any }> {
    cachedLogsMap = {};
    const response = await apiClient.post<{ success: boolean; message: string; record: any }>('/attendance/admin/mark-attendance', payload);
    return response.data;
  },
};
