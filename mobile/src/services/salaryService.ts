import { apiClient } from './api';
import { SalarySlip, SalaryConfig, SalarySummaryResponse } from '../types';

export interface SalaryConfigPayload {
  monthlySalary: number;
  absentDeductionRate: number;
  halfDayDeductionRate: number;
  effectiveDate: string;
  notes?: string;
}

export interface FinalizeSalaryPayload {
  employeeId: string;
  month: number;
  year: number;
  notes?: string;
}

export interface ReviseSalaryPayload {
  employeeId: string;
  month: number;
  year: number;
  revisionReason: string;
  monthlySalary?: number;
  absentDeductionRate?: number;
  halfDayDeductionRate?: number;
  notes?: string;
}

export const salaryService = {
  async getSalarySlip(employeeId: string, month: number = 10, year: number = 2026): Promise<SalarySlip> {
    const response = await apiClient.get<SalarySlip>(`/salary/slip/${employeeId}`, {
      params: { month, year },
    });
    return response.data;
  },

  async getSalarySummary(month: number = 10, year: number = 2026): Promise<SalarySummaryResponse> {
    const response = await apiClient.get<SalarySummaryResponse>('/salary/summary', {
      params: { month, year },
    });
    return response.data;
  },

  async getSalaryConfig(employeeId: string): Promise<SalaryConfig> {
    const response = await apiClient.get<SalaryConfig>(`/salary/config/${employeeId}`);
    return response.data;
  },

  async updateSalaryConfig(employeeId: string, payload: SalaryConfigPayload): Promise<SalaryConfig> {
    const response = await apiClient.put<SalaryConfig>(`/salary/config/${employeeId}`, payload);
    return response.data;
  },

  async finalizeSalary(payload: FinalizeSalaryPayload): Promise<SalarySlip> {
    const response = await apiClient.post<SalarySlip>('/salary/finalize', payload);
    return response.data;
  },

  async reviseSalary(payload: ReviseSalaryPayload): Promise<SalarySlip> {
    const response = await apiClient.post<SalarySlip>('/salary/revise', payload);
    return response.data;
  },

  getDownloadUrl(employeeId: string, month: number = 10, year: number = 2026, token?: string): string {
    const base = apiClient.defaults.baseURL || '';
    const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
    return `${cleanBase}/salary/download/${employeeId}?month=${month}&year=${year}${tokenParam}`;
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
