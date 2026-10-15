import { useSyncExternalStore } from "react";

// Layar tertentu (mis. verifikasi wajah saat absen) menyembunyikan tab bar
// mengambang sementara. Nilainya satu untuk seluruh aplikasi.
let tersembunyi = false;
const pendengar = new Set<() => void>();

export function setTabBarHidden(nilai: boolean) {
  if (tersembunyi === nilai) return;
  tersembunyi = nilai;
  pendengar.forEach((f) => f());
}

export function useTabBarHidden(): boolean {
  return useSyncExternalStore(
    (cb) => {
      pendengar.add(cb);
      return () => {
        pendengar.delete(cb);
      };
    },
    () => tersembunyi,
  );
}
