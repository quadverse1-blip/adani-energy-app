import { apiClient } from './api';
import { FleetTechnician } from '../types';
import { FleetRadarData } from './dashboardService';

export interface LocationPingPayload {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  batteryLevel?: number;
  siteId?: string;
  locationName?: string;
}

export interface LocationHistoryStop {
  latitude: number;
  longitude: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  durationFormatted: string;
}

export interface EmployeeLocationHistoryResponse {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  date: string;
  totalPoints: number;
  totalDistanceKm: number;
  totalDistanceFormatted: string;
  startPoint?: {
    latitude: number;
    longitude: number;
    time: string;
    locationName?: string;
  };
  endPoint?: {
    latitude: number;
    longitude: number;
    time: string;
    locationName?: string;
  };
  stops: LocationHistoryStop[];
  points: Array<{
    latitude: number;
    longitude: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
    time: string;
    timestamp?: string;
  }>;
  coordinates: [number, number][]; // [lat, lon]
}

export interface LastKnownLocationResponse {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  designation: string;
  circle?: string;
  division?: string;
  latitude: number;
  longitude: number;
  accuracy: string;
  speed?: number;
  heading?: number;
  isLive: boolean;
  statusLabel: 'LIVE LOCATION' | 'LAST KNOWN LOCATION';
  lastSeen: string;
  lastLocationDate: string;
  timeAgo: string;
  assignedSite?: any;
  distanceToSiteMeters: number;
  roadDistanceToSiteKm: number;
}

export const trackingService = {
  /**
   * Transmits real-time device GPS coordinates and telemetry to backend.
   */
  async pingLocation(payload: LocationPingPayload): Promise<{ status: string; timestamp?: string }> {
    const response = await apiClient.post('/locations/ping', payload);
    return response.data;
  },

  /**
   * Fetches real-time radar for Maharashtra state including all substations and technicians.
   */
  async getLiveFleetRadar(): Promise<FleetRadarData> {
    const response = await apiClient.get<FleetRadarData>('/locations/live');
    return response.data;
  },

  /**
   * Retrieves timestamped GPS history breadcrumbs, total distance, and stops for an employee.
   */
  async getEmployeeLocationHistory(
    employeeId: string,
    date?: string,
    limit = 500
  ): Promise<EmployeeLocationHistoryResponse> {
    const response = await apiClient.get<EmployeeLocationHistoryResponse>(`/locations/history/${employeeId}`, {
      params: { date, limit },
    });
    return response.data;
  },

  /**
   * Retrieves verified LAST KNOWN location record for a specific employee.
   */
  async getEmployeeLastKnownLocation(employeeId: string): Promise<LastKnownLocationResponse> {
    const response = await apiClient.get<LastKnownLocationResponse>(`/locations/employee/${employeeId}/last-known`);
    return response.data;
  },
};
