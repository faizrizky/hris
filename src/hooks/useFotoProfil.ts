import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { hrisApi } from "@/services/api";
import { saveAttachment } from "@/utils/lampiran";

// Foto profil adalah berkas privat: diunduh dengan sesi ke cache lalu
// ditampilkan dari sana. Hasil unduhan diingat per URL supaya tidak diunduh
// ulang setiap layar fokus. Null = belum ada foto (atau gagal dimuat).
const cache = new Map<string, string>();

export function useProfilePhoto(): string | null {
  const [uri, setUri] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      hrisApi
        .getFaceStatus()
        .then(async (f) => {
          if (!f.profileUrl) return null;
          const ada = cache.get(f.profileUrl);
          if (ada) return ada;
          const localUri = await saveAttachment(f.profileUrl, "profil");
          cache.set(f.profileUrl, localUri);
          return localUri;
        })
        .then((u) => {
          if (isMounted) setUri(u);
        })
        .catch(() => {
          if (isMounted) setUri(null);
        });
      return () => {
        isMounted = false;
      };
    }, []),
  );
  return uri;
}
