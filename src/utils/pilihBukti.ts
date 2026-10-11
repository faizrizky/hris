import * as DocumentPicker from "expo-document-picker";
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
    type: ["application/pdf", "image/jpeg", "image/png"],
    copyToCacheDirectory: true,
  });
  if (r.canceled) return null;
  const a = r.assets[0];
  if ((a.size ?? 0) > MAKS_BYTE) return { terlaluBesar: ukuranFile(a.size!) };
  return {
    berkas: {
      name: a.name,
      size: ukuranFile(a.size ?? 0),
      uri: a.uri,
      mimeType: a.mimeType ?? "application/octet-stream",
    },
  };
}
