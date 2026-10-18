# Spesifikasi: Background Checking di ERPNext

Status: draf untuk ditinjau, belum ada yang dibangun. Sumber desain: `~/Downloads/Resume Screening List/02_Background_Checking/` (10 layar). Keputusan awal: hanya web (ERPNext Desk), analisis berbasis aturan tanpa LLM. Dibangun di custom app yang sama dengan Resume Screening (`hris_ats`, lihat `SPEC-RESUME-SCREENING.md`).

## 1. Posisi di alur

```
Resume Screening ─► Background Check ─► Interview
```

Background check dijalankan **hanya untuk pelamar yang dipilih HR** (lolos screening dan diklik "Mulai background check"), bukan otomatis untuk semua pelamar. Alasannya:
- Pengecekan ini memproses data pribadi paling sensitif di seluruh alur, termasuk riwayat perkara yang tergolong data spesifik di UU PDP. Prinsip minimisasi data menuntut hanya kandidat yang benar-benar dipertimbangkan yang diperiksa.
- Setiap pengecekan memanggil layanan berbayar (API pencarian, API media sosial), jadi biaya naik per pelamar.

## 2. Telaah desain per layar

| # | Layar | Isi desain | Rekomendasi |
|---|---|---|---|
| 01 | List | Kandidat, kontak, region, lowongan, ikon media sosial, status "Done"/"Crawling...", filter Level dan Applied to | **Pakai.** Level = tingkat risiko (bagian 6.6). |
| 02 | Add profile | Nama, email, telepon (+62), akun media sosial dengan pilihan platform, saklar single/multiple input | **Pakai**, ditambah langkah persetujuan kandidat (bagian 3). Mode multiple input = tabel akun. Integrasi "Dragonfly" yang disebut di catatan desain tidak dipakai. |
| 03 | Overview summary | Paragraf ringkasan profil kandidat | **Pakai**, disusun dari templat kalimat berbasis fakta yang ditemukan, bisa diedit HR. |
| 04 | Registered platforms | Platform tempat kandidat terdaftar, dicari dari email/username ("Register with" Gmail/Facebook/LinkedIn) | **Ubah.** Cek lewat email/nomor biasanya memanfaatkan alur lupa-password atau pendaftaran platform. Cara itu melanggar ketentuan layanan platform dan bisa memicu email keamanan ke kandidat. Ganti dengan: akun yang dinyatakan kandidat, plus pengecekan apakah profil publik dengan username itu ada. |
| 05 | GetContact analysis | Ringkasan dan tag nama dari GetContact | **Buang.** GetContact tidak punya API resmi, jadi otomatisasinya berarti menyalahgunakan aplikasi. Tag-nya adalah label dari buku kontak orang lain, akurasinya tidak bisa dipertanggungjawabkan. Pengganti opsional: verifikasi nomor milik kandidat lewat OTP WhatsApp/SMS. |
| 06 | Jejak digital nama: Article | Artikel berita yang memuat nama kandidat | **Pakai**, dengan skor kecocokan identitas (bagian 6.2). |
| 07 | Jejak digital nama: File | Dokumen (PDF) yang memuat nama kandidat | **Pakai**, sama seperti artikel. |
| 08 | Jejak digital nama: Case history | Putusan pengadilan (jenis, nomor, PN, tanggal) | **Pakai dengan pengaman ketat** (bagian 6.4). Catatan perkara adalah data spesifik; nama yang sama sangat sering terjadi; dan contoh di desain (permohonan perdata) bukan hal negatif. Pelengkap: kandidat boleh mengunggah SKCK (opsional). |
| 09 | Jejak digital akun: Post | Daftar post/tweet per akun, last active | **Pakai** untuk platform yang punya akses resmi (bagian 6.5). |
| 10 | Jejak digital akun: Analysis | Analisis psikologis, kesantunan, pandangan terhadap pemerintah, pandangan politik, **partai politik yang disukai** | **Sebagian besar dibuang.** Lihat bagian 2.1. |

### 2.1 Bagian layar 10 yang tidak akan dibangun

