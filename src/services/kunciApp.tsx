import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { signOutSafely, useSession } from "@/services/session";
import { useTheme } from "@/theme/ThemeContext";
import { useT } from "@/i18n";
import {
  hasBiometricLogin,
  authenticate,
  readLockSettings,
  getBiometricKind,
  isLockHeld,
  saveLockSettings,
  holdLock,
  type LockSettings,
} from "@/services/biometrik";
import type { Palette } from "@/theme/colors";

interface LockContextValue {
  settings: LockSettings;
  update: (p: LockSettings) => void;
  /** Dipanggil sebelum aksi yang membuka prompt sistem (mis. kamera/biometrik) supaya tidak dianggap ke latar belakang. */
  ignoreBackground: (ms?: number) => void;
}

const Ctx = createContext<LockContextValue | null>(null);
const INITIAL_PROMPT_DELAY_MS = 250; // beri waktu layar kunci tampil sebelum prompt biometrik
const IGNORE_BACKGROUND_PROMPT_MS = 15_000; // prompt biometrik membuat aplikasi sesaat "tidak aktif"

export function useAppLock(): LockContextValue {
  const c = useContext(Ctx);
  if (!c) throw new Error("useKunci dipakai di luar KunciProvider");
  return c;
}

// Kunci otomatis: aplikasi terkunci saat dibuka dari nol dan saat kembali dari latar belakang setelah melewati batas
// waktu, bila pengguna mengaktifkannya dan perangkat punya biometrik terdaftar.
export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const { employee, setEmployee, isRestored } = useSession();
  const [settings, setSettings] = useState<LockSettings>({
    isActive: false,
    timeoutMs: 60_000,
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLockedByBackground, setIsLockedByBackground] = useState(false); // dikunci karena kembali dari latar belakang
  const [hasOpened, setHasOpened] = useState(false);
  const backgroundSince = useRef<number | null>(null);

  useEffect(() => {
    readLockSettings().then(async (p) => {
      // Kunci otomatis terikat biometrik: tanpa login biometrik aktif, kunci dimatikan (data lama yang tidak konsisten).
      if (p.isActive && !(await hasBiometricLogin())) {
        p = { ...p, isActive: false };
        saveLockSettings(p);
      }
      setSettings(p);
      setIsLoaded(true);
    });
  }, []);

  const update = useCallback((p: LockSettings) => {
    setSettings(p);
    saveLockSettings(p);
  }, []);

  const ignoreBackground = useCallback((ms = 30_000) => {
    holdLock(ms);
  }, []);

  // Terkunci saat aplikasi dibuka dari nol dengan sesi tersimpan, dan saat kembali dari latar belakang melewati batas waktu.
  const isLocked =
    isLoaded &&
    settings.isActive &&
    !!employee &&
    (isLockedByBackground || (isRestored && !hasOpened));

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "background") {
        if (!isLockHeld()) backgroundSince.current = Date.now();
        return;
      }
      if (s === "active") {
        const since = backgroundSince.current;
        backgroundSince.current = null;
        if (
          since !== null &&
          settings.isActive &&
          employee &&
          Date.now() - since >= settings.timeoutMs
        )
          setIsLockedByBackground(true);
      }
    });
    return () => sub.remove();
  }, [settings, employee]);

  const contextValue = useMemo(
    () => ({ settings, update, ignoreBackground }),
    [settings, update, ignoreBackground],
  );

  return (
    <Ctx.Provider value={contextValue}>
      {children}
      {isLocked && employee ? (
        <LockScreen
          onUnlock={() => {
            setIsLockedByBackground(false);
            setHasOpened(true);
          }}
          onSignOut={async () => {
            await signOutSafely();
            setIsLockedByBackground(false);
            setHasOpened(true);
            setEmployee(null);
          }}
          ignoreBackground={ignoreBackground}
        />
      ) : null}
    </Ctx.Provider>
  );
}

function LockScreen({
  onUnlock,
  onSignOut,
  ignoreBackground,
}: {
  onUnlock: () => void;
  onSignOut: () => void;
  ignoreBackground: (ms?: number) => void;
}) {
  const t = useT();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [kind, setKind] = useState<"wajah" | "sidikJari" | "umum">("umum");
  const [hasFailed, setHasFailed] = useState(false);
  const sedang = useRef(false);

  const open = useCallback(async () => {
    if (sedang.current) return;
    sedang.current = true;
    setHasFailed(false);
    ignoreBackground(IGNORE_BACKGROUND_PROMPT_MS);
    const isConfirmed = await authenticate(t("kunci.prompt"), t("kunci.batal"));
    sedang.current = false;
    if (isConfirmed) onUnlock();
    else setHasFailed(true);
  }, [ignoreBackground, onUnlock, t]);

  const openInitially = useEffectEvent(open);
  useEffect(() => {
    getBiometricKind().then(setKind);
    const id = setTimeout(openInitially, INITIAL_PROMPT_DELAY_MS);
    return () => clearTimeout(id);
  }, []);

  const icon = kind === "wajah" ? "scan-outline" : "finger-print-outline";
  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <View style={styles.center}>
        <View style={styles.ring}>
          <Ionicons name={icon} size={44} color={c.accent} />
        </View>
        <Text style={styles.title}>{t("kunci.judul")}</Text>
        <Text style={styles.sub}>
          {hasFailed ? t("kunci.gagal") : t("kunci.sub")}
        </Text>
        <Pressable style={styles.button} onPress={open}>
          <Text style={styles.buttonText}>{t("kunci.buka")}</Text>
        </Pressable>
      </View>
      <Pressable onPress={onSignOut} hitSlop={10}>
        <Text style={styles.signOut}>{t("kunci.keluar")}</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    screen: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.bg,
      alignItems: "center",
      justifyContent: "space-between",
      zIndex: 1000,
      elevation: 1000,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
    },
    ring: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: c.info.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontSize: 20, fontWeight: "800", color: c.ink, marginTop: 22 },
    sub: {
      fontSize: 13,
      lineHeight: 20,
      color: c.muted,
      textAlign: "center",
      marginTop: 8,
      maxWidth: 280,
    },
    button: {
      marginTop: 28,
      backgroundColor: c.accent,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 28,
    },
    buttonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
    signOut: { fontSize: 13, fontWeight: "700", color: c.muted },
  });
