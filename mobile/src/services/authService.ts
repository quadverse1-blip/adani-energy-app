import { apiClient, setStoredToken, clearStoredToken } from './api';
import { User } from '../types';

export interface LoginResult {
  access_token: string;
  token_type: string;
  user: User;
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

  async forgotPassword(employeeId: string): Promise<{ message: string }> {
    const response = await apiClient.post('/auth/forgot-password', { employeeId });
    return response.data;
  },

  async resetPassword(employeeId: string, newPassword: string): Promise<{ message: string }> {
    const response = await apiClient.post('/auth/reset-password', { employeeId, newPassword });
    return response.data;
  },

  async logout(): Promise<void> {
    await clearStoredToken();
  },
};
