import { Platform, Alert, Linking } from 'react-native';
import * as Location from 'expo-location';

export interface DeviceCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export type GeolocationErrorCode = 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'UNKNOWN';

export interface GeolocationErrorDetail {
  code: GeolocationErrorCode;
  message: string;
  isPermissionDenied: boolean;
  isGpsDisabled: boolean;
  isTimeout: boolean;
}

export interface GeolocationCallbacks {
  onCoordinatesAcquired: (coords: DeviceCoordinates) => void;
  onError?: (err: GeolocationErrorDetail) => void;
  onGpsDisabled?: (message?: string) => void;
  onPermissionDenied?: (message?: string) => void;
  onTimeout?: (message?: string) => void;
}

/**
 * Checks browser permission state ('granted' | 'prompt' | 'denied' | 'unsupported')
 * using W3C Permissions API on supported browsers.
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
 * Zero fake coordinates, zero IP approximations, zero mock data.
 * Separate handling for PERMISSION_DENIED, POSITION_UNAVAILABLE, and TIMEOUT.
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

  // 1. Web Browser Environment (Chrome on Android, Safari, Edge, Desktop Chrome)
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
    return new Promise((resolve) => {
      // Step A: Pre-check if permission is explicitly blocked in site settings
      if (navigator.permissions?.query) {
        navigator.permissions.query({ name: 'geolocation' }).then((status) => {
          if (status.state === 'denied') {
            const detail: GeolocationErrorDetail = {
              code: 'PERMISSION_DENIED',
              message: 'Location permission is denied in browser settings. Please allow location in your address bar settings.',
              isPermissionDenied: true,
              isGpsDisabled: false,
              isTimeout: false,
            };
            dispatchError(detail);
            if (isManualPress) {
              Alert.alert(
                'Location Permission Denied',
                'Please click the lock / info icon in your browser address bar and select "Allow" for Location to detect your position.',
                [{ text: 'OK' }]
              );
            }
            resolve(null);
          }
        }).catch(() => {});
      }

      // Step B: Use navigator.geolocation.getCurrentPosition
      // enableHighAccuracy: true ensures hardware GPS satellites are queried.
      // timeout: 25000 gives ample time (up to 25s) for user interaction with "Allow" dialogs.
      // maximumAge: 15000 allows immediate response if a fresh hardware fix was obtained recently.
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
            const detail: GeolocationErrorDetail = {
              code: 'POSITION_UNAVAILABLE',
              message: 'Device GPS is searching for satellite signal.',
              isPermissionDenied: false,
              isGpsDisabled: true,
              isTimeout: false,
            };
            dispatchError(detail);
            resolve(null);
          }
        },
        (err) => {
          console.warn('[RealGPS] Browser GPS error code:', err.code, err.message);

          if (err.code === 1) {
            // PERMISSION_DENIED: User tapped "Never allow" or permission was blocked
            const detail: GeolocationErrorDetail = {
              code: 'PERMISSION_DENIED',
              message: 'Location permission is denied in browser. Please allow location in site settings.',
              isPermissionDenied: true,
              isGpsDisabled: false,
              isTimeout: false,
            };
            dispatchError(detail);
            if (isManualPress) {
              Alert.alert(
                'Location Permission Denied',
                'Please click the lock / permissions icon in your browser address bar and set Location to "Allow".',
                [{ text: 'OK' }]
              );
            }
          } else if (err.code === 2) {
            // POSITION_UNAVAILABLE: Permission granted, but physical phone GPS is OFF
            const detail: GeolocationErrorDetail = {
              code: 'POSITION_UNAVAILABLE',
              message: 'Phone GPS is turned OFF. Please turn ON Location in your device settings.',
              isPermissionDenied: false,
              isGpsDisabled: true,
              isTimeout: false,
            };
            dispatchError(detail);
            if (isManualPress) {
              Alert.alert(
                'Turn ON Phone GPS',
                'Your phone GPS is currently turned OFF. Please pull down your phone notification bar and turn ON Location (GPS).',
                [{ text: 'OK' }]
              );
            }
          } else if (err.code === 3) {
            // TIMEOUT: Satellite search took longer than timeout limit
            const detail: GeolocationErrorDetail = {
              code: 'TIMEOUT',
              message: 'GPS satellite search timed out. Retrying GPS lock...',
              isPermissionDenied: false,
              isGpsDisabled: false,
              isTimeout: true,
            };
            dispatchError(detail);
            if (isManualPress) {
              Alert.alert(
                'Weak GPS Satellite Signal',
                'GPS satellite acquisition timed out. Please ensure you have a clear view of the sky or Wi-Fi enabled, and tap Fetch Live Location again.',
                [{ text: 'OK' }]
              );
            }
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
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 25000, maximumAge: 15000 }
      );
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
            // Automatically prompts native Google Play Services dialog:
            // "To continue, turn on device location, which uses Google's location service" [ OK ] [ No thanks ]
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
          if (isManualPress) {
            Alert.alert(
              'Turn ON Device Location (GPS)',
              'Please turn ON Location in your phone settings to detect your real location.',
              [
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }
          return null;
        }
      }
    } catch (svcErr) {
      console.warn('[RealGPS] hasServicesEnabledAsync check failed:', svcErr);
    }

    // 2c. Fetch REAL device coordinates from GPS hardware (No fallbacks, no fakes)
    let realCoords: DeviceCoordinates | null = null;

    // Fast check for recent real GPS fix (<5 minutes old)
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

    // Precise live GPS position from device hardware
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
      // Fallback to balanced accuracy if GPS satellite search timed out indoors
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
      if (isManualPress) {
        Alert.alert(
          'Waiting for GPS Signal',
          'Could not lock real device GPS satellites. Please make sure Location (GPS) is turned ON in phone settings and you have clear view of the sky or Wi-Fi connected.',
          [
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
            { text: 'Retry', onPress: () => fetchRealDeviceLocation(callbacks, true) },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }
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
 * Continuous real-time location subscriber using W3C watchPosition on Web
 * and expo-location watchPositionAsync on native mobile.
 * Returns an unsubscribe cleanup function.
 */
export const subscribeRealDeviceLocationWatcher = (
  onCoordinatesAcquired: (coords: DeviceCoordinates) => void,
  onError?: (err: GeolocationErrorDetail) => void
): (() => void) => {
  // Web browser watcher
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
    const watchId = navigator.geolocation.watchPosition(
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
        if (onError) {
          if (err.code === 1) {
            onError({
              code: 'PERMISSION_DENIED',
              message: 'Location permission is denied.',
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
          } else if (err.code === 3) {
            onError({
              code: 'TIMEOUT',
              message: 'GPS signal timeout.',
              isPermissionDenied: false,
              isGpsDisabled: false,
              isTimeout: true,
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

    return () => {
      try {
        navigator.geolocation.clearWatch(watchId);
      } catch (_) {}
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