- **Pandangan politik, sikap terhadap pemerintah, partai politik yang disukai.** Menyaring pelamar berdasarkan pandangan politik adalah diskriminasi kerja: UU 21/1999 meratifikasi Konvensi ILO 111 yang secara tegas melarang diskriminasi atas dasar pandangan politik, dan UU Ketenagakerjaan Pasal 5–6 mewajibkan kesempatan yang sama tanpa diskriminasi. Menyimpan dugaan afiliasi partai seseorang juga membuka risiko hukum dan reputasi yang besar bagi perusahaan. Saya tidak akan membangun bagian ini.
- **Analisis psikologis/kepribadian dari post** ("ekstrover", "introspektif karena posting malam hari"). Tidak ada dasar ilmiah yang sahih untuk menyimpulkan kepribadian dari pola posting, apalagi dengan aturan sederhana tanpa LLM. Kesimpulan seperti ini mudah bias dan sulit dipertanggungjawabkan saat kandidat menanyakannya.
- Yang **tetap** dibangun dari layar 10: kesantunan bahasa, konten berisiko, relevansi profesional, dan pola aktivitas sebagai fakta (bagian 6.5).

Catatan kecil: teks contoh di layar 10 memakai nama "Rizal", sedangkan kandidatnya "Ronald richard".

## 3. Persetujuan kandidat (wajib sebelum pengecekan)

Background check tidak bisa dimulai tanpa persetujuan tercatat. Ini dasar hukum pemrosesan (UU PDP Pasal 20) dan syarat khusus untuk data spesifik.

Alur:
1. HR klik "Mulai background check" pada Job Applicant → dokumen Background Check dibuat dengan `consent_status = Pending`.
2. Sistem mengirim email ke kandidat berisi tautan Web Form: penjelasan sumber yang akan diperiksa, lama penyimpanan, hak kandidat, dan kotak centang per sumber (artikel/file, riwayat perkara, akun media sosial). Kandidat juga mengisi atau mengoreksi daftar akun media sosialnya sendiri di form ini, dan boleh mengunggah SKCK (opsional).
3. Persetujuan tersimpan: versi teks persetujuan, waktu, IP, dan sumber yang disetujui. Sumber yang tidak dicentang tidak dijalankan.
4. Untuk kandidat yang ditambahkan manual tanpa email, HR mengunggah formulir persetujuan bertanda tangan (`consent_method = Uploaded document`).
5. Kandidat bisa menarik persetujuan; temuan yang sudah ada lalu dihapus.

## 4. Doctype baru

### 4.1 Background Check

| Field | Tipe | Keterangan |
|---|---|---|
| `naming_series` | `BGC-.YYYY.-.#####` | |
| `job_applicant` | Link Job Applicant | Boleh kosong untuk profil yang ditambah manual (layar 02), tapi disarankan selalu terhubung. |
| `full_name`, `email`, `phone` | Data | Dari applicant, bisa dikoreksi. Telepon dinormalisasi ke format +62. |
| `name_variants` | Small Text | Variasi nama untuk pencarian (otomatis: tanpa gelar, tanpa nama tengah; HR boleh menambah). |
| `context_terms` | Small Text, read only | Kota, perusahaan dan sekolah sebelumnya dari hasil Resume Screening. Dipakai untuk mencocokkan identitas. |
| `accounts` | Table → Background Check Account | Mode "multiple input" di layar 02. |
| `consent_status` | Select `Pending` / `Granted` / `Declined` / `Withdrawn` | |
| `consent_method` | Select `Web form` / `Uploaded document` | |
| `consent_at`, `consent_ip`, `consent_text_version`, `consent_file` | | Bukti persetujuan. |
| `consent_scope` | Table → Background Check Consent Scope | Sumber yang disetujui. |
| `status` | Select `Waiting Consent` / `Queued` / `Crawling` / `Done` / `Failed` | Badge di layar 01. |
| `source_runs` | Table → Background Check Source Run | Status per sumber, supaya tiap tab bisa menampilkan "Crawling..." sendiri. |
| `summary_auto` | Small Text, read only | Ringkasan dari templat (bagian 6.7). |
| `summary_hr` | Text Editor | Ikon pensil di layar 03/05: HR menulis atau mengoreksi ringkasan. |
| `risk_level_auto` | Select `Rendah` / `Sedang` / `Tinggi` / `Perlu verifikasi`, read only | Indikasi dari sistem. |
| `risk_level_final` | Select, sama | Keputusan HR. Filter "Level" di list memakai ini, atau `risk_level_auto` bila belum diputuskan. |
| `hr_conclusion` | Small Text | Wajib diisi sebelum stage pindah ke Interview. |
| `reviewed_by`, `reviewed_on` | | |
| `skck_file` | Attach, opsional | SKCK yang diunggah kandidat lewat form persetujuan atau oleh HR. Tidak wajib. |
| `skck_number`, `skck_valid_until` | Data, Date, opsional | Diisi HR saat memeriksa SKCK. Muncul hanya bila `skck_file` terisi. |
| `skck_status` | Select `Tidak diunggah` / `Belum diperiksa` / `Bersih` / `Ada catatan` / `Kedaluwarsa` | Diisi HR. `Kedaluwarsa` otomatis bila `skck_valid_until` < hari ini. |
| `purge_after` | Date, read only | Tanggal penghapusan temuan mentah (bagian 8). |

