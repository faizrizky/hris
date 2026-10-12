import { useEffect, useState } from "react";
import { dengarkanAntrean } from "@/services/offlineQueue";

// Jumlah check-in offline yang masih menunggu dikirim.
export function useJumlahAntrean(): number {
  const [n, setN] = useState(0);
  useEffect(() => dengarkanAntrean(setN), []);
  return n;
}
