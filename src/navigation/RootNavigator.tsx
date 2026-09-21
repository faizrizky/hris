import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { colors } from "@/theme/colors";
import { useSession } from "@/services/session";

import { LoginScreen } from "@/screens/auth/LoginScreen";
import { HomeScreen } from "@/screens/home/HomeScreen";
import { ClockScreen } from "@/screens/attendance/ClockScreen";
import { AttendanceHistoryScreen } from "@/screens/attendance/AttendanceHistoryScreen";
import { AttendanceCorrectionHistoryScreen } from "@/screens/attendance/AttendanceCorrectionHistoryScreen";
import { LeaveListScreen } from "@/screens/leave/LeaveListScreen";
import { LeaveRequestScreen } from "@/screens/leave/LeaveRequestScreen";
import { LeaveApprovalScreen } from "@/screens/leave/LeaveApprovalScreen";
import { PayslipListScreen } from "@/screens/payroll/PayslipListScreen";
import { PayslipDetailScreen } from "@/screens/payroll/PayslipDetailScreen";
import { ProfileScreen } from "@/screens/profile/ProfileScreen";
import { AttendanceCorrectionScreen } from "@/screens/attendance/AttendanceCorrectionScreen";
import { NavBar } from "@/components/NavBar";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Stack kecil di dalam tab Absensi (Clock -> History) dan tab Cuti
// (List -> Request) supaya tetap 1 tab tapi bisa navigasi berjenjang.
function AttendanceStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        header: (props) => (
          <NavBar
            title={props.options.title ?? props.route.name}
            onBack={props.back ? props.navigation.goBack : undefined}
          />
        ),
      }}
    >
      <Stack.Screen
        name="Clock"
        component={ClockScreen}
        options={{ title: "Absensi" }}
      />
      <Stack.Screen
        name="History"
        component={AttendanceHistoryScreen}
        options={{ title: "Riwayat Absensi" }}
      />
      <Stack.Screen
        name="AttendanceCorrection"
        component={AttendanceCorrectionScreen}
        options={{ title: "Koreksi Absensi" }}
      />
      <Stack.Screen
        name="AttendanceCorrectionHistory"
        component={AttendanceCorrectionHistoryScreen}
        options={{ title: "Riwayat Koreksi" }}
      />
    </Stack.Navigator>
  );
}

function LeaveStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        header: (props) => (
          <NavBar
            title={props.options.title ?? props.route.name}
            onBack={props.back ? props.navigation.goBack : undefined}
          />
        ),
      }}
    >
      <Stack.Screen
        name="LeaveList"
        component={LeaveListScreen}
        options={{ title: "Cuti & Pengajuan" }}
      />
      <Stack.Screen
        name="LeaveRequest"
        component={LeaveRequestScreen}
        options={{ title: "Ajukan" }}
      />
    </Stack.Navigator>
  );
}

function PayrollStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        header: (props) => (
          <NavBar
            title={props.options.title ?? props.route.name}
            onBack={props.back ? props.navigation.goBack : undefined}
          />
        ),
      }}
    >
      <Stack.Screen
        name="PayslipList"
        component={PayslipListScreen}
        options={{ title: "Slip Gaji" }}
      />
      <Stack.Screen
        name="PayslipDetail"
        component={PayslipDetailScreen}
        options={{ title: "Detail Slip Gaji" }}
      />
    </Stack.Navigator>
  );
}

function MainTabs() {
  const { employee } = useSession();
  const canApprove = employee?.role === "mss" || employee?.role === "hr";

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
      }}
    >
      <Tab.Screen
        name="Beranda"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Absensi"
        component={AttendanceStack}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Cuti"
        component={LeaveStack}
        options={{ headerShown: false }}
      />
      {canApprove && (
        <Tab.Screen
          name="Approval"
          component={LeaveApprovalScreen}
          options={{ header: () => <NavBar title="Approval" /> }}
        />
      )}
      <Tab.Screen
        name="Slip Gaji"
        component={PayrollStack}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Profil"
        component={ProfileScreen}
        options={{
          header: () => <NavBar title="Profil" />,
        }}
      />
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
