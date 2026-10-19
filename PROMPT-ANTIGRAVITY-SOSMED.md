# Prompt untuk Antigravity: Media sosial penuh pada Background Check

Salin seluruh isi di bawah garis ke Antigravity. **Jalankan setelah `PROMPT-ANTIGRAVITY-PERBAIKAN.md` selesai seluruhnya** (terutama Fase 2 bahasa, Fase 3 domain/persetujuan/Test fetch, dan Fase 5 verifikasi). Kerjakan **per fase**; setelah setiap fase agen wajib berhenti dan melapor.

---

## Konteks

Custom app `hris_ats` ada di `docker/apps/hris_ats/`, branch `feat/hris-ats`. Setelah prompt perbaikan, sistem sudah punya: domain media sosial sebagai settingan (`fetch_blocked_domains`), persetujuan kandidat per akun (sumber `Social Media`, `social_consent`), lapisan `bgc/fetch.py` (Scrapling) dengan mode biasa/Browser/stealth, dan tombol "Test fetch". Prompt ini menambah pengambilan **profil dan post media sosial** yang sebenarnya.

Sumber kebenaran: `SPEC-BACKGROUND-CHECK.md`, terutama 2.1, 3.1, 4.1–4.5, 5.1–5.4, dan 6.5 (versi terbaru), serta `SPEC-RESUME-SCREENING.md` bagian 12. Bila prompt dan spesifikasi berbeda di suatu detail, **berhenti dan tanya**. Jangan mengedit berkas `SPEC-*.md`.

Persetujuan kandidat per akun (3.1) sudah mencakup profil dan post publik milik kandidat, dan **berlaku untuk semua jalur di bawah**. Tidak ada jalur yang boleh berjalan tanpanya.

## Hasil "Test fetch"

Sebelum Fase 1, baca hasil "Test fetch" yang dilampirkan di laporan Fase 3 prompt perbaikan (atau minta saya melampirkannya): per platform dan per mode, apa yang terambil dan apakah itu halaman login. Hasil itu menentukan seberapa jauh jalur halaman publik (Fase 1) bisa diandalkan. **Jangan mengasumsikan** sebuah platform bisa diambil; buktikan dengan halaman nyata milik tim.

## Yang boleh dan wajib dibangun

1. Pengambilan profil dan **post publik** dari Instagram, Facebook, TikTok, dan LinkedIn lewat `fetch.py`, dengan mode stealth dan eskalasi otomatis antar mode (Fase 1).
2. **Unggah ekspor data** oleh kandidat sebagai jalur lengkap (Fase 2).
3. **Koneksi OAuth resmi** oleh kandidat, opsional (Fase 3).

## Tetap tidak boleh dibangun (jangan dalam bentuk apa pun, termasuk setting tersembunyi)

Persetujuan kandidat **tidak** mengesahkan hal-hal ini:

1. **Login memakai akun perusahaan atau akun tumbal**, atau menyimpan/meminta **password atau cookie sesi** kandidat atau siapa pun. Ketentuan layanan platform adalah antara platform dan pemilik akun, dan kredensial yang tersimpan adalah risiko keamanan baru. Jalur ekspor (Fase 2) dan OAuth (Fase 3) adalah pengganti yang sah.
2. **`ProxyRotator`** dan rotasi proxy/IP dalam bentuk apa pun. Persetujuan kandidat tidak berkaitan dengan blokir dari situs sumber.
3. Analisis atau tebakan **pandangan politik, sikap terhadap pemerintah, partai**, **kepribadian/psikologis**, agama, suku, kesehatan, atau orientasi seksual dari post. Persetujuan tidak mengesahkan diskriminasi kerja.
4. Membaca, menyimpan, atau menampilkan **DM, kontak, riwayat lokasi, data iklan**, serta **komentar, nama, atau data orang lain** (pihak ketiga) dari halaman, ekspor, maupun API.
5. Mengunduh media (foto/video) dari post. Simpan hanya penanda jenis media.
6. Usia, gender, foto dalam skor atau tampilan; penolakan otomatis; LLM atau model ML.

Aturan bahasa dari prompt perbaikan berlaku: semua string sumber berbahasa Inggris dengan `_()`/`__()`, terjemahan Indonesia di `translations/id.csv`, teks buatan sistem sebagai `*_template` + `*_params`, kosakata isi dokumen tetap dua bahasa. Halaman persetujuan kandidat mengikuti bahasa kandidat.

## Aturan kerja

