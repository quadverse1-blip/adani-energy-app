import React from 'react';
import { LogBox, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';

LogBox.ignoreLogs([
  'Current location is unavailable',
  'User GPS location fetch error',
  'Location provider is unavailable',
  'new NativeEventEmitter()',
]);

// Initialize Mappls SDK only if API keys are explicitly configured
const mapplsMapKey = process.env.EXPO_PUBLIC_MAPPLS_MAP_KEY || '';
const mapplsRestKey = process.env.EXPO_PUBLIC_MAPPLS_REST_KEY || '';

if (Platform.OS !== 'web' && (mapplsMapKey || mapplsRestKey)) {
  try {
    const MapplsModule = require('mappls-map-react-native');
    const MapplsGL = MapplsModule.default || MapplsModule;
    if (MapplsGL) {
      if (mapplsMapKey && typeof MapplsGL.setMapSDKKey === 'function') {
        MapplsGL.setMapSDKKey(mapplsMapKey);
      }
      if (mapplsRestKey && typeof MapplsGL.setRestAPIKey === 'function') {
        MapplsGL.setRestAPIKey(mapplsRestKey);
      }
    }
  } catch (err) {
    // Gracefully handled if native module is not linked
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}
