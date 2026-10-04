import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "@/services/session";
import { RootNavigator } from "@/navigation/RootNavigator";
import { ThemeProvider } from "@/theme/ThemeContext";
import { ConfirmProvider } from "@/components/ConfirmDialog";

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ConfirmProvider>
          <SessionProvider>
            <RootNavigator />
            <StatusBar style="auto" />
          </SessionProvider>
        </ConfirmProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
