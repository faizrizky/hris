# Prompt untuk Antigravity: Media sosial penuh pada Background Check

Salin seluruh isi di bawah garis ke Antigravity (chat baru). **Jalankan setelah `PROMPT-ANTIGRAVITY-PERBAIKAN.md` selesai seluruhnya.** Kerjakan **per fase**; setelah setiap fase agen wajib berhenti dan melapor.

---

## Konteks

Custom app `hris_ats` ada di `docker/apps/hris_ats/`, branch `feat/hris-ats`. Baca `docker/apps/hris_ats/AUDIT.md` dulu untuk kondisi terakhir. Sistem sudah punya: domain media sosial sebagai settingan (`fetch_blocked_domains`, daftar kosong dihormati), persetujuan kandidat per akun (sumber `Social Media`, `social_consent`), lapisan `bgc/fetch.py` (Scrapling) dengan mode biasa/Browser/stealth, tombol "Test Fetch", browser untuk mode stealth sudah terpasang di container dev, dan nilai Select serta string UI sudah berbahasa Inggris dengan terjemahan Indonesia di `id.csv`.

**Perbaikan setelah uji Fase 2** ada di `PROMPT-ANTIGRAVITY-PERBAIKAN-FASE2.md` dan dikerjakan sebelum Fase 3 (deteksi login, mode Session di Test Fetch, default Settings, antrean browser khusus, latensi dialog).

Prompt ini menambah:
1. Settings dirapikan menjadi **tab**.
2. **Akun crawler per platform** (Instagram, Facebook, TikTok, LinkedIn) dengan **login interaktif lewat pop-up** dan persetujuan di ERPNext.
3. Pengambilan **profil dan post** media sosial yang sebenarnya, dengan eskalasi mode dan sesi akun crawler.
4. **Ekspor data kandidat** (post dan **komentar milik kandidat**).
5. **OAuth resmi** (opsional).

Sumber kebenaran: `SPEC-BACKGROUND-CHECK.md` (bagian 2.1, 3, 3.1, 4.1–4.6, 5.1–5.5, 6.5, 8, 12) dan `SPEC-RESUME-SCREENING.md` bagian 12. Bila prompt dan spesifikasi berbeda di suatu detail, **berhenti dan tanya**. **Jangan mengedit, mengembalikan, atau menghapus** berkas `SPEC-*.md`, `PROMPT-*.md`, dan `BACKLOG-*.md`.

Persetujuan kandidat per akun (3.1) berlaku untuk **semua jalur** di bawah. Tidak ada jalur yang boleh berjalan tanpanya.

## Hasil "Test Fetch"

Sebelum Fase 3, baca hasil "Test Fetch" per platform dan per mode yang saya lampirkan di pesan pertama (apa yang terambil, dan apakah itu halaman login). Hasil itu menentukan seberapa jauh jalur halaman publik bisa diandalkan dan seberapa sering akun crawler diperlukan. **Jangan mengasumsikan** sebuah platform bisa diambil; buktikan dengan halaman nyata milik tim.

## Yang boleh dan wajib dibangun

1. Tab pada Background Check Settings (Fase 1).
2. Akun crawler per platform dengan login interaktif (Fase 2).
3. Crawl profil dan post, dengan eskalasi otomatis dan sesi akun crawler (Fase 3).
4. Ekspor data kandidat: post dan komentar milik kandidat (Fase 4).
5. OAuth resmi, opsional (Fase 5).

## Tetap tidak boleh dibangun (jangan dalam bentuk apa pun, termasuk setting tersembunyi)

Persetujuan kandidat dan persetujuan di ERPNext **tidak** mengesahkan hal-hal ini:

