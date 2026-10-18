import { useSyncExternalStore } from "react";

// Layar tertentu (mis. verifikasi wajah saat absen) menyembunyikan tab bar
// mengambang sementara. Nilainya satu untuk seluruh aplikasi.
let isHiddenValue = false;
const listeners = new Set<() => void>();

export function setTabBarHidden(shouldHide: boolean) {
  if (isHiddenValue === shouldHide) return;
  isHiddenValue = shouldHide;
  listeners.forEach((f) => f());
}

export function useTabBarHidden(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => isHiddenValue,
  );
}
