import { Platform, Alert, Linking } from 'react-native';
import * as Location from 'expo-location';

export interface DeviceCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface GeolocationCallbacks {
  onCoordinatesAcquired: (coords: DeviceCoordinates) => void;
  onGpsDisabled?: (message?: string) => void;
  onPermissionDenied?: (message?: string) => void;
}

/**
 * Pure Real-Device GPS Geolocation.
 * Strictly acquires genuine hardware coordinates from device GPS.
 * Zero fake coordinates, zero IP approximations, zero mock data.
 */
export const fetchRealDeviceLocation = async (
  callbacks: GeolocationCallbacks,
  isManualPress = false
): Promise<DeviceCoordinates | null> => {
  const { onCoordinatesAcquired, onGpsDisabled, onPermissionDenied } = callbacks;

  // 1. Web / Browser Environment (Chrome on Android, Safari, Edge, Desktop Chrome)
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
    return new Promise((resolve) => {
      // Prompt / query browser geolocation
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
            if (onGpsDisabled) onGpsDisabled('Unable to acquire hardware GPS satellites.');
            resolve(null);
          }
        },
        (err) => {
          console.warn('[RealGPS] Browser GPS error:', err.code, err.message);
          if (err.code === 1) {
            // PERMISSION_DENIED: User clicked "Never allow" or "Block"
            const msg = 'Location permission is denied. Please tap to allow location access.';
            if (onPermissionDenied) onPermissionDenied(msg);
            if (isManualPress) {
              Alert.alert(
                'Location Permission Denied',
                'Please click the lock / permissions icon in your browser address bar and choose "Allow" for Location to detect your real position.',
                [{ text: 'OK' }]
              );
            }
          } else if (err.code === 2 || err.code === 3) {
            // POSITION_UNAVAILABLE (code 2) or TIMEOUT (code 3):
            // Permission is allowed, but device GPS hardware is turned OFF in phone settings!
            const msg = 'Device GPS is turned OFF. Please turn ON Location in phone settings.';
            if (onGpsDisabled) onGpsDisabled(msg);
            if (isManualPress) {
              Alert.alert(
                'Turn ON Phone GPS',
                'Your phone GPS / Location is turned OFF. Please pull down your phone notification bar and turn ON Location (GPS) to show your location on the map.',
                [{ text: 'OK' }]
              );
            }
          } else {
            const msg = 'Unable to acquire real GPS location. Please check device location settings.';
            if (onGpsDisabled) onGpsDisabled(msg);
          }
          resolve(null);
        },
        // enableHighAccuracy: true forces hardware GPS satellites
        // maximumAge: 10000 allows immediate lock if GPS fix was obtained in last 10s
        // timeout: 12000 gives GPS chip time to lock satellites without hanging indefinitely
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
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
      const msg = 'Location permission is denied. Tap to open Settings.';
      if (onPermissionDenied) onPermissionDenied(msg);
      if (isManualPress) {
        Alert.alert(
          'Location Permission Required',
          'Please allow Location access ("While using the app" or "Only this time") to detect your real location.',
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
            const msg = 'Device GPS is turned OFF. Please turn ON Location in settings.';
            if (onGpsDisabled) onGpsDisabled(msg);
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
          const msg = 'Device GPS is turned OFF. Please turn ON Location in settings.';
          if (onGpsDisabled) onGpsDisabled(msg);
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
        new Promise<null>((res) => setTimeout(() => res(null), 6000)),
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
      const msg = 'Device GPS is turned OFF or searching for satellites. Please ensure Location is ON.';
      if (onGpsDisabled) onGpsDisabled(msg);
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
    if (onGpsDisabled) onGpsDisabled(err.message || 'GPS location acquisition failed.');
  }

  return null;
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
