import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { CONFIG } from '../config';

export const apiClient = axios.create({
  baseURL: CONFIG.API_BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function setApiBaseUrl(url: string): void {
  apiClient.defaults.baseURL = url;
}

export async function getStoredToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(CONFIG.TOKEN_KEY);
  }
  try {
    return await SecureStore.getItemAsync(CONFIG.TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setStoredToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(CONFIG.TOKEN_KEY, token);
    return;
  }
  try {
    await SecureStore.setItemAsync(CONFIG.TOKEN_KEY, token);
  } catch (e) {
    console.warn('SecureStore set error:', e);
  }
}

export async function clearStoredToken(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(CONFIG.TOKEN_KEY);
  } catch (e) {
    console.warn('SecureStore delete error:', e);
  }
}

function sanitizeStorageKey(rawKey: string): string {
  // Expo SecureStore only allows alphanumeric, '.', '-', and '_'
  return (rawKey || '').replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function getStorageItem(key: string): Promise<string | null> {
  const safeKey = sanitizeStorageKey(key);
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(safeKey);
    } catch {
      return null;
    }
  }
  try {
    return await SecureStore.getItemAsync(safeKey);
  } catch {
    return null;
  }
}

export async function setStorageItem(key: string, value: string): Promise<void> {
  const safeKey = sanitizeStorageKey(key);
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(safeKey, value);
    } catch {}
    return;
  }
  try {
    await SecureStore.setItemAsync(safeKey, value);
  } catch (e) {
    console.warn('SecureStore set error:', e);
  }
}

// Attach JWT token to all requests
apiClient.interceptors.request.use(
  async (config) => {
    const token = await getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error unwrapping
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    let message = 'An unexpected network error occurred. Please check your connection.';
    if (error.response?.data?.detail) {
      message = error.response.data.detail;
    } else if (error.message) {
      message = error.message;
    }
    return Promise.reject(new Error(message));
  }
);
