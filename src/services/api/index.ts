// Titik tunggal yang dipakai semua layar untuk akses data.
//
// FASE 1 (sekarang): export mockApi — semua data dummy, in-memory.
// FASE 2 (nanti): buat `erpnextApi.ts` di folder ini yang implement HrisApi
// yang sama (lihat src/services/types.ts) dengan call REST API ERPNext asli,
// lalu ganti baris export di bawah. Tidak ada layar yang perlu diubah.

import { mockApi } from '../mock/mockApi';
import { HrisApi } from '../types';

export const hrisApi: HrisApi = mockApi;
