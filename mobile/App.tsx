import React, { useEffect } from 'react';
import { LogBox, Platform, NativeModules } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';

// 1. Proactively polyfill missing addListener and removeListeners on legacy native modules to eliminate NativeEventEmitter warnings
if (Platform.OS !== 'web' && NativeModules) {
  try {
    Object.keys(NativeModules).forEach((modName) => {
      const mod = NativeModules[modName];
      if (mod && typeof mod === 'object') {
        if (typeof mod.addListener !== 'function') mod.addListener = () => {};
        if (typeof mod.removeListeners !== 'function') mod.removeListeners = () => {};
      }
    });
  } catch {}
}

LogBox.ignoreLogs([
  '`new NativeEventEmitter()`',
  'new NativeEventEmitter()',
  'addListener',
  'removeListeners',
  'Current location is unavailable',
  'User GPS location fetch error',
  'Location provider is unavailable',
  'Dashboard loadData error',
]);

// Initialize Mappls SDK with cluster ID from app1794051151341i9612916.a.conf / .olf
if (Platform.OS !== 'web') {
  try {
    const MapplsModule = require('mappls-map-react-native');
    const MapplsGL = MapplsModule.default || MapplsModule;
    if (MapplsGL) {
      if (typeof MapplsGL.setClusterId === 'function') {
        MapplsGL.setClusterId('1794051151341i9612916');
      } else if (typeof MapplsGL.settingClusterId === 'function') {
        MapplsGL.settingClusterId('1794051151341i9612916', null);
      }
    }
  } catch (err) {
    // Native module unavailable in web / dev client without native links
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}
