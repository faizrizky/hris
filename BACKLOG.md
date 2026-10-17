# Backlog migrasi mock ke ERPNext

Status per 2026-10-17 (diperbarui setelah item "bisa dikerjakan" dikerjakan). Sumber kebenaran: method di `HrisApi` ([src/services/types.ts](src/services/types.ts)) yang belum di-override `erpnextApi`.

## Sudah asli

- Login, logout, role, sesi kedaluwarsa (layar login memberi tahu bila dikeluarkan dari luar), bahasa mengikuti akun ERPNext
- Cuti, Lembur, Dinas Luar, WFH: kirim, daftar, approval; saldo cuti; zona waktu dinas
- Absensi: jam dari server menurut zona kerja, status Terlambat/Pulang awal/Tepat waktu sesuai shift, riwayat, koreksi, geofence, check-in offline dengan jam tepercaya
- Karyawan, ringkasan kepegawaian, absensi tim, Beranda (menu Semua, sapaan sesuai shift termasuk shift malam, jam live)
- Slip gaji, PPh21/BPJS; Dokumen Digital (status berubah sendiri saat HR memverifikasi) dan Appraisal
- Profil, foto profil (diajukan ke HR), notifikasi, bahasa ID/EN
- **Wajah:** pendaftaran (ML Kit + SFace fp32, tiga perintah liveness acak, sampel kualitas tinggi), persetujuan HR di web (tiga foto, KTP PDF ikut tampil, skor, selfie disimpan selama Active), ambang `min_ktp` 34, wajib wajah terdaftar untuk Clock In, liveness Clock In/Out tiga perintah acak
- **Anti-spoofing (Minivision MiniFASNet, ONNX):** mode bayangan di Clock In/Out (skor dicatat di Employee Checkin); di pendaftaran wajah sudah menolak bila median skor < 0,5
- **Ikatan perangkat:** Registered Device (perangkat pertama otomatis, berikutnya menunggu HR), Clock In diblokir di perangkat belum disetujui
- **Keamanan:** login biometrik (sidik jari/wajah terdaftar di HP; nama menyesuaikan Android/iOS), kunci otomatis terikat biometrik, keluarkan perangkat satu per satu, batas 3 sesi aktif
- Pembaruan aplikasi: APK wajib lewat server (`rilis-apk.sh` setelah tiap build) dan JavaScript lewat EAS Update (`kirim-update.sh`); proyek EAS di akun `gshins-team`
- **HR di aplikasi:** menu "Verifikasi wajah" (selfie, KTP, foto profil, skor, anti-spoofing; setujui atau tolak dengan alasan)
- Status presensi benar untuk shift lintas tengah malam; Clock In/Out memakai frame kualitas lebih tinggi; HR bisa mengganti perangkat karyawan (centang "Replace Previous Devices" saat menyetujui perangkat baru)
- Tata letak form web (section berlabel, kolom) untuk semua DocType buatan sendiri
- Push notification: Firebase (`hris-2d0e4`), kunci FCM V1 dan keystore di EAS, `scripts/tes-push.sh`

## Masih mock

- Toggle "Verifikasi 2 langkah" di Profil > Keamanan masih data contoh (tidak berfungsi). Putuskan: dibuat sungguhan (OTP email) atau dihapus.

## Berikutnya

Perlu kamu (uji atau keputusan):
- [ ] Uji APK baru `com.hrismobile` dengan ceklis Fase 3d di `TESTING.md` (perangkat, liveness, anti-spoofing bayangan, biometrik, kunci otomatis, push); catat skor anti-spoofing wajah asli di HP karyawan untuk menyetel ambang (0,5 di pendaftaran)
- [ ] Push sungguhan: matikan Dry Run di Push Settings lalu uji dengan persetujuan cuti
- [ ] Kuota build EAS gratis habis per bulan (15 build Android). Putuskan paket berbayar atau pindah ke akun organisasi perusahaan; unduh dan cadangkan keystore (`npx eas-cli credentials`)
- [ ] Putuskan nama dan ID paket final (sekarang `com.hrismobile`; mengubahnya = aplikasi baru, isi ulang App Update dengan `rilis-apk.sh`)
- [ ] Tinjauan hukum sebelum rilis komersial: lisensi bobot SFace dan data latihnya; Minivision (tanyakan data latih dan izin komersial ke Minivision); ML Kit; **jangan pakai SuriAI** (dilatih di CelebA-Spoof, non-komersial); persetujuan karyawan untuk data biometrik (UU PDP) dan retensi selfie
- [ ] Rilis toko: Play Store (AAB, kebijakan privasi, keamanan data) dan App Store (akun Apple Developer); lalu `MODE_PEMBARUAN = "toko"`
- [ ] Verifikasi tabel TER PPh 21 dengan PDF PMK 168/2023

Bisa dikerjakan:
- [ ] **Verifikasi wajah di server** (ditunda sesuai permintaan) (embedding dihitung server dari foto, bukan vektor dari HP): menutup celah vektor palsu lewat API. Butuh container embedding (FastAPI + onnxruntime); AuraFace diuji lebih baik pada KTP bagus tetapi 260 MB dan lebih buruk pada KTP buram, jadi SFace tetap kecuali ada data uji sungguhan
- [ ] Anti-spoofing: setelah data mode bayangan terkumpul (1 sampai 2 minggu), tentukan ambang dan jadikan penanda "Perlu Ditinjau" atau penjaga di Clock In/Out; tambahkan uji dengan kamera depan HP karyawan
- [ ] Pemindaian wajah lebih cepat seperti Face ID: baca aliran video (vision-camera + frame processor ML Kit) menggantikan foto satu per satu; butuh build baru
- [ ] Verifikasi wajah dan biometrik iOS (Vision, Face ID); ditunda; butuh akun Apple Developer
- [ ] Blur sungguhan di bawah tab bar: di Android `expo-blur` butuh `BlurTargetView` yang membungkus seluruh konten layar, perubahan arsitektur yang harus diuji performanya di perangkat (Android 11); sekarang gradien pudar
- [ ] (ditunda sesuai permintaan) Server sungguhan: seed di srv-vllm, alamat tetap (domain + HTTPS), perbarui variabel env EAS `preview`, uji seed dari nol (`down -v`, perlu izin)
