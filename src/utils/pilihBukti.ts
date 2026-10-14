import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { jadikanJpeg } from "@/utils/jadikanJpeg";
import { MAKS_BYTE, ukuranFile } from "@/utils/file";

export interface BuktiBerkas {
  name: string;
  size: string; // "1,2 MB"
  uri: string;
  mimeType: string;
}

export type HasilPilih =
  | { berkas: BuktiBerkas }
  | { terlaluBesar: string } // ukuran berkas, untuk pesan galat
  | null; // dibatalkan

// Memilih satu bukti (PDF/JPG/PNG, maks. 5 MB). Batas yang sama dijaga juga oleh server.
export async function pilihBukti(): Promise<HasilPilih> {
  const r = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/*"],
    copyToCacheDirectory: true,
  });
  if (r.canceled) return null;
  const a = r.assets[0];
  let uri = a.uri;
  let name = a.name;
  let mimeType = a.mimeType ?? "application/octet-stream";
  let ukuran = a.size ?? 0;
  // HEIC/WebP dan sejenisnya tidak diterima server: ubah ke JPEG di HP.
  if (mimeType.startsWith("image/") && !/^image\/(jpeg|png)$/.test(mimeType)) {
    uri = await jadikanJpeg(uri);
    name = `${name.replace(/\.[^.]+$/, "")}.jpg`;
    mimeType = "image/jpeg";
    ukuran = new File(uri).size ?? 0;
  }
  if (ukuran > MAKS_BYTE) return { terlaluBesar: ukuranFile(ukuran) };
  return {
    berkas: {
      name,
      size: ukuranFile(ukuran),
      uri,
      mimeType,
    },
  };
}
