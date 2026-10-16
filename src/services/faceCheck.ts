// Uji kehadiran wajah di perangkat (ML Kit lewat modul native HrisFace).
// Bukan pencocokan identitas: hanya memastikan ada wajah asli di depan kamera
// yang menuruti tantangan acak (kedip atau menoleh). Foto tidak disimpan.

import { requireOptionalNativeModule } from "expo";

export interface HasilDeteksi {
  count: number;
  yaw: number; // derajat; tanda tergantung kamera depan, dipakai sebagai |yaw|
  pitch: number; // derajat, atas-bawah
  eyesOpen: number; // 0..1, -1 bila tidak terbaca
  size: number; // lebar wajah / lebar foto
}

interface HrisFaceNative {
  supported(): boolean;
  detect(uri: string): Promise<HasilDeteksi>;
  embed(uri: string): Promise<number[] | null>;
}

const Native = requireOptionalNativeModule<HrisFaceNative>("HrisFace");

// False di iOS dan Expo Go: layar presensi melewati langkah wajah.
export const wajahDidukung = (): boolean => !!Native && Native.supported();

export const deteksiWajah = (uri: string): Promise<HasilDeteksi> =>
  Native!.detect(uri);

// Embedding 128 angka ternormalisasi, atau null bila tidak ada wajah di foto.
export const embeddingWajah = (uri: string): Promise<number[] | null> =>
  Native!.embed(uri);

// Kemiripan cosine -1..1 (keduanya ternormalisasi = hasil kali titik).
export const kemiripan = (a: number[], b: number[]): number =>
  a.reduce((sum, v, i) => sum + v * b[i], 0);

// Liveness saat absen: tiga perintah berurutan yang baru terlihat satu per satu dan urutannya diacak tiap sesi:
// pejam mata, toleh ke satu sisi, lalu toleh ke sisi SEBALIKNYA. Foto tidak bisa memejam atau menoleh, dan video
// rekaman tidak tahu kapan harus melakukan apa. Tanpa menyebut kiri/kanan, jadi tidak bergantung tanda sudut kamera.
export type Tantangan = "pejam" | "toleh" | "tolehBalik";

export const LANGKAH_TOTAL = 3;
export const BATAS_LANGKAH_MS = 10_000;
const SUDUT_DEPAN = 8; // |yaw| di bawah ini dianggap menghadap depan
const SUDUT_TOLEH = 14; // |yaw| di atas ini dianggap menoleh

export const urutanAcak = (): Tantangan[] => {
  const posisiPejam = Math.floor(Math.random() * 3); // 0 awal, 1 tengah, 2 akhir
  const urutan: Tantangan[] = ["toleh", "tolehBalik"];
  urutan.splice(posisiPejam, 0, "pejam");
  return urutan;
};

export interface StatusUrutan {
  urutan: Tantangan[];
  langkah: number; // indeks perintah aktif
  siap: boolean; // sudah melihat wajah depan dengan mata terbuka
  netral: boolean; // kondisi awal perintah aktif terpenuhi (mata terbuka / kepala di tengah)
  sisi: number; // tanda yaw toleh pertama (+1 atau -1), 0 bila belum
  mulaiLangkah: number; // epoch ms
  lulus: boolean;
  pesan: "tidakAda" | "banyak" | "dekat" | "depan" | "tantangan";
}

export const awalUrutan = (): StatusUrutan => ({
  urutan: urutanAcak(),
  langkah: 0,
  siap: false,
  netral: false,
  sisi: 0,
  mulaiLangkah: 0,
  lulus: false,
  pesan: "tidakAda",
});

export function langkahUrutan(
  s: StatusUrutan,
  d: HasilDeteksi,
  sekarang: number,
): StatusUrutan {
  if (d.count === 0) return { ...s, pesan: "tidakAda" };
  if (d.count > 1) return { ...s, pesan: "banyak" };
  if (d.size < 0.25) return { ...s, pesan: "dekat" };
  if (!s.siap) {
    const depan = Math.abs(d.yaw) < SUDUT_DEPAN && d.eyesOpen > 0.6;
    return depan
      ? { ...s, siap: true, mulaiLangkah: sekarang, pesan: "tantangan" }
      : { ...s, pesan: "depan" };
  }
  const aktif = s.urutan[s.langkah]!;
  let netral = s.netral;
  let sisi = s.sisi;
  let ok = false;
  if (aktif === "pejam") {
    if (d.eyesOpen >= 0.5 && Math.abs(d.yaw) < SUDUT_DEPAN + 4) netral = true;
    ok = netral && d.eyesOpen >= 0 && d.eyesOpen < 0.45;
  } else if (aktif === "toleh") {
    if (Math.abs(d.yaw) < SUDUT_DEPAN) netral = true;
    if (netral && Math.abs(d.yaw) >= SUDUT_TOLEH) {
      ok = true;
      sisi = d.yaw > 0 ? 1 : -1;
    }
  } else {
    // sisi sebaliknya dari toleh pertama
    ok = s.sisi !== 0 && d.yaw * s.sisi <= -SUDUT_TOLEH;
  }
  if (!ok) return { ...s, netral, sisi, pesan: "tantangan" };
  const langkah = s.langkah + 1;
  return {
    ...s,
    langkah,
    netral: false,
    sisi,
    mulaiLangkah: sekarang,
    lulus: langkah >= s.urutan.length,
    pesan: "tantangan",
  };
}
