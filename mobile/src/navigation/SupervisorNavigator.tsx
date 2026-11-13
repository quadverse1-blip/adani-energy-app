import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { SupervisorDashboardScreen } from '../screens/supervisor/SupervisorDashboardScreen';
import { SupervisorTeamScreen } from '../screens/supervisor/SupervisorTeamScreen';
import { AttendanceLogsScreen } from '../screens/admin/AttendanceLogsScreen';
import { SupervisorAttendanceHistoryScreen } from '../screens/supervisor/SupervisorAttendanceHistoryScreen';
import { SitesScreen } from '../screens/admin/SitesScreen';
import { SupervisorSiteManagementScreen } from '../screens/supervisor/SupervisorSiteManagementScreen';
import { TrackingScreen } from '../screens/admin/TrackingScreen';
import { SalaryScreen } from '../screens/technician/SalaryScreen';
import { ReportsScreen } from '../screens/admin/ReportsScreen';
import { ProfileScreen } from '../screens/common/ProfileScreen';
import { SiteDetailsScreen } from '../screens/technician/SiteDetailsScreen';
import { TodayAttendanceScreen } from '../screens/technician/TodayAttendanceScreen';
import { HistoryScreen } from '../screens/technician/HistoryScreen';
import { CheckInScreen } from '../screens/technician/CheckInScreen';

const Stack = createNativeStackNavigator();

export const SupervisorNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="SupervisorDashboard"
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Stack.Screen name="SupervisorDashboard" component={SupervisorDashboardScreen} />
      <Stack.Screen name="AdminDashboard" component={SupervisorDashboardScreen} />
      <Stack.Screen name="SupervisorTeam" component={SupervisorTeamScreen} />
      <Stack.Screen name="AttendanceLogs" component={SupervisorAttendanceHistoryScreen} />
      <Stack.Screen name="AttendanceLogsScreen" component={SupervisorAttendanceHistoryScreen} />
      <Stack.Screen name="AttendanceHistory" component={SupervisorAttendanceHistoryScreen} />
      <Stack.Screen name="AdminAttendanceLogs" component={AttendanceLogsScreen} />
      <Stack.Screen name="Sites" component={SupervisorSiteManagementScreen} />
      <Stack.Screen name="SiteManagement" component={SupervisorSiteManagementScreen} />
      <Stack.Screen name="SupervisorSiteManagement" component={SupervisorSiteManagementScreen} />
      <Stack.Screen name="AdminSites" component={SitesScreen} />
      <Stack.Screen name="Tracking" component={TrackingScreen} />
      <Stack.Screen
        name="Salary"
        component={SalaryScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="SiteDetails" component={SiteDetailsScreen} />
      <Stack.Screen name="Today" component={TodayAttendanceScreen} />
      <Stack.Screen name="History" component={HistoryScreen} />
      <Stack.Screen name="CheckIn" component={CheckInScreen} />
    </Stack.Navigator>
  );
};

export default SupervisorNavigator;