Child `Background Check Account`: `platform` (Link Background Check Platform), `username`, `profile_url` (read only), `declared_by` (Select `Candidate` / `HR`), `exists` (Check, read only), `last_active` (Datetime, read only), `post_access` (Select `API` / `Manual review only` / `Not supported`), `display_name`, `bio_snippet` (maks. 300 karakter), `profile_location` (read only, dari halaman profil publik), `identity_match` (Int 0–100, read only), `identity_reasons` (Small Text, read only). Lihat 6.2.1.

Child `Background Check Source Run`: `source` (Select `Platform` / `Article` / `File` / `Case history` / `Posts`), `status` (`Pending` / `Crawling` / `Done` / `Failed` / `Skipped`), `items_found` (Int), `started_on`, `finished_on`, `error`, `fetch_mode_used` (Data), `robots_ignored_count` (Int).

Child `Background Check Consent Scope`: `source`, `granted` (Check).

### 4.2 Background Check Finding

Doctype terpisah, bukan tabel anak, karena jumlahnya bisa ratusan per kandidat dan perlu pencarian, filter, dan paginasi (layar 06–09).

| Field | Tipe | Keterangan |
|---|---|---|
| `background_check` | Link, wajib | |
| `finding_type` | Select `Article` / `File` / `Case` / `Post` | Sub-tab layar 06–09. |
| `account` | Data | Untuk Post: platform + username. |
| `title`, `snippet` | Data, Small Text | |
| `url`, `source_name` | Data | Mis. "Kompas.com". |
| `published_on` | Datetime | Filter "Year" di layar 08. |
| `file_type` | Data | Untuk File: PDF, DOCX, dsb. |
| `match_confidence` | Int 0–100 | Bagian 6.2. Di bawah ambang tidak ditampilkan secara default. |
| `match_reasons` | Small Text | Mis. "Nama persis + kota Pekanbaru + perusahaan ABC". |
| `text_source` | Select `Cuplikan` / `Teks lengkap` / `PDF putusan` | Dari teks mana skor kecocokan dihitung. Makin lengkap, makin bisa dipercaya. |
| `evidence_excerpt` | Small Text, maks. 600 karakter | Potongan teks di sekitar nama yang menjadi bukti. Teks lengkap/PDF **tidak** disimpan (minimisasi data); cukup potongan ini + URL. |
| `detail_url`, `pdf_url` | Data | Untuk Case: halaman detail putusan dan berkas PDF-nya. |
| `category` | Select `Prestasi` / `Profesional` / `Netral` / `Berisiko` | |
| `risk_flags` | Small Text | Kategori leksikon yang cocok (bagian 6.5). |
| `severity` | Select `Info` / `Rendah` / `Sedang` / `Tinggi` | |
| `case_type`, `case_number`, `court`, `party_role`, `registered_on`, `uploaded_on`, `adjudicated_on` | | Khusus Case (layar 08). |
| `hr_verdict` | Select `Belum ditinjau` / `Relevan` / `Bukan orang ini` / `Diabaikan` | Hanya temuan "Relevan" yang memengaruhi `risk_level_final`. |
| `hr_note` | Small Text | |

### 4.3 Background Check Platform (katalog)

Daftar platform untuk layar 04: `platform_name`, `category` (Creative, Social, Professional, Developer, ...), `icon`, `profile_url_template` (mis. `https://www.canva.com/{username}`), `check_method` (Select `Status code` / `Body contains` / `Body not contains`), `check_value`, `post_api` (Select `None` / `X` / `YouTube` / `GitHub` / `Mastodon` / `Reddit`), `enabled`.

Isi awal diambil dari dataset terbuka WhatsMyName (lisensi CC BY-SA 4.0, wajib mencantumkan atribusi), dipangkas ke platform yang relevan untuk rekrutmen.

### 4.4 Background Check Lexicon

Kamus aturan yang bisa diubah HR tanpa mengubah kode: `category` (mis. Kata kasar, Ujaran kebencian/SARA, Ancaman/kekerasan, Pornografi, Judi online, Narkoba, Penipuan, Kebocoran informasi perusahaan, Prestasi, Hukum-negatif), `term`, `is_regex`, `language` (`id` / `en`), `severity`, `weight`, `enabled`.

