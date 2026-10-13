// Uji kehadiran wajah di perangkat (ML Kit lewat modul native HrisFace).
// Bukan pencocokan identitas: hanya memastikan ada wajah asli di depan kamera
// yang menuruti tantangan acak (kedip atau menoleh). Foto tidak disimpan.

import { requireOptionalNativeModule } from "expo";

export interface HasilDeteksi {
  count: number;
  yaw: number; // derajat; tanda tergantung kamera depan, dipakai sebagai |yaw|
  eyesOpen: number; // 0..1, -1 bila tidak terbaca
  size: number; // lebar wajah / lebar foto
}

interface HrisFaceNative {
  supported(): boolean;
  detect(uri: string): Promise<HasilDeteksi>;
}

const Native = requireOptionalNativeModule<HrisFaceNative>("HrisFace");

// False di iOS dan Expo Go: layar presensi melewati langkah wajah.
export const wajahDidukung = (): boolean => !!Native && Native.supported();

export const deteksiWajah = (uri: string): Promise<HasilDeteksi> =>
  Native!.detect(uri);

export type Tantangan = "kedip" | "toleh";

export const tantanganAcak = (): Tantangan =>
  Math.random() < 0.5 ? "kedip" : "toleh";

// Mesin status per-frame. Tahap 1: satu wajah menghadap depan dengan mata
// terbuka. Tahap 2: tantangan terpenuhi. Mengembalikan status berikutnya.
export interface StatusLiveness {
  siap: boolean; // sudah melihat wajah depan
  matiTerlihat: boolean; // kedip: mata sempat tertutup
  lulus: boolean;
  pesan: "tidakAda" | "banyak" | "dekat" | "depan" | "tantangan";
}

export const awalLiveness: StatusLiveness = {
  siap: false,
  matiTerlihat: false,
  lulus: false,
  pesan: "tidakAda",
};

export function langkahLiveness(
  s: StatusLiveness,
  d: HasilDeteksi,
  tantangan: Tantangan,
): StatusLiveness {
  if (d.count === 0) return { ...s, pesan: "tidakAda" };
  if (d.count > 1) return { ...s, pesan: "banyak" };
  if (d.size < 0.25) return { ...s, pesan: "dekat" };

  if (!s.siap) {
    const depan = Math.abs(d.yaw) < 12 && d.eyesOpen > 0.6;
    return depan
      ? { ...s, siap: true, pesan: "tantangan" }
      : { ...s, pesan: "depan" };
  }
  if (tantangan === "toleh") {
    return Math.abs(d.yaw) > 22
      ? { ...s, lulus: true, pesan: "tantangan" }
      : { ...s, pesan: "tantangan" };
  }
  // kedip: mata tertutup lalu terbuka lagi
  if (d.eyesOpen >= 0 && d.eyesOpen < 0.3)
    return { ...s, matiTerlihat: true, pesan: "tantangan" };
  if (s.matiTerlihat && d.eyesOpen > 0.6)
    return { ...s, lulus: true, pesan: "tantangan" };
  return { ...s, pesan: "tantangan" };
}
