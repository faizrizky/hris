// Bahasa aplikasi: Indonesia (bawaan) atau English, disimpan di perangkat.
// Pakai useT() di komponen: const t = useT(); t("tab.home").

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { id, Kunci } from "./id";
import { en } from "./en";

export type Bahasa = "id" | "en";
const KEY = "hris.bahasa";
const KAMUS: Record<Bahasa, Record<Kunci, string>> = { id, en };

// Bahasa aktif juga disimpan di luar React supaya kode non-komponen (mis.
// penerjemah label server) bisa membacanya.
let activeLanguage: Bahasa = "id";
export function getActiveLanguage(): Bahasa {
  return activeLanguage;
}

interface Ctx {
  language: Bahasa;
  setLanguage: (b: Bahasa) => void;
}

const LanguageCtx = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Bahasa>("id");

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === "id" || v === "en") {
          activeLanguage = v;
          setLanguageState(v);
        }
      })
      .catch(() => {});
  }, []);

  const setLanguage = useCallback((b: Bahasa) => {
    activeLanguage = b;
    setLanguageState(b);
    // Gagal menyimpan tidak boleh menggagalkan pergantian bahasa.
    AsyncStorage.setItem(KEY, b).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ language, setLanguage }),
    [language, setLanguage],
  );
  return <LanguageCtx.Provider value={value}>{children}</LanguageCtx.Provider>;
}

export function useLanguage(): Ctx {
  const ctx = useContext(LanguageCtx);
  if (!ctx) throw new Error("useBahasa must be used within LanguageProvider");
  return ctx;
}

type Param = Record<string, string | number>;

function content(text: string, param?: Param): string {
  if (!param) return text;
  let result = text;
  for (const [k, v] of Object.entries(param)) {
    result = result.replace(`{${k}}`, String(v));
  }
  return result;
}

// Versi tanpa hook untuk kode di luar komponen (mis. pesan galat API).
export function translate(cacheKey: Kunci, param?: Param): string {
  return content(KAMUS[activeLanguage][cacheKey], param);
}

export function useT() {
  const { language } = useLanguage();
  return useCallback(
    (cacheKey: Kunci, param?: Param): string => {
      return content(KAMUS[language][cacheKey], param);
    },
    [language],
  );
}
