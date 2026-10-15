// Pembaruan aplikasi tanpa toko (sementara, Android): APK diunggah ke server, aplikasi memeriksa versi
// saat dibuka, mengunduhnya dengan progres, lalu membuka pemasang Android. Pemasangan tidak bisa senyap:
// Android selalu meminta pengguna mengetuk "Perbarui".
//
// Nanti, saat aplikasi rilis lewat Play Store / App Store, ganti MODE_PEMBARUAN ke "toko" dan isi URL_TOKO:
// pemeriksaan versi yang sama tetap dipakai, tetapi tombolnya membuka halaman toko, bukan mengunduh APK.

import { Linking, Platform } from "react-native";
import * as Application from "expo-application";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { muatAlamatServer } from "@/services/api/http";

export const MODE_PEMBARUAN: "unduh" | "toko" = "unduh";
export const URL_TOKO = {
  android: "https://play.google.com/store/apps/details?id=com.falah.hrismobile",
  ios: "",
};

export interface InfoPembaruan {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  size: number;
  notes: string;
  mandatory: boolean;
}

const BATAS_CEK_MS = 7000;

// Null = tidak perlu memperbarui (sudah terbaru, bukan build asli, server tidak terjangkau, atau belum ada APK).
// Kegagalan jaringan tidak boleh menghalangi pengguna masuk, jadi galat ditelan.
export async function cekPembaruan(): Promise<InfoPembaruan | null> {
  if (Platform.OS !== "android") return null;
  const terpasang = Number(Application.nativeBuildVersion);
  if (!Number.isFinite(terpasang) || terpasang <= 0) return null; // Expo Go / dev
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), BATAS_CEK_MS);
  try {
    const base = await muatAlamatServer();
    if (!base) return null;
    const res = await fetch(`${base}/api/method/hris_get_app_update`, {
      signal: ctl.signal,
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
    if (!m || !m.version_code || m.version_code <= terpasang) return null;
    if (MODE_PEMBARUAN === "unduh" && !m.apk_url) return null;
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
export async function unduhDanPasang(
  info: InfoPembaruan,
  onProgres: (p: number) => void,
): Promise<void> {
  if (MODE_PEMBARUAN === "toko") {
    const url = Platform.OS === "ios" ? URL_TOKO.ios : URL_TOKO.android;
    if (url) await Linking.openURL(url);
    return;
  }
  const tujuan = `${FileSystem.cacheDirectory}hris-${info.versionCode}.apk`;
  await FileSystem.deleteAsync(tujuan, { idempotent: true });
  const unduhan = FileSystem.createDownloadResumable(
    info.apkUrl,
    tujuan,
    {},
    (p) => {
      const total = p.totalBytesExpectedToWrite || info.size;
      if (total > 0) onProgres(Math.min(1, p.totalBytesWritten / total));
    },
  );
  const hasil = await unduhan.downloadAsync();
  if (!hasil || hasil.status !== 200) throw new Error("download");
  const berkas = await FileSystem.getInfoAsync(tujuan);
  if (!berkas.exists || (info.size > 0 && berkas.size !== info.size)) {
    throw new Error("ukuran");
  }
  onProgres(1);
  const uri = await FileSystem.getContentUriAsync(tujuan);
  await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
    data: uri,
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    type: "application/vnd.android.package-archive",
  });
}
