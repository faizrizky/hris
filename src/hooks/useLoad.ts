import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { describeError } from "@/services/api/http";

export interface Load<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean; // true selama belum ada data pertama
  retry: () => void;
}

// Memuat data setiap layar mendapat fokus. Data lama tetap tampil selama
// pemuatan ulang; error hanya menggantikan layar kalau belum ada data.
//
// `kunci` menentukan kapan pemuatan dianggap berbeda (mis. id karyawan yang
// login). Fungsi `ambil` boleh dibuat ulang tiap render: yang dipakai selalu
// versi terbarunya.
export function useLoad<T>(
  fetchData: () => Promise<T>,
  cacheKey: string | number | null | undefined,
): Load<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Data boleh null secara sah (mis. belum ada appraisal), jadi "sudah dimuat"
  // dicatat terpisah dari isinya.
  const [isFinished, setIsFinished] = useState(false);
  const order = useRef(0); // abaikan jawaban dari permintaan yang sudah usang
  const latestFetch = useRef(fetchData);

  useEffect(() => {
    latestFetch.current = fetchData;
  });

  const runLoad = useCallback(() => {
    const saya = ++order.current;
    setError(null);
    latestFetch
      .current()
      .then((result) => {
        if (saya === order.current) {
          setData(result);
          setIsFinished(true);
        }
      })
      .catch((e) => {
        if (saya === order.current) setError(describeError(e));
      });
  }, []);

  useFocusEffect(runLoad);

  // `kunci` yang berubah memuat ulang walau layar tidak berganti fokus.
  const loadedKey = useRef(cacheKey);
  useEffect(() => {
    if (loadedKey.current === cacheKey) return;
    loadedKey.current = cacheKey;
    runLoad();
  }, [cacheKey, runLoad]);

  return {
    data,
    error,
    isLoading: !isFinished && error === null,
    retry: runLoad,
  };
}
