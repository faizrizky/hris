import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Biometrik perangkat (sidik jari / wajah Android, Face ID iOS). Hanya jalan bila sudah didaftarkan di perangkat ini.
// Semua nilai tersimpan di penyimpanan aplikasi / Keystore sehingga tetap ada setelah pembaruan aplikasi.
const K_KRED = "hris.bio.kredensial"; // SecureStore, dibuka dengan biometrik
const K_BIO_AKTIF = "hris.bio.aktif"; // AsyncStorage: penanda kredensial tersimpan (tanpa memicu prompt)
const K_KUNCI = "hris.kunci.aktif";
const K_TIMEOUT = "hris.kunci.timeoutMs";

export type KesiapanBiometrik = "siap" | "tidakAda" | "belumDaftar";

export async function kesiapanBiometrik(): Promise<KesiapanBiometrik> {
  try {
    if (!(await LocalAuthentication.hasHardwareAsync())) return "tidakAda";
    if (!(await LocalAuthentication.isEnrolledAsync())) return "belumDaftar";
    return "siap";
  } catch {
    return "tidakAda";
  }
}

export async function jenisBiometrik(): Promise<
  "wajah" | "sidikJari" | "umum"
> {
  try {
    const t = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const T = LocalAuthentication.AuthenticationType;
    if (t.includes(T.FACIAL_RECOGNITION) && !t.includes(T.FINGERPRINT))
      return "wajah";
    if (t.includes(T.FINGERPRINT) && !t.includes(T.FACIAL_RECOGNITION))
      return "sidikJari";
  } catch {
    // jatuh ke umum
  }
  return "umum";
}

export async function autentikasi(
  pesan: string,
  batal: string,
): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: pesan,
      cancelLabel: batal,
      disableDeviceFallback: true, // hanya biometrik yang sudah terdaftar, bukan PIN/pola
    });
    return r.success;
  } catch {
    return false;
  }
}

// ---- Login biometrik: kredensial disimpan terenkripsi, dibuka hanya dengan biometrik ----
export const adaLoginBiometrik = async (): Promise<boolean> =>
  (await AsyncStorage.getItem(K_BIO_AKTIF).catch(() => null)) === "1";

export async function simpanKredensial(user: string, password: string) {
  await SecureStore.setItemAsync(
    K_KRED,
    JSON.stringify({ u: user, p: password }),
    {
      requireAuthentication: true,
    },
  );
  await AsyncStorage.setItem(K_BIO_AKTIF, "1");
}

export async function bacaKredensial(
  pesan: string,
): Promise<{ u: string; p: string } | null> {
  try {
    const raw = await SecureStore.getItemAsync(K_KRED, {
      requireAuthentication: true,
      authenticationPrompt: pesan,
    });
    return raw ? (JSON.parse(raw) as { u: string; p: string }) : null;
  } catch {
    return null;
  }
}

export async function hapusKredensial() {
  await SecureStore.deleteItemAsync(K_KRED).catch(() => {});
  await AsyncStorage.removeItem(K_BIO_AKTIF).catch(() => {});
}

// ---- Kunci otomatis ----
export interface PengaturanKunci {
  aktif: boolean;
  timeoutMs: number; // 0 = langsung saat aplikasi kembali dari latar belakang
}

export async function bacaKunci(): Promise<PengaturanKunci> {
  const [a, t] = await Promise.all([
    AsyncStorage.getItem(K_KUNCI).catch(() => null),
    AsyncStorage.getItem(K_TIMEOUT).catch(() => null),
  ]);
  const ms = t === null ? 60_000 : Number(t);
  return { aktif: a === "1", timeoutMs: Number.isFinite(ms) ? ms : 60_000 };
}

export async function simpanKunci(p: PengaturanKunci) {
  await AsyncStorage.setItem(K_KUNCI, p.aktif ? "1" : "0").catch(() => {});
  await AsyncStorage.setItem(K_TIMEOUT, String(p.timeoutMs)).catch(() => {});
}

// Layar sistem (kamera, galeri, pemilih berkas, berbagi) membuat aplikasi sesaat ke latar belakang; panggil ini sebelum
// membukanya supaya tidak dihitung sebagai "ditinggalkan" dan terkunci. Modul ini tanpa dependensi lain (aman diimpor di mana saja).
let abaikanSampai = 0;
export const tahanKunci = (ms = 90_000) => {
  abaikanSampai = Date.now() + ms;
};
export const kunciDitahan = () => Date.now() <= abaikanSampai;
