import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import { Platform, Alert } from 'react-native';

export interface AppPermissionsStatus {
  locationGranted: boolean;
  cameraGranted: boolean;
  allGranted: boolean;
}

/**
 * Request required runtime permissions (Location & Camera) for the Adani Workforce app.
 * Called automatically after login to ensure field operations, GPS geofencing,
 * and photo check-in verification function seamlessly.
 */
export const requestRequiredAppPermissions = async (showPromptAlert = false): Promise<AppPermissionsStatus> => {
  let locationGranted = false;
  let cameraGranted = false;

  // 1. Request High-Accuracy Foreground GPS Location
  try {
    const locRes = await Location.requestForegroundPermissionsAsync();
    locationGranted = locRes.status === 'granted';
  } catch (err) {
    console.warn('[Permissions] Location permission request error:', err);
  }

  // 2. Request Camera Permission for Biometric & Geofence Verification
  try {
    const camRes = await Camera.requestCameraPermissionsAsync();
    cameraGranted = camRes.status === 'granted';
  } catch (err) {
    console.warn('[Permissions] Camera permission request error:', err);
  }

  const allGranted = locationGranted && cameraGranted;

  if (showPromptAlert && !allGranted && Platform.OS !== 'web') {
    const missing: string[] = [];
    if (!locationGranted) missing.push('• Location (GPS Substation Geofence)');
    if (!cameraGranted) missing.push('• Camera (Shift Verification Selfie)');

    Alert.alert(
      'Permissions Required',
      `The Adani Workforce Platform requires the following permissions to operate:\n\n${missing.join(
        '\n'
      )}\n\nPlease grant permissions in your device settings for verified field attendance.`,
      [{ text: 'Understood' }]
    );
  }

  return {
    locationGranted,
    cameraGranted,
    allGranted,
  };
};

/**
 * Check current permission status without prompting user.
 */
export const checkRequiredAppPermissions = async (): Promise<AppPermissionsStatus> => {
  let locationGranted = false;
  let cameraGranted = false;

  try {
    const locRes = await Location.getForegroundPermissionsAsync();
    locationGranted = locRes.status === 'granted';
  } catch (err) {
    console.warn('[Permissions] Location permission check error:', err);
  }

  try {
    const camRes = await Camera.getCameraPermissionsAsync();
    cameraGranted = camRes.status === 'granted';
  } catch (err) {
    console.warn('[Permissions] Camera permission check error:', err);
  }

  const allGranted = locationGranted && cameraGranted;

  return {
    locationGranted,
    cameraGranted,
    allGranted,
  };
};
