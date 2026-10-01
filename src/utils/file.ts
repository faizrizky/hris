export const MAKS_BYTE = 5 * 1024 * 1024;

/** 1258291 -> "1,2 MB" */
export function ukuranFile(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/** "ktp-depan.jpeg" -> "JPG" */
export function ekstensiDari(namaFile: string) {
  const ext = namaFile.split(".").pop()?.toUpperCase() ?? "FILE";
  return ext === "JPEG" ? "JPG" : ext;
}

/** "Sertifikat K3 Umum.pdf" -> "Sertifikat K3 Umum" */
export function tanpaEkstensi(namaFile: string) {
  const i = namaFile.lastIndexOf(".");
  return i > 0 ? namaFile.slice(0, i) : namaFile;
}