- Tetap di branch `feat/hris-ats`. **Jangan push**, jangan merge. Commit per fase, gaya `FEAT: ...` / `FIX: ...` berbahasa Indonesia, **tanpa trailer `Co-Authored-By` atau atribusi AI apa pun**.
- Jangan `docker compose down -v`, `bench restore`, atau `drop-site` pada `hris.localhost`. Jangan `eas build`/`eas update`. Jangan mengubah `docker/server-scripts/`, aplikasi mobile, atau data pengguna yang ada.
- Semua test tanpa internet (jaringan dan API di-mock). Fixture HTML dan ekspor **disusun dari akun uji milik tim sendiri atau dibuat fiktif**, dan semua data orang lain disamarkan atau dihapus sebelum disimpan. Jangan pernah membuat fixture dari akun orang lain.
- Jangan menebak struktur halaman atau format ekspor; baca contoh nyata. Format platform sering berubah, jadi parser harus gagal dengan jelas bila struktur tidak dikenali.
- Bila langkah butuh kredensial, akun, client ID, atau layanan berbayar, **berhenti dan tanya**.
- Setiap fase berakhir dengan: semua test lulus, `ruff check` bersih untuk berkas yang diubah, dan laporan.

---

## Fase 1: Post publik lewat crawl, stealth, dan eskalasi otomatis

### 1a. Eskalasi otomatis mode pengambilan
- Tambah di Settings `fetch_auto_escalate` (Check, default 0, `permlevel 1`) sesuai spesifikasi 4.5. Wajib `fetch_risk_acknowledged` bila diaktifkan (validasi sama dengan saklar lain).
- Di `bgc/fetch.py`: bila respons memenuhi kriteria "terhalang" (status 403/429/503 yang khas anti-bot, tantangan anti-bot terdeteksi, atau halaman login terdeteksi dengan fungsi deteksi yang sama dengan Test fetch), dan `fetch_auto_escalate = 1`, coba mode berikutnya dengan urutan `Company` → `Browser` → `stealth`, hanya sampai mode tertinggi yang diizinkan Settings (stealth hanya bila `fetch_stealth_mode = 1` atau domain terdaftar, dan browser terpasang). Berhenti di percobaan pertama yang berhasil.
- Tidak pernah melakukan login dan tidak pernah memakai proxy. Batas laju per domain berlaku untuk setiap percobaan. `fetch_mode_used` mencatat rantai (`company>browser>stealth`). Bila semua mode gagal: `Failed` dengan alasan terstruktur (`login required` atau `blocked`).
- Hormati `fetch_respect_robots` pada setiap percobaan, dan domain di `fetch_blocked_domains` tetap ditolak.
- Test (jaringan di-mock): tiap kombinasi pengaturan menghasilkan rantai yang benar; eskalasi berhenti di mode tertinggi yang diizinkan; tanpa `fetch_auto_escalate` tidak ada eskalasi; halaman login yang berulang tidak menghasilkan percobaan lebih dari jumlah mode.

### 1b. Penjaga persetujuan terpusat
- Buat **satu** fungsi `assert_social_consent(bgc, account)` di `bgc/consent.py` yang memeriksa 3.1 (scope `Social Media` granted, `social_consent = 1`, domain diizinkan) dan dipakai oleh **semua** jalur media sosial (crawl, ekspor, OAuth). Tidak ada jalur yang boleh membuat permintaan jaringan atau menyimpan data akun sebelum fungsi ini lulus.
- Test: tiap jalur dengan scope tidak ada, akun tidak dicentang, dan domain diblokir → nol permintaan jaringan dan nol Finding.

