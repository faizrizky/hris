import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { unduhBerkas } from "@/services/api/http";

// Mengunduh lampiran privat lalu membukanya lewat lembar berbagi/pratinjau sistem.
// Browser tidak bisa dipakai: sesi aplikasi tidak ikut terbawa ke sana.
export async function bukaLampiran(
  url: string,
  nama: string,
): Promise<boolean> {
  const bytes = await unduhBerkas(url);
  // Nama harus berekstensi supaya pratinjau sistem tahu cara membukanya.
  const ext = url.split("?")[0]!.match(/\.[a-z0-9]+$/i)?.[0] ?? "";
  const dasar = nama.replace(/[^\w.\- ]+/g, "_") || "lampiran";
  const aman = /\.[a-z0-9]+$/i.test(dasar) ? dasar : `${dasar}${ext}`;
  const file = new File(Paths.cache, aman);
  file.create({ overwrite: true });
  file.write(bytes);
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri);
  return true;
}
