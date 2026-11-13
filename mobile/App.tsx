import React, { useEffect } from 'react';
import { LogBox, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AppErrorBoundary } from './src/components/common/AppErrorBoundary';

LogBox.ignoreLogs([
  'Current location is unavailable',
  'User GPS location fetch error',
  'Location provider is unavailable',
  'new NativeEventEmitter()',
]);

export default function App() {
  useEffect(() => {
    // Initialize Mappls SDK with cluster ID from app1794051151341i9612916.a.conf / .olf
    if (Platform.OS !== 'web') {
      try {
        const MapplsModule = require('mappls-map-react-native');
        const MapplsGL = MapplsModule?.default || MapplsModule;
        if (MapplsGL) {
          if (typeof MapplsGL.setClusterId === 'function') {
            MapplsGL.setClusterId('1794051151341i9612916');
          } else if (typeof MapplsGL.settingClusterId === 'function') {
            MapplsGL.settingClusterId('1794051151341i9612916', null);
          }
        }
      } catch (err) {
        // Silently handled: native map will use resilient Web/Leaflet engine if native module is absent
      }
    }
  }, []);

  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <RootNavigator />
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}
