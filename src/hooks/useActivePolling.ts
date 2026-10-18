import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "@react-navigation/native";

// Menjalankan `fn` berkala hanya saat layar terbuka (fokus), aplikasi di depan, dan `aktif` benar.
// Berhenti sepenuhnya di latar belakang supaya tidak membebani baterai dan membuat HP panas.
export function useActivePolling(fn: () => void, ms: number, isActive = true) {
  const latestCallback = useRef(fn);
  useEffect(() => {
    latestCallback.current = fn;
  });
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isActive || !isFocused) return;
    let id: ReturnType<typeof setInterval> | null = null;
    const mulai = () => {
      if (id === null) id = setInterval(() => latestCallback.current(), ms);
    };
    const stopPolling = () => {
      if (id !== null) {
        clearInterval(id);
        id = null;
      }
    };
    if (AppState.currentState === "active") mulai();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        latestCallback.current(); // segarkan sekali begitu kembali ke aplikasi
        mulai();
      } else stopPolling();
    });
    return () => {
      stopPolling();
      sub.remove();
    };
  }, [ms, isActive, isFocused]);
}