1. **Akun palsu atau massal, akun yang dibeli, atau akun pribadi karyawan** untuk crawling. Akun crawler harus akun asli milik perusahaan yang dibuat manual oleh manusia.
2. **Menyimpan atau meminta password**, serta otomatisasi pengisian username dan password. Login hanya dilakukan **manusia** di pop-up (Fase 2); sistem hanya menyimpan sesi hasilnya.
3. **Penembusan 2FA, CAPTCHA, atau halaman checkpoint** platform. Bila muncul saat login, manusia yang menyelesaikannya. Saat crawling, sistem berhenti dan melapor.
4. **Aksi tulis** dari akun crawler: mengikuti akun, like, komentar, DM, permintaan pertemanan, atau aksi apa pun selain membuka halaman untuk dibaca. Profil privat tidak dijangkau.
5. **`ProxyRotator`** dan rotasi proxy/IP dalam bentuk apa pun.
6. Analisis atau tebakan **pandangan politik, sikap terhadap pemerintah, partai**, **kepribadian/psikologis**, agama, suku, kesehatan, atau orientasi seksual dari post atau komentar. Persetujuan tidak mengesahkan diskriminasi kerja.
7. **Like, reaksi, dan riwayat interaksi**: tidak diambil, tidak disimpan, tidak dianalisis.
8. Membaca, menyimpan, atau menampilkan **DM, kontak, riwayat lokasi, data iklan, daftar pengikut**, serta **komentar, nama, atau data orang lain** (pihak ketiga).
9. Mengunduh media (foto/video). Simpan hanya penanda jenis media.
10. Usia, gender, foto dalam skor atau tampilan; penolakan otomatis; LLM atau model ML.

Aturan bahasa dari prompt perbaikan berlaku: semua string sumber berbahasa Inggris dengan `_()`/`__()`, terjemahan Indonesia di `translations/id.csv`, teks buatan sistem sebagai `*_template` + `*_params`, kosakata isi dokumen tetap dua bahasa. Halaman persetujuan kandidat mengikuti bahasa kandidat.

## Aturan kerja

- Tetap di branch `feat/hris-ats`. **Jangan push**, jangan merge. Commit per fase, gaya `FEAT: ...` / `FIX: ...` berbahasa Indonesia, **tanpa trailer `Co-Authored-By` atau atribusi AI apa pun**. Commit hanya berkas yang kamu ubah sendiri (jangan `git add -A`).
- **Jangan menjalankan `git checkout`, `git restore`, `git stash`, `git reset`, atau `git clean` pada berkas yang bukan buatanmu.** Berkas milik pengguna bisa hilang. Bila perlu membatalkan perubahanmu sendiri, lakukan per berkas dan hanya untuk berkas yang kamu ubah.
- Jangan `docker compose down -v`, `bench restore`, atau `drop-site` pada `hris.localhost`. Jangan `eas build`/`eas update`. Jangan mengubah `docker/server-scripts/`, aplikasi mobile, atau data pengguna yang ada.
- Test Frappe hanya di site `ats-test.localhost` (buat, jalankan, hapus; kunci enkripsi acak, jangan salin dari site mana pun). Semua test tanpa internet (jaringan dan API di-mock). **Tidak ada test yang login ke platform sungguhan.**
- Fixture HTML dan ekspor **disusun dari akun uji milik tim atau dibuat fiktif**, dan semua data orang lain disamarkan atau dihapus sebelum disimpan.
- Jangan menebak struktur halaman, format ekspor, atau API (Scrapling, Patchright/Playwright, Frappe); baca source atau dokumentasi yang terpasang.
- **Jangan pernah meminta, menerima, atau mengetik password atau cookie akun.** Bila uji manual butuh login, berhenti dan minta saya melakukannya sendiri di pop-up.
- Bila langkah butuh kredensial, akun, client ID, atau layanan berbayar, **berhenti dan tanya**.
- Setiap fase berakhir dengan: semua test lulus, `ruff check` bersih untuk berkas yang diubah, dan laporan.

---

## Fase 1: Rapikan Background Check Settings menjadi tab

