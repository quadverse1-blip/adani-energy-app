import { Platform } from 'react-native';
import { Paths, File as ExpoFile } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { apiClient, getStoredToken } from './api';
import { User } from '../types';

export interface EmployeeFilters {
  search?: string;
  role?: string;
  status?: string;
}

export interface BulkUploadResponse {
  success: boolean;
  totalRows: number;
  addedCount: number;
  updatedCount: number;
  errorCount: number;
  errors: string[];
  message: string;
  employees: Array<{
    id: string;
    employeeId: string;
    name: string;
    phone: string;
    role: string;
    status: string;
  }>;
}

export interface BulkEmployeeItem {
  employeeId: string;
  phone: string;
  password: string;
  name?: string;
  role?: string;
  designation?: string;
  assignedSiteIds?: string[];
  assignedSiteId?: string;
  email?: string;
  circle?: string;
  division?: string;
  department?: string;
}

let cachedEmployeesList: User[] = [];

export const employeeService = {
  getCachedEmployees(): User[] {
    return cachedEmployeesList;
  },

  async getEmployees(filters?: EmployeeFilters): Promise<User[]> {
    try {
      const response = await apiClient.get<User[]>('/employees', { params: filters });
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        // If query was unfiltered, cache entire master list
        if (!filters || (!filters.role && !filters.search && !filters.status)) {
          cachedEmployeesList = response.data;
        } else if (cachedEmployeesList.length === 0) {
          cachedEmployeesList = response.data;
        }
      }
      return response.data;
    } catch (err) {
      if (cachedEmployeesList.length > 0) {
        console.warn('Network error fetching employees, serving cached list of', cachedEmployeesList.length);
        let list = [...cachedEmployeesList];
        if (filters?.role) {
          list = list.filter((e) => (e.role || '').toLowerCase() === filters.role?.toLowerCase());
        }
        if (filters?.status) {
          list = list.filter((e) => (e.status || '').toLowerCase() === filters.status?.toLowerCase());
        }
        if (filters?.search) {
          const s = filters.search.toLowerCase();
          list = list.filter(
            (e) =>
              (e.name || '').toLowerCase().includes(s) ||
              (e.employeeId || '').toLowerCase().includes(s) ||
              (e.phone || '').includes(s)
          );
        }
        return list;
      }
      throw err;
    }
  },

  async getEmployeeById(employeeId: string): Promise<User> {
    const response = await apiClient.get<User>(`/employees/${encodeURIComponent(employeeId)}`);
    return response.data;
  },

  async createEmployee(data: Partial<User> & { password: string }): Promise<User> {
    const response = await apiClient.post<User>('/employees', data);
    return response.data;
  },

  async updateEmployee(employeeId: string, data: Partial<User>): Promise<User> {
    const response = await apiClient.put<User>(`/employees/${encodeURIComponent(employeeId)}`, data);
    return response.data;
  },

  async deleteEmployee(employeeId: string): Promise<void> {
    await apiClient.delete(`/employees/${encodeURIComponent(employeeId)}`);
  },

  async resetPassword(employeeId: string): Promise<{ message: string }> {
    const response = await apiClient.post(`/employees/${encodeURIComponent(employeeId)}/reset-password`);
    return response.data;
  },

  /**
   * Bulk upload employees from an Excel (.xlsx, .xls) or CSV file.
   */
  async bulkUploadEmployees(
    file: { uri: string; name: string; type?: string; rawFile?: any },
    defaultSiteId?: string
  ): Promise<BulkUploadResponse> {
    const formData = new FormData();

    if (Platform.OS === 'web' && file.rawFile) {
      formData.append('file', file.rawFile);
    } else {
      formData.append('file', {
        uri: file.uri,
        name: file.name || 'Adani_Employees.xlsx',
        type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      } as any);
    }

    if (defaultSiteId) {
      formData.append('defaultSiteId', defaultSiteId);
    }

    const response = await apiClient.post<BulkUploadResponse>('/employees/bulk-upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      transformRequest: (data) => data, // Preserve native FormData on web & native
    });

    return response.data;
  },

  /**
   * Bulk import employee items directly via JSON payload.
   */
  async bulkImportJson(
    items: BulkEmployeeItem[],
    defaultSiteId?: string
  ): Promise<BulkUploadResponse> {
    const response = await apiClient.post<BulkUploadResponse>('/employees/bulk-import-json', items, {
      params: defaultSiteId ? { defaultSiteId } : undefined,
    });
    return response.data;
  },

  /**
   * Download the standard Adani bulk employees Excel template (.xlsx).
   */
  async downloadTemplate(): Promise<void> {
    const filename = 'Adani_Bulk_Employees_Template.xlsx';
    const token = await getStoredToken();

    if (Platform.OS === 'web') {
      try {
        const response = await apiClient.get('/employees/bulk-template', {
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
        let fallbackUrl = `${apiClient.defaults.baseURL}/employees/bulk-template`;
        if (token) fallbackUrl += `?token=${encodeURIComponent(token)}`;
        window.open(fallbackUrl, '_blank');
        return;
      }
    }

    // Native Mobile (iOS/Android)
    try {
      const downloadUrl = `${apiClient.defaults.baseURL}/employees/bulk-template`;
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
          dialogTitle: 'Adani Bulk Employees Excel Template',
          UTI: 'com.microsoft.excel.xlsx',
        });
      }
    } catch (error: any) {
      console.error('Failed to download employee template:', error);
      throw error;
    }
  },
};
