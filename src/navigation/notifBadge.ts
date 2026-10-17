import { useSyncExternalStore } from "react";

// Jumlah notifikasi belum dibaca untuk titik di tab bar. Diisi tab bar (saat
// dimuat/pindah tab) dan layar Notifikasi (saat daftar berubah).
let jumlah = 0;
const pendengar = new Set<() => void>();

export function setBelumDibaca(n: number) {
  if (jumlah === n) return;
  jumlah = n;
  pendengar.forEach((f) => f());
}

export function useBelumDibaca(): number {
  return useSyncExternalStore(
    (cb) => {
      pendengar.add(cb);
      return () => {
        pendengar.delete(cb);
      };
    },
    () => jumlah,
  );
}