Tanpa perubahan perilaku. Hanya tata letak form (`background_check_settings.json` dan `.js`) sesuai `SPEC-BACKGROUND-CHECK.md` 4.5.

1. Gunakan **Tab Break** Frappe. Tab: **General**, **Providers**, **Page Fetching**, **Social Accounts** (kosong dulu, diisi Fase 2), **Consent**.
2. Pindahkan field ke tab sesuai spesifikasi 4.5. Beri tiap bagian (Section Break) judul dan keterangan singkat; kelompokkan field yang berkaitan dalam kolom; bagian lanjutan bisa dilipat (`collapsible`). Tombol **Test Fetch** tampil di tab Page Fetching.
3. Pertahankan semua `permlevel`, validasi, default, dan nilai tersimpan. Tab **Page Fetching** dan **Social Accounts** hanya bisa diubah System Manager; HR Manager hanya melihat.
4. Semua label, judul tab, dan keterangan baru dalam Bahasa Inggris dengan terjemahan `id.csv` dan terkover `test_i18n.py`.
5. Pastikan form tidak menumpuk di satu halaman: tangkapan layar tiap tab dalam bahasa `en` dan `id` sebagai bukti.

**Selesai bila:** semua test lulus, validasi Settings tidak berubah (test lama lulus tanpa diubah selain tata letak), dan tangkapan layar terlampir.
**Berhenti dan lapor.**

## Fase 2: Akun crawler per platform dan login interaktif

Ikuti `SPEC-BACKGROUND-CHECK.md` 4.6 dan 5.5 persis.

### 2a. Doctype dan tab Social Accounts
- Buat doctype `Background Check Crawler Account` (4.6): hanya **System Manager** yang bisa membaca dan menulis; satu akun aktif per platform (validasi); field `session` bertipe Password, tersembunyi, tidak masuk API/list/print.
- Tambah di `Background Check Platform`: `login_url` dan `session_domains`; isi awal untuk Instagram, Facebook, TikTok, dan LinkedIn (verifikasi URL login dan domain cookie yang benar dari halaman nyata, jangan menebak).
- Tab **Social Accounts** di Settings: saklar `fetch_use_login_session` (default 0, `permlevel 1`, wajib `fetch_risk_acknowledged`), dan daftar akun crawler (HTML field) yang menampilkan platform, label, handle, status (Connected/Expired/Challenge/Not connected/Disabled), terakhir login, terakhir dipakai, kedaluwarsa sesi, dan tombol per baris: **Login**, **Test session**, **Disconnect**, serta tombol tambah akun.
- **Persetujuan di ERPNext per akun**: `risk_acknowledged` (menyimpan `risk_ack_by/on`) wajib dicentang sebelum akun bisa dipakai dan sebelum tombol Login aktif. Keterangan di sampingnya memuat tiga poin risiko di spesifikasi 5.1 (ketentuan layanan dan UU ITE Pasal 30 ayat (3); akun bisa dibatasi/diblokir; sebaiknya disetujui Legal). `legal_reference` opsional.

