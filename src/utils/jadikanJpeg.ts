import * as ImageManipulator from "expo-image-manipulator";

// Foto dari galeri/kamera bisa berformat HEIC/HEIF (mis. dari iPhone) atau
// berukuran besar. Server hanya menerima PDF/JPG/PNG dan batasnya 5 MB, dan
// pembaca wajah di HP tidak selalu bisa mendekode HEIC. Di sini foto diubah ke
// JPEG dengan sisi terpanjang <= 1600 px sebelum dipakai atau dikirim.
export async function jadikanJpeg(uri: string): Promise<string> {
  const r = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1600 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );
  return r.uri;
}