### 1c. Provider media sosial publik
- `bgc/providers/social_public.py` dengan satu adaptor per platform (Instagram, Facebook, TikTok, LinkedIn) di `bgc/providers/social/<platform>.py`. Setiap adaptor: membangun URL profil dari username, mengambil lewat `fetch.py`, mengurai (selektor adaptif Scrapling + data JSON yang tertanam di halaman bila ada) menjadi: nama tampilan, bio, lokasi, dan daftar post publik yang terlihat (teks, tanggal, tautan, jenis media).
- **Pelajari halaman nyata sekali** per platform memakai akun uji milik tim untuk menulis adaptor, dan simpan 2–3 fixture HTML tersamarkan per platform di `tests/fixtures/social/<platform>/`. Adaptor mengisi selektor bawaan ke katalog platform (`display_name_selector`, dst.) sebagai nilai awal yang bisa diubah admin.
- Bila halaman hanya menampilkan login (setelah eskalasi bila aktif): `Failed`, alasan `login required`, dan Source Run menyarankan jalur ekspor (Fase 2). Jangan mengembalikan hasil kosong yang tampak sukses.
- Post disimpan sebagai Finding tipe `Post`: `account`, `snippet` (teks, maks. 500 karakter), `url`, `published_on`, penanda jenis media, `provenance = Crawled`, `match_confidence` dari `identity_match` akun. **Tanpa media, tanpa komentar, tanpa nama orang lain** (hapus mention/tag pihak ketiga dari `snippet` bila terbaca, ganti `@[user]`).
- Hormati `social_max_posts` dan `social_lookback_months`. Telusuri halaman lanjutan (scroll/paginasi) hanya sejauh yang bisa dicapai tanpa login dan masih dalam batas laju.
- Sambungkan ke `runner.py`: sumber `Social Media` memakai provider ini saat `mock_provider = 0`; `mock_provider = 1` memakai mock. Isi `fetch_mode_used`, `accounts_skipped`, `items_found`.
- Analisis: gunakan `analysis/posts.py` yang sudah ada (aktivitas, kesantunan, konten berisiko, relevansi profesional, sentimen leksikon) tanpa menambah jenis analisis baru. Tampilkan hasil di tab "Digital footprint by account" yang sudah ada, dengan filter platform dan badge `provenance`.

**Selesai bila:** semua test baru dan lama lulus; per platform ada laporan jujur: berhasil/gagal dengan mode apa (berdasarkan Test fetch dan uji nyata pada akun uji tim), disertai tangkapan layar tab Post.
**Berhenti dan lapor.**

## Fase 2: Unggah ekspor data oleh kandidat

Ikuti `SPEC-BACKGROUND-CHECK.md` 5.3 persis.

1. **Halaman persetujuan** (`www/ats_consent.html`/`.py`): pada setiap akun media sosial, pilihan "Upload my data export (recommended)" dengan petunjuk singkat per platform dan tautan ke halaman bantuan resminya (verifikasi tautan masih hidup; tulis petunjuk generik, jangan langkah menu yang rinci). Teks dua bahasa dengan terjemahan di `id.csv`. Semua kotak tetap kosong di awal.
2. **Unggah**: ZIP/JSON/CSV/HTML sampai `export_max_mb`, dengan token persetujuan yang sama (sekali pakai, kedaluwarsa). Periksa tipe berkas sebenarnya (bukan hanya ekstensi), tolak arsip dengan jalur berbahaya (zip-slip), batasi ukuran terekstrak dan jumlah berkas (zip-bomb), proses di direktori sementara yang dibersihkan di `finally`. **Arsip asli dihapus segera setelah dibaca.**
3. **Parser** per platform di `bgc/export_parsers/<platform>.py` sebagai fungsi murni tanpa `import frappe`: Instagram, Facebook, TikTok, LinkedIn. Tiap parser memakai **allowlist jalur berkas** yang hanya memuat profil dan postingan milik kandidat. Berkas lain (pesan, kontak, lokasi, iklan, komentar orang lain, dll.) **tidak dibuka**. Keluaran: profil (nama, bio) dan daftar post (teks maks. 500 karakter, tanggal, tautan bila ada, jenis media).
   - Struktur arsip tiap platform: minta tim menyediakan **ekspor nyata dari akun uji tim** untuk menulis parser, simpan versi tersamarkan sebagai fixture. Bila ekspor nyata belum tersedia, **berhenti dan tanya** alih-alih menebak format.
   - Format tidak dikenali → galat jelas dengan nama platform dan versi yang didukung; bukan hasil kosong.
4. **Penyimpanan**: Finding `Post` dengan `provenance = Candidate export`, `text_source = Candidate export`; akun `connection_method = Data export`; hanya setelah `assert_social_consent` lulus. Penarikan persetujuan dan retensi menghapus semuanya.
5. **Hak akses dan tampilan**: sama dengan Finding lain; badge `provenance` di daftar temuan dan Print Format; jumlah post per sumber di tab.
6. Test: tiap parser terhadap fixture (hanya data milik kandidat yang terambil, data pihak ketiga tidak ikut, jalur di luar allowlist tidak pernah dibuka); zip-slip dan zip-bomb ditolak; arsip dihapus setelah baca; unggah tanpa persetujuan akun ditolak; format tak dikenal menghasilkan galat; semua string UI lewat `_()` dengan terjemahan `id`.