### 2b. Tombol Login: pop-up browser jarak jauh
- Tombol Login membuka dialog berisi **browser sungguhan di server** (headless Chromium via Patchright/Playwright; cek mana yang dipakai Scrapling 0.5 dan konsisten dengan itu) yang membuka `login_url` platform. Layar dikirim ke dialog sebagai gambar yang diperbarui berkala (± 1 fps, lewat polling `whitelist` atau `frappe.realtime`), dan klik, ketikan, tombol khusus, serta scroll pengguna diteruskan ke browser itu. Ukuran viewport tetap.
- Browser dijalankan sebagai proses latar (antrean `long`) yang dikelola per sesi login: ID sesi acak terikat ke pengguna, perintah dan frame lewat Redis dengan TTL pendek, satu sesi login sekaligus, batas waktu **10 menit**, dan dibersihkan di `finally` (tutup browser, hapus direktori profil) termasuk bila dialog ditutup.
- **Manusia yang mengisi username, password, 2FA, CAPTCHA, dan checkpoint.** Kode tidak boleh menyimpan, mencatat, atau menangkap isi ketikan; tidak menyimpan tangkapan layar; tidak mencoba melewati tantangan apa pun. Navigasi di browser dibatasi ke domain milik platform itu (`session_domains` dan domain login-nya), supaya dialog tidak bisa dipakai membuka situs lain.
- Tombol **Selesai**: server memverifikasi sesi (membuka halaman beranda atau profil akun itu dan mencari penanda sudah login, dengan fungsi deteksi login yang sama dengan Test Fetch), mengambil `storage_state`, menyaringnya hanya ke `session_domains`, mengenkripsi ke field `session`, mengisi `status = Connected`, `connected_by/on`, `session_expires_on`, lalu menutup browser dan menghapus profilnya.
- **Cadangan**: bila platform menolak login dari browser server, sediakan impor manual (System Manager menempelkan cookie yang diekspor dari browser pribadinya ke dialog yang sama) dengan hasil akhir yang sama. Laporkan jujur bila jalur utama gagal pada platform tertentu; **jangan mencoba menyiasati deteksi platform** di luar mode stealth yang sudah ada di Settings.
- Catatan keamanan di dokumentasi: ketikan melewati server kita, jadi di produksi dialog ini hanya boleh dipakai lewat **HTTPS**.

### 2c. Test session, Disconnect, dan status
- **Test session**: membuka halaman beranda akun itu dan menampilkan hanya nama akun dan status; memperbarui `status`, `last_checked_on`, dan `last_error_*`.
- **Disconnect**: menghapus `session`, `status = Not connected`. Menonaktifkan akun atau mematikan `fetch_use_login_session` menghentikan pemakaian seketika.
- Sesi tidak pernah muncul di log, cache Redis, Finding, Source Run, respons API, atau tampilan selain System Manager. Penggunaan tercatat (waktu, platform, kandidat, hasil) tanpa isi sesi. Semua pesan galat dan status memakai `*_template` + `*_params`.

### 2d. Test (tanpa platform sungguhan)
- Hak akses: HR Manager, Background Check Officer, dan peran lain tidak bisa membaca atau menulis Crawler Account; `session` tidak ada di respons API dan tidak bisa dibaca lewat `frappe.get_doc(...).as_dict()` biasa oleh non-admin.
- Tombol Login ditolak tanpa `fetch_risk_acknowledged` dan `risk_acknowledged`; ditolak untuk non-System Manager; ditolak saat browser belum terpasang dengan pesan jelas.
- Manajer sesi login (dengan browser di-mock): satu sesi sekaligus, batas waktu, pembersihan di `finally`, navigasi di luar domain ditolak, tidak ada ketikan atau tangkapan layar yang tertulis ke log atau disk.
- `storage_state` disaring ke `session_domains` dan tersimpan terenkripsi; Disconnect menghapusnya.
- Satu akun aktif per platform.

**Selesai bila:** semua test lulus, tab Social Accounts tampil rapi dalam `en` dan `id` (tangkapan layar), dan alur dialog Login sudah berjalan sampai membuka halaman login platform di browser server (tangkapan layar halaman login yang tampil di dialog; **jangan login**). Untuk login sungguhan, berhenti dan minta saya yang melakukannya di pop-up, lalu laporkan hasilnya dari sisi sistem (status Connected, kedaluwarsa sesi) tanpa menampilkan isi sesi.
**Berhenti dan lapor.**

## Fase 3: Crawl media sosial: eskalasi, penjaga persetujuan, sesi, dan post

