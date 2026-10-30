import { apiClient } from './api';
import { User } from '../types';

export interface EmployeeFilters {
  search?: string;
  role?: string;
  status?: string;
}

export const employeeService = {
  async getEmployees(filters?: EmployeeFilters): Promise<User[]> {
    const response = await apiClient.get<User[]>('/employees', { params: filters });
    return response.data;
  },

  async getEmployeeById(employeeId: string): Promise<User> {
    const response = await apiClient.get<User>(`/employees/${employeeId}`);
    return response.data;
  },

  async createEmployee(data: Partial<User> & { password: string }): Promise<User> {
    const response = await apiClient.post<User>('/employees', data);
    return response.data;
  },

  async updateEmployee(employeeId: string, data: Partial<User>): Promise<User> {
    const response = await apiClient.put<User>(`/employees/${employeeId}`, data);
    return response.data;
  },

  async deleteEmployee(employeeId: string): Promise<void> {
    await apiClient.delete(`/employees/${employeeId}`);
  },

  async resetPassword(employeeId: string): Promise<{ message: string }> {
    const response = await apiClient.post(`/employees/${employeeId}/reset-password`);
    return response.data;
  },
};
