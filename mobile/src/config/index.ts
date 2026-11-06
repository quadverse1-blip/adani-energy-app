import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Production Backend deployed on Vercel
export const PRODUCTION_API_URL = 'https://adani-energy-app.vercel.app';

// Automatically resolve API Base URL (Production Vercel URL by default)
const getApiUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Standalone production APK and non-dev builds strictly use Vercel backend
  if (!__DEV__) {
    return PRODUCTION_API_URL;
  }

  // In development, default to Production Vercel backend so APKs and physical devices connect reliably
  return PRODUCTION_API_URL;
};

export const CONFIG = {
  API_BASE_URL: getApiUrl(),
  DEFAULT_GEOFENCE_RADIUS_METERS: 500,
  MAX_GPS_ACCURACY_THRESHOLD_METERS: 50,
  SHIFT_START: '09:00',
  SHIFT_GRACE_END: '10:30',
  SHIFT_ON_TIME_END: '09:00',
  SHIFT_LATE_END: '10:30',
  SHIFT_END: '18:00',
  TOKEN_KEY: 'adani_workforce_jwt_token',
  USER_KEY: 'adani_workforce_cached_user',
};

export * from './firebase';

