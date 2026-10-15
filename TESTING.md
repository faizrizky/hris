# Ceklis uji di HP

**Cara mengisi:** centang `[x]` bila lulus. Bila gagal atau aneh, biarkan kosong dan tulis di baris `> Catatan:` tepat di bawahnya (layar, langkah, yang diharapkan, yang terjadi; boleh tambahkan nama file screenshot). Setelah selesai, bilang "sudah dicek" dan saya baca file ini.

Akun uji (password di `docker/.credentials.local`, jangan dibagikan):
rani.test@example.com (karyawan), mss.test@example.com (Dewi, atasan), hr.test@example.com (Sari, HR).

## Fase 0: Persiapan
- [ ] Mac dan HP di Wi-Fi yang sama
  > Catatan:
- [ ] Server hidup: `cd docker && docker compose ps`, lalu `./seed/seed.sh` (terapkan seed terbaru)
  > Catatan:
- [ ] Dari HP, `http://<IP Mac>:8082/api/method/ping` di browser menampilkan `{"message":"pong"}`
  > Catatan:
- [ ] APK terbaru terpasang di HP (bukan Expo Go; push notification tidak jalan tanpa Firebase)
  > Catatan:
- [ ] Alamat server di layar login benar (ketuk tulisan "Server: …" untuk mengubahnya; kosong = bawaan build)
  > Catatan:

## Fase 1: Login dan sesi
- [ ] Login rani: Beranda ESS (tanpa tab Approval)
  > Catatan:
- [ ] Login dewi: ada tab Approval dan Absensi Kry
  > Catatan:
- [ ] Login sari: ada menu Karyawan
  > Catatan:
- [ ] Password salah menampilkan "Email atau password salah"
  > Catatan:
- [ ] Keluar dari Profil lalu masuk lagi
  > Catatan:

## Fase 2: Bahasa
- [ ] Tombol ID/EN di layar login dan Profil mengganti semua teks
  > Catatan:
- [ ] Web ERPNext (login rani) My Settings > Language > English, buka ulang aplikasi: semua berbahasa Inggris; kembalikan ke Indonesia
  > Catatan:
- [ ] Ubah bahasa lewat Profil di aplikasi: setelan Language di web ikut berubah
  > Catatan:
- [ ] Tanggal, nama hari/bulan, "WIB", dan format angka benar di tiap bahasa
  > Catatan:

## Fase 3: Karyawan (rani)
- [ ] Beranda: statistik terisi, kartu Employment tidak tampil untuk ESS, Aksi Cepat membuka layar yang benar
  > Catatan:
- [ ] Cuti: saldo tampil; ajukan Tahunan dan Sakit; tanggal bentrok memunculkan pesan bentrok; delegasi dipilih; hasil muncul di Pengajuan saya dengan approver Dewi
  > Catatan:
- [ ] Lembur: hari kerja (mulai 17:00, maks 4 jam) dan hari libur (mulai 08:00, maks 8 jam); lampirkan bukti; file >5 MB ditolak; kirim
  > Catatan:
- [ ] Dinas luar: kota, transportasi, keperluan, 2 baris biaya dengan bukti; total dan uang harian benar; lampiran muncul di daftar
  > Catatan:
- [ ] Absensi: Clock In dan Clock Out; jam sesuai server (ubah jam HP 1 jam, jam tercatat tetap jam server); label zona "WIB"
  > Catatan:
- [ ] Riwayat Absensi; Koreksi absensi dengan bukti; Riwayat Koreksi menampilkan lampiran
  > Catatan:
- [ ] Slip gaji: daftar, rincian, PPh21 dan BPJS
  > Catatan:
- [ ] Appraisal: skor, dua penilai, goal
  > Catatan:
- [ ] Dokumen Digital: unggah PDF dan JPG (status Menunggu); .txt dan >5 MB ditolak
  > Catatan:
- [ ] Profil: Ubah Data (email salah ditolak), kontak darurat kedua, Ubah Password (syarat, salah password lama), Keamanan (perangkat aktif, keluar dari perangkat lain)
  > Catatan:
- [ ] Notifikasi: daftar, tandai dibaca, kategori dan terjemahan benar, titik merah lonceng hilang setelah dibaca semua
  > Catatan:

## Fase 3b: Fitur lanjutan (rani, dewi, sari)
- [ ] Cuti khusus: Melahirkan hanya untuk perempuan, istri melahirkan hanya laki-laki; Izin Penting (Menikah, Khitanan, dll.) bisa dipilih
  > Catatan:
- [ ] Sakit lebih dari 1 hari wajib surat dokter; bukti cuti terlampir dan terbuka di kartu approval
  > Catatan:
- [ ] Geofence (izin lokasi): di luar radius Clock In ditolak; Clock Out boleh di mana saja
  > Catatan:
- [ ] Geofence: lokasi palsu terdeteksi; akurasi GPS buruk ditolak
  > Catatan:
- [ ] WFH: rani ajukan (rentang tanggal, hari per minggu, alasan); tumpang tindih ditolak
  > Catatan:
- [ ] WFH: sebelum disetujui, Clock In di luar radius tetap ditolak; setelah dewi menyetujui, lolos pada hari WFH; rani menerima notifikasi
  > Catatan:
- [ ] Check-in offline: matikan data, Clock In masuk antrean; nyalakan, antrean terkirim
  > Catatan:
- [ ] Check-in offline: mundurkan jam HP, jam tercatat tetap dari jam tepercaya dan ditandai Perlu Ditinjau; atasan/HR meninjau di Peninjauan Check-in
  > Catatan:
- [ ] Pengumuman HR tampil dan notifikasinya terbuka
  > Catatan:
- [ ] Permintaan ubah data (status pernikahan, anak) masuk ke HR untuk disetujui
  > Catatan:

## Fase 3c: Foto profil dan verifikasi wajah (rani, sari, dewi)
Syarat: KTP rani berstatus Verified (Profil > Dokumen; di web ubah status Employee Document KTP). Foto KTP dan foto profil harus berisi wajah yang jelas.

- [ ] Foto profil: Profil > Data Pribadi > Ubah foto; panduan tiga slide (Lanjut/Lewati), lalu Buka kamera atau galeri
  > Catatan:
- [ ] Foto HEIC dari iPhone tetap terproses (dipilih dari galeri)
  > Catatan:
- [ ] Tinjau foto lalu Ajukan ke HR berhasil (tanpa pesan "server problem")
  > Catatan:
- [ ] HR (sari) di web: Profile Change Request berisi foto dan skor kemiripan; setujui
  > Catatan:
- [ ] Foto muncul sebagai hero di halaman Profil rani dengan animasi memudar
  > Catatan:
- [ ] Sebelum KTP terverifikasi atau foto profil ada: Keamanan > kartu pendaftaran wajah menampilkan pesan apa yang kurang dengan tombol ke Dokumen/Foto profil
  > Catatan:
- [ ] Pendaftaran wajah: putar kepala pelan sampai garis lingkaran hijau semua; hasilnya berstatus Menunggu HR
  > Catatan: (tulis juga: garis menyala mulus atau patah-patah? lingkaran bisa penuh?)
- [ ] HR (sari) di web: Face Enrollment menampilkan selfie, KTP, foto profil berdampingan dengan tiga persentase dan peringatan merah di bawah ambang
  > Catatan: (tulis angkanya: wajah-KTP ___ %, wajah-profil ___ %, profil-KTP ___ %)
- [ ] HR menyetujui; rani menerima notifikasi dan kartu Keamanan berstatus Aktif
  > Catatan:
- [ ] Absen: Clock In/Out menampilkan kamera depan dan tantangan acak (kedip atau toleh)
  > Catatan:
