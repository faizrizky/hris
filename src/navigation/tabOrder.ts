import type { Role } from "@/services/types";

// Urutan tab di bar bawah; tab kedua bergantung peran.
export const tabOrder = (role: Role | undefined): string[] => [
  "Beranda",
  role === "mss" ? "Approval" : role === "hr" ? "AbsensiTim" : "Absensi",
  "Notifikasi",
  "Slip Gaji",
  "Profil",
];
