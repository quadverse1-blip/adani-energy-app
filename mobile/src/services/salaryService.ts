import { apiClient } from './api';
import { SalarySlip } from '../types';

export interface SalarySummary {
  totalDisbursed: number;
  paidCount: number;
  pendingCount: number;
  slips: SalarySlip[];
}

export const salaryService = {
  async getSalarySlip(employeeId: string, month: number = 10, year: number = 2026): Promise<SalarySlip> {
    const response = await apiClient.get<SalarySlip>(`/salary/slip/${employeeId}`, {
      params: { month, year },
    });
    return response.data;
  },

  async getSalarySummary(month: number = 10, year: number = 2026): Promise<SalarySummary> {
    const response = await apiClient.get<SalarySummary>('/salary/summary', {
      params: { month, year },
    });
    return response.data;
  },

  getDownloadUrl(employeeId: string, month: number = 10, year: number = 2026): string {
    return `${apiClient.defaults.baseURL}/salary/download/${employeeId}?month=${month}&year=${year}`;
  },

  async uploadSalarySlip(payload: {
    employeeId: string;
    month: number;
    year: number;
    netAmount: number;
    notes?: string;
    fileName?: string;
    fileBase64?: string;
  }): Promise<SalarySlip> {
    const response = await apiClient.post<SalarySlip>('/salary/upload', payload);
    return response.data;
  },
};
