import { Platform } from 'react-native';
import * as Location from 'expo-location';

export interface DeviceCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  isFallback?: boolean;
}

/**
 * Fetch approximate IP-based location fallback if physical GPS or browser geolocation is blocked/unavailable.
 */
export const getIpFallbackLocation = async (): Promise<DeviceCoordinates | null> => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && data.latitude && data.longitude) {
        return {
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          accuracy: 25,
          isFallback: true,
        };
      }
    }
  } catch (_) {}

  // Secondary fallback provider
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch('https://ipwho.is/', { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && data.latitude && data.longitude) {
        return {
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          accuracy: 30,
          isFallback: true,
        };
      }
    }
  } catch (_) {}

  return null;
};

/**
 * Robust cross-platform device location retriever.
 * Works seamlessly across Web browsers (triggers "Allow while visiting site / Allow this time")
 * and Native Android/iOS (triggers "While using app / Only this time").
 */
export const fetchLiveDeviceLocation = async (
  onCoordinatesAcquired: (coords: DeviceCoordinates) => void,
  onPermissionDenied?: () => void
): Promise<DeviceCoordinates | null> => {
  // 1. Web Browser Environment (Chrome, Edge, Safari, WebViews)
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const res: DeviceCoordinates = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy || 10,
          };
          onCoordinatesAcquired(res);
          resolve(res);
        },
        async (err) => {
          console.warn('[Geolocation] Browser geolocation error:', err?.message);
          // If browser blocks location (e.g. HTTP insecure origin or denied), use IP geolocation fallback
          const fallback = await getIpFallbackLocation();
          if (fallback) {
            onCoordinatesAcquired(fallback);
            resolve(fallback);
          } else {
            if (onPermissionDenied) onPermissionDenied();
            resolve(null);
          }
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
    });
  }

  // 2. Native Mobile Environment (Android APK & iOS)
  try {
    // 2a. Prompt Foreground Location Permission FIRST
    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && perm.status !== 'granted') {
      perm = await Location.requestForegroundPermissionsAsync();
    }

    if (!perm.granted && perm.status !== 'granted') {
      if (onPermissionDenied) onPermissionDenied();
      // Graceful IP fallback so the user is never stuck
      const fallback = await getIpFallbackLocation();
      if (fallback) {
        onCoordinatesAcquired(fallback);
        return fallback;
      }
      return null;
    }

    // 2b. Check if device Location toggle is ON
    try {
      const hasServices = await Location.hasServicesEnabledAsync();
      if (!hasServices && Platform.OS === 'android') {
        try {
          await Location.enableNetworkProviderAsync();
        } catch (_) {}
      }
    } catch (_) {}

    // 2c. Instant cached position (<500ms)
    try {
      const cached = await Location.getLastKnownPositionAsync({ maxAge: 86400000 });
      if (cached?.coords && cached.coords.latitude !== 0 && cached.coords.longitude !== 0) {
        const res: DeviceCoordinates = {
          latitude: cached.coords.latitude,
          longitude: cached.coords.longitude,
          accuracy: cached.coords.accuracy || 15,
        };
        onCoordinatesAcquired(res);
      }
    } catch (_) {}

    // 2d. Fresh live GPS position
    try {
      const loc = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((res) => setTimeout(() => res(null), 4000)),
      ]);
      if (loc?.coords && loc.coords.latitude !== 0 && loc.coords.longitude !== 0) {
        const res: DeviceCoordinates = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy || 8,
        };
        onCoordinatesAcquired(res);
        return res;
      }
    } catch (_) {}

    // 2e. Try IP fallback if hardware satellites were unreachable
    const fallback = await getIpFallbackLocation();
    if (fallback) {
      onCoordinatesAcquired(fallback);
      return fallback;
    }
  } catch (err) {
    console.warn('[Geolocation] Native location error:', err);
    const fallback = await getIpFallbackLocation();
    if (fallback) {
      onCoordinatesAcquired(fallback);
      return fallback;
    }
  }

  return null;
};
