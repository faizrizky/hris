import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "@react-navigation/native";

// Menjalankan `fn` berkala hanya saat layar terbuka (fokus), aplikasi di depan, dan `aktif` benar.
// Berhenti sepenuhnya di latar belakang supaya tidak membebani baterai dan membuat HP panas.
export function usePollingAktif(fn: () => void, ms: number, aktif = true) {
  const terbaru = useRef(fn);
  useEffect(() => {
    terbaru.current = fn;
  });
  const fokus = useIsFocused();
  useEffect(() => {
    if (!aktif || !fokus) return;
    let id: ReturnType<typeof setInterval> | null = null;
    const mulai = () => {
      if (id === null) id = setInterval(() => terbaru.current(), ms);
    };
    const henti = () => {
      if (id !== null) {
        clearInterval(id);
        id = null;
      }
    };
    if (AppState.currentState === "active") mulai();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        terbaru.current(); // segarkan sekali begitu kembali ke aplikasi
        mulai();
      } else henti();
    });
    return () => {
      henti();
      sub.remove();
    };
  }, [ms, aktif, fokus]);
}