### 3a. Eskalasi otomatis mode pengambilan
- Tambah di Settings `fetch_auto_escalate` (Check, default 0, `permlevel 1`, tab Page Fetching) sesuai spesifikasi 4.5. Wajib `fetch_risk_acknowledged` bila diaktifkan.
- Di `bgc/fetch.py`: bila respons memenuhi kriteria "terhalang" (403/429/503 yang khas anti-bot, tantangan anti-bot terdeteksi, atau halaman login terdeteksi dengan fungsi yang sama dengan Test Fetch) dan `fetch_auto_escalate = 1`, coba mode berikutnya dengan urutan `Company` → `Browser` → `stealth` → `session`, hanya sampai mode tertinggi yang diizinkan Settings (stealth hanya bila `fetch_stealth_mode = 1` atau domain terdaftar, dan browser terpasang; `session` hanya bila `fetch_use_login_session = 1` dan ada akun crawler `Connected`, dan selalu langkah terakhir). Berhenti di percobaan pertama yang berhasil. Hasil uji pengguna: Instagram sudah mengembalikan data profil publik pada mode Browser tanpa login, jadi sesi hanya dipakai bila mode tanpa sesi terhalang atau mendarat di halaman login.
- Tidak pernah memakai proxy. Batas laju per domain berlaku untuk setiap percobaan. `fetch_mode_used` mencatat rantai (`company>browser>stealth`). Bila semua mode gagal: `Failed` dengan alasan terstruktur (`login required` atau `blocked`).
- Hormati `fetch_respect_robots` pada setiap percobaan, dan domain di `fetch_blocked_domains` tetap ditolak.
- Test (jaringan di-mock): tiap kombinasi menghasilkan rantai yang benar; berhenti di mode tertinggi yang diizinkan; tanpa `fetch_auto_escalate` tidak ada eskalasi; halaman login berulang tidak menghasilkan percobaan lebih banyak dari jumlah mode.

### 3b. Penjaga persetujuan terpusat
- Buat **satu** fungsi `assert_social_consent(bgc, account)` di `bgc/consent.py` yang memeriksa 3.1 (scope `Social Media` granted, `social_consent = 1`, domain diizinkan) dan dipakai oleh **semua** jalur (crawl publik, sesi akun crawler, ekspor, OAuth). Tidak ada jalur yang boleh membuat permintaan jaringan atau menyimpan data akun sebelum fungsi ini lulus.
- Test: tiap jalur dengan scope tidak ada, akun tidak dicentang, dan domain diblokir → nol permintaan jaringan dan nol Finding.

### 3c. Sesi akun crawler pada `fetch.py`
- Bila `fetch_use_login_session = 1`, platform punya akun crawler `Connected` dan `enabled` dengan `risk_acknowledged = 1`, dan `assert_social_consent` lulus, halaman platform dibuka dengan `storage_state` akun itu (muat ke `StealthySession`/`FetcherSession`; cek API Scrapling 0.5). Selain itu tidak ada sesi yang dipakai.
- **Pelan dan manusiawi**: `hourly_limit`, `daily_limit`, jeda `min_delay_seconds` + acak `jitter_seconds`, satu permintaan pada satu waktu per akun (kunci Redis). Hitung per akun, bukan per kandidat.
- **Hanya membaca**: hanya membuka URL profil kandidat yang sudah setuju. Tidak ada pencarian, tidak ada klik tombol aksi. Profil privat dilaporkan sebagai `Failed` (`private profile`), tanpa mengirim permintaan mengikuti.
- **Berhenti saat dihalangi**: checkpoint, tantangan, penguncian, atau sesi kedaluwarsa → akun `status = Challenge` atau `Expired`, sumber `Failed` dengan alasan terstruktur dan petunjuk "gunakan jalur ekspor", notifikasi ke System Manager (Notification Log), tanpa percobaan ulang otomatis.
- Respons dari sesi login tidak boleh bercampur dengan cache respons tanpa sesi (kunci cache memuat mode sesi), dan sesi tidak pernah ikut tertulis ke cache, log, atau Finding. Source Run mencatat `crawler_account` (label) dan `provenance = Crawled (session)`.
- Test (jaringan di-mock): sesi hanya dipakai bila semua syarat terpenuhi; batas jam dan hari ditegakkan; checkpoint menghentikan dan mengubah status; sesi tidak muncul di log atau cache; profil privat tidak memicu permintaan tambahan.

