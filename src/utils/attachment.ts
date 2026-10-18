import { holdLock } from "@/services/biometric";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { downloadFile } from "@/services/api/http";

// Mengunduh lampiran privat ke cache dengan sesi aplikasi, mengembalikan uri lokal.
// Nama harus berekstensi supaya pratinjau sistem tahu cara membukanya.
export async function saveAttachment(
  url: string,
  nama: string,
): Promise<string> {
  const bytes = await downloadFile(url);
  const ext = url.split("?")[0]!.match(/\.[a-z0-9]+$/i)?.[0] ?? "";
  const baseName = nama.replace(/[^\w.\- ]+/g, "_") || "lampiran";
  const safeName = /\.[a-z0-9]+$/i.test(baseName)
    ? baseName
    : `${baseName}${ext}`;
  const file = new File(Paths.cache, safeName);
  file.create({ overwrite: true });
  file.write(bytes);
  return file.uri;
}

// Membuka lampiran lewat lembar berbagi/pratinjau sistem. Browser tidak bisa
// dipakai: sesi aplikasi tidak ikut terbawa ke sana.
export async function openAttachment(
  url: string,
  nama: string,
): Promise<boolean> {
  const uri = await saveAttachment(url, nama);
  if (!(await Sharing.isAvailableAsync())) return false;
  holdLock();
  await Sharing.shareAsync(uri);
  return true;
}

export const isImage = (url: string) =>
  /\.(png|jpe?g|gif|webp|heic)$/i.test(url.split("?")[0]!);
