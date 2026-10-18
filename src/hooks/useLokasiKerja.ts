import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { hrisApi } from "@/services/api";
import { GeofenceRule, CheckinLocation } from "@/services/types";

export type LocationPermission = "cek" | "ok" | "ditolak";

export interface NearestWorkLocation {
  nama: string;
  distanceM: number;
  radiusM: number;
  isInside: boolean;
}

// Jarak antara dua titik (meter), rumus haversine.
export function distanceInMeters(
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

function toCheckinLocation(l: Location.LocationObject): CheckinLocation {
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
export function useWorkLocation(isActive: boolean) {
  const [permission, setPermission] = useState<LocationPermission>("cek");
  const [fix, setFix] = useState<CheckinLocation | null>(null);
  const [geofenceRule, setGeofenceRule] = useState<GeofenceRule | null>(null);
  const lastLocation = useRef<CheckinLocation | null>(null);

  useEffect(() => {
    if (!isActive) return;
    let isCancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    hrisApi
      .getWorkLocations()
      .then((l) => !isCancelled && setGeofenceRule(l))
      .catch(() => {});
    (async () => {
      try {
        const r = await Location.requestForegroundPermissionsAsync();
        if (isCancelled) return;
        if (r.status !== "granted") {
          setPermission("ditolak");
          return;
        }
        setPermission("ok");
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 4000,
            distanceInterval: 3,
          },
          (l) => {
            const x = toCheckinLocation(l);
            lastLocation.current = x;
            if (!isCancelled) setFix(x);
          },
        );
      } catch {
        if (!isCancelled) setPermission("ditolak");
      }
    })();
    return () => {
      isCancelled = true;
      subscription?.remove();
    };
  }, [isActive]);

  // Lokasi terbaru saat tombol ditekan: pakai fix segar, selain itu minta satu kali.
  const latestFetch = useCallback(async (): Promise<
    CheckinLocation | undefined
  > => {
    const baru = lastLocation.current;
    if (baru && Date.now() - baru.gpsMs < 60_000) return baru;
    try {
      const l = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return toCheckinLocation(l);
    } catch {
      return baru ?? undefined;
    }
  }, []);

  let nearest: NearestWorkLocation | null = null;
  if (fix) {
    for (const l of geofenceRule?.locations ?? []) {
      const d = distanceInMeters(fix.lat, fix.lng, l.latitude, l.longitude);
      if (!nearest || d < nearest.distanceM) {
        nearest = {
          nama: l.locationName,
          distanceM: Math.round(d),
          radiusM: l.radiusM,
          isInside: d <= l.radiusM + Math.min(fix.accuracyM, 50),
        };
      }
    }
  }

  return { permission, fix, nearest, geofenceRule, latestFetch };
}
