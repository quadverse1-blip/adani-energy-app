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
    // If employeeId contains slash (e.g. b4S/Adani/61), encode each segment or parameter
    const safeEmpId = encodeURIComponent(employeeId);
    return `${cleanBase}/salary/download/${safeEmpId}?month=${month}&year=${year}${tokenParam}`;
  },

  async downloadPayslipFile(employeeId: string, month: number = 10, year: number = 2026, preferredFileName?: string): Promise<{ success: boolean; uri?: string; error?: string }> {
    try {
      const response = await apiClient.get(`/salary/download/${encodeURIComponent(employeeId)}`, {
        params: { month, year },
        responseType: 'blob',
      });

      const fileName = preferredFileName || `Adani_Salary_Slip_${employeeId.replace(/[^a-zA-Z0-9_-]/g, '_')}_${month}_${year}.pdf`;

      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
        return { success: true, uri: blobUrl };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Download failed' };
    }
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