### 3d. Provider media sosial per platform
- `bgc/providers/social_public.py` dengan satu adaptor per platform (Instagram, Facebook, TikTok, LinkedIn) di `bgc/providers/social/<platform>.py`. Setiap adaptor membangun URL profil dari username, mengambil lewat `fetch.py` (dengan atau tanpa sesi sesuai 3c), dan mengurai (selektor adaptif Scrapling + data JSON yang tertanam di halaman bila ada) menjadi nama tampilan, bio, lokasi, dan daftar post yang terlihat (teks, tanggal, tautan, jenis media).
- **Pelajari halaman nyata sekali** per platform memakai akun uji milik tim untuk menulis adaptor, dan simpan 2–3 fixture HTML tersamarkan per platform di `tests/fixtures/social/<platform>/`. Selektor bawaan diisi ke katalog platform (`display_name_selector`, dst.) sebagai nilai awal yang bisa diubah admin. Bila sesi login dibutuhkan untuk melihat halaman nyata, minta saya yang mengambil contoh halamannya; jangan login sendiri.
- Halaman login yang tetap muncul → `Failed`, alasan `login required`, petunjuk jalur ekspor. Jangan mengembalikan hasil kosong yang tampak sukses.
- Post disimpan sebagai Finding `Post`: `account`, `snippet` (maks. 500 karakter), `url`, `published_on`, penanda jenis media, `provenance = Crawled` atau `Crawled (session)`, `match_confidence` dari `identity_match` akun. **Tanpa media, tanpa komentar orang lain, tanpa nama orang lain** (ganti mention/tag pihak ketiga dengan `@[user]`).
- Hormati `social_max_posts` dan `social_lookback_months`; telusuri halaman lanjutan hanya sejauh batas laju dan sesi mengizinkan.
- Sambungkan ke `runner.py`: sumber `Social Media` memakai provider ini saat `mock_provider = 0`. Isi `fetch_mode_used`, `accounts_skipped`, `items_found`, `crawler_account`.
- Analisis: pakai `analysis/posts.py` yang ada (aktivitas, kesantunan, konten berisiko, relevansi profesional, sentimen leksikon) tanpa jenis analisis baru. Tampilkan di tab "Digital footprint by account" dengan filter platform dan badge `provenance`.

**Selesai bila:** semua test baru dan lama lulus; laporan jujur per platform: berhasil/gagal dengan mode apa dan dengan atau tanpa sesi (berdasarkan Test Fetch dan uji nyata yang saya bantu), **termasuk perbandingan data yang terlihat tanpa sesi vs dengan sesi** (nama, bio, jumlah pengikut, jumlah post), disertai tangkapan layar tab Post.
**Berhenti dan lapor.**

## Fase 4: Ekspor data kandidat: post dan komentar milik kandidat

Ikuti `SPEC-BACKGROUND-CHECK.md` 5.3 persis.