Isi awal disusun tim dan ditinjau Legal/HR. Kategori yang menyangkut agama, suku, politik, kesehatan, atau orientasi seksual **tidak boleh** ditambahkan sebagai penanda risiko. Yang boleh adalah *ujaran kebencian* terhadap kelompok tersebut, bukan *keanggotaan* seseorang di dalamnya.

### 4.5 Background Check Settings (Single)

| Field | Keterangan |
|---|---|
| Saklar per sumber | Platform, Article, File, Case history, Posts. |
| `search_provider` + API key (Password) | Penyedia pencarian web untuk Article/File (bagian 5). |
| API key X, YouTube, GitHub, dll. (Password) | |
| `min_match_confidence` | Default 50. Di bawah ini temuan disembunyikan. |
| `max_results_per_source` | Default 50 (angka "(50)" di layar 06–08). |
| `rate_limit_per_minute` | Per domain. |
| `retention_days` | Default 90 hari setelah keputusan akhir pelamar. |
| `consent_text` + `consent_text_version` | Teks persetujuan; versi naik setiap kali teks diubah. |

Bagian **Mode pengambilan halaman** (lihat 5.1). Semua field di bagian ini memakai `permlevel 1`: hanya **System Manager** yang bisa mengubahnya; HR hanya bisa melihat.

| Field | Default | Keterangan |
|---|---|---|
| `fetch_respect_robots` | 1 | Patuhi robots.txt. Bila 0, halaman yang dilarang robots.txt tetap diambil. |
| `fetch_identity` | `Company` | Select `Company` / `Browser`. `Company`: User-Agent dari `fetch_user_agent`, tanpa peniruan. `Browser`: meniru header dan TLS fingerprint browser (fitur `impersonate` Scrapling). |
| `fetch_user_agent` | `"<Nama Perusahaan> HR Background Check (+email kontak)"` | Dipakai bila `fetch_identity = Company`. |
| `fetch_stealth_mode` | 0 | Pakai `StealthyFetcher` (browser + penanganan tantangan anti-bot seperti Cloudflare). Butuh browser terpasang (5.1). |
| `fetch_stealth_domains` | kosong | Daftar domain, satu per baris. Bila diisi, mode stealth hanya dipakai untuk domain ini; domain lain tetap mode biasa. Kosong = semua domain. |
| `fetch_browser_status` | read only | `Terpasang` / `Tidak terpasang`, dicek saat Settings dibuka. |
| `fetch_risk_acknowledged` | 0 | Wajib dicentang sebelum salah satu saklar di atas dilonggarkan dari default. Menyimpan `fetch_risk_ack_by` dan `fetch_risk_ack_on`. |

Validasi: menyimpan Settings dengan `fetch_respect_robots = 0`, `fetch_identity = Browser`, atau `fetch_stealth_mode = 1` ditolak bila `fetch_risk_acknowledged` belum dicentang. Teks di samping kotak centang menjelaskan risikonya (5.1).

## 5. Sumber data

| Sumber | Cara | Catatan |
|---|---|---|
| Platform terdaftar | Untuk tiap akun yang dinyatakan + setiap platform di katalog (opsional, hanya username yang dinyatakan kandidat): ambil URL profil publik dan cek sesuai `check_method`. | Tidak ada pengecekan lewat email atau nomor telepon. |
| Article | API pencarian web dengan kueri `"nama" + konteks`, dibatasi ke domain berita; atau GDELT (gratis, khusus berita). | Penyedia perlu dipilih: Google Programmable Search, Brave Search API, atau SerpAPI. Bandingkan biaya dan ketersediaannya dulu karena kebijakan penyedia sering berubah. |
| File | Penyedia yang sama dengan kueri `filetype:pdf OR filetype:docx`. | |
| Case history | Direktori Putusan Mahkamah Agung (publik). | Hormati robots.txt dan batas laju. Banyak putusan menyamarkan nama pihak, jadi hasil bisa tidak lengkap. SKCK dari kandidat bersifat opsional sebagai pelengkap. |
| Posts | Hanya platform dengan API resmi yang mengizinkan membaca post publik: X (API berbayar), YouTube, GitHub (relevan untuk posisi teknis), Mastodon, Reddit. | Instagram, Facebook, TikTok, LinkedIn: tidak ada akses resmi untuk membaca post akun orang lain, dan scraping melanggar ketentuan layanannya. Untuk platform ini sistem hanya menampilkan tautan profil untuk ditinjau manual oleh HR (`post_access = Manual review only`). |

Setiap sumber dibuat sebagai *provider* yang bisa diganti lewat Settings. Bila kredensial belum diisi, sumber itu berstatus `Skipped` dengan alasan yang jelas, bukan error.

