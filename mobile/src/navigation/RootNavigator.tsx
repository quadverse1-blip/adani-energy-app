import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/useAuthStore';
import { AuthNavigator } from './AuthNavigator';
import { TechnicianNavigator } from './TechnicianNavigator';
import { AdminNavigator } from './AdminNavigator';
import { SupervisorNavigator } from './SupervisorNavigator';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { requestRequiredAppPermissions } from '../utils/permissionUtils';

export const RootNavigator: React.FC = () => {
  const { user, isInitialized, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  // Ensure required permissions (Location & Camera) are granted after login
  useEffect(() => {
    if (user) {
      requestRequiredAppPermissions(false).catch((err) => {
        console.warn('[RootNavigator] Permission check error:', err);
      });
    }
  }, [user?.id]);

  if (!isInitialized) {
    return <LoadingSpinner message="Initializing Adani Enterprise Platform..." />;
  }

  const renderContent = () => {
    if (!user) {
      return <AuthNavigator />;
    }
    const role = (user.role || '').toLowerCase();
    if (role === 'admin') {
      return <AdminNavigator />;
    }
    if (role === 'supervisor') {
      return <SupervisorNavigator />;
    }
    return <TechnicianNavigator />;
  };

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      {renderContent()}
    </NavigationContainer>
  );
};
