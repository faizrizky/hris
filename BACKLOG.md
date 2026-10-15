# Backlog migrasi mock ke ERPNext

Status per 2026-10-16. Sumber kebenaran: method di `HrisApi` ([src/services/types.ts](src/services/types.ts)) yang belum di-override `erpnextApi`.

## Sudah asli

- Login, logout, role, sesi kedaluwarsa, bahasa mengikuti akun ERPNext (`hris_get_my_language`)
- Cuti: saldo, daftar, kirim, approval (satu PUT `status` + `docstatus:1`)
- Lembur (`hris_*_overtime`), Dinas Luar (`hris_*_travel_request`), dan WFH (`hris_*_wfh`, pilih hari per minggu; hanya yang disetujui atasan membebaskan geofence): kirim, daftar, approval
- Absensi: status jam, check-in/out dengan jam dari server menurut zona waktu (`hris_checkin`), riwayat, koreksi
- Karyawan, ringkasan kepegawaian, absensi tim, Beranda (feed, statistik)
- Slip gaji, PPh21/BPJS
- Dokumen Digital (unggah multipart, verifikasi HR) dan Appraisal
- Profil, keamanan (password, perangkat aktif), notifikasi (Notification Log)
- Semua layar sudah ID/EN mengikuti bahasa akun
- Geofence (Shift Location, peta web bisa digeser/diklik), check-in offline dengan jam tepercaya, WFH oleh karyawan
- Foto profil (diajukan ke HR), pendaftaran wajah (ML Kit + SFace, lingkaran Face ID, persetujuan HR di web), wajib wajah terdaftar untuk Clock In
- Menu Beranda (Semua), sapaan sesuai shift, jam live, layar pembuka beranimasi
- Pembaruan aplikasi: APK wajib lewat server (App Update + rilis-apk.sh) dan JavaScript lewat EAS Update (kirim-update.sh)

## Masih mock

Tidak ada: seluruh method `HrisApi` sudah punya implementasi ERPNext. Dokumen Digital (`hris_*_my_document` + `upload_file`) dan Appraisal (`hris_get_my_appraisal`) baru tersambung dan belum diuji di perangkat.

## Berikutnya

Perlu kamu (uji atau keputusan):
- [ ] Uji di HP dengan ceklis (halaman ceklis, fase 3b dan 3c di `TESTING.md`): verifikasi wajah, geofence/WFH, offline, pembaruan APK dan EAS Update; kumpulkan angka kemiripan wajah untuk menyetel ambang
- [ ] Push notification: butuh akun Firebase (`google-services.json`) lalu Push Settings → Dry Run = 0
- [ ] Putuskan ID paket `com.falah.hrismobile` sebelum rilis toko (mengubahnya = aplikasi baru)
- [ ] Tinjauan hukum lisensi bobot SFace sebelum rilis komersial; persetujuan karyawan untuk data biometrik (UU PDP)
- [ ] Rilis toko: Play Store (AAB, kebijakan privasi, keamanan data) dan App Store (akun Apple Developer); lalu `MODE_PEMBARUAN = "toko"`
- [ ] Verifikasi tabel TER PPh 21 dengan PDF PMK 168/2023 (pemetaan kategori sudah cocok dengan DJP)

Bisa dikerjakan:
- [ ] Ikatan perangkat per akun (HP terdaftar, HP baru disetujui HR) untuk menutup titip absen dari HP lain
- [ ] Server sungguhan: seed di srv-vllm, alamat tetap (domain + HTTPS), perbarui variabel env EAS `preview`, uji seed dari nol (`down -v`, perlu izin)
- [ ] Perkecil APK (model wajah int8, sekitar 70 MB) setelah uji akurasi
- [ ] Verifikasi wajah iOS (Vision); pencocokan wajah di server; layar peninjauan pendaftaran wajah di aplikasi untuk HR
- [ ] Blur sungguhan di bawah tab bar (sekarang gradien pudar); uji performa di Android 11
- [ ] Shift malam yang melewati tengah malam pada sapaan Beranda
