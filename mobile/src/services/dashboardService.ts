import { apiClient } from './api';
import { FleetTechnician, Substation } from '../types';

export interface AdminNotification {
  id: string;
  type: 'warning' | 'danger' | 'info' | 'success';
  category: string;
  title: string;
  message: string;
  timestamp: string;
  employeeId?: string;
  employeeName?: string;
  avatar?: string;
  siteName?: string;
  isRead: boolean;
  source?: 'admin' | 'employee';
  sender?: string;
}

export interface RecentAttendanceItem {
  id: string;
  employeeId: string;
  employeeName: string;
  avatar?: string;
  designation?: string;
  siteName: string;
  siteCode?: string;
  checkInTime: string;
  checkOutTime: string;
  duration: string;
  status: 'present' | 'late' | 'half_day' | 'absent' | 'completed' | string;
  isInsideGeofence: boolean;
  distanceMeters: number;
  distanceTraveled?: string;
  latitude?: number;
  longitude?: number;
  siteLatitude?: number;
  siteLongitude?: number;
  siteRadius?: number;
  outLatitude?: number | null;
  outLongitude?: number | null;
  photoUrl?: string;
  remarks?: string;
}

export interface StatusDistribution {
  presentOnTime: number;
  presentLate: number;
  completedShift: number;
  absent: number;
  totalTracked: number;
  complianceRate: number;
  punctualityRate: number;
  percentages: {
    onTime: number;
    late: number;
    completed: number;
    absent: number;
  };
}

export interface HourlyArrivalSlot {
  slot: string;
  count: number;
  label: string;
  color: string;
  rate: string;
}

export interface AdminStats {
  kpi: {
    totalFieldStaff: number;
    currentlyPresent: number;
    absentOffDuty: number;
    completedShift: number;
  };
  weeklyTrend: Array<{ day: string; present: number; late: number; absent: number; attendanceRate?: number }>;
  liveFeed: RecentAttendanceItem[];
  recentAttendance: RecentAttendanceItem[];
  notifications: AdminNotification[];
  unreadNotificationsCount: number;
  statusDistribution: StatusDistribution;
  hourlyArrivals: HourlyArrivalSlot[];
  sitesCount: number;
  workforceStatus: {
    onDuty: number;
    completed: number;
    late: number;
    absent: number;
  };
}

export interface FleetRadarData {
  substations: Substation[];
  technicians: FleetTechnician[];
  totalCount?: number;
  onDutyCount?: number;
  standbyCount?: number;
  timestamp: string;
}

export const dashboardService = {
  async getAdminStats(): Promise<AdminStats> {
    const response = await apiClient.get<AdminStats>('/dashboard/stats');
    return response.data;
  },

  async getLiveFleetRadar(): Promise<FleetRadarData> {
    const response = await apiClient.get<FleetRadarData>('/locations/live');
    return response.data;
  },

  async markNotificationsRead(notificationId?: string): Promise<{ status: string }> {
    const response = await apiClient.post('/dashboard/notifications/mark-read', {
      notificationId,
    });
    return response.data;
  },
};
