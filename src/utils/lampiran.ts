import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { unduhBerkas } from "@/services/api/http";

// Mengunduh lampiran privat ke cache dengan sesi aplikasi, mengembalikan uri lokal.
// Nama harus berekstensi supaya pratinjau sistem tahu cara membukanya.
export async function simpanLampiran(
  url: string,
  nama: string,
): Promise<string> {
  const bytes = await unduhBerkas(url);
  const ext = url.split("?")[0]!.match(/\.[a-z0-9]+$/i)?.[0] ?? "";
  const dasar = nama.replace(/[^\w.\- ]+/g, "_") || "lampiran";
  const aman = /\.[a-z0-9]+$/i.test(dasar) ? dasar : `${dasar}${ext}`;
  const file = new File(Paths.cache, aman);
  file.create({ overwrite: true });
  file.write(bytes);
  return file.uri;
}

// Membuka lampiran lewat lembar berbagi/pratinjau sistem. Browser tidak bisa
// dipakai: sesi aplikasi tidak ikut terbawa ke sana.
export async function bukaLampiran(
  url: string,
  nama: string,
): Promise<boolean> {
  const uri = await simpanLampiran(url, nama);
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri);
  return true;
}

export const adalahGambar = (url: string) =>
  /\.(png|jpe?g|gif|webp|heic)$/i.test(url.split("?")[0]!);
