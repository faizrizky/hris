# Backlog migrasi mock ke ERPNext

Status per 2026-10-11. Sumber kebenaran: method di `HrisApi` ([src/services/types.ts](src/services/types.ts)) yang belum di-override `erpnextApi`.

## Sudah asli

- Login, logout, role, sesi kedaluwarsa, bahasa mengikuti akun ERPNext (`hris_get_my_language`)
- Cuti: saldo, daftar, kirim, approval (satu PUT `status` + `docstatus:1`)
- Lembur (`hris_*_overtime`) dan Dinas Luar (`hris_*_travel_request`): kirim, daftar, approval
- Absensi: status jam, check-in/out dengan jam dari server menurut zona waktu (`hris_checkin`), riwayat, koreksi
- Karyawan, ringkasan kepegawaian, absensi tim, Beranda (feed, statistik)
- Slip gaji, PPh21/BPJS
- Dokumen Digital (unggah multipart, verifikasi HR) dan Appraisal
- Profil, keamanan (password, perangkat aktif), notifikasi (Notification Log)
- Semua layar sudah ID/EN mengikuti bahasa akun

## Masih mock

Tidak ada: seluruh method `HrisApi` sudah punya implementasi ERPNext. Dokumen Digital (`hris_*_my_document` + `upload_file`) dan Appraisal (`hris_get_my_appraisal`) baru tersambung dan belum diuji di perangkat.

## Berikutnya

- [ ] Uji di HP fisik: buka lampiran dari kartu approval (unduh dengan sesi lalu lembar berbagi), unggah bukti lembur/biaya dinas dan dokumen, jam menurut zona dinas (butuh dinas aktif di zona lain), riwayat absensi staf
- [ ] Push notification: butuh dev build + akun Apple Developer + `projectId` EAS di app.json (`extra.eas.projectId`). Server sudah siap (Push Settings → Dry Run diubah ke 0 untuk kirim sungguhan); pengiriman masih sinkron di request pembuat notifikasi (maks 8 detik)
- [ ] Check-in offline: uji modul native `hris-clock` di build APK pertama (belum pernah dikompilasi), dan uji geofence/GPS di HP (izin lokasi, lokasi palsu, mode Block)
- [ ] Verifikasi wajah Android (ML Kit): deteksi wajah dan liveness; pencocokan identitas butuh model embedding (belum diputuskan)
- [ ] Lampiran bukti untuk pengajuan cuti (surat dokter, akta) belum terkirim ke ERPNext; tombol unggah di form cuti masih tampilan
- [ ] Pengajuan WFH oleh karyawan dengan persetujuan atasan (kini jadwal WFH diatur HR di web)
- [ ] Seed dari nol (`down -v`) belum diuji; seed baru perlu dijalankan di srv-vllm
