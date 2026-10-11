# Backlog migrasi mock ke ERPNext

Status per 2026-10-11. Sumber kebenaran: method di `HrisApi` ([src/services/types.ts](src/services/types.ts)) yang belum di-override `erpnextApi`.

## Sudah asli
- Login, logout, role, sesi kedaluwarsa, bahasa mengikuti akun ERPNext (`hris_get_my_language`)
- Cuti: saldo, daftar, kirim, approval (satu PUT `status` + `docstatus:1`)
- Lembur (`hris_*_overtime`) dan Dinas Luar (`hris_*_travel_request`): kirim, daftar, approval
- Absensi: status jam, check-in/out dengan jam dari server menurut zona waktu (`hris_checkin`), riwayat, koreksi
- Karyawan, ringkasan kepegawaian, absensi tim, Beranda (feed, statistik)
- Slip gaji, PPh21/BPJS
- Profil, keamanan (password, perangkat aktif), notifikasi (Notification Log)
- Semua layar sudah ID/EN mengikuti bahasa akun

## Masih mock
- [ ] `getAppraisal` (Appraisal Cycle / Appraisal / Goal hrms v16)
- [ ] `getDocuments`, `uploadDocument` (Dokumen Digital: doctype kustom + upload_file)

## Berikutnya
- [ ] Bukti lembur dan bukti biaya dinas luar: kini file tiruan di aplikasi, belum terkirim
- [ ] Zona waktu dari server ditampilkan di ClockScreen (kini tertulis "WIB" tetap)
- [ ] Riwayat absensi per karyawan (`StaffDetail`/`StaffHistory` memanggil riwayat milik pemanggil)
- [ ] Antrean check-in offline tidak bisa mengirim jam asli
- [ ] Kategori notifikasi Pengumuman/Appraisal belum punya sumber (usulan: doctype "HR Announcement")
- [ ] Push notification ke HP: butuh dev build (bukan Expo Go), akun Apple Developer, dan pekerja luar untuk memanggil layanan push
- [ ] Verifikasi wajah (ML Kit) dan geofence asli
- [ ] Jenis cuti Melahirkan dan Izin penting belum punya Leave Type
- [ ] Uji di HP fisik (ATS iOS / cleartext Android untuk build non-Expo Go)
- [ ] Seed dari nol (`down -v`) belum diuji; seed baru perlu dijalankan di srv-vllm
- [ ] `graphify-out/` perlu masuk .gitignore
