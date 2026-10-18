// Efek sinkronisasi yang berjalan selama ada karyawan yang login. Dipisah dari
// SessionProvider supaya satu komponen tidak menumpuk banyak useEffect.

import { useEffect } from "react";
import { AppState } from "react-native";
import { useBahasa } from "@/i18n";
import { hrisApi } from "@/services/api";
import { ambilTokenPush } from "@/services/push";
import { muatJangkar } from "@/services/trustedTime";
import { jumlahAntrean } from "@/services/offlineQueue";

const SYNC_ANTREAN_INTERVAL_MS = 30_000;

// Bahasa mengikuti akun ERPNext; gagal membaca = pakai pilihan lokal.
export function useSyncAccountLanguage(employeeId: string | undefined) {
  const { setBahasa } = useBahasa();
  useEffect(() => {
    if (!employeeId) return;
    hrisApi
      .getLanguage()
      .then((language) => language && setBahasa(language))
      .catch(() => {});
  }, [employeeId, setBahasa]);
}

// Jangkar jam terpercaya dimuat sekali; antrean check-in offline dikirim saat
// login, saat aplikasi kembali aktif, dan tiap setengah menit selama masih ada.
export function useSyncOfflineCheckins(employeeId: string | undefined) {
  useEffect(() => {
    void muatJangkar();
  }, []);

  useEffect(() => {
    if (!employeeId) return;
    const syncQueuedCheckins = () => {
      void jumlahAntrean().then((queuedCount) => {
        if (queuedCount > 0) void hrisApi.syncOfflineCheckins().catch(() => {});
      });
    };
    syncQueuedCheckins();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") syncQueuedCheckins();
    });
    const timer = setInterval(syncQueuedCheckins, SYNC_ANTREAN_INTERVAL_MS);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [employeeId]);
}

// Daftarkan perangkat untuk push; tanpa izin atau di simulator, dilewati.
export function useRegisterPushToken(employeeId: string | undefined) {
  useEffect(() => {
    if (!employeeId) return;
    ambilTokenPush()
      .then((token) => token && hrisApi.registerPushToken(token))
      .catch(() => {});
  }, [employeeId]);
}
