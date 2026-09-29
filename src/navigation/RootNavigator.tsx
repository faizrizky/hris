import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSession } from "@/services/session";
import { FloatingTabBar } from "@/components/FloatingTabBar";
import { LoginScreen } from "@/screens/auth/LoginScreen";
import { HomeScreen } from "@/screens/home/HomeScreen";
import { ClockScreen } from "@/screens/attendance/ClockScreen";
import { AttendanceHistoryScreen } from "@/screens/attendance/AttendanceHistoryScreen";
import { AttendanceCorrectionHistoryScreen } from "@/screens/attendance/AttendanceCorrectionHistoryScreen";
import { LeaveListScreen } from "@/screens/leave/LeaveListScreen";
import { LeaveRequestScreen } from "@/screens/leave/LeaveRequestScreen";
import { LeaveApprovalScreen } from "@/screens/leave/LeaveApprovalScreen";
import { OvertimeScreen } from "@/screens/leave/OvertimeScreen";
import { PayslipListScreen } from "@/screens/payroll/PayslipListScreen";
import { PayslipDetailScreen } from "@/screens/payroll/PayslipDetailScreen";
import { ProfileScreen } from "@/screens/profile/ProfileScreen";
import { AttendanceCorrectionScreen } from "@/screens/attendance/AttendanceCorrectionScreen";
import { NavBar } from "@/components/NavBar";
import { NotificationScreen } from "@/screens/notifications/NotificationScreen";
import { TaxScreen } from "@/screens/payroll/TaxScreen";
import { AppraisalScreen } from "@/screens/appraisal/AppraisalScreen";
import { StaffListScreen } from "@/screens/staff/StaffListScreen";
import { StaffDetailScreen } from "@/screens/staff/StaffDetailScreen";
import { StaffAttendanceScreen } from "@/screens/staff/StaffAttendanceScreen";
import { StaffHistoryScreen } from "@/screens/staff/StaffHistoryScreen";

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
        options={{ title: "Absensi", headerShown: false }}
      />
      <Stack.Screen
        name="History"
        component={AttendanceHistoryScreen}
        options={{ title: "Riwayat Absensi", headerShown: false }}
      />
      <Stack.Screen
        name="AttendanceCorrection"
        component={AttendanceCorrectionScreen}
        options={{ title: "Koreksi Absensi", headerShown: false }}
      />
      <Stack.Screen
        name="AttendanceCorrectionHistory"
        component={AttendanceCorrectionHistoryScreen}
        options={{ title: "Riwayat Koreksi", headerShown: false }}
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
        options={{ title: "Cuti & Pengajuan", headerShown: false }}
      />

      <Stack.Screen
        name="Overtime"
        component={OvertimeScreen}
        options={{ title: "Lembur", headerShown: false }}
      />

      <Stack.Screen
        name="LeaveRequest"
        component={LeaveRequestScreen}
        options={{ title: "Ajukan", headerShown: false }}
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
        options={{ title: "Slip Gaji", headerShown: false }}
      />
      <Stack.Screen
        name="PayslipDetail"
        component={PayslipDetailScreen}
        options={{ title: "Detail Slip Gaji" }}
      />
      <Stack.Screen
        name="TaxDetail"
        component={TaxScreen}
        options={{ title: "PPh 21 & BPJS", headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="Notifications" component={NotificationScreen} />
      <Stack.Screen name="Appraisal" component={AppraisalScreen} />
      <Stack.Screen name="StaffList" component={StaffListScreen} />
      <Stack.Screen name="StaffDetail" component={StaffDetailScreen} />
      <Stack.Screen name="StaffAttendance" component={StaffAttendanceScreen} />
      <Stack.Screen name="StaffHistory" component={StaffHistoryScreen} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  const { employee } = useSession();
  const canApprove = employee?.role === "mss" || employee?.role === "hr";

  return (
    <Tab.Navigator tabBar={(props) => <FloatingTabBar {...props} />}>
      <Tab.Screen
        name="Beranda"
        component={HomeStack}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Absensi"
        component={AttendanceStack}
        options={{ headerShown: false }}
      />
      {employee?.role === "hr" && (
        <Tab.Screen
          name="AbsensiTim"
          component={StaffAttendanceScreen}
          options={{ headerShown: false }}
        />
      )}
      <Tab.Screen
        name="Cuti"
        component={LeaveStack}
        options={{ headerShown: false }}
      />
      {canApprove && (
        <Tab.Screen
          name="Approval"
          component={LeaveApprovalScreen}
          options={{ headerShown: false }}
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
          headerShown: false,
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
