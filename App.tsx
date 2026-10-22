import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "@/services/session";
import { TenantProvider, useTenant } from "@/services/tenant";
import { AppLockProvider } from "@/services/appLock";
import { RootNavigator } from "@/navigation/RootNavigator";
import { ThemeProvider } from "@/theme/ThemeContext";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { LanguageProvider } from "@/i18n";
import { AnimatedSplash } from "@/components/AnimatedSplash";

// Layar pembuka native ditahan sampai layar pembuka beranimasi siap.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <ConfirmProvider>
            <TenantProvider>
              <SessionProvider>
                <AppShell />
              </SessionProvider>
            </TenantProvider>
          </ConfirmProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppShell() {
  const kode = useTenant().tenant?.kode ?? null;
  // undefined = layar pembuka belum selesai. Company baru dipilih (kode lain): layar pembuka diputar lagi
  // supaya pembaruan diperiksa sesuai company sebelum login.
  const [splashDoneFor, setSplashDoneFor] = useState<string | null>();
  const isSplashDone =
    splashDoneFor !== undefined && (kode === null || kode === splashDoneFor);
  return (
    <>
      <AppLockProvider>
        <RootNavigator />
        <StatusBar style="auto" />
      </AppLockProvider>
      {isSplashDone ? null : (
        <AnimatedSplash onDone={() => setSplashDoneFor(kode)} />
      )}
    </>
  );
}