### 5.1 Mesin pengambil halaman: Scrapling

Semua pengambilan dan penguraian halaman (cek profil publik, isi artikel, Direktori Putusan MA) memakai **Scrapling** (`scrapling[fetchers]==0.5`, BSD-3), lewat satu modul pembungkus `bgc/fetch.py`. Provider tidak boleh memanggil Scrapling atau `requests` langsung, supaya Settings 4.5 selalu berlaku.

Agent-Reach tidak dipakai: dirancang untuk dijalankan agen LLM, dan aksesnya ke media sosial memakai cookie/login akun.

Fitur Scrapling yang dipakai, dan untuk apa:

| Fitur | Dipakai untuk |
|---|---|
| `Fetcher` / `FetcherSession` (+ `impersonate` sebagai setting) | Semua pengambilan halaman biasa. Session dipakai ulang dalam satu job. |
| `StealthyFetcher` / `StealthySession` (setting) | Mode stealth, hanya untuk domain yang diizinkan. |
| **Spider** (`response.follow`, `concurrent_requests`, `robots_txt_obey`, `crawldir`) | Case history: menelusuri **semua halaman** hasil pencarian sampai `max_results_per_source`, lalu masuk ke halaman detail tiap putusan. `crawldir` di `sites/<site>/private/hris_ats/crawl/` supaya crawl yang terputus bisa dilanjutkan. |
| **Selektor adaptif** (Smart Element Tracking) | Selektor halaman putusan MA dan halaman profil tetap menemukan elemennya walau tampilan situs berubah. Data pelacakan disimpan di `sites/<site>/private/hris_ats/`. |
| **`find_similar`** | Mengambil semua baris hasil pencarian yang strukturnya sama, tanpa selektor rapuh per baris. |
| Pencarian teks/regex di halaman | Menemukan nama kandidat dan istilah konteks di halaman detail. |
| **`page.markdown()`** | Mengambil isi artikel yang bersih untuk pencocokan konteks, setelah penyedia pencarian Article dipilih. Bukan LLM. |

Pengunduhan **PDF putusan** memakai `fetch.py` lalu dibaca dengan `pdfplumber` (sudah ada di image).

Aturan yang sama dengan `fetch.py` wajib berlaku juga di Spider: domain terlarang, robots.txt sesuai setting, batas laju per domain lewat Redis, mode identitas/stealth, dan pencatatan `fetch_mode_used`. Kalau Spider tidak bisa dikonfigurasi untuk mematuhi semuanya, penelusuran halaman dikerjakan manual lewat `fetch.py`.

Fitur Scrapling yang **tidak** dipakai:
- `ProxyRotator`: fungsinya hanya menghindari blokir IP dari situs sumber; kalau situs sudah memblokir, itu keputusan mereka. Tidak tersedia juga sebagai setting.
- Server MCP, Agent Skill, dan extra `[ai]`: untuk agen AI.

Perilaku `bgc/fetch.py` menurut Settings:

| Setting | Perilaku |
|---|---|
| Default (robots dipatuhi, identitas perusahaan, stealth mati) | `Fetcher`/`FetcherSession` tanpa `impersonate`, User-Agent perusahaan, robots.txt dicek dulu (Protego), batas laju per domain. |
| `fetch_respect_robots = 0` | Pengecekan robots.txt dilewati. Batas laju tetap berlaku. |
| `fetch_identity = Browser` | `Fetcher` dengan `impersonate` browser. |
| `fetch_stealth_mode = 1` | `StealthyFetcher` untuk domain di `fetch_stealth_domains` (atau semua). Bila browser belum terpasang, sumber `Failed` dengan pesan "Mode stealth aktif tapi browser belum terpasang", bukan diam-diam turun ke mode biasa. |

Yang tetap berlaku apa pun settingnya: batas laju per domain, cache 24 jam, persetujuan kandidat dan `consent_scope`, serta daftar yang tidak dibangun di bagian 2.1. Saklar ini hanya mengatur **cara** mengambil halaman, bukan **apa** yang boleh diambil: Instagram, Facebook, TikTok, dan LinkedIn tetap hanya tautan untuk ditinjau manual, dan tidak ada login atau cookie akun.

**Browser untuk mode stealth** tidak dipasang secara default. Pemasangannya lewat opsi eksplisit: `docker/dev-ats.sh --with-browsers` untuk pengembangan, dan argumen build terpisah untuk image produksi. Ini menambah ukuran image beberapa ratus MB.

