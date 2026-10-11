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
//
// `kunci` menentukan kapan pemuatan dianggap berbeda (mis. id karyawan yang
// login). Fungsi `ambil` boleh dibuat ulang tiap render: yang dipakai selalu
// versi terbarunya.
export function useLoad<T>(
  ambil: () => Promise<T>,
  kunci: string | number | null | undefined,
): Load<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Data boleh null secara sah (mis. belum ada appraisal), jadi "sudah dimuat"
  // dicatat terpisah dari isinya.
  const [selesai, setSelesai] = useState(false);
  const urutan = useRef(0); // abaikan jawaban dari permintaan yang sudah usang
  const ambilTerbaru = useRef(ambil);

  useEffect(() => {
    ambilTerbaru.current = ambil;
  });

  const jalankan = useCallback(() => {
    const saya = ++urutan.current;
    setError(null);
    ambilTerbaru
      .current()
      .then((hasil) => {
        if (saya === urutan.current) {
          setData(hasil);
          setSelesai(true);
        }
      })
      .catch((e) => {
        if (saya === urutan.current) setError(describeError(e));
      });
    // `kunci` sengaja menjadi satu-satunya pemicu muat ulang selain fokus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunci]);

  useFocusEffect(jalankan);

  return {
    data,
    error,
    memuat: !selesai && error === null,
    ulangi: jalankan,
  };
}
