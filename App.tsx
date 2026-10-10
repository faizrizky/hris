import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "@/services/session";
import { RootNavigator } from "@/navigation/RootNavigator";
import { ThemeProvider } from "@/theme/ThemeContext";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { LanguageProvider } from "@/i18n";

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <ConfirmProvider>
            <SessionProvider>
              <RootNavigator />
              <StatusBar style="auto" />
            </SessionProvider>
          </ConfirmProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
