import { holdLock } from "@/services/biometric";
// Pembaruan aplikasi tanpa toko (sementara, Android): APK diunggah ke server, aplikasi memeriksa versi
// saat dibuka, mengunduhnya dengan progres, lalu membuka pemasang Android. Pemasangan tidak bisa senyap:
// Android selalu meminta pengguna mengetuk "Perbarui".
//
// Nanti, saat aplikasi rilis lewat Play Store / App Store, ganti MODE_PEMBARUAN ke "toko" dan isi URL_TOKO:
// pemeriksaan versi yang sama tetap dipakai, tetapi tombolnya membuka halaman toko, bukan mengunduh APK.

import { Linking, Platform } from "react-native";
import * as Application from "expo-application";
import * as Updates from "expo-updates";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { loadServerAddress, siteHeaders } from "@/services/api/http";

export const UPDATE_MODE: "unduh" | "toko" = "unduh";
export const URL_TOKO = {
  android: "https://play.google.com/store/apps/details?id=com.hrismobile",
  ios: "",
};

export interface UpdateInfo {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  size: number;
  notes: string;
  mandatory: boolean;
}

const CHECK_TIMEOUT_MS = 7000;

// Null = tidak perlu memperbarui (sudah terbaru, bukan build asli, server tidak terjangkau, atau belum ada APK).
// Kegagalan jaringan tidak boleh menghalangi pengguna masuk, jadi galat ditelan.
export async function checkAppUpdate(): Promise<UpdateInfo | null> {
  if (Platform.OS !== "android") return null;
  const installedVersion = Number(Application.nativeBuildVersion);
  if (!Number.isFinite(installedVersion) || installedVersion <= 0) return null; // Expo Go / dev
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), CHECK_TIMEOUT_MS);
  try {
    const base = await loadServerAddress();
    if (!base) return null;
    const res = await fetch(`${base}/api/method/hris_get_app_update`, {
      headers: siteHeaders(),
      signal: abortController.signal,
    });
    if (!res.ok) return null;
    const m = (await res.json()).message as {
      version_code: number;
      version_name: string;
      apk_url: string;
      size: number;
      notes: string;
      mandatory: number;
    };
    if (!m || !m.version_code || m.version_code <= installedVersion)
      return null;
    if (UPDATE_MODE === "unduh" && !m.apk_url) return null;
    return {
      versionCode: m.version_code,
      versionName: m.version_name,
      // apk_url relatif (/files/...) dihitung dari alamat server yang dipakai aplikasi (bukan localhost server).
      apkUrl: m.apk_url.startsWith("/") ? `${base}${m.apk_url}` : m.apk_url,
      size: m.size,
      notes: m.notes,
      mandatory: !!m.mandatory,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Mengunduh APK ke cache dengan progres 0..1, memeriksa ukurannya, lalu membuka pemasang Android.
export async function downloadAndInstall(
  info: UpdateInfo,
  onProgress: (p: number) => void,
): Promise<void> {
  if (UPDATE_MODE === "toko") {
    const url = Platform.OS === "ios" ? URL_TOKO.ios : URL_TOKO.android;
    if (url) await Linking.openURL(url);
    return;
  }
  const destination = `${FileSystem.cacheDirectory}hris-${info.versionCode}.apk`;
  await FileSystem.deleteAsync(destination, { idempotent: true });
  const download = FileSystem.createDownloadResumable(
    info.apkUrl,
    destination,
    { headers: siteHeaders() },
    (p) => {
      const total = p.totalBytesExpectedToWrite || info.size;
      if (total > 0) onProgress(Math.min(1, p.totalBytesWritten / total));
    },
  );
  const result = await download.downloadAsync();
  if (!result || result.status !== 200) throw new Error("download");
  const file = await FileSystem.getInfoAsync(destination);
  if (!file.exists || (info.size > 0 && file.size !== info.size)) {
    throw new Error("ukuran");
  }
  onProgress(1);
  const uri = await FileSystem.getContentUriAsync(destination);
  holdLock();
  await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
    data: uri,
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    type: "application/vnd.android.package-archive",
  });
}

// ---- EAS Update (OTA): paket JavaScript baru tanpa build ulang ----
// Dicek setelah pemeriksaan APK. Bila ada, paket diunduh lalu aplikasi dimuat ulang otomatis.
// Tidak aktif di Expo Go / mode pengembangan.
export async function checkAndApplyOta(
  onStage: (stage: "unduh") => void,
  channel?: string,
): Promise<boolean> {
  if (__DEV__ || !Updates.isEnabled) return false;
  try {
    // Channel per company dari registry (mis. "pilot"); kosong = channel bawaan build.
    Updates.setUpdateRequestHeadersOverride(
      channel ? { "expo-channel-name": channel } : null,
    );
    const checkResult = await Promise.race([
      Updates.checkForUpdateAsync(),
      new Promise<null>((r) => setTimeout(() => r(null), CHECK_TIMEOUT_MS)),
    ]);
    if (!checkResult || !checkResult.isAvailable) return false;
    onStage("unduh");
    const result = await Updates.fetchUpdateAsync();
    if (!result.isNew) return false;
    await Updates.reloadAsync();
    return true;
  } catch {
    // Gagal terhubung ke Expo tidak boleh menahan pengguna masuk.
    return false;
  }
}
