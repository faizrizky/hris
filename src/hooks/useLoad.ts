import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { describeError } from "@/services/api/http";

export interface Load<T> {
  data: T | null;
  error: string | null;
  memuat: boolean; // true selama belum ada data pertama
  ulangi: () => void;
}

// Memuat data setiap layar mendapat fokus. Data lama tetap tampil selama
// pemuatan ulang; error hanya menggantikan layar kalau belum ada data.
export function useLoad<T>(ambil: () => Promise<T>, deps: unknown[]): Load<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const urutan = useRef(0); // abaikan jawaban dari permintaan yang sudah usang

  const jalankan = useCallback(() => {
    const saya = ++urutan.current;
    setError(null);
    ambil()
      .then((hasil) => {
        if (saya === urutan.current) setData(hasil);
      })
      .catch((e) => {
        if (saya === urutan.current) setError(describeError(e));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useFocusEffect(jalankan);

  return {
    data,
    error,
    memuat: data === null && error === null,
    ulangi: jalankan,
  };
}