1. **Halaman persetujuan** (`www/ats_consent.html`/`.py`): pada setiap akun media sosial, pilihan "Upload my data export (recommended)" dengan petunjuk singkat per platform dan tautan ke halaman bantuan resminya (verifikasi tautan masih hidup; tulis petunjuk generik, bukan langkah menu rinci). Teks dua bahasa dengan terjemahan `id.csv`. Semua kotak tetap kosong di awal.
2. **Unggah**: ZIP/JSON/CSV/HTML sampai `export_max_mb`, dengan token persetujuan yang sama (sekali pakai, kedaluwarsa). Periksa tipe berkas sebenarnya, tolak arsip berjalur berbahaya (zip-slip), batasi ukuran terekstrak dan jumlah berkas (zip-bomb), proses di direktori sementara yang dibersihkan di `finally`. **Arsip asli dihapus segera setelah dibaca.**
3. **Parser** per platform di `bgc/export_parsers/<platform>.py` sebagai fungsi murni tanpa `import frappe`: Instagram, Facebook, TikTok, LinkedIn. Tiap parser memakai **allowlist jalur berkas** yang hanya memuat profil, postingan, dan **komentar yang ditulis kandidat sendiri**. Berkas lain (pesan, kontak, lokasi, iklan, like/reaksi, komentar orang lain, dll.) **tidak dibuka**.
   - Keluaran post: teks (maks. 500 karakter), tanggal, tautan bila ada, jenis media.
   - Keluaran komentar: **hanya teks komentar kandidat** (maks. 500 karakter), tanggal, dan tautan ke post bila ada. Isi post yang dikomentari dan nama pihak ketiga tidak disimpan; mention diganti `@[user]`.
   - Struktur arsip tiap platform: minta tim menyediakan **ekspor nyata dari akun uji tim** untuk menulis parser, simpan versi tersamarkan sebagai fixture. Bila ekspor nyata belum tersedia, **berhenti dan tanya**.
   - Format tidak dikenali → galat jelas dengan nama platform dan versi yang didukung; bukan hasil kosong.
4. **Penyimpanan**: Finding `Post` atau `Comment` (tambah nilai `Comment` pada `finding_type`, dengan patch migrasi idempoten dan terjemahan) dengan `provenance = Candidate export`, `text_source = Candidate export`; akun `connection_method = Data export`; hanya setelah `assert_social_consent` lulus. Penarikan persetujuan dan retensi menghapus semuanya.
5. **Analisis dan tampilan**: komentar ikut dalam analisis aktivitas, kesantunan, dan konten berisiko yang sama dengan post (tanpa jenis analisis baru). Tab "Digital footprint by account" punya sub-tab **Post** dan **Comment**, filter platform, badge `provenance`, dan hitungan per sumber; Print Format memuat komentar yang ditandai `Relevant`.
6. Test: tiap parser terhadap fixture (hanya data milik kandidat yang terambil, data pihak ketiga tidak ikut, jalur di luar allowlist tidak pernah dibuka, like/reaksi tidak dibaca); zip-slip dan zip-bomb ditolak; arsip dihapus setelah baca; unggah tanpa persetujuan akun ditolak; format tak dikenal menghasilkan galat; komentar menaikkan penanda risiko sesuai leksikon; semua string UI lewat `_()` dengan terjemahan `id`.

**Selesai bila:** unggah ekspor fiktif/akun uji tim di halaman persetujuan (bahasa `id` dan `en`) menghasilkan post dan komentar di tab Digital footprint dengan badge `Candidate export`; tangkapan layar terlampir.
**Berhenti dan lapor.**

## Fase 5: Koneksi OAuth resmi (opsional)

**Kerjakan hanya bila saya mengonfirmasi punya client ID/secret untuk platform yang dimaksud.** Bila belum, lewati fase ini dan laporkan "dilewati".

