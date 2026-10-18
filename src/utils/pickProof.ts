import { holdLock } from "@/services/biometric";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { toJpeg } from "@/utils/toJpeg";
import { MAX_BYTES, formatFileSize } from "@/utils/file";

export interface ProofFile {
  name: string;
  size: string; // "1,2 MB"
  uri: string;
  mimeType: string;
}

export type PickResult =
  | { file: ProofFile }
  | { tooLargeSizeLabel: string } // ukuran berkas, untuk pesan galat
  | null; // dibatalkan

// Memilih satu bukti (PDF/JPG/PNG, maks. 5 MB). Batas yang sama dijaga juga oleh server.
export async function pickProof(): Promise<PickResult> {
  holdLock();
  const r = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/*"],
    copyToCacheDirectory: true,
  });
  if (r.canceled) return null;
  const a = r.assets[0];
  let uri = a.uri;
  let name = a.name;
  let mimeType = a.mimeType ?? "application/octet-stream";
  let fileSize = a.size ?? 0;
  // HEIC/WebP dan sejenisnya tidak diterima server: ubah ke JPEG di HP.
  if (mimeType.startsWith("image/") && !/^image\/(jpeg|png)$/.test(mimeType)) {
    uri = await toJpeg(uri);
    name = `${name.replace(/\.[^.]+$/, "")}.jpg`;
    mimeType = "image/jpeg";
    fileSize = new File(uri).size ?? 0;
  }
  if (fileSize > MAX_BYTES)
    return { tooLargeSizeLabel: formatFileSize(fileSize) };
  return {
    file: {
      name,
      size: formatFileSize(fileSize),
      uri,
      mimeType,
    },
  };
}
