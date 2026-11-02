import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { CONFIG } from '../config';

// In-memory token cache for lightning-fast synchronous request dispatching
let cachedAuthToken: string | null = null;

export const apiClient = axios.create({
  baseURL: CONFIG.API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function setApiBaseUrl(url: string): void {
  apiClient.defaults.baseURL = url;
}

export async function getStoredToken(): Promise<string | null> {
  if (cachedAuthToken !== null) {
    return cachedAuthToken;
  }
  if (Platform.OS === 'web') {
    try {
      cachedAuthToken = localStorage.getItem(CONFIG.TOKEN_KEY);
      return cachedAuthToken;
    } catch {
      return null;
    }
  }
  try {
    cachedAuthToken = await SecureStore.getItemAsync(CONFIG.TOKEN_KEY);
    return cachedAuthToken;
  } catch {
    return null;
  }
}

export function getCachedTokenSync(): string | null {
  return cachedAuthToken;
}

export async function setStoredToken(token: string): Promise<void> {
  cachedAuthToken = token;
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(CONFIG.TOKEN_KEY, token);
    } catch {}
    return;
  }
  try {
    await SecureStore.setItemAsync(CONFIG.TOKEN_KEY, token);
  } catch (e) {
    console.warn('SecureStore set error:', e);
  }
}

export async function clearStoredToken(): Promise<void> {
  cachedAuthToken = null;
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(CONFIG.TOKEN_KEY);
    } catch {}
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

// Fast synchronous token attachment on all outbound requests
apiClient.interceptors.request.use(
  (config) => {
    const token = cachedAuthToken || (Platform.OS === 'web' ? localStorage.getItem(CONFIG.TOKEN_KEY) : null);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);
