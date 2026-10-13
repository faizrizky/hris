# Panduan uji di HP

Akun uji (password di `docker/.credentials.local`, jangan dibagikan):
rani.test@example.com (karyawan), mss.test@example.com (Dewi, atasan), hr.test@example.com (Sari, HR).

## Fase 0: Persiapan
1. Mac dan HP di Wi-Fi yang sama. IP Mac saat ini 192.168.1.43 (`ipconfig getifaddr en0`).
2. `.env` aplikasi: `EXPO_PUBLIC_API_BASE_URL=http://192.168.1.43:8082` dan `EXPO_PUBLIC_USE_ERPNEXT=1`.
3. Server hidup: `cd docker && docker compose ps` lalu `./seed/seed.sh` (terapkan seed terbaru).
4. Dari HP, buka `http://192.168.1.43:8082/api/method/ping` di browser; harus muncul `{"message":"pong"}`.
5. Jalankan `npx expo start -c` dan buka lewat Expo Go. Push notification TIDAK bisa di Expo Go (lihat Fase 9).

## Fase 1: Login dan sesi
- Login rani, dewi, sari: masuk, Beranda sesuai peran (ESS tidak punya tab Approval; mss punya Approval + Absensi Kry; HR punya Karyawan).
- Password salah: pesan "Email atau password salah".
- Keluar dari Profil lalu masuk lagi.

## Fase 2: Bahasa
- Tombol ID/EN di layar login dan Profil: semua teks berganti.
- Di web ERPNext (login rani) My Settings > Language > English, tutup dan buka lagi aplikasi: seluruh halaman berbahasa Inggris. Ubah ke Indonesia: kembali.
- Ubah bahasa lewat Profil di aplikasi, cek di web bahwa setelan Language ikut berubah.
- Periksa tanggal, nama hari/bulan, "WIB", dan format angka di tiap bahasa.

## Fase 3: Karyawan (rani)
Beranda: statistik terisi (bukan skeleton selamanya), kartu Employment tidak tampil untuk ESS, Aksi Cepat membuka layar yang benar.
Cuti: saldo tampil; ajukan Tahunan dan Sakit; tanggal bentrok memunculkan pesan bentrok; delegasi dipilih; hasil muncul di Pengajuan saya dengan approver nyata (Dewi).
Lembur: tanggal hari kerja (mulai 17:00, maks 4 jam) dan hari libur (mulai 08:00, maks 8 jam); lampirkan bukti (PDF/JPG/PNG); file >5 MB ditolak; kirim.
Dinas luar: kota, transportasi, keperluan, 2 baris biaya dengan bukti masing-masing; total dan uang harian benar; kirim. Cek di daftar bahwa lampiran muncul.
Absensi: Clock In (tahap GPS lalu wajah lalu selesai), Clock Out; jam sesuai server, bukan jam HP (ubah jam HP 1 jam lalu coba, jam tercatat tetap jam server); label zona "WIB"; Riwayat Absensi; Koreksi absensi dengan bukti; Riwayat Koreksi menampilkan lampiran.
Slip gaji: daftar, rincian, PPh21 & BPJS. Catatan: nominal bisa 0 bila rumus belum diatur HR.
Appraisal: skor 4,0, dua penilai, empat goal.
Dokumen Digital: 3 dokumen contoh; unggah PDF dan JPG (status Menunggu); .txt ditolak; file >5 MB ditolak.
Profil: Ubah Data (email salah ditolak), kontak darurat kedua, Ubah Password (syarat, salah password lama), Keamanan (perangkat aktif, keluar dari perangkat lain).
Notifikasi: daftar, tandai dibaca, kategori terjemahan benar.

