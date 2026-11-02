import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Automatically detect the host machine's IP address from Expo bundler connection
const getDevApiUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (Platform.OS === 'web') {
    return 'http://127.0.0.1:8000';
  }

  // In Expo Go on physical device or simulator, hostUri contains "192.168.x.x:8081"
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host) {
      return `http://${host}:8000`;
    }
  }

  // Local LAN IP fallback
  return 'http://192.168.0.111:8000';
};

export const CONFIG = {
  API_BASE_URL: getDevApiUrl(),
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