**Jejak audit**: setiap `Background Check Source Run` mencatat `fetch_mode_used` (mis. `company+robots`, `browser`, `stealth`) dan jumlah halaman yang diambil dengan robots.txt diabaikan. Perubahan Settings tercatat lewat `track_changes`. Laporan PDF menyebut mode yang dipakai.

**Risiko yang ditampilkan di samping `fetch_risk_acknowledged`**:
- Menembus proteksi anti-bot dapat dianggap "menerobos atau menjebol sistem pengamanan" menurut UU ITE Pasal 30 ayat (3), dan melanggar ketentuan layanan situs sumber.
- Mengabaikan robots.txt dan menyamar sebagai browser melanggar ketentuan layanan banyak situs dan bisa membuat IP server diblokir, termasuk untuk layanan lain yang berjalan di server yang sama.
- Keputusan mengaktifkannya sebaiknya disetujui Legal dan dicatat.

## 6. Algoritma (tanpa LLM)

### 6.1 Persiapan identitas
- Normalisasi nama: huruf kecil, hapus gelar (S.Kom., S.T., Dr., Ir., M.M., dll.), satukan spasi.
- Variasi nama: lengkap, nama depan + belakang, tanpa nama tengah. Nama satu kata (mononim) ditandai karena kemungkinan salah orang jauh lebih tinggi.
- Konteks dari Resume Screening: kota domisili, nama perusahaan, nama sekolah/universitas, jabatan.

### 6.2 Skor kecocokan identitas (Article, File, Case)

```
match_confidence = kemiripan_nama (0–50)
                 + konteks_cocok   (0–40)
                 + bonus_unik      (0–10)
```

- **kemiripan_nama**: rapidfuzz `token_sort_ratio` antara variasi nama dan nama yang muncul di teks. Cocok persis = 50; ≥ 90 = 40; ≥ 80 = 25; di bawahnya = 0 (temuan dibuang).
- **konteks_cocok**: +15 per istilah konteks yang muncul dalam radius 300 karakter dari nama (kota, perusahaan, sekolah, jabatan), maksimal 40.
- **bonus_unik**: +10 bila pencarian nama persis menghasilkan < 20 hasil (nama jarang); 0 untuk mononim.
- Tingkat: ≥ 80 Tinggi, 50–79 Sedang, < 50 Rendah (disembunyikan secara default). Alasan kecocokan disimpan di `match_reasons`.
- **Teks yang dipakai**: urutan prioritas PDF putusan → teks lengkap halaman (detail putusan / isi artikel) → cuplikan hasil pencarian. Skor dihitung ulang setiap kali teks yang lebih lengkap tersedia; `text_source` mencatat yang dipakai. Skor dari cuplikan saja dibatasi maksimal 70, karena konteksnya terlalu sedikit untuk tingkat Tinggi.
- Bila nama muncul beberapa kali di teks lengkap, `konteks_cocok` dihitung di kemunculan dengan konteks terbanyak, dan potongan teks di sekitarnya disimpan sebagai `evidence_excerpt`.

### 6.2.1 Kecocokan identitas akun platform

Selain mengecek profil publik ada, halaman profil diurai untuk nama tampilan, bio, dan lokasi:

```
identity_match = kemiripan nama tampilan (0–50)   # rapidfuzz token_sort_ratio, skala sama dengan 6.2
               + lokasi cocok dengan kota kandidat (0–20)
               + bio menyebut perusahaan/sekolah/jabatan dari CV (0–20)
               + akun dinyatakan sendiri oleh kandidat (+10)
```

Akun yang tidak dinyatakan kandidat dengan `identity_match` < 50 tidak ditampilkan sebagai milik kandidat. Platform terlarang (Instagram, Facebook, TikTok, LinkedIn) tidak diurai sama sekali; `identity_match` dibiarkan kosong.

### 6.3 Klasifikasi Article dan File
Cocokkan judul + cuplikan ke leksikon:
- Kategori `Prestasi`: juara, meraih, penghargaan, award, winner, beasiswa, dll. (layar 06: "juara 1 lomba UI/UX").
- Kategori `Profesional`: narasumber, pembicara, peneliti, proyek, publikasi, jurnal.
- Kategori `Berisiko`: kategori leksikon dengan severity ≥ Sedang (mis. ditangkap, tersangka, penipuan, korupsi, narkoba).
- Selain itu `Netral`.

Severity temuan = severity leksikon tertinggi yang cocok, diturunkan satu tingkat bila `match_confidence` < 80.

