// Efek sinkronisasi yang berjalan selama ada karyawan yang login. Dipisah dari
// SessionProvider supaya satu komponen tidak menumpuk banyak useEffect.

import { useEffect } from "react";
import { AppState } from "react-native";
import { useLanguage } from "@/i18n";
import { hrisApi } from "@/services/api";
import { fetchPushToken } from "@/services/push";
import { loadAnchor } from "@/services/trustedTime";
import { getQueueCount } from "@/services/offlineQueue";

const QUEUE_SYNC_INTERVAL_MS = 30_000;

// Bahasa mengikuti akun ERPNext; gagal membaca = pakai pilihan lokal.
export function useSyncAccountLanguage(employeeId: string | undefined) {
  const { setLanguage } = useLanguage();
  useEffect(() => {
    if (!employeeId) return;
    hrisApi
      .getLanguage()
      .then((language) => language && setLanguage(language))
      .catch(() => {});
  }, [employeeId, setLanguage]);
}

// Jangkar jam terpercaya dimuat sekali; antrean check-in offline dikirim saat
// login, saat aplikasi kembali aktif, dan tiap setengah menit selama masih ada.
export function useSyncOfflineCheckins(employeeId: string | undefined) {
  useEffect(() => {
    void loadAnchor();
  }, []);

  useEffect(() => {
    if (!employeeId) return;
    const syncQueuedCheckins = () => {
      void getQueueCount().then((queuedCount) => {
        if (queuedCount > 0) void hrisApi.syncOfflineCheckins().catch(() => {});
      });
    };
    syncQueuedCheckins();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") syncQueuedCheckins();
    });
    const timer = setInterval(syncQueuedCheckins, QUEUE_SYNC_INTERVAL_MS);
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
    fetchPushToken()
      .then((token) => token && hrisApi.registerPushToken(token))
      .catch(() => {});
  }, [employeeId]);
}
