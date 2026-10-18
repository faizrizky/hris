import type { AppNotification } from "@/services/types";

// Kotak Masuk hanya berisi kabar pribadi; pengumuman HR punya tab sendiri.
export const isInboxNotification = (notification: AppNotification): boolean =>
  notification.category !== "Pengumuman";
