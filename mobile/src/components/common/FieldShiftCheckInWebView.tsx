import React, { useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  Text,
} from 'react-native';
import { WebView } from 'react-native-webview';

export interface FieldShiftCheckInWebViewProps {
  uri?: string;
  html?: string;
  onLocationPermissionStatus?: (granted: boolean) => void;
  style?: any;
  [key: string]: any;
}

const WebViewAny = WebView as any;

/**
 * Enterprise Field Shift Check-In WebView component.
 * Configured with Android native location permissions, high-accuracy geolocation
 * bridging, DOM storage, and hardware GPS support for the Adani Field Operations suite.
 */
export const FieldShiftCheckInWebView: React.FC<FieldShiftCheckInWebViewProps> = ({
  uri,
  html,
  onLocationPermissionStatus,
  style,
  ...rest
}) => {
  const webViewRef = useRef<any>(null);

  // Request Android native location permissions before WebView loads
  const requestAndroidLocationPermissions = useCallback(async () => {
    if (Platform.OS !== 'android') return true;

    try {
      const fineGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      const coarseGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
      );

      if (fineGranted || coarseGranted) {
        if (onLocationPermissionStatus) onLocationPermissionStatus(true);
        return true;
      }

      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ]);

      const isGranted =
        granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED ||
        granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED;

      if (onLocationPermissionStatus) onLocationPermissionStatus(isGranted);
      return isGranted;
    } catch (err) {
      console.warn('[FieldShiftCheckInWebView] Android permission request error:', err);
      return false;
    }
  }, [onLocationPermissionStatus]);

  useEffect(() => {
    requestAndroidLocationPermissions();
  }, [requestAndroidLocationPermissions]);

  const source = uri ? { uri } : html ? { html } : undefined;

  return (
    <View style={[styles.container, style]}>
      <WebViewAny
        ref={webViewRef}
        source={source}
        style={styles.webView}
        // Essential Geolocation & Web Features
        geolocationEnabled={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        originWhitelist={['*']}
        mixedContentMode="always"
        // Performance & Hardware Acceleration
        androidHardwareAccelerationDisabled={false}
        scalesPageToFit={true}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1E63F0" />
            <Text style={styles.loadingText}>Loading Field Shift Radar...</Text>
          </View>
        )}
        startInLoadingState={true}
        {...rest}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    ...(StyleSheet.absoluteFill as any),
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
});

export default FieldShiftCheckInWebView;
