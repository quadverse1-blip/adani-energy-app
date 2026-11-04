import { Platform, Alert, Linking } from 'react-native';
import * as Location from 'expo-location';

export interface DeviceCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export type GeolocationErrorCode = 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'INSECURE_CONTEXT' | 'UNKNOWN';

export interface GeolocationErrorDetail {
  code: GeolocationErrorCode;
  message: string;
  isPermissionDenied: boolean;
  isGpsDisabled: boolean;
  isTimeout: boolean;
  isInsecureContext?: boolean;
}

export interface GeolocationCallbacks {
  onCoordinatesAcquired: (coords: DeviceCoordinates) => void;
  onError?: (err: GeolocationErrorDetail) => void;
  onGpsDisabled?: (message?: string) => void;
  onPermissionDenied?: (message?: string) => void;
  onTimeout?: (message?: string) => void;
}

/**
 * Validates whether the current web execution context is secure (HTTPS or localhost).
 * Web browsers strictly require HTTPS to access navigator.geolocation.
 */
export const isSecureWebContext = (): boolean => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (typeof window.isSecureContext === 'boolean') {
      return window.isSecureContext;
    }
    const proto = window.location?.protocol || '';
    const host = window.location?.hostname || '';
    return proto === 'https:' || host === 'localhost' || host === '127.0.0.1';
  }
  return true;
};

/**
 * Checks browser permission state ('granted' | 'prompt' | 'denied' | 'unsupported')
 * using W3C Permissions API.
 */
export const checkBrowserPermissionState = async (): Promise<'granted' | 'prompt' | 'denied' | 'unsupported'> => {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.permissions?.query) {
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      return status.state;
    } catch (_) {
      return 'unsupported';
    }
  }
  return 'unsupported';
};

/**
 * Pure Real-Device GPS Geolocation.
 * Strictly acquires genuine hardware coordinates from device GPS.
 * Directly triggers the native Android Chrome bottom-sheet permission dialog
 * ("Allow while visiting the site" / "Allow this time" / "Never allow")
 * when invoked from user interaction.
 */
