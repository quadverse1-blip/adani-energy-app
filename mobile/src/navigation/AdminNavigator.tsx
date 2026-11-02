import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { EmployeesScreen } from '../screens/admin/EmployeesScreen';
import { SitesScreen } from '../screens/admin/SitesScreen';
import { TrackingScreen } from '../screens/admin/TrackingScreen';
import { AttendanceLogsScreen } from '../screens/admin/AttendanceLogsScreen';
import { ReportsScreen } from '../screens/admin/ReportsScreen';
import { CompensationScreen } from '../screens/admin/CompensationScreen';
import { HolidayManagementScreen } from '../screens/admin/HolidayManagementScreen';

const Stack = createNativeStackNavigator();

export const AdminNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="AdminDashboard"
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Stack.Screen name="Employees" component={EmployeesScreen} />
      <Stack.Screen name="Sites" component={SitesScreen} />
      <Stack.Screen name="Tracking" component={TrackingScreen} />
      <Stack.Screen name="AttendanceLogs" component={AttendanceLogsScreen} />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen
        name="Salary"
        component={CompensationScreen}
      />
      <Stack.Screen name="Holidays" component={HolidayManagementScreen} />
    </Stack.Navigator>
  );
};
