// "Jam terpercaya": jam server yang diperkirakan tanpa bergantung pada jam HP.
//
// Setiap kali aplikasi berhasil menghubungi server, pasangan (jam server,
// penghitung monotonic perangkat) disimpan sebagai jangkar. Saat offline, jam
// terpercaya = jam server jangkar + selisih penghitung sejak jangkar itu.
// Penghitung (elapsedRealtime) tidak berubah ketika pengguna mengubah jam HP,
// jadi memundurkan jam tidak memengaruhi hasilnya.
//
// Terbatas pada: modul native HrisClock tersedia (APK/dev build, bukan Expo Go),
// dan HP tidak restart sejak jangkar terakhir. Selain itu hasilnya ditandai
// "tidak terpercaya" dan server memperlakukannya konservatif.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { requireOptionalNativeModule } from "expo";

interface HrisClockNative {
  elapsedRealtimeMs(): number;
  bootCount(): number;
  autoTimeEnabled(): boolean | null;
}

const Native = requireOptionalNativeModule<HrisClockNative>("HrisClock");
const KEY = "hris.timeAnchor";

interface Anchor {
  serverMs: number; // jam server (epoch UTC ms) saat kontak terakhir
  elapsedMs: number; // penghitung monotonic saat itu
  boot: number; // identitas boot (-1 = tidak diketahui)
}

let anchor: Anchor | null = null;
let terakhirSimpan = 0;

// Dipanggil sekali saat aplikasi mulai, supaya jangkar bertahan antar peluncuran
// (selama HP tidak restart).
export async function muatJangkar(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw && !anchor) anchor = JSON.parse(raw) as Anchor;
  } catch {
    // Tanpa jangkar tersimpan, jam dianggap tidak terpercaya sampai online lagi.
  }
}

// Dipanggil dari lapisan HTTP setiap respons sukses, dengan header `Date` server.
export function catatKontakServer(headerDate: string | null): void {
  if (!Native || !headerDate) return;
  const serverMs = Date.parse(headerDate);
  if (Number.isNaN(serverMs)) return;
  try {
    anchor = {
      serverMs,
      elapsedMs: Native.elapsedRealtimeMs(),
      boot: Native.bootCount(),
    };
    // Cukup disimpan sesekali; yang terpenting nilai di memori selalu terbaru.
    const sekarang = Date.now();
    if (sekarang - terakhirSimpan > 60_000) {
      terakhirSimpan = sekarang;
      void AsyncStorage.setItem(KEY, JSON.stringify(anchor)).catch(() => {});
    }
  } catch {
    // Pembacaan penghitung gagal: biarkan jangkar lama.
  }
}

export interface WaktuTerpercaya {
  ms: number; // epoch UTC ms
  trusted: boolean;
  anchorAgeS: number; // detik sejak kontak server terakhir; -1 bila tidak diketahui
}

export function waktuTerpercaya(): WaktuTerpercaya {
  if (!Native || !anchor) {
    return { ms: Date.now(), trusted: false, anchorAgeS: -1 };
  }
  try {
    const elapsed = Native.elapsedRealtimeMs();
    const boot = Native.bootCount();
    // Restart terdeteksi dari identitas boot, atau (bila tidak ada) dari
    // penghitung yang mengecil. Setelah restart jangkar tidak berlaku.
    const restart =
      (boot !== -1 && anchor.boot !== -1 && boot !== anchor.boot) ||
      elapsed < anchor.elapsedMs;
    if (restart) return { ms: Date.now(), trusted: false, anchorAgeS: -1 };
    const selisih = elapsed - anchor.elapsedMs;
    return {
      ms: anchor.serverMs + selisih,
      trusted: true,
      anchorAgeS: Math.round(selisih / 1000),
    };
  } catch {
    return { ms: Date.now(), trusted: false, anchorAgeS: -1 };
  }
}

// "Tanggal & waktu otomatis" menyala? null = tidak diketahui (iOS / tanpa modul).
export function autoWaktuAktif(): boolean | null {
  try {
    return Native?.autoTimeEnabled() ?? null;
  } catch {
    return null;
  }
}

export const modulJamTersedia = () => Native !== null;
