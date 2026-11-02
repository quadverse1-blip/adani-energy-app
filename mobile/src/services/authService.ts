import { apiClient, setStoredToken, clearStoredToken } from './api';
import { User } from '../types';

export interface LoginResult {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  email?: string;
  targetEmail?: string;
  employeeId?: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  employeeId?: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
  employeeId?: string;
}

export const authService = {
  async login(username: string, password: string): Promise<LoginResult> {
    const response = await apiClient.post<LoginResult>('/auth/login', {
      username,
      password,
    });
    if (response.data?.access_token) {
      await setStoredToken(response.data.access_token);
    }
    return response.data;
  },

  async getProfile(): Promise<User> {
    const response = await apiClient.get<User>('/auth/me');
    return response.data;
  },

  async forgotPassword(identifier: string, email?: string): Promise<ForgotPasswordResponse> {
    const response = await apiClient.post<ForgotPasswordResponse>('/auth/forgot-password', {
      identifier: identifier.trim(),
      employeeId: identifier.trim(),
      email: email ? email.trim() : undefined,
    });
    return response.data;
  },

  async verifyOtp(identifier: string, otp: string): Promise<VerifyOtpResponse> {
    const response = await apiClient.post<VerifyOtpResponse>('/auth/verify-otp', {
      identifier: identifier.trim(),
      employeeId: identifier.trim(),
      otp: otp.trim(),
    });
    return response.data;
  },

  async resetPassword(identifier: string, otp: string, newPassword: string): Promise<ResetPasswordResponse> {
    const response = await apiClient.post<ResetPasswordResponse>('/auth/reset-password', {
      identifier: identifier.trim(),
      employeeId: identifier.trim(),
      otp: otp.trim(),
      newPassword,
    });
    return response.data;
  },

  async logout(): Promise<void> {
    await clearStoredToken();
  },
};
