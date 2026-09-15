import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '@/theme/colors';
import { useSession } from '@/services/session';

import { LoginScreen } from '@/screens/auth/LoginScreen';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { ClockScreen } from '@/screens/attendance/ClockScreen';
import { AttendanceHistoryScreen } from '@/screens/attendance/AttendanceHistoryScreen';
import { LeaveListScreen } from '@/screens/leave/LeaveListScreen';
import { LeaveRequestScreen } from '@/screens/leave/LeaveRequestScreen';
import { LeaveApprovalScreen } from '@/screens/leave/LeaveApprovalScreen';
import { PayslipListScreen } from '@/screens/payroll/PayslipListScreen';
import { PayslipDetailScreen } from '@/screens/payroll/PayslipDetailScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Stack kecil di dalam tab Absensi (Clock -> History) dan tab Cuti
// (List -> Request) supaya tetap 1 tab tapi bisa navigasi berjenjang.
function AttendanceStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen name="Clock" component={ClockScreen} options={{ title: 'Absensi' }} />
      <Stack.Screen name="History" component={AttendanceHistoryScreen} options={{ title: 'Riwayat Absensi' }} />
    </Stack.Navigator>
  );
}

function LeaveStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen name="LeaveList" component={LeaveListScreen} options={{ title: 'Cuti & Pengajuan' }} />
      <Stack.Screen name="LeaveRequest" component={LeaveRequestScreen} options={{ title: 'Ajukan' }} />
    </Stack.Navigator>
  );
}

function PayrollStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen name="PayslipList" component={PayslipListScreen} options={{ title: 'Slip Gaji' }} />
      <Stack.Screen name="PayslipDetail" component={PayslipDetailScreen} options={{ title: 'Detail Slip Gaji' }} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  const { employee } = useSession();
  const canApprove = employee?.role === 'mss' || employee?.role === 'hr';

  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.accent }}>
      <Tab.Screen name="Beranda" component={HomeScreen} />
      <Tab.Screen name="Absensi" component={AttendanceStack} />
      <Tab.Screen name="Cuti" component={LeaveStack} />
      {canApprove && (
        <Tab.Screen
          name="Approval"
          component={LeaveApprovalScreen}
          options={{ headerShown: true, title: 'Approval' }}
        />
      )}
      <Tab.Screen name="Slip Gaji" component={PayrollStack} />
      <Tab.Screen name="Profil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { employee } = useSession();

  return (
    <NavigationContainer>
      {employee ? <MainTabs /> : <LoginScreen />}
    </NavigationContainer>
  );
}