export const fetchRealDeviceLocation = async (
  callbacks: GeolocationCallbacks,
  isManualPress = false
): Promise<DeviceCoordinates | null> => {
  const { onCoordinatesAcquired, onError, onGpsDisabled, onPermissionDenied, onTimeout } = callbacks;

  const dispatchError = (detail: GeolocationErrorDetail) => {
    if (onError) onError(detail);
    if (detail.isPermissionDenied && onPermissionDenied) onPermissionDenied(detail.message);
    if (detail.isGpsDisabled && onGpsDisabled) onGpsDisabled(detail.message);
    if (detail.isTimeout && onTimeout) onTimeout(detail.message);
  };

  // 1. Web Browser Environment (Chrome on Android, Safari, Desktop Chrome)
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
    // Check HTTPS security boundary
    if (!isSecureWebContext()) {
      const detail: GeolocationErrorDetail = {
        code: 'INSECURE_CONTEXT',
        message: 'Browser requires HTTPS for location. Please access over https:// or localhost.',
        isPermissionDenied: true,
        isGpsDisabled: false,
        isTimeout: false,
        isInsecureContext: true,
      };
      dispatchError(detail);
      return null;
    }

    return new Promise((resolve) => {
      // Directly invoke navigator.geolocation.getCurrentPosition()
      // Calling this directly ensures Chrome/Android displays the native
      // permission popup bottom-sheet ("Allow while visiting the site" / "Allow this time" / "Never allow")
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (pos?.coords && pos.coords.latitude && pos.coords.longitude) {
            const realCoords: DeviceCoordinates = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy || 10,
            };
            onCoordinatesAcquired(realCoords);
            resolve(realCoords);
          } else {
            // Attempt standard accuracy fallback if coordinates empty
            tryStandardAccuracyFallback(resolve);
          }
        },
        (err) => {
          console.warn('[RealGPS] High-accuracy browser GPS error code:', err.code, err.message);

          if (err.code === 1) {
            // PERMISSION_DENIED: User explicitly selected "Never allow" or origin blocked
            const detail: GeolocationErrorDetail = {
              code: 'PERMISSION_DENIED',
              message: 'Location permission was denied. Tap the lock icon in the Chrome address bar to reset permission.',
              isPermissionDenied: true,
              isGpsDisabled: false,
              isTimeout: false,
            };
            dispatchError(detail);
            resolve(null);
          } else {
            // POSITION_UNAVAILABLE (code 2) or TIMEOUT (code 3):
            // Satellite lock might take time indoors or while warm-up occurs.
            // Immediately attempt standard network/Wi-Fi triangulation fallback!
            tryStandardAccuracyFallback(resolve);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 15000,
        }
      );

      function tryStandardAccuracyFallback(finishResolve: (val: DeviceCoordinates | null) => void) {
        navigator.geolocation.getCurrentPosition(
          (posFallback) => {
            if (posFallback?.coords && posFallback.coords.latitude && posFallback.coords.longitude) {
              const fallbackCoords: DeviceCoordinates = {
                latitude: posFallback.coords.latitude,
                longitude: posFallback.coords.longitude,
                accuracy: posFallback.coords.accuracy || 20,
              };
              onCoordinatesAcquired(fallbackCoords);
              finishResolve(fallbackCoords);
            } else {
              const detail: GeolocationErrorDetail = {
                code: 'POSITION_UNAVAILABLE',
                message: 'Phone GPS is turned OFF. Please pull down quick settings and turn ON Location.',
                isPermissionDenied: false,
                isGpsDisabled: true,
                isTimeout: false,
              };
              dispatchError(detail);
              finishResolve(null);
            }
          },
          (errFallback) => {
            console.warn('[RealGPS] Standard-accuracy browser GPS error code:', errFallback.code, errFallback.message);
            if (errFallback.code === 1) {
              const detail: GeolocationErrorDetail = {
                code: 'PERMISSION_DENIED',
                message: 'Location permission was denied. Tap the lock icon in Chrome to allow access.',
                isPermissionDenied: true,
                isGpsDisabled: false,
                isTimeout: false,
              };
              dispatchError(detail);
            } else if (errFallback.code === 2) {
              const detail: GeolocationErrorDetail = {
                code: 'POSITION_UNAVAILABLE',
                message: 'Phone GPS is turned OFF. Please pull down quick settings and turn ON Location.',
                isPermissionDenied: false,
                isGpsDisabled: true,
                isTimeout: false,
              };
              dispatchError(detail);
              if (isManualPress) {
                Alert.alert(
                  'Turn ON Phone GPS',
                  'Your phone GPS / Location is currently turned OFF. Please pull down your phone notification bar and turn ON Location (GPS).',
                  [{ text: 'OK' }]
                );
              }
            } else if (errFallback.code === 3) {
              const detail: GeolocationErrorDetail = {
                code: 'TIMEOUT',
                message: 'GPS search timed out. Tap "Fetch Live Location" to retry.',
                isPermissionDenied: false,
                isGpsDisabled: false,
                isTimeout: true,
              };
              dispatchError(detail);
            } else {
              const detail: GeolocationErrorDetail = {
                code: 'UNKNOWN',
                message: 'Unable to acquire real GPS location.',
                isPermissionDenied: false,
                isGpsDisabled: true,
                isTimeout: false,
              };
              dispatchError(detail);
            }
            finishResolve(null);
          },
          {
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 60000,
          }
        );
      }
    });
  }

  // 2. Native Android / iOS Mobile Environment (Expo Go, APK, IPA)
  try {
    // 2a. Prompt Foreground Location Permission FIRST
    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && perm.status !== 'granted') {
      perm = await Location.requestForegroundPermissionsAsync();
    }

    if (!perm.granted && perm.status !== 'granted') {
      const detail: GeolocationErrorDetail = {
        code: 'PERMISSION_DENIED',
        message: 'Location permission is denied. Tap to open Settings.',
        isPermissionDenied: true,
        isGpsDisabled: false,
        isTimeout: false,
      };
      dispatchError(detail);
      if (isManualPress) {
        Alert.alert(
          'Location Permission Required',
          'Please allow Location access ("While using the app" or "Only this time") in device settings to detect your real location.',
          [
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }
      return null;
    }

    // 2b. Check if Phone GPS (Location Service) is turned ON
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        if (Platform.OS === 'android') {
          try {
            await Location.enableNetworkProviderAsync();
          } catch (_) {
            const detail: GeolocationErrorDetail = {
              code: 'POSITION_UNAVAILABLE',
              message: 'Phone GPS is turned OFF. Please turn ON Location in settings.',
              isPermissionDenied: false,
              isGpsDisabled: true,
              isTimeout: false,
            };
            dispatchError(detail);
            if (isManualPress) {
              Alert.alert(
                'Turn ON Device Location (GPS)',
                'Your phone GPS is currently turned OFF. Please turn ON Location in your quick settings or phone settings to detect your real location.',
                [
                  { text: 'Open Settings', onPress: () => Linking.openSettings() },
                  { text: 'Cancel', style: 'cancel' },
                ]
              );
            }
            return null;
          }
        } else {
          const detail: GeolocationErrorDetail = {
            code: 'POSITION_UNAVAILABLE',
            message: 'Phone GPS is turned OFF. Please turn ON Location in settings.',
            isPermissionDenied: false,
            isGpsDisabled: true,
            isTimeout: false,
          };
          dispatchError(detail);
          return null;
        }
      }
    } catch (svcErr) {
      console.warn('[RealGPS] hasServicesEnabledAsync check failed:', svcErr);
    }

    // 2c. Fetch REAL device coordinates from GPS hardware (No fallbacks, no fakes)
    let realCoords: DeviceCoordinates | null = null;

    try {
      const cached = await Location.getLastKnownPositionAsync({ maxAge: 300000 });
      if (cached?.coords && cached.coords.latitude !== 0 && cached.coords.longitude !== 0) {
        realCoords = {
          latitude: cached.coords.latitude,
          longitude: cached.coords.longitude,
          accuracy: cached.coords.accuracy || 10,
        };
        onCoordinatesAcquired(realCoords);
      }
    } catch (_) {}

    try {
      const fresh = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<null>((res) => setTimeout(() => res(null), 8000)),
      ]);

      if (fresh?.coords && fresh.coords.latitude !== 0 && fresh.coords.longitude !== 0) {
        realCoords = {
          latitude: fresh.coords.latitude,
          longitude: fresh.coords.longitude,
          accuracy: fresh.coords.accuracy || 8,
        };
        onCoordinatesAcquired(realCoords);
        return realCoords;
      }
    } catch (highErr) {
      try {
        const balanced = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (balanced?.coords && balanced.coords.latitude !== 0 && balanced.coords.longitude !== 0) {
          realCoords = {
            latitude: balanced.coords.latitude,
            longitude: balanced.coords.longitude,
            accuracy: balanced.coords.accuracy || 12,
          };
          onCoordinatesAcquired(realCoords);
          return realCoords;
        }
      } catch (_) {}
    }

    if (!realCoords) {
      const detail: GeolocationErrorDetail = {
        code: 'TIMEOUT',
        message: 'Device GPS is searching for satellites. Please ensure Location is ON.',
        isPermissionDenied: false,
        isGpsDisabled: false,
        isTimeout: true,
      };
      dispatchError(detail);
    }
    return realCoords;
  } catch (err: any) {
    console.warn('[RealGPS] Location acquisition error:', err);
    const detail: GeolocationErrorDetail = {
      code: 'UNKNOWN',
      message: err.message || 'GPS location acquisition failed.',
      isPermissionDenied: false,
      isGpsDisabled: true,
      isTimeout: false,
    };
    dispatchError(detail);
  }

  return null;
};

