# HRIS Mobile (Fase 1 — Mocking)

Prototype UI aplikasi HRIS mobile (iOS & Android) untuk Falah Inovasi Teknologi, dibangun dengan **React Native (Expo) + TypeScript**. Semua data di fase ini masih **dummy/in-memory** — belum terhubung ke ERPNext.

## Scope fase ini

Fitur Must-have (lihat dokumen `HRIS-Mobile-Scope-Prioritas.md` untuk detail prioritas lengkap):

- Login (mock — role ditentukan dari prefix email: `ess@`, `mss@`, `hr@`)
- Clock in / clock out (tanpa GPS & face recognition dulu)
- Riwayat absensi + filter status
- Ajukan cuti/lembur/dinas luar + lihat sisa kuota
- Approval pengajuan (khusus role `mss`/`hr`, tab "Approval" otomatis muncul)
- Slip gaji (list + detail)
- Profil diri

Belum termasuk di fase ini (menyusul di fase berikutnya): integrasi REST API ERPNext, autentikasi asli, GPS, dan face recognition (ML Kit).

## Menjalankan

```bash
npm install
npx expo start
```

Scan QR dengan Expo Go (kalau tidak pakai native module custom), atau `npm run ios` / `npm run android` kalau sudah setup simulator/emulator.

## Struktur folder

```
src/
  navigation/     -> RootNavigator (bottom tabs + stack per fitur)
  screens/        -> satu folder per modul (auth, home, attendance, leave, payroll, profile)
  services/
    types.ts      -> domain types + interface HrisApi (kontrak data)
    mock/         -> implementasi HrisApi pakai data dummy (dipakai sekarang)
    api/          -> titik ganti ke ERPNext asli nanti (lihat catatan di bawah)
  theme/          -> warna, mengikuti mockup Design Canvas (accent #2490EF)
  components/     -> Card, StatusBadge, PrimaryButton (dipakai di semua layar)
```

## Cara lanjut ke Fase 2 (integrasi ERPNext)

Semua layar memanggil data lewat `hrisApi` dari `src/services/api/index.ts`, bukan langsung ke mock. Supaya integrasi nanti tidak perlu mengubah layar sama sekali:

1. Buat `src/services/api/erpnextApi.ts` yang mengimplementasikan interface `HrisApi` (di `src/services/types.ts`) dengan call REST API ERPNext asli (auth, `/api/resource/Attendance`, `/api/resource/Leave Application`, `/api/resource/Salary Slip`, dll).
2. Ganti isi `src/services/api/index.ts` dari `export const hrisApi = mockApi` menjadi `export const hrisApi = erpnextApi`.
3. Tambahkan face recognition (ML Kit + model embedding, lihat catatan diskusi sebelumnya) di alur `ClockScreen` saat itu tiba gilirannya.

## Catatan

- Alias import `@/...` mengarah ke `src/` (dikonfigurasi lewat `babel-plugin-module-resolver`, lihat `babel.config.js`).
- Warna & komponen mengikuti gaya di mockup Design Canvas (iOS Liquid Glass) — silakan sesuaikan lebih lanjut kalau ada perubahan desain final dari Figma.
