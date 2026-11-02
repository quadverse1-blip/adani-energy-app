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
}

export interface HistoryResult {
  summary: AttendanceSummary;
  records: AttendanceRecord[];
}

export const attendanceService = {
  async uploadPhoto(photoUri: string): Promise<string> {
    const formData = new FormData();
    const filename = photoUri.split('/').pop() || 'selfie.jpg';
    
    // Append file according to React Native FormData convention
    // @ts-ignore
    formData.append('photo', {
      uri: photoUri,
      name: filename,
      type: 'image/jpeg',
    });

    const response = await apiClient.post<{ photoUrl: string }>('/attendance/upload-photo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.photoUrl;
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

  async getAllLogs(month?: number, year?: number, period?: string, employeeId?: string): Promise<{ logs: any[]; total: number }> {
    const params: Record<string, any> = {};
    if (month) params.month = month;
    if (year) params.year = year;
    if (period) params.period = period;
    if (employeeId) params.employeeId = employeeId;
    const response = await apiClient.get<{ logs: any[]; total: number }>('/attendance/admin/all-logs', { params });
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
    const response = await apiClient.post<{ success: boolean; message: string; record: any }>('/attendance/admin/mark-attendance', payload);
    return response.data;
  },
};
