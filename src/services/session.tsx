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
const SIGN_OUT_TIMEOUT_MS = 3000;
const INTENTIONAL_SIGN_OUT_MS = 8000;
const RESTORE_TIMEOUT_MS = 6000;
let intentionalSignOutUntil = 0;

export async function signOutSafely(): Promise<void> {
  intentionalSignOutUntil = Date.now() + INTENTIONAL_SIGN_OUT_MS; // sesi yang mati karena keluar sengaja bukan "dikeluarkan paksa"
  await Promise.race([
    hrisApi.logout().catch(() => {}),
    new Promise<void>((r) => setTimeout(r, SIGN_OUT_TIMEOUT_MS)),
  ]);
}

interface SessionContextValue {
  employee: Employee | null;
  setEmployee: (employee: Employee | null) => void;
  isReady: boolean; // false selama sesi tersimpan masih dipulihkan saat aplikasi dibuka
  isRestored: boolean; // true bila pengguna masuk lewat sesi tersimpan (bukan mengetik login)
  loginNotice: "sesiBerakhir" | null; // alasan kembali ke layar login (ditampilkan sekali di layar login)
  clearLoginNotice: () => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(
  undefined,
);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isRestored, setIsRestored] = useState(false);
  const [loginNotice, setLoginNotice] = useState<"sesiBerakhir" | null>(null);

  // Sesi login hidup di cookie server, jadi aplikasi yang dibuka ulang (termasuk setelah pembaruan APK/OTA)
  // tinggal bertanya "siapa saya"; hanya bila sesinya sudah kedaluwarsa pengguna kembali ke layar login.
  useEffect(() => {
    let isCancelled = false;
    // Batas waktu supaya server yang lambat/tidak terjangkau tidak menahan layar kosong.
    Promise.race([
      hrisApi.getCurrentEmployee(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), RESTORE_TIMEOUT_MS),
      ),
    ])
      .then((e) => {
        if (isCancelled) return;
        setEmployee((now) => now ?? e);
        setIsRestored(true);
      })
      .catch(() => {})
      .finally(() => {
        if (!isCancelled) setIsReady(true);
      });
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      // Dikeluarkan dari luar (sesi habis, login di perangkat lain, dikeluarkan lewat Keamanan): beri tahu pengguna.
      if (Date.now() > intentionalSignOutUntil) setLoginNotice("sesiBerakhir");
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
        isReady,
        isRestored,
        loginNotice,
        clearLoginNotice: () => setLoginNotice(null),
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
