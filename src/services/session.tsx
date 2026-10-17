// Session context sederhana: siapa yang login sekarang + role-nya.
// Dipakai untuk munculkan/sembunyikan tab Approval (khusus mss/hr).

import { setSessionExpiredHandler } from "./api/http";
import React, { useEffect, createContext, useContext, useState } from "react";
import { Employee } from "./types";
import { hrisApi } from "./api";
import { useBahasa } from "@/i18n";
import { ambilTokenPush } from "./push";
import { muatJangkar } from "./trustedTime";
import { jumlahAntrean } from "./offlineQueue";
import { AppState } from "react-native";

// Keluar akun yang tidak bisa tersangkut: permintaan ke server dibatasi 3 detik; layar login tetap tampil
// walau server lambat / tidak terjangkau (cookie sesi akan kedaluwarsa di server).
let keluarSengajaSampai = 0;

export async function keluarAman(): Promise<void> {
  keluarSengajaSampai = Date.now() + 8000; // sesi yang mati karena keluar sengaja bukan "dikeluarkan paksa"
  await Promise.race([
    hrisApi.logout().catch(() => {}),
    new Promise<void>((r) => setTimeout(r, 3000)),
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
        setTimeout(() => tolak(new Error("timeout")), 6000),
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

  const { setBahasa } = useBahasa();
  const employeeId = employee?.id;

  // Bahasa mengikuti akun ERPNext; gagal membaca = pakai pilihan lokal.
  useEffect(() => {
    if (!employeeId) return;
    hrisApi
      .getLanguage()
      .then((b) => b && setBahasa(b))
      .catch(() => {});
  }, [employeeId, setBahasa]);

  // Jangkar jam terpercaya dimuat sekali; antrean check-in offline dikirim saat
  // login, saat aplikasi kembali aktif, dan tiap setengah menit selama masih ada.
  useEffect(() => {
    void muatJangkar();
  }, []);

  useEffect(() => {
    if (!employeeId) return;
    const kirim = () => {
      void jumlahAntrean().then((n) => {
        if (n > 0) void hrisApi.syncOfflineCheckins().catch(() => {});
      });
    };
    kirim();
    const langganan = AppState.addEventListener("change", (s) => {
      if (s === "active") kirim();
    });
    const timer = setInterval(kirim, 30_000);
    return () => {
      langganan.remove();
      clearInterval(timer);
    };
  }, [employeeId]);

  // Daftarkan perangkat untuk push; tanpa izin atau di simulator, dilewati.
  useEffect(() => {
    if (!employeeId) return;
    ambilTokenPush()
      .then((t) => t && hrisApi.registerPushToken(t))
      .catch(() => {});
  }, [employeeId]);

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
