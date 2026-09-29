import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { darkColors, lightColors, Palette } from "@/theme/colors";

type Mode = "light" | "dark";
const KEY = "hris.theme";

interface Ctx {
  mode: Mode;
  colors: Palette;
  setMode: (m: Mode) => void;
  toggle: () => void;
}

const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Nilai awal dari setelan sistem supaya render pertama sudah masuk akal,
  // lalu ditimpa pilihan user begitu terbaca dari penyimpanan.
  const [mode, setModeState] = useState<Mode>(() =>
    Appearance.getColorScheme() === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === "dark" || v === "light") setModeState(v);
      })
      .catch(() => {});
  }, []);

  const setMode = (m: Mode) => {
    setModeState(m);
    // Gagal menyimpan tidak boleh menggagalkan pergantian tema.
    AsyncStorage.setItem(KEY, m).catch(() => {});
  };

  const value = useMemo<Ctx>(
    () => ({
      mode,
      colors: mode === "dark" ? darkColors : lightColors,
      setMode,
      toggle: () => setMode(mode === "dark" ? "light" : "dark"),
    }),
    [mode],
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

function useCtx() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme dipakai di luar ThemeProvider");
  return ctx;
}

/** Palet aktif — ini yang dipakai di dalam makeStyles. */
export function useTheme(): Palette {
  return useCtx().colors;
}

/** Mode dan pengubahnya — untuk sakelar di Profil. */
export function useThemeMode() {
  const { mode, setMode, toggle } = useCtx();
  return { mode, setMode, toggle };
}