**Selesai bila:** unggah ekspor fiktif/akun uji tim di halaman persetujuan (bahasa `id` dan `en`) menghasilkan post di tab Digital footprint dengan badge `Candidate export`; tangkapan layar terlampir.
**Berhenti dan lapor.**

## Fase 3: Koneksi OAuth resmi (opsional)

**Kerjakan hanya bila saya mengonfirmasi punya client ID/secret untuk platform yang dimaksud.** Bila belum, lewati fase ini dan laporkan "dilewati".

1. Kerangka OAuth2 (Authorization Code + PKCE) di `bgc/oauth/`: tombol "Hubungkan akun" per akun di halaman persetujuan, `state` anti-CSRF terikat token persetujuan, redirect URI di bawah `/ats-consent/oauth/<platform>`.
2. Platform: Google/YouTube (`youtube.readonly`), TikTok (Login Kit + Display API: `user.info.basic`, `video.list`), X (OAuth 2.0, bila API berbayarnya aktif), Reddit, GitHub, Mastodon. **Instagram/Facebook/LinkedIn tidak** (akses post terbatas lewat review/mitra); untuk ketiganya tetap jalur ekspor. Baca dokumentasi resmi tiap API terbaru, jangan menebak scope atau endpoint.
3. Client ID dan secret di Settings (`oauth_<platform>_*`, secret bertipe Password), nonaktif sampai diisi. Token **tidak disimpan jangka panjang**: dipakai sekali untuk mengambil post dalam batas `social_max_posts` dan `social_lookback_months`, lalu dibuang dan dicabut bila platform menyediakan endpoint pencabutan.
4. Hasil: Finding `Post` dengan `provenance = OAuth API`; akun `connection_method = OAuth`; hanya setelah `assert_social_consent`. Hanya data milik kandidat; tanpa pihak ketiga.
5. Test dengan API di-mock: alur otorisasi, `state` tidak cocok → ditolak, token dibuang setelah pakai, scope yang diminta minimal, tanpa persetujuan → nol panggilan.

**Berhenti dan lapor.**

## Fase 4: Verifikasi akhir dan audit

1. Semua test (pytest murni + `FrappeTestCase` di site uji `ats-test.localhost`, lalu hapus site itu) lulus. `ruff check` bersih untuk berkas yang diubah.
2. Audit larangan: pindai kode untuk memastikan tidak ada login akun, cookie/password, `ProxyRotator`, analisis politik/psikologis, pembacaan DM/kontak/lokasi/iklan, unduhan media, atau data pihak ketiga yang tersimpan. Tempel hasil pemindaian.
3. Audit persetujuan: tiap jalur (crawl, ekspor, OAuth) diuji tanpa scope, tanpa centang akun, dan setelah penarikan persetujuan → nol permintaan jaringan, nol penyimpanan, dan semua data turunan terhapus.
4. Audit bahasa: tidak ada string Indonesia di sumber; setiap string baru punya baris `id.csv`; tangkapan layar halaman persetujuan, tab media sosial, dan Settings dalam `en` dan `id`.
5. Jalan penuh dengan data fiktif: pelamar → Resume Screening → Background Check → persetujuan kandidat dengan akun media sosial → job berjalan (jalur crawl dan jalur ekspor) → tinjau temuan → kesimpulan HR → Interview.
6. Perbarui `AUDIT.md` dan README app: jalur media sosial, batas yang sengaja tidak dibangun, cara menambah parser baru, dan cara menyegarkan fixture.
7. `git diff main --stat` untuk `docker/server-scripts`, `src`, `App.tsx`, `modules`, `app.json`, `eas.json` kosong.

**Berhenti dan lapor.**

---

## Format laporan setiap fase

1. Ringkasan yang dikerjakan (≤ 10 baris).
2. Daftar file yang dibuat/diubah.
3. Perintah verifikasi beserta hasilnya (tempel keluaran).
4. Penyimpangan dari prompt dan alasannya, atau "tidak ada".
5. Temuan di luar cakupan.
6. Pertanyaan sebelum fase berikutnya.

## Kapan wajib berhenti dan bertanya

- Halaman nyata sebuah platform tidak bisa diambil tanpa login pada mode apa pun. Laporkan, jangan memaksakan.
- Ekspor nyata dari akun uji tim belum tersedia untuk menulis parser.
- Format ekspor atau API sebuah platform berubah dari yang dijelaskan di sini.
- Langkah butuh kredensial, client ID, akun, atau layanan berbayar.
- Kamu tergoda memakai login akun, cookie/password, proxy, atau membaca data di luar allowlist.
- Ada test lama yang gagal dan penyebabnya tidak jelas.
