// Session context sederhana: siapa yang login sekarang + role-nya.
// Dipakai untuk munculkan/sembunyikan tab Approval (khusus mss/hr).

import { setSessionExpiredHandler } from "./api/http";
import React, { useEffect, createContext, useContext, useState } from "react";
import { Employee } from "./types";
import { hrisApi } from "./api";
import {
  useRegisterPushToken,
  useSyncAccountLanguage,
  useSyncOfflineCheckins,
} from "@/hooks/useSessionEffects";

// Keluar akun yang tidak bisa tersangkut: permintaan ke server dibatasi 3 detik; layar login tetap tampil
// walau server lambat / tidak terjangkau (cookie sesi akan kedaluwarsa di server).
const KELUAR_BATAS_MS = 3000;
const KELUAR_SENGAJA_MS = 8000;
const PULIHKAN_BATAS_MS = 6000;
let keluarSengajaSampai = 0;

export async function keluarAman(): Promise<void> {
  keluarSengajaSampai = Date.now() + KELUAR_SENGAJA_MS; // sesi yang mati karena keluar sengaja bukan "dikeluarkan paksa"
  await Promise.race([
    hrisApi.logout().catch(() => {}),
    new Promise<void>((r) => setTimeout(r, KELUAR_BATAS_MS)),
  ]);
}

interface SessionContextValue {
  employee: Employee | null;
  setEmployee: (employee: Employee | null) => void;
  siap: boolean; // false selama sesi tersimpan masih dipulihkan saat aplikasi dibuka
  dipulihkan: boolean; // true bila pengguna masuk lewat sesi tersimpan (bukan mengetik login)
  pesanLogin: "sesiBerakhir" | null; // alasan kembali ke layar login (ditampilkan sekali di layar login)
  bersihkanPesanLogin: () => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(
  undefined,
);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [siap, setSiap] = useState(false);
  const [dipulihkan, setDipulihkan] = useState(false);
  const [pesanLogin, setPesanLogin] = useState<"sesiBerakhir" | null>(null);

  // Sesi login hidup di cookie server, jadi aplikasi yang dibuka ulang (termasuk setelah pembaruan APK/OTA)
  // tinggal bertanya "siapa saya"; hanya bila sesinya sudah kedaluwarsa pengguna kembali ke layar login.
  useEffect(() => {
    let batal = false;
    // Batas waktu supaya server yang lambat/tidak terjangkau tidak menahan layar kosong.
    Promise.race([
      hrisApi.getCurrentEmployee(),
      new Promise<never>((_, tolak) =>
        setTimeout(() => tolak(new Error("timeout")), PULIHKAN_BATAS_MS),
      ),
    ])
      .then((e) => {
        if (batal) return;
        setEmployee((sekarang) => sekarang ?? e);
        setDipulihkan(true);
      })
      .catch(() => {})
      .finally(() => {
        if (!batal) setSiap(true);
      });
    return () => {
      batal = true;
    };
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      // Dikeluarkan dari luar (sesi habis, login di perangkat lain, dikeluarkan lewat Keamanan): beri tahu pengguna.
      if (Date.now() > keluarSengajaSampai) setPesanLogin("sesiBerakhir");
      setEmployee(null);
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  const employeeId = employee?.id;
  useSyncAccountLanguage(employeeId);
  useSyncOfflineCheckins(employeeId);
  useRegisterPushToken(employeeId);

  return (
    <SessionContext.Provider
      value={{
        employee,
        setEmployee,
        siap,
        dipulihkan,
        pesanLogin,
        bersihkanPesanLogin: () => setPesanLogin(null),
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
