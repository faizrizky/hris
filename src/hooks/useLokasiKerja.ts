import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { hrisApi } from "@/services/api";
import { AturanLokasi, LokasiCheckin } from "@/services/types";

export type IzinLokasi = "cek" | "ok" | "ditolak";

export interface TerdekatKerja {
  nama: string;
  jarakM: number;
  radiusM: number;
  didalam: boolean;
}

// Jarak antara dua titik (meter), rumus haversine.
export function jarakMeter(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function keLokasi(l: Location.LocationObject): LokasiCheckin {
  return {
    lat: l.coords.latitude,
    lng: l.coords.longitude,
    accuracyM: l.coords.accuracy ?? 0,
    gpsMs: l.timestamp,
    // Android menandai lokasi dari aplikasi mock; iOS tidak punya penanda ini.
    mocked: (l as { mocked?: boolean }).mocked === true,
  };
}

// Memantau lokasi saat layar presensi terbuka, lalu menghitung jarak ke lokasi
// kerja. Server tetap yang menilai; ini hanya agar karyawan tahu posisinya
// sebelum check-in.
export function useLokasiKerja(aktif: boolean) {
  const [izin, setIzin] = useState<IzinLokasi>("cek");
  const [fix, setFix] = useState<LokasiCheckin | null>(null);
  const [aturan, setAturan] = useState<AturanLokasi | null>(null);
  const terakhir = useRef<LokasiCheckin | null>(null);

  useEffect(() => {
    if (!aktif) return;
    let batal = false;
    let langganan: Location.LocationSubscription | null = null;
    hrisApi
      .getWorkLocations()
      .then((l) => !batal && setAturan(l))
      .catch(() => {});
    (async () => {
      try {
        const r = await Location.requestForegroundPermissionsAsync();
        if (batal) return;
        if (r.status !== "granted") {
          setIzin("ditolak");
          return;
        }
        setIzin("ok");
        langganan = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 4000,
            distanceInterval: 3,
          },
          (l) => {
            const x = keLokasi(l);
            terakhir.current = x;
            if (!batal) setFix(x);
          },
        );
      } catch {
        if (!batal) setIzin("ditolak");
      }
    })();
    return () => {
      batal = true;
      langganan?.remove();
    };
  }, [aktif]);

  // Lokasi terbaru saat tombol ditekan: pakai fix segar, selain itu minta satu kali.
  const ambilTerbaru = useCallback(async (): Promise<
    LokasiCheckin | undefined
  > => {
    const baru = terakhir.current;
    if (baru && Date.now() - baru.gpsMs < 60_000) return baru;
    try {
      const l = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return keLokasi(l);
    } catch {
      return baru ?? undefined;
    }
  }, []);

  let terdekat: TerdekatKerja | null = null;
  if (fix) {
    for (const l of aturan?.locations ?? []) {
      const d = jarakMeter(fix.lat, fix.lng, l.latitude, l.longitude);
      if (!terdekat || d < terdekat.jarakM) {
        terdekat = {
          nama: l.locationName,
          jarakM: Math.round(d),
          radiusM: l.radiusM,
          didalam: d <= l.radiusM + Math.min(fix.accuracyM, 50),
        };
      }
    }
  }

  return { izin, fix, terdekat, aturan, ambilTerbaru };
}
