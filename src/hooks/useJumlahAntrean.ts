import { useEffect, useState } from "react";
import { listenToQueue } from "@/services/offlineQueue";

// Jumlah check-in offline yang masih menunggu dikirim.
export function useQueueCount(): number {
  const [n, setN] = useState(0);
  useEffect(() => listenToQueue(setN), []);
  return n;
}
