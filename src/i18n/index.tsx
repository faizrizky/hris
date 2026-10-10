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
let aktif: Bahasa = "id";
export function bahasaAktif(): Bahasa {
  return aktif;
}

interface Ctx {
  bahasa: Bahasa;
  setBahasa: (b: Bahasa) => void;
}

const LanguageCtx = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [bahasa, setBahasaState] = useState<Bahasa>("id");

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === "id" || v === "en") {
          aktif = v;
          setBahasaState(v);
        }
      })
      .catch(() => {});
  }, []);

  const setBahasa = useCallback((b: Bahasa) => {
    aktif = b;
    setBahasaState(b);
    // Gagal menyimpan tidak boleh menggagalkan pergantian bahasa.
    AsyncStorage.setItem(KEY, b).catch(() => {});
  }, []);

  const value = useMemo(() => ({ bahasa, setBahasa }), [bahasa, setBahasa]);
  return <LanguageCtx.Provider value={value}>{children}</LanguageCtx.Provider>;
}

export function useBahasa(): Ctx {
  const ctx = useContext(LanguageCtx);
  if (!ctx) throw new Error("useBahasa must be used within LanguageProvider");
  return ctx;
}

type Param = Record<string, string | number>;

function isi(teks: string, param?: Param): string {
  if (!param) return teks;
  let hasil = teks;
  for (const [k, v] of Object.entries(param)) {
    hasil = hasil.replace(`{${k}}`, String(v));
  }
  return hasil;
}

// Versi tanpa hook untuk kode di luar komponen (mis. pesan galat API).
export function tt(kunci: Kunci, param?: Param): string {
  return isi(KAMUS[aktif][kunci], param);
}

export function useT() {
  const { bahasa } = useBahasa();
  return useCallback(
    (kunci: Kunci, param?: Param): string => {
      return isi(KAMUS[bahasa][kunci], param);
    },
    [bahasa],
  );
}