/**
 * Continuous real-time location subscriber.
 * Started AFTER permission is granted to keep tracking device movement.
 * Returns an unsubscribe cleanup function.
 */
export const subscribeRealDeviceLocationWatcher = (
  onCoordinatesAcquired: (coords: DeviceCoordinates) => void,
  onError?: (err: GeolocationErrorDetail) => void
): (() => void) => {
  // Web browser watcher
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
    let watchId: number | null = null;
    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (pos?.coords && pos.coords.latitude && pos.coords.longitude) {
            onCoordinatesAcquired({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy || 10,
            });
          }
        },
        (err) => {
          // In continuous watching, code 3 (TIMEOUT) is normal when stationary or indoors; do not report as error
          if (err.code === 3) return;
          if (onError) {
            if (err.code === 1) {
              onError({
                code: 'PERMISSION_DENIED',
                message: 'Location permission was denied.',
                isPermissionDenied: true,
                isGpsDisabled: false,
                isTimeout: false,
              });
            } else if (err.code === 2) {
              onError({
                code: 'POSITION_UNAVAILABLE',
                message: 'Phone GPS is turned OFF.',
                isPermissionDenied: false,
                isGpsDisabled: true,
                isTimeout: false,
              });
            }
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 25000,
          maximumAge: 5000,
        }
      );
    } catch (_) {}

    return () => {
      if (watchId !== null) {
        try {
          navigator.geolocation.clearWatch(watchId);
        } catch (_) {}
      }
    };
  }

  // Native Mobile watcher
  let active = true;
  let sub: Location.LocationSubscription | null = null;
  (async () => {
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) return;
      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 1,
        },
        (loc) => {
          if (!active) return;
          if (loc?.coords && loc.coords.latitude !== 0 && loc.coords.longitude !== 0) {
            onCoordinatesAcquired({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              accuracy: loc.coords.accuracy || 8,
            });
          }
        }
      );
    } catch (_) {}
  })();

  return () => {
    active = false;
    if (sub) {
      try {
        sub.remove();
      } catch (_) {}
      sub = null;
    }
  };
};

/**
 * Backward compatibility alias for fetchRealDeviceLocation.
 */
export const fetchLiveDeviceLocation = async (
  onCoordinatesAcquired: (coords: DeviceCoordinates) => void,
  onPermissionDenied?: () => void,
  isManualPress = false
): Promise<DeviceCoordinates | null> => {
  return fetchRealDeviceLocation(
    {
      onCoordinatesAcquired,
      onGpsDisabled: () => {},
      onPermissionDenied: () => {
        if (onPermissionDenied) onPermissionDenied();
      },
    },
    isManualPress
  );
};
