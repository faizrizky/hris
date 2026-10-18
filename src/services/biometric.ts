import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Biometrik perangkat (sidik jari / wajah Android, Face ID iOS). Hanya jalan bila sudah didaftarkan di perangkat ini.
// Semua nilai tersimpan di penyimpanan aplikasi / Keystore sehingga tetap ada setelah pembaruan aplikasi.
const KEY_CREDENTIALS = "hris.bio.kredensial"; // SecureStore, dibuka dengan biometrik
const KEY_BIOMETRIC_ENABLED = "hris.bio.aktif"; // AsyncStorage: penanda kredensial tersimpan (tanpa memicu prompt)
const KEY_LOCK_ENABLED = "hris.kunci.aktif";
const KEY_LOCK_TIMEOUT = "hris.kunci.timeoutMs";

export type BiometricReadiness = "siap" | "tidakAda" | "belumDaftar";

export async function getBiometricReadiness(): Promise<BiometricReadiness> {
  try {
    if (!(await LocalAuthentication.hasHardwareAsync())) return "tidakAda";
    if (!(await LocalAuthentication.isEnrolledAsync())) return "belumDaftar";
    return "siap";
  } catch {
    return "tidakAda";
  }
}

export async function getBiometricKind(): Promise<
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

// Nama yang ditampilkan ke pengguna sesuai perangkat: iPhone "Face ID"/"Touch ID"; Android "sidik jari", "pemindai
// wajah", atau "sidik jari / wajah" (Android tidak punya merek "Face ID").
export async function getBiometricName(): Promise<string> {
  const j = await getBiometricKind();
  if (Platform.OS === "ios") return j === "sidikJari" ? "Touch ID" : "Face ID";
  if (j === "sidikJari") return "sidik jari";
  if (j === "wajah") return "pemindai wajah";
  return "sidik jari / wajah";
}

export async function authenticate(
  message: string,
  cancelLabel: string,
): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: message,
      cancelLabel,
      disableDeviceFallback: true, // hanya biometrik yang sudah terdaftar, bukan PIN/pola
    });
    return r.success;
  } catch {
    return false;
  }
}

// ---- Login biometrik: kredensial disimpan terenkripsi, dibuka hanya dengan biometrik ----
export const hasBiometricLogin = async (): Promise<boolean> =>
  (await AsyncStorage.getItem(KEY_BIOMETRIC_ENABLED).catch(() => null)) === "1";

const K_GATE = "hris.bio.gate"; // "1": kredensial disimpan tanpa kunci terikat biometrik, dijaga verifikasi di aplikasi

export async function saveCredentials(user: string, password: string) {
  const value = JSON.stringify({ u: user, p: password });
  try {
    await SecureStore.setItemAsync(KEY_CREDENTIALS, value, {
      requireAuthentication: true,
    });
    await AsyncStorage.removeItem(K_GATE);
  } catch {
    // Sebagian perangkat gagal membuat kunci Keystore yang terikat biometrik. Cadangannya: simpan terenkripsi biasa
    // (Keystore) dan jaga pembacaannya dengan verifikasi biometrik di aplikasi.
    await SecureStore.setItemAsync(KEY_CREDENTIALS, value);
    await AsyncStorage.setItem(K_GATE, "1");
  }
  await AsyncStorage.setItem(KEY_BIOMETRIC_ENABLED, "1");
}

export async function readCredentials(
  message: string,
  cancelLabel = "Batal",
): Promise<{ u: string; p: string } | null> {
  try {
    const isGuardedByApp =
      (await AsyncStorage.getItem(K_GATE).catch(() => null)) === "1";
    if (isGuardedByApp && !(await authenticate(message, cancelLabel)))
      return null;
    const raw = await SecureStore.getItemAsync(
      KEY_CREDENTIALS,
      isGuardedByApp
        ? undefined
        : { requireAuthentication: true, authenticationPrompt: message },
    );
    return raw ? (JSON.parse(raw) as { u: string; p: string }) : null;
  } catch {
    return null;
  }
}

export async function deleteCredentials() {
  await SecureStore.deleteItemAsync(KEY_CREDENTIALS).catch(() => {});
  await AsyncStorage.removeItem(KEY_BIOMETRIC_ENABLED).catch(() => {});
  await AsyncStorage.removeItem(K_GATE).catch(() => {});
}

// ---- Kunci otomatis ----
export interface LockSettings {
  isActive: boolean;
  timeoutMs: number; // 0 = langsung saat aplikasi kembali dari latar belakang
}

export async function readLockSettings(): Promise<LockSettings> {
  const [a, t] = await Promise.all([
    AsyncStorage.getItem(KEY_LOCK_ENABLED).catch(() => null),
    AsyncStorage.getItem(KEY_LOCK_TIMEOUT).catch(() => null),
  ]);
  const ms = t === null ? 60_000 : Number(t);
  return { isActive: a === "1", timeoutMs: Number.isFinite(ms) ? ms : 60_000 };
}

export async function saveLockSettings(p: LockSettings) {
  await AsyncStorage.setItem(KEY_LOCK_ENABLED, p.isActive ? "1" : "0").catch(
    () => {},
  );
  await AsyncStorage.setItem(KEY_LOCK_TIMEOUT, String(p.timeoutMs)).catch(
    () => {},
  );
}

// Layar sistem (kamera, galeri, pemilih berkas, berbagi) membuat aplikasi sesaat ke latar belakang; panggil ini sebelum
// membukanya supaya tidak dihitung sebagai "ditinggalkan" dan terkunci. Modul ini tanpa dependensi lain (aman diimpor di mana saja).
let ignoreUntil = 0;
export const holdLock = (ms = 90_000) => {
  ignoreUntil = Date.now() + ms;
};
export const isLockHeld = () => Date.now() <= ignoreUntil;