1. Kerangka OAuth2 (Authorization Code + PKCE) di `bgc/oauth/`: tombol "Hubungkan akun" per akun di halaman persetujuan, `state` anti-CSRF terikat token persetujuan, redirect URI di bawah `/ats-consent/oauth/<platform>`.
2. Platform: Google/YouTube (`youtube.readonly`), TikTok (Login Kit + Display API: `user.info.basic`, `video.list`), X (OAuth 2.0, bila API berbayarnya aktif), Reddit, GitHub, Mastodon. **Instagram, Facebook, dan LinkedIn tidak** (akses post terbatas lewat review/mitra); untuk ketiganya tetap jalur ekspor dan sesi akun crawler. Baca dokumentasi resmi tiap API terbaru, jangan menebak scope atau endpoint.
3. Client ID dan secret di Settings tab **Providers** (`oauth_<platform>_*`, secret bertipe Password), nonaktif sampai diisi. Token **tidak disimpan jangka panjang**: dipakai sekali untuk mengambil data dalam batas `social_max_posts` dan `social_lookback_months`, lalu dibuang dan dicabut bila platform menyediakan endpoint pencabutan.
4. Hasil: Finding `Post` (dan `Comment` bila API menyediakan komentar milik pengguna) dengan `provenance = OAuth API`; akun `connection_method = OAuth`; hanya setelah `assert_social_consent`. Hanya data milik kandidat; tanpa pihak ketiga.
5. Test dengan API di-mock: alur otorisasi, `state` tidak cocok → ditolak, token dibuang setelah pakai, scope yang diminta minimal, tanpa persetujuan → nol panggilan.

**Berhenti dan lapor.**

## Fase 6: Verifikasi akhir dan audit

1. Semua test (pytest murni + `FrappeTestCase` di `ats-test.localhost`, lalu hapus site itu) lulus. `ruff check` bersih untuk berkas yang diubah.
2. Audit larangan: pindai kode untuk memastikan tidak ada penyimpanan password, otomatisasi pengisian login, akun palsu, penembusan 2FA/CAPTCHA/checkpoint, aksi tulis dari akun crawler, `ProxyRotator`, analisis politik/psikologis, pengambilan like/reaksi, pembacaan DM/kontak/lokasi/iklan/pengikut, unduhan media, atau data pihak ketiga yang tersimpan. Tempel hasil pemindaian.
3. Audit persetujuan: tiap jalur (crawl publik, sesi akun crawler, ekspor, OAuth) diuji tanpa scope, tanpa centang akun, tanpa `risk_acknowledged` akun, dan setelah penarikan persetujuan → nol permintaan jaringan, nol penyimpanan, dan semua data turunan terhapus.
4. Audit rahasia: pastikan `session` akun crawler tidak muncul di log, cache Redis, respons API, `frappe.get_doc().as_dict()` untuk non-admin, Finding, Source Run, atau berkas sementara. Tempel hasilnya.
5. Audit bahasa: tidak ada string Indonesia di sumber; setiap string baru punya baris `id.csv`; tangkapan layar Settings (semua tab), halaman persetujuan, dan tab media sosial dalam `en` dan `id`.
6. Jalan penuh dengan data fiktif: pelamar → Resume Screening → Background Check → persetujuan kandidat dengan akun media sosial → job berjalan (jalur crawl dan jalur ekspor) → tinjau post dan komentar → kesimpulan HR → Interview.
7. Perbarui `AUDIT.md` dan README app: akun crawler dan login interaktif, batas yang sengaja tidak dibangun, cara menambah adaptor dan parser baru, cara menyegarkan fixture, dan catatan HTTPS untuk dialog login di produksi.
8. `git diff main --stat` untuk `docker/server-scripts`, `src`, `App.tsx`, `modules`, `app.json`, `eas.json` kosong.

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

- Login sungguhan atau halaman nyata di balik login dibutuhkan. Minta saya yang melakukannya.
- Platform menolak login dari browser server dan jalur cadangan impor cookie pun tidak memadai.
- Halaman nyata sebuah platform tidak bisa diambil pada mode apa pun. Laporkan, jangan memaksakan.
- Ekspor nyata dari akun uji tim belum tersedia untuk menulis parser.
- Format ekspor, halaman, atau API sebuah platform berubah dari yang dijelaskan di sini.
- Langkah butuh kredensial, client ID, akun, atau layanan berbayar.
- Kamu tergoda menyimpan password, mengotomatiskan login, menembus 2FA/CAPTCHA/checkpoint, melakukan aksi tulis, memakai proxy, membaca like/reaksi, atau membaca data di luar allowlist.
- Ada test lama yang gagal dan penyebabnya tidak jelas.