### 6.4 Case history
1. Telusuri semua halaman hasil pencarian (Spider) sampai `max_results_per_source`, buka halaman detail tiap hasil, lalu ambil metadata putusan: jenis perkara (Pidana, Perdata, Perdata Khusus, Agama, TUN), nomor, pengadilan, tanggal register/upload/putus, dan tautan PDF.
2. Unduh PDF putusan untuk hasil yang `kemiripan_nama` ≥ 80, lalu baca dengan `pdfplumber`. Dari bagian identitas para pihak di awal putusan, ambil peran, pekerjaan, dan kota/kabupaten alamat pihak yang namanya cocok. Pekerjaan dan kota dipakai sebagai istilah konteks di 6.2. Nama pihak lain, NIK, alamat lengkap, dan data selain pihak yang cocok tidak disimpan. PDF dibuang setelah dibaca.
   Tentukan **peran** nama dengan regex di sekitar nama: `Terdakwa`, `Tergugat`, `Penggugat`, `Pemohon`, `Termohon`, `Saksi`. Peran dari PDF mengalahkan peran dari cuplikan. Bila PDF tidak tersedia atau tidak terbaca (hasil scan), peran diambil dari halaman detail dan `text_source = Teks lengkap`.
3. Severity:

   | Jenis | Peran | Severity |
   |---|---|---|
   | Pidana | Terdakwa | Tinggi |
   | Perdata/Perdata Khusus | Tergugat | Sedang |
   | Perdata | Penggugat/Pemohon (mis. ganti nama, penetapan ahli waris) | Info |
   | Apa pun | Saksi | Info |
   | Agama, TUN | apa pun | Info, dan disembunyikan secara default |

4. Contoh di layar 08 ("Perdata umum, Nomor 72/PDT.P/2017", permohonan) masuk kategori **Info**, bukan risiko.
5. Temuan Case **tidak pernah** menaikkan `risk_level_auto` di atas `Perlu verifikasi`. Hanya setelah HR menandai `Relevan` (idealnya setelah konfirmasi ke kandidat atau dicek dengan SKCK) temuan ini dihitung.

### 6.5 Analisis post (pengganti layar 10)
Untuk setiap akun dengan akses API, ambil maksimal N post terakhir (default 200 atau 12 bulan), lalu hitung:

| Bagian | Isi | Cara |
|---|---|---|
| Aktivitas | Jumlah post, last active, rata-rata post per minggu, sebaran jam | Fakta saja, tanpa tafsiran kepribadian. |
| Kesantunan bahasa | % post yang mengandung kata kasar/hinaan; % balasan yang mengandung kata kasar | Leksikon kategori Kata kasar. Skor = 100 − (persentase × faktor). |
| Konten berisiko | Daftar post yang cocok kategori Ujaran kebencian, Ancaman, Pornografi, Judi online, Narkoba, Penipuan, Kebocoran informasi perusahaan | Leksikon + regex. Setiap post yang cocok menjadi Finding tipe `Post` dengan tautan ke post aslinya. |
| Relevansi profesional | % post yang menyebut skill/topik dari lowongan | Cocokkan ke `required_skills` dan `preferred_skills` Job Opening. Sinyal positif. |
| Sentimen umum | Rasio post positif : negatif | Leksikon sentimen bahasa Indonesia (mis. InSet; cek lisensinya). Hanya informasi, tidak masuk tingkat risiko. |

Semua hasil ditampilkan sebagai angka dan daftar post bukti, bukan kesimpulan naratif tentang karakter orang.

### 6.6 Tingkat risiko
`risk_level_auto` dihitung dari temuan dengan `match_confidence` ≥ ambang:
- `Perlu verifikasi`: ada temuan severity Tinggi yang belum ditinjau HR.
- `Tinggi`: ada temuan severity Tinggi yang ditandai `Relevan`.
- `Sedang`: ≥ 3 temuan Sedang yang `Relevan`, atau skor kesantunan < 60.
- `Rendah`: selain itu.

HR menetapkan `risk_level_final` dan `hr_conclusion`. Sistem tidak pernah menolak kandidat otomatis.

### 6.7 Ringkasan otomatis (layar 03)
Disusun dari templat kalimat yang diisi fakta, contoh:

> {nama} melamar sebagai {jabatan}. Ditemukan {n} akun publik ({daftar platform}). Ada {a} artikel yang kemungkinan besar terkait, {p} di antaranya tentang prestasi. Ditemukan {c} catatan perkara yang perlu diverifikasi. Analisis {m} post menunjukkan kesantunan bahasa {skor}/100 dan {r} post yang ditandai berisiko.

Kalimat yang nilainya nol dihilangkan. HR bisa menimpanya lewat `summary_hr`.

## 7. Pemetaan layar ke Desk

