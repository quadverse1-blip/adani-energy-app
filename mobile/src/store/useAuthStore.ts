import { create } from 'zustand';
import { User } from '../types';
import { authService } from '../services/authService';
import { getStoredToken, clearStoredToken } from '../services/api';
import { useAttendanceStore } from './useAttendanceStore';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  
  initialize: () => Promise<void>;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  refreshProfile: () => Promise<User | null>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  initialize: async () => {
    try {
      const token = await getStoredToken();
      if (token) {
        set({ token });
        try {
          const profile = await authService.getProfile();
          set({ user: profile, isInitialized: true });
        } catch {
          // Token expired or invalid
          await clearStoredToken();
          set({ user: null, token: null, isInitialized: true });
        }
      } else {
        set({ user: null, token: null, isInitialized: true });
      }
    } catch {
      set({ user: null, token: null, isInitialized: true });
    }
  },

  refreshProfile: async () => {
    try {
      const profile = await authService.getProfile();
      set({ user: profile });
      return profile;
    } catch (e) {
      console.warn('refreshProfile error:', e);
      return null;
    }
  },

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authService.login(username, password);
      // Reset attendance store immediately on new login so previous employee state never leaks
      useAttendanceStore.getState().resetAttendance();
      set({
        user: result.user,
        token: result.access_token,
        isLoading: false,
      });
      return result.user;
    } catch (err: any) {
      set({
        error: err.message || 'Login failed. Please verify credentials.',
        isLoading: false,
      });
      throw err;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authService.logout();
    } finally {
      // Clear attendance store on logout
      useAttendanceStore.getState().resetAttendance();
      set({ user: null, token: null, isLoading: false });
    }
  },

  setUser: (user) => {
    useAttendanceStore.getState().resetAttendance();
    set({ user });
  },
  clearError: () => set({ error: null }),
}));