## Fase 3b: Fitur lanjutan (rani, dewi, sari)
Cuti khusus: pilih Melahirkan/Izin Penting (Menikah, Khitanan, dll.); jenis kelamin membatasi pilihan (Melahirkan hanya perempuan, istri melahirkan hanya laki-laki); Sakit lebih dari 1 hari wajib surat dokter; bukti cuti terlampir dan terbuka di kartu approval.
Geofence (butuh izin lokasi): di luar radius Shift Location, Clock In ditolak; Clock Out boleh di mana saja; lokasi palsu terdeteksi; akurasi GPS buruk ditolak.
WFH: rani ajukan di segmen WFH (rentang tanggal, hari per minggu, alasan); tumpang tindih ditolak; sebelum disetujui Clock In di luar radius tetap ditolak; dewi menyetujui di Approval lalu Clock In di luar radius lolos pada hari WFH; rani menerima notifikasi.
Check-in offline: matikan data, Clock In masuk antrean; nyalakan, antrean terkirim; mundurkan jam HP, jam tercatat tetap dari jam tepercaya dan ditandai Perlu Ditinjau; atasan/HR meninjau di Peninjauan Check-in.
Pengumuman dan data keluarga: pengumuman HR tampil dan notifikasi terbuka; permintaan ubah data (status pernikahan, anak) masuk ke HR untuk disetujui.

## Fase 4: Atasan (dewi)
- Inbox Approval memuat cuti, lembur, dinas luar, koreksi dari rani (hasil Fase 3).
- Ketuk nama lampiran: terunduh dan terbuka di lembar berbagi/pratinjau.
- Setujui satu, tolak satu, "Setujui semua"; cek status berubah dan rani menerima notifikasi.
- Cuti disetujui: saldo rani berkurang.
- Karyawan: hanya bawahan langsung. Absensi Kry: tab Hadir/Telat/Cuti/Belum. Detail staf dan Riwayat staf menampilkan absensi karyawan itu (bukan milik dewi).

## Fase 5: HR (sari) dan web
- Karyawan: semua karyawan; Beranda menampilkan ringkasan.
- Web ERPNext (login hr): sidebar Leaves > Overtime Request / Travel Request di bawah Pengajuan Cuti; buka dokumen rani, lampiran terbuka.
- Employee Document: ubah status dokumen rani ke Verified/Rejected di web; rani menerima notifikasi dan status di aplikasi berubah.

## Fase 6: Zona waktu dinas
1. Sebagai rani ajukan Dinas Luar yang mencakup hari ini; dewi setujui.
2. Di web, buka Travel Request itu dan atur field Timezone/Destination ke zona lain (mis. Asia/Makassar) bila belum terisi.
3. Rani buka Absensi: label berubah "WITA" dan lokasi kerja berisi kota tujuan.
4. Clock In: jam yang tercatat memakai zona tujuan (selisih 1 jam dari WIB), tidak mengikuti jam HP.

## Fase 7: Galat dan batas
- Matikan Wi-Fi HP lalu buka layar mana pun: muncul pesan galat dengan tombol "Coba lagi"; nyalakan lagi lalu Coba lagi berhasil.
- Matikan server (`docker compose stop backend`): pesan "Tidak bisa terhubung" bukan layar kosong. Nyalakan kembali.
- Sesi kedaluwarsa: di Profil > Keamanan dari perangkat lain, atau hapus sesi di web; aplikasi kembali ke login.
- Rotasi/keyboard: form panjang tidak tertutup keyboard.

## Fase 8: Tampilan
- Mode gelap dan terang di setiap layar utama.
- Animasi transisi antar halaman dan dialog konfirmasi tidak patah.
- Teks tidak terpotong di EN (lebih panjang di beberapa label).

## Fase 9: Push notification (perlu dev build)
Prasyarat: dev build (`npx expo run:ios` / EAS), `extra.eas.projectId` di app.json, akun Apple Developer untuk iOS fisik, perangkat fisik.
1. Login: izin notifikasi diminta; token terdaftar (cek doctype Push Token di web).
2. Web: Push Settings > Dry Run = 0.
3. Buat notifikasi untuk rani (mis. dewi menyetujui cuti): push tiba di HP saat aplikasi di latar belakang.
4. Keluar dari akun: token terhapus.

## Mencatat hasil
Untuk tiap butir yang gagal kirim ke saya: layar, langkah, yang diharapkan, yang terjadi, dan screenshot. Galat jaringan sertakan pesan di layar.