| Layar | Di ERPNext |
|---|---|
| 01 list | List view Background Check: kandidat, kontak, region, lowongan, ikon akun (kolom HTML), status, level. Filter Level & Applied to bawaan. |
| 02 add profile | Form Background Check baru (dari Job Applicant atau berdiri sendiri), tabel akun. |
| 03–10 tab | Form Background Check dengan Tab Break: Ringkasan, Platform, Jejak digital nama (sub-filter Article/File/Case), Jejak digital akun (Post/Analisis). Daftar temuan dirender di field HTML dengan pencarian dan paginasi, plus tautan "Lihat semua" ke list Background Check Finding yang sudah terfilter. |
| Tab GetContact | Tidak ada (bagian 2). |
| Panel "Candidate detail" | Sidebar form: tanggal lamaran, lowongan, kontak, region, ikon akun. Tanpa usia dan gender. |
| Pensil di header | Ubah input lalu "Jalankan ulang". |
| Unduh | Print Format "Background Check Report" (PDF), hanya memuat temuan yang `Relevan` dan kesimpulan HR. |
| Panah kiri/kanan | Prev/next bawaan form. |

## 8. Keamanan, akses, dan retensi

- Role baru **Background Check Officer**. Hanya role ini dan HR Manager yang bisa membaca Background Check dan Finding.
- Interviewer dan atasan pengguna hanya melihat `risk_level_final` dan `hr_conclusion` lewat Job Applicant, bukan temuan mentahnya.
- Setiap pembukaan dokumen dicatat (Access Log bawaan + `track_views`).
- `purge_after` = tanggal keputusan akhir pelamar (Rejected/Hired) + `retention_days`. Job harian menghapus Finding, ringkasan otomatis, dan data akun setelah tanggal itu, dan hanya menyisakan level, kesimpulan HR, dan bukti persetujuan.
- Kandidat berhak meminta salinan dan koreksi (UU PDP). Laporan PDF di atas juga dipakai untuk memenuhi permintaan ini.
- Secara default crawling memakai User-Agent yang menyebut nama perusahaan dan mematuhi robots.txt; keduanya bisa dilonggarkan lewat Settings oleh System Manager (5.1). Batas laju per domain dan cache 24 jam per kueri selalu berlaku.

## 9. Pemicu dan perpindahan tahap
- Tombol "Mulai background check" di Job Applicant (hanya bila Resume Screening `Done`) → Background Check dibuat, `recruitment_stage = Background Check`, email persetujuan terkirim.
- Persetujuan `Granted` → satu background job per sumber yang disetujui (antrean `long`), `status = Crawling`, status per sumber diperbarui lewat `publish_realtime`.
- Semua sumber selesai → `status = Done`, tingkat risiko dan ringkasan dihitung, notifikasi ke Background Check Officer.
- HR mengisi kesimpulan lalu membuat Interview → `recruitment_stage = Interview`.

## 10. Hal yang perlu diputuskan sebelum dibangun

Sudah diputuskan: Dragonfly tidak dipakai; SKCK opsional; pengambil halaman memakai Scrapling dengan mode longgar yang bisa diaktifkan lewat Settings (5.1).

Masih terbuka (tidak menghalangi pembangunan, karena sumbernya bisa dimatikan lewat Settings):
1. **Penyedia pencarian web** untuk Article/File, beserta anggarannya.
2. **API X** berbayar: perlu atau tidak? Tanpa itu, analisis post v1 hanya untuk YouTube, GitHub, Mastodon, dan Reddit.
3. **Review Legal** atas teks persetujuan dan isi awal leksikon sebelum dipakai ke kandidat sungguhan.
4. **Tanggal dan tempat lahir untuk pencocokan identitas** (opsional): putusan umumnya mencantumkan tempat/tanggal lahir pihak. Kalau kandidat mengisinya di form persetujuan, pencocokan perkara jauh lebih pasti. Datanya hanya dipakai untuk pencocokan, tidak ditampilkan di screening, dan tidak memengaruhi skor. Perlu diputuskan apakah field ini diminta.

## 11. Urutan pengerjaan setelah disetujui
1. Doctype + settings + role + persetujuan (Web Form + email).
2. Katalog platform (impor dari WhatsMyName) + pengecekan profil publik.
3. Integrasi penyedia pencarian → Article/File + skor kecocokan + klasifikasi leksikon.
4. Case history (Direktori Putusan) + deteksi peran + severity.
5. Post via API resmi + analisis 6.5.
6. Tingkat risiko, ringkasan otomatis, layout tab, print format.
7. Job retensi/penghapusan, uji dengan data contoh (tanpa data orang sungguhan), lalu deploy.
