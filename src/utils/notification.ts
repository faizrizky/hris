import type { AppNotification } from "@/services/types";

// Kotak Masuk hanya berisi kabar pribadi; pengumuman HR punya tab sendiri.
// Server memberi kategori "Pengumuman" juga ke kabar pribadi (wajah, perangkat, profil, dokumen), jadi yang
// disaring hanya pengumuman HR (dan baris tanpa rujukan dokumen berkategori pengumuman).
export const isInboxNotification = (notification: AppNotification): boolean =>
  notification.documentType
    ? notification.documentType !== "HR Announcement"
    : notification.category !== "Pengumuman";
