// Titik tunggal yang dipakai semua layar untuk akses data.
//
// Default: mockApi (data dummy, in-memory).
// Set EXPO_PUBLIC_USE_ERPNEXT=1 di .env untuk memakai erpnextApi, yang saat
// ini baru login/getCurrentEmployee/logout yang asli, sisanya masih mock.

import { mockApi } from "../mock/mockApi";
import { HrisApi } from "../types";
import { erpnextApi } from "./erpnextApi";

export const hrisApi: HrisApi =
  process.env.EXPO_PUBLIC_USE_ERPNEXT === "1" ? erpnextApi : mockApi;
