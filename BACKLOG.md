# Backlog migrasi mock ke ERPNext

Status per 2026-10-17. Sumber kebenaran: method di `HrisApi` ([src/services/types.ts](src/services/types.ts)) yang belum di-override `erpnextApi`.

## Sudah asli

- Login, logout, role, sesi kedaluwarsa (layar login memberi tahu bila dikeluarkan dari luar), bahasa mengikuti akun ERPNext
- Cuti, Lembur, Dinas Luar, WFH: kirim, daftar, approval; saldo cuti; zona waktu dinas
- Absensi: jam dari server menurut zona kerja, status Terlambat/Pulang awal/Tepat waktu sesuai shift, riwayat, koreksi, geofence, check-in offline dengan jam tepercaya
- Karyawan, ringkasan kepegawaian, absensi tim, Beranda (menu Semua, sapaan sesuai shift termasuk shift malam, jam live)
- Slip gaji, PPh21/BPJS (tabel TER kategori A, B, C dan pemetaan kategori PTKP **diverifikasi baris demi baris** terhadap salinan resmi PP 58/2023 dari peraturan.bpk.go.id pada 2026-10-17: A 44 baris, B 40, C 41, semua cocok; Desember memakai tarif Pasal 17 UU PPh); Dokumen Digital (status berubah sendiri saat HR memverifikasi) dan Appraisal
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
- [ ] Uji APK `com.hrismobile` (build `fab3e71d`) dengan ceklis Fase 3d di `TESTING.md`: perangkat, daftar ulang wajah, liveness, anti-spoofing bayangan, biometrik dan kunci otomatis, keluarkan perangkat, push. Catat skor anti-spoofing wajah asli di HP karyawan; bila wajah asli sering ditolak saat mendaftar, ambang 0,5 (`SPOOF_AMBANG` di `FaceEnrollScreen.tsx`) perlu digeser
- [ ] Push sungguhan: matikan Dry Run di Push Settings lalu uji dengan persetujuan cuti; `./scripts/tes-push.sh` untuk uji langsung
- [ ] Kuota build EAS gratis: 15 build Android per bulan per akun (akun `gshins-team`). Putuskan paket berbayar atau akun organisasi perusahaan; unduh dan cadangkan keystore (`npx eas-cli credentials`). Setiap build baru: jalankan `./scripts/rilis-apk.sh <build-id>` supaya server tahu versi terbaru
- [ ] Putuskan nama dan ID paket final (sekarang `com.hrismobile`; mengubahnya = aplikasi baru, App Update harus diisi ulang, Firebase tambah app Android baru). Repositori ini memuat `google-services.json`: jaga tetap privat
- [ ] Tinjauan hukum sebelum rilis komersial: lisensi bobot SFace dan data latihnya; Minivision (tanyakan data latih dan izin komersial ke Minivision); ML Kit; **jangan pakai SuriAI** (dilatih di CelebA-Spoof, non-komersial); persetujuan karyawan untuk data biometrik (UU PDP), retensi selfie (disimpan selama pendaftaran Active)
- [ ] Verifikasi 2 langkah di Keamanan masih data contoh: putuskan dibuat sungguhan (OTP email) atau dihapus
- [ ] Kebijakan sesi: sekarang maksimal 3 sesi aktif per pengguna (System Settings > Deny Multiple Sessions, User > Simultaneous Sessions); sesuaikan bila terlalu ketat. Keluarkan perangkat dibatasi 10 kali per jam per IP klien oleh Frappe
- [ ] Rilis toko: Play Store (AAB, kebijakan privasi, keamanan data) dan App Store (akun Apple Developer); lalu `MODE_PEMBARUAN = "toko"`

Bisa dikerjakan (setelah data uji terkumpul atau bersama build berikutnya):
- [ ] Anti-spoofing: setelah data mode bayangan terkumpul (1 sampai 2 minggu), tentukan ambang dan jadikan penanda "Perlu Ditinjau" atau penjaga di Clock In/Out; tambahkan uji dengan kamera depan HP karyawan dan foto cetak/layar sungguhan
- [ ] Pemindaian wajah lebih cepat seperti Face ID: baca aliran video (vision-camera + frame processor ML Kit) menggantikan foto satu per satu; butuh build baru
- [ ] Blur sungguhan di bawah tab bar: di Android `expo-blur` butuh `BlurTargetView` yang membungkus seluruh konten layar; perubahan arsitektur yang harus diuji performanya di perangkat (Android 11). Sekarang gradien pudar

Ditunda atas permintaan:
- [ ] Verifikasi wajah di server: embedding dihitung server dari foto, bukan vektor dari HP, untuk menutup celah vektor palsu lewat API. Butuh container embedding (FastAPI + onnxruntime); AuraFace lebih baik pada KTP bagus tetapi 260 MB dan lebih buruk pada KTP buram, jadi SFace tetap kecuali ada data uji sungguhan
- [ ] Server sungguhan: seed di srv-vllm, alamat tetap (domain + HTTPS), perbarui variabel env EAS `preview`, uji seed dari nol (`down -v`, perlu izin)
- [ ] iOS: verifikasi wajah (Vision) dan Face ID; butuh akun Apple Developer dan build iOS

Catatan operasional:
- Server lokal butuh Docker Desktop menyala; setelah mengubah `docker/server-scripts` atau `docker/seed` jalankan `./docker/seed/seed.sh`
- Perubahan JavaScript: `./scripts/kirim-update.sh "pesan"` (tanpa build); perubahan native, izin, model, ikon: build baru atas perintahmu, lalu `rilis-apk.sh`
- Graf kode: `graphify update .`; cek graf lebih dulu sebelum mengubah kode (skill `/graphify` sudah terpasang)
