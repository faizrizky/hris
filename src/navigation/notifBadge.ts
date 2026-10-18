import { useSyncExternalStore } from "react";

// Jumlah notifikasi belum dibaca untuk titik di tab bar. Diisi tab bar (saat
// dimuat/pindah tab) dan layar Notifikasi (saat daftar berubah).
let count = 0;
const listeners = new Set<() => void>();

export function setUnreadCount(n: number) {
  if (count === n) return;
  count = n;
  listeners.forEach((f) => f());
}

export function useUnreadCount(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => count,
  );
}
