import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { hrisApi } from "@/services/api";
import { simpanLampiran } from "@/utils/lampiran";

// Foto profil adalah berkas privat: diunduh dengan sesi ke cache lalu
// ditampilkan dari sana. Hasil unduhan diingat per URL supaya tidak diunduh
// ulang setiap layar fokus. Null = belum ada foto (atau gagal dimuat).
const cache = new Map<string, string>();

export function useFotoProfil(): string | null {
  const [uri, setUri] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      let aktif = true;
      hrisApi
        .getFaceStatus()
        .then(async (f) => {
          if (!f.profileUrl) return null;
          const ada = cache.get(f.profileUrl);
          if (ada) return ada;
          const lokal = await simpanLampiran(f.profileUrl, "profil");
          cache.set(f.profileUrl, lokal);
          return lokal;
        })
        .then((u) => {
          if (aktif) setUri(u);
        })
        .catch(() => {
          if (aktif) setUri(null);
        });
      return () => {
        aktif = false;
      };
    }, []),
  );
  return uri;
}
