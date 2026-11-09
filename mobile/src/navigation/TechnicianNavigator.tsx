import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { DashboardScreen } from '../screens/technician/DashboardScreen';
import { CheckInScreen } from '../screens/technician/CheckInScreen';
import { CheckOutScreen } from '../screens/technician/CheckOutScreen';
import { TodayAttendanceScreen } from '../screens/technician/TodayAttendanceScreen';
import { HistoryScreen } from '../screens/technician/HistoryScreen';
import { SalaryScreen } from '../screens/technician/SalaryScreen';
import { SiteDetailsScreen } from '../screens/technician/SiteDetailsScreen';
import { SupervisorTeamScreen } from '../screens/supervisor/SupervisorTeamScreen';
import { useAuthStore } from '../store/useAuthStore';

const Stack = createNativeStackNavigator();

export const TechnicianNavigator: React.FC = () => {
  const { user } = useAuthStore();
  const isSupervisor = user?.role === 'supervisor';

  return (
    <Stack.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="History" component={HistoryScreen} />
      <Stack.Screen name="Today" component={TodayAttendanceScreen} />
      <Stack.Screen name="CheckIn" component={CheckInScreen} />
      <Stack.Screen name="CheckOut" component={CheckOutScreen} />
      <Stack.Screen
        name="Salary"
        component={SalaryScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SiteDetails"
        component={SiteDetailsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SiteManagement"
        component={SiteDetailsScreen}
        options={{ headerShown: false }}
      />
      {isSupervisor && (
        <Stack.Screen
          name="SupervisorTeam"
          component={SupervisorTeamScreen}
          options={{ headerShown: false }}
        />
      )}
    </Stack.Navigator>
  );
};

export default TechnicianNavigator;
