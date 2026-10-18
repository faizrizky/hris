import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "@/services/session";
import { AppLockProvider } from "@/services/appLock";
import { RootNavigator } from "@/navigation/RootNavigator";
import { ThemeProvider } from "@/theme/ThemeContext";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { LanguageProvider } from "@/i18n";
import { AnimatedSplash } from "@/components/AnimatedSplash";

// Layar pembuka native ditahan sampai layar pembuka beranimasi siap.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [isSplashDone, setIsSplashDone] = useState(false);
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <ConfirmProvider>
            <SessionProvider>
              <AppLockProvider>
                <RootNavigator />
                <StatusBar style="auto" />
              </AppLockProvider>
              {isSplashDone ? null : (
                <AnimatedSplash onDone={() => setIsSplashDone(true)} />
              )}
            </SessionProvider>
          </ConfirmProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
