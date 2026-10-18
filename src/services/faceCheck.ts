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
  spoof?(uri: string): Promise<number | null>; // hanya ada di build baru (Android)
}

const Native = requireOptionalNativeModule<HrisFaceNative>("HrisFace");

// False di iOS dan Expo Go: layar presensi melewati langkah wajah.
export const isFaceSupported = (): boolean => !!Native && Native.supported();

export const detectFace = (uri: string): Promise<HasilDeteksi> =>
  Native!.detect(uri);

// Skor anti-spoofing 0..1 (makin tinggi makin asli), atau null bila tidak tersedia / tidak ada wajah.
export const isSpoofAvailable = (): boolean => !!Native && !!Native.spoof;
export const getSpoofScore = async (uri: string): Promise<number | null> => {
  try {
    return Native?.spoof ? await Native.spoof(uri) : null;
  } catch {
    return null;
  }
};

// Embedding 128 angka ternormalisasi, atau null bila tidak ada wajah di foto.
export const getFaceEmbedding = (uri: string): Promise<number[] | null> =>
  Native!.embed(uri);

// Kemiripan cosine -1..1 (keduanya ternormalisasi = hasil kali titik).
export const similarity = (a: number[], b: number[]): number =>
  a.reduce((sum, v, i) => sum + v * b[i], 0);

// Liveness saat absen: tiga perintah berurutan yang baru terlihat satu per satu dan urutannya diacak tiap sesi:
// pejam mata, toleh ke satu sisi, lalu toleh ke sisi SEBALIKNYA. Foto tidak bisa memejam atau menoleh, dan video
// rekaman tidak tahu kapan harus melakukan apa. Tanpa menyebut kiri/kanan, jadi tidak bergantung tanda sudut kamera.
export type Challenge = "pejam" | "toleh" | "tolehBalik";

export const TOTAL_STEPS = 3;
export const STEP_TIMEOUT_MS = 10_000;
const FRONT_ANGLE = 8; // |yaw| di bawah ini dianggap menghadap depan
const TURN_ANGLE = 14; // |yaw| di atas ini dianggap menoleh

export const randomOrder = (): Challenge[] => {
  const blinkPosition = Math.floor(Math.random() * 3); // 0 awal, 1 tengah, 2 akhir
  const order: Challenge[] = ["toleh", "tolehBalik"];
  order.splice(blinkPosition, 0, "pejam");
  return order;
};

export interface SequenceState {
  order: Challenge[];
  step: number; // indeks perintah aktif
  isReady: boolean; // sudah melihat wajah depan dengan mata terbuka
  isNeutral: boolean; // kondisi awal perintah aktif terpenuhi (mata terbuka / kepala di tengah)
  sisi: number; // tanda yaw toleh pertama (+1 atau -1), 0 bila belum
  stepStartedAt: number; // epoch ms
  hasPassed: boolean;
  message: "tidakAda" | "banyak" | "dekat" | "depan" | "tantangan";
}

export const initialSequence = (): SequenceState => ({
  order: randomOrder(),
  step: 0,
  isReady: false,
  isNeutral: false,
  sisi: 0,
  stepStartedAt: 0,
  hasPassed: false,
  message: "tidakAda",
});

export function advanceSequence(
  s: SequenceState,
  d: HasilDeteksi,
  now: number,
): SequenceState {
  if (d.count === 0) return { ...s, message: "tidakAda" };
  if (d.count > 1) return { ...s, message: "banyak" };
  if (d.size < 0.25) return { ...s, message: "dekat" };
  if (!s.isReady) {
    const isFacingFront = Math.abs(d.yaw) < FRONT_ANGLE && d.eyesOpen > 0.6;
    return isFacingFront
      ? { ...s, isReady: true, stepStartedAt: now, message: "tantangan" }
      : { ...s, message: "depan" };
  }
  const currentChallenge = s.order[s.step]!;
  let isNeutral = s.isNeutral;
  let sisi = s.sisi;
  let isConfirmed = false;
  if (currentChallenge === "pejam") {
    if (d.eyesOpen >= 0.5 && Math.abs(d.yaw) < FRONT_ANGLE + 4)
      isNeutral = true;
    isConfirmed = isNeutral && d.eyesOpen >= 0 && d.eyesOpen < 0.45;
  } else if (currentChallenge === "toleh") {
    if (Math.abs(d.yaw) < FRONT_ANGLE) isNeutral = true;
    if (isNeutral && Math.abs(d.yaw) >= TURN_ANGLE) {
      isConfirmed = true;
      sisi = d.yaw > 0 ? 1 : -1;
    }
  } else {
    // sisi sebaliknya dari toleh pertama
    isConfirmed = s.sisi !== 0 && d.yaw * s.sisi <= -TURN_ANGLE;
  }
  if (!isConfirmed) return { ...s, isNeutral, sisi, message: "tantangan" };
  const nextStep = s.step + 1;
  return {
    ...s,
    step: nextStep,
    isNeutral: false,
    sisi,
    stepStartedAt: now,
    hasPassed: nextStep >= s.order.length,
    message: "tantangan",
  };
}