- [ ] Wajah rani sendiri lolos
  > Catatan:
- [ ] Foto wajah rani di HP lain gagal
  > Catatan:
- [ ] Orang lain di depan kamera ditandai Perlu Ditinjau di Peninjauan Check-in
  > Catatan:
- [ ] Ganti foto profil dengan foto orang lain dan HR menyetujui: kartu Keamanan berstatus Perlu daftar ulang, modal pengingat muncul saat buka aplikasi, absen tetap jalan selama tenggang 3 hari
  > Catatan:
- [ ] Keyboard di Android tidak menutupi field (form cuti, ubah data, alasan tolak)
  > Catatan:

## Fase 4: Atasan (dewi)
- [ ] Inbox Approval memuat cuti, lembur, dinas luar, koreksi dari rani
  > Catatan:
- [ ] Ketuk nama lampiran: terunduh dan terbuka di lembar berbagi/pratinjau
  > Catatan:
- [ ] Setujui satu, tolak satu, "Setujui semua"; status berubah dan rani menerima notifikasi
  > Catatan:
- [ ] Cuti disetujui: saldo rani berkurang
  > Catatan:
- [ ] Karyawan: hanya bawahan langsung; Absensi Kry tab Hadir/Telat/Cuti/Belum; Detail dan Riwayat staf menampilkan absensi karyawan itu
  > Catatan:

## Fase 5: HR (sari) dan web
- [ ] Karyawan: semua karyawan; Beranda menampilkan ringkasan
  > Catatan:
- [ ] Web ERPNext (login hr): sidebar Leaves > Overtime Request / Travel Request di bawah Pengajuan Cuti; buka dokumen rani, lampiran terbuka
  > Catatan:
- [ ] Ubah status dokumen rani ke Verified/Rejected di web; rani menerima notifikasi dan status di aplikasi berubah
  > Catatan:

## Fase 6: Zona waktu dinas
- [ ] Rani ajukan Dinas Luar yang mencakup hari ini; dewi setujui
  > Catatan:
- [ ] Di web, atur Timezone/Destination Travel Request ke zona lain (mis. Asia/Makassar) bila belum terisi
  > Catatan:
- [ ] Rani buka Absensi: label berubah "WITA", lokasi kerja berisi kota tujuan
  > Catatan:
- [ ] Clock In memakai zona tujuan (selisih 1 jam dari WIB), tidak mengikuti jam HP
  > Catatan:

## Fase 7: Galat dan batas
- [ ] Matikan Wi-Fi HP lalu buka layar mana pun: muncul galat dengan tombol "Coba lagi"; nyalakan lagi, Coba lagi berhasil
  > Catatan:
- [ ] Matikan server (`docker compose stop backend`): pesan "Tidak bisa terhubung", bukan layar kosong; nyalakan kembali
  > Catatan:
- [ ] Sesi kedaluwarsa (hapus sesi di web atau keluar dari perangkat lain): aplikasi kembali ke login
  > Catatan:

## Fase 8: Tampilan
- [ ] Mode gelap dan terang di setiap layar utama
  > Catatan:
- [ ] Animasi transisi antar halaman dan dialog konfirmasi tidak patah
  > Catatan:
- [ ] Teks tidak terpotong di EN
  > Catatan:

## Fase 9: Push notification (butuh Firebase, belum aktif)
Prasyarat: Firebase dan `google-services.json`, `extra.eas.projectId` di app.json (sudah ada), perangkat fisik. Lewati fase ini sampai Firebase siap.

- [ ] Login: izin notifikasi diminta; token terdaftar (doctype Push Token di web)
  > Catatan:
- [ ] Web: Push Settings > Dry Run = 0
  > Catatan:
- [ ] Notifikasi untuk rani (mis. dewi menyetujui cuti): push tiba saat aplikasi di latar belakang
  > Catatan:
- [ ] Keluar dari akun: token terhapus
  > Catatan:
