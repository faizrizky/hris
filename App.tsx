import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "@/services/session";
import { RootNavigator } from "@/navigation/RootNavigator";
import { ThemeProvider } from "@/theme/ThemeContext";

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SessionProvider>
          <RootNavigator />
          <StatusBar style="auto" />
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
