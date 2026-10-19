# Spesifikasi: Background Checking di ERPNext

Status: sudah dibangun sebagian di branch `feat/hris-ats` (`docker/apps/hris_ats/`). Dokumen ini adalah spesifikasi yang berlaku setelah keputusan terbaru: bahasa UI, persetujuan media sosial per akun, domain terlarang sebagai settingan, akun crawler per platform dengan login interaktif, tab pada Settings, serta post dan komentar. Pekerjaan lanjutan dijelaskan di `PROMPT-ANTIGRAVITY-SOSMED.md`.

Sumber desain: `~/Downloads/Resume Screening List/02_Background_Checking/` (10 layar). Hanya web (ERPNext Desk). Analisis berbasis aturan, tanpa LLM. Satu custom app dengan Resume Screening (`hris_ats`, lihat `SPEC-RESUME-SCREENING.md`).

**Konvensi penulisan.** Nilai Select, nama field, dan nama doctype ditulis dalam Bahasa Inggris (nilai tersimpan di database). Tampilan Indonesia diberikan lewat terjemahan (bagian 12). Penjelasan di dokumen ini tetap berbahasa Indonesia.

## 1. Posisi di alur

```
Resume Screening ─► Background Check ─► Interview
```

Background check dijalankan **hanya untuk pelamar yang dipilih HR** (lolos screening dan diklik "Mulai background check"), bukan otomatis untuk semua pelamar. Alasannya:
- Pengecekan ini memproses data pribadi paling sensitif di seluruh alur, termasuk riwayat perkara yang tergolong data spesifik di UU PDP. Prinsip minimisasi data menuntut hanya kandidat yang benar-benar dipertimbangkan yang diperiksa.
- Setiap pengecekan memanggil layanan berbayar (API pencarian, API media sosial), jadi biaya naik per pelamar.

## 2. Telaah desain per layar

| # | Layar | Isi desain | Keputusan |
|---|---|---|---|
| 01 | List | Kandidat, kontak, region, lowongan, ikon media sosial, status "Done"/"Crawling...", filter Level dan Applied to | **Pakai.** Level = tingkat risiko (bagian 6.6). |
| 02 | Add profile | Nama, email, telepon (+62), akun media sosial dengan pilihan platform, saklar single/multiple input | **Pakai**, ditambah langkah persetujuan kandidat (bagian 3). Mode multiple input = tabel akun. Integrasi "Dragonfly" di catatan desain tidak dipakai. |
| 03 | Overview summary | Paragraf ringkasan profil kandidat | **Pakai**, disusun dari templat kalimat berbasis fakta, bisa diedit HR. |
| 04 | Registered platforms | Platform tempat kandidat terdaftar, dicari dari email/username | **Ubah.** Cek lewat email/nomor memanfaatkan alur lupa-password atau pendaftaran platform, melanggar ketentuan layanan, dan bisa memicu email keamanan ke kandidat. Diganti: akun yang dinyatakan kandidat + pengecekan profil publik dari username. |
| 05 | GetContact analysis | Ringkasan dan tag nama dari GetContact | **Buang.** Tidak ada API resmi dan tag berasal dari buku kontak orang lain, akurasinya tidak bisa dipertanggungjawabkan. |
| 06 | Jejak digital nama: Article | Artikel berita yang memuat nama kandidat | **Pakai**, dengan skor kecocokan identitas (6.2). |
| 07 | Jejak digital nama: File | Dokumen (PDF) yang memuat nama kandidat | **Pakai**, sama seperti artikel. |
| 08 | Jejak digital nama: Case history | Putusan pengadilan | **Pakai dengan pengaman ketat** (6.4). SKCK dari kandidat opsional sebagai pelengkap. |
| 09 | Jejak digital akun: Post | Daftar post/tweet per akun | **Pakai**, ditambah komentar milik kandidat (5.3), sumber dari halaman publik, sesi akun crawler, ekspor, dan API resmi. |
| 10 | Jejak digital akun: Analysis | Analisis psikologis, kesantunan, pandangan terhadap pemerintah, pandangan politik, partai politik | **Sebagian besar dibuang** (2.1). |

### 2.1 Yang tidak dibangun

- **Pandangan politik, sikap terhadap pemerintah, partai politik** (layar 10). Menyaring pelamar berdasarkan pandangan politik adalah diskriminasi kerja: UU 21/1999 meratifikasi Konvensi ILO 111 yang melarangnya, dan UU Ketenagakerjaan Pasal 5–6 mewajibkan kesempatan yang sama tanpa diskriminasi. Menyimpan dugaan afiliasi partai juga berisiko hukum dan reputasi besar bagi perusahaan.
- **Analisis psikologis/kepribadian dari post.** Tidak ada dasar ilmiah yang sahih untuk menyimpulkan kepribadian dari pola posting; mudah bias dan sulit dipertanggungjawabkan.
- **Like, reaksi, dan riwayat interaksi** (tidak disimpan dan tidak dianalisis). Sinyalnya lemah dan mudah dipakai menebak pandangan politik, agama, atau preferensi pribadi, yang membuka jalan bagi diskriminasi walaupun analisisnya tidak dibangun. Persetujuan kandidat tidak mengesahkannya.
- **GetContact** dalam bentuk apa pun.
- Pembuatan **akun palsu atau massal**, akun yang dibeli, dan akun pribadi karyawan untuk crawling. Akun crawler (5.5) harus akun asli milik perusahaan yang dibuat manual.
- **Penembusan 2FA, CAPTCHA, atau halaman checkpoint** platform. Bila muncul, manusia (System Manager) yang menyelesaikannya saat login interaktif; saat crawling sistem berhenti.
- **Aksi tulis** di platform mana pun dari akun crawler: mengikuti akun, like, komentar, DM, atau permintaan pertemanan. Akun crawler hanya membaca.
- **`ProxyRotator`** Scrapling dan rotasi proxy/IP dalam bentuk apa pun (memutar proxy hanya untuk menghindari blokir dari situs sumber).
- Pengambilan **pesan pribadi (DM), kontak, riwayat lokasi, data iklan**, atau data pihak ketiga (komentar dan nama orang lain, daftar pengikut) dari akun mana pun.
- Yang **tetap** dibangun dari layar 10: kesantunan bahasa, konten berisiko, relevansi profesional, dan pola aktivitas sebagai fakta (6.5).

Catatan kecil: teks contoh di layar 10 memakai nama "Rizal", sedangkan kandidatnya "Ronald richard".

## 3. Persetujuan kandidat (wajib sebelum pengecekan)

Background check tidak bisa dimulai tanpa persetujuan tercatat. Ini dasar hukum pemrosesan (UU PDP Pasal 20) dan syarat khusus untuk data spesifik. Persetujuan harus **aktif (opt-in)**: tidak ada kotak centang yang sudah tercentang sebelumnya.

Alur:
1. HR klik "Mulai background check" pada Job Applicant dan memilih bahasa kandidat (`candidate_language`: `id` atau `en`, default `id`) → dokumen Background Check dibuat dengan `consent_status = Pending`.
2. Sistem mengirim email ke kandidat, dalam bahasa kandidat, berisi tautan bertoken sekali pakai yang kedaluwarsa. Halaman persetujuan:
   - tampil dalam bahasa kandidat: `?lang=` bila ada, lalu `candidate_language`, lalu Accept-Language browser, lalu `id`; hanya `id` dan `en` yang diterima; ada pemilih bahasa **ID | EN** yang terlihat dan mengalahkan semuanya;
   - menjelaskan sumber yang diperiksa, lama penyimpanan, dan hak kandidat;
   - memuat kotak centang **per sumber**, semuanya kosong di awal (Platform, Article, File, Case history, Posts, **Social Media**);
   - memuat kotak pernyataan akhir; tombol Kirim nonaktif sampai kotak itu dan minimal satu sumber dicentang;
   - memuat bagian **Akun media sosial** (3.1);
   - mengizinkan kandidat mengisi atau mengoreksi daftar akunnya, mengunggah ekspor data (5.3), dan mengunggah SKCK (opsional).
3. Persetujuan tersimpan sebagai bukti: bahasa yang benar-benar tampil saat Kirim, versi teks yang disetujui, waktu, IP, serta sumber yang disetujui. Sumber yang tidak dicentang tidak dijalankan.
4. Kandidat tanpa email: HR mengunggah formulir persetujuan bertanda tangan (`consent_method = Uploaded document`, `consent_file` wajib).
5. Kandidat bisa menarik persetujuan: semua temuan dan data turunan akun dihapus, termasuk cache, berkas crawl, dan `skck_file` (8).

### 3.1 Persetujuan khusus media sosial (per akun)

Membuka domain media sosial di Settings (5.1) **tidak cukup** untuk mengambil data seorang kandidat. Akun media sosial hanya diambil bila **semua** syarat ini terpenuhi:

1. Scope `Social Media` di `consent_scope` = granted oleh kandidat.
2. Akun tersebut punya `social_consent = 1`: kandidat mencentang akun itu satu per satu pada kotak "Akun ini milik saya dan saya setuju profil publiknya diambil otomatis". Akun yang ditambahkan HR dan tidak dicentang kandidat dilewati.
3. Domain akun diizinkan di Settings (tidak ada di `fetch_blocked_domains`).

Persetujuan `Social Media` mencakup profil, post publik milik kandidat, dan (lewat ekspor) komentar milik kandidat. Syarat ini berlaku untuk **semua jalur** (halaman publik, sesi akun crawler, ekspor, OAuth) dan ditegakkan di satu fungsi `assert_social_consent`. Akun yang tidak memenuhi syarat dilewati **tanpa permintaan jaringan sama sekali**, dan Source Run mencatat jumlah akun yang dilewati beserta alasannya. Untuk jalur formulir bertanda tangan, HR mencentang per akun "Dikonfirmasi kandidat di dokumen" dan `consent_file` wajib terlampir sebelum `social_consent` bisa diisi; siapa dan kapan dicatat.

"Akun media sosial" = akun pada platform di katalog yang bertanda `requires_social_consent` (bawaan: Instagram, Facebook, TikTok, LinkedIn) atau pada domain apa pun di daftar domain terlarang bawaan. Aturan ini tetap berlaku walau domainnya sudah dibuka di Settings.

## 4. Doctype

### 4.1 Background Check

| Field | Tipe | Keterangan |
|---|---|---|
| `naming_series` | `BGC-.YYYY.-.#####` | |
| `job_applicant` | Link Job Applicant | Boleh kosong untuk profil yang ditambah manual (layar 02), tapi disarankan selalu terhubung. |
| `full_name`, `email`, `phone` | Data | Dari applicant, bisa dikoreksi. Telepon dinormalisasi ke +62. |
| `candidate_language` | Select `id` / `en` | Bahasa halaman dan email persetujuan. Default `id`. |
| `name_variants` | Small Text | Variasi nama untuk pencarian (otomatis: tanpa gelar, tanpa nama tengah; HR boleh menambah). |
| `context_terms` | Small Text, read only | Kota, perusahaan, dan sekolah dari hasil Resume Screening, untuk mencocokkan identitas. |
| `accounts` | Table → Background Check Account | Mode "multiple input" di layar 02. |
| `consent_status` | Select `Pending` / `Granted` / `Declined` / `Withdrawn` | |
| `consent_method` | Select `Web form` / `Uploaded document` | |
| `consent_at`, `consent_ip`, `consent_language`, `consent_text_version`, `consent_file` | | Bukti persetujuan. |
| `consent_scope` | Table → Background Check Consent Scope | Sumber yang disetujui. |
| `status` | Select `Waiting Consent` / `Queued` / `Crawling` / `Done` / `Failed` | Badge di layar 01. |
| `source_runs` | Table → Background Check Source Run | Status per sumber. |
| `summary_template`, `summary_params`, `summary_auto` | Text, JSON, Small Text; read only | Ringkasan otomatis disimpan sebagai templat + parameter dan dirender dalam bahasa pembaca saat ditampilkan (bagian 12). `summary_auto` = hasil render Inggris sebagai cadangan. |
| `summary_hr` | Text Editor | HR menulis atau mengoreksi ringkasan. |
| `risk_level_auto` | Select `Low` / `Medium` / `High` / `Needs verification`, read only | Indikasi dari sistem. |
| `risk_level_final` | Select, sama | Keputusan HR. Filter "Level" di list memakai ini, atau `risk_level_auto` bila belum diputuskan. |
| `hr_conclusion` | Small Text | Wajib diisi sebelum Interview dibuat untuk pelamar ini. |
| `reviewed_by`, `reviewed_on` | | |
| `skck_file` | Attach, opsional | SKCK dari kandidat atau HR. Dihapus (berkas dan field) saat retensi dan saat persetujuan ditarik; `skck_status` tetap disimpan. |
| `skck_number`, `skck_valid_until` | Data, Date, opsional | Diisi HR. Muncul hanya bila `skck_file` terisi. |
| `skck_status` | Select `Not uploaded` / `Not checked` / `Clear` / `Has records` / `Expired` | Diisi HR. `Expired` otomatis bila `skck_valid_until` < hari ini. |
| `purge_after` | Date, read only | Tanggal penghapusan temuan mentah (bagian 8). |

Child `Background Check Account`: `platform` (Link Background Check Platform), `username`, `profile_url` (read only), `declared_by` (Select `Candidate` / `HR`), `connection_method` (Select `Public page` / `Logged-in session` / `Data export` / `OAuth`, read only), `social_consent` (Check, read only; 3.1), `social_consent_attested_by`, `social_consent_attested_on` (jalur dokumen), `exists` (Check, read only), `last_active` (Datetime, read only), `post_access` (Select `API` / `Manual review only` / `Not supported`), `display_name`, `bio_snippet` (maks. 300 karakter), `profile_location`, `identity_match` (Int 0–100), `identity_reasons_template`, `identity_reasons_params`, `identity_reasons` (read only). Lihat 6.2.1.

Child `Background Check Source Run`: `source` (Select `Platform` / `Article` / `File` / `Case history` / `Posts` / `Social Media`), `status` (`Pending` / `Crawling` / `Done` / `Failed` / `Skipped`), `items_found` (Int), `accounts_skipped` (Int), `started_on`, `finished_on`, `error_template`, `error_params`, `error` (read only; bagian 12), `fetch_mode_used` (Data), `robots_ignored_count` (Int), `crawler_account` (Link Background Check Crawler Account, read only; label akun crawler yang dipakai, bukan kredensial).

Child `Background Check Consent Scope`: `source` (sama dengan Source Run), `granted` (Check).

### 4.2 Background Check Finding

Doctype terpisah, bukan tabel anak, karena jumlahnya bisa ratusan per kandidat dan perlu pencarian, filter, dan paginasi (layar 06–09).

| Field | Tipe | Keterangan |
|---|---|---|
| `background_check` | Link, wajib | |
| `finding_type` | Select `Article` / `File` / `Case` / `Post` / `Comment` | Sub-tab layar 06–09. `Comment` = komentar yang ditulis kandidat sendiri. |
| `account` | Data | Untuk Post/Comment: platform + username. |
| `title`, `snippet` | Data, Small Text | |
| `url`, `source_name` | Data | Mis. "Kompas.com". |
| `published_on` | Datetime | Filter "Year" di layar 08. |
| `file_type` | Data | Untuk File: PDF, DOCX, dsb. |
| `match_confidence` | Int 0–100 | 6.2. Di bawah ambang disembunyikan secara default. |
| `match_reasons_template`, `match_reasons_params`, `match_reasons` | Text, JSON, Small Text; read only | Alasan kecocokan, disimpan netral bahasa (bagian 12). |
| `text_source` | Select `Snippet` / `Full text` / `Decision PDF` / `Candidate export` | Dari teks mana skor dihitung. Makin lengkap, makin bisa dipercaya. |
| `provenance` | Select `Crawled` / `Crawled (session)` / `Candidate export` / `OAuth API` / `Official API` | Asal data; badge di daftar temuan dan laporan. |
| `evidence_excerpt` | Small Text, maks. 600 karakter | Potongan teks di sekitar nama. Teks lengkap/PDF **tidak** disimpan (minimisasi data). |
| `detail_url`, `pdf_url` | Data | Untuk Case. |
| `category` | Select `Achievement` / `Professional` / `Neutral` / `Risky` | |
| `risk_flags_template`, `risk_flags_params`, `risk_flags` | | Kategori leksikon yang cocok (6.5), netral bahasa. |
| `severity` | Select `Info` / `Low` / `Medium` / `High` | |
| `case_type`, `case_number`, `court`, `party_role`, `registered_on`, `uploaded_on`, `adjudicated_on` | | Khusus Case (layar 08). |
| `hr_verdict` | Select `Not reviewed` / `Relevant` / `Not this person` / `Ignored` | Hanya temuan `Relevant` yang memengaruhi `risk_level_final`. |
| `hr_note` | Small Text | |

### 4.3 Background Check Platform (katalog)

Daftar platform untuk layar 04: `platform_name`, `category` (Select `Creative` / `Social` / `Professional` / `Developer` / `Other`), `icon`, `profile_url_template` (mis. `https://www.canva.com/{username}`), `check_method` (Select `Status code` / `Body contains` / `Body not contains`), `check_value`, `post_api` (Select `None` / `X` / `YouTube` / `GitHub` / `Mastodon` / `Reddit`), `requires_social_consent` (Check; 3.1), `login_url` (URL halaman login untuk login interaktif, 5.5), `session_domains` (domain yang cookie-nya disimpan), `display_name_selector`, `bio_selector`, `location_selector` (opsional; selektor halaman profil untuk 6.2.1, dikelola admin), `enabled`.

Isi awal dari dataset terbuka WhatsMyName (CC BY-SA 4.0, wajib mencantumkan atribusi), dipangkas ke platform yang relevan untuk rekrutmen.

### 4.4 Background Check Lexicon

Kamus aturan yang bisa diubah HR tanpa mengubah kode: `category` (Select, Inggris: `Profanity`, `Hate speech`, `Threats/violence`, `Pornography`, `Online gambling`, `Narcotics`, `Fraud`, `Company information leak`, `Achievement`, `Legal-negative`, dst.), `term`, `is_regex`, `language` (`id` / `en`), `severity` (`Info` / `Low` / `Medium` / `High`), `weight`, `enabled`.

`term` adalah **kosakata isi dokumen yang dinilai** (mis. "korupsi", "slot gacor"), bukan teks UI: tetap dua bahasa dan tidak diterjemahkan. Hanya nama kategori yang mengikuti aturan bahasa UI.

Isi awal disusun tim dan wajib ditinjau Legal/HR. Kategori yang menyangkut agama, suku, politik, kesehatan, atau orientasi seksual **tidak boleh** dipakai sebagai penanda risiko. Yang boleh adalah *ujaran kebencian* terhadap kelompok tersebut, bukan *keanggotaan* seseorang di dalamnya.

### 4.5 Background Check Settings (Single)

Form dirapikan menjadi **tab** (Frappe Tab Break) dengan bagian yang diberi judul dan keterangan singkat, tidak lagi satu halaman panjang:

| Tab | Isi |
|---|---|
| **General** | `enabled`, `mock_provider`, saklar per sumber (Platform, Article, File, Case history, Posts, Social Media), parameter (`min_match_confidence`, `max_results_per_source`, `rate_limit_per_minute`, `social_max_posts`, `social_lookback_months`), retensi (`retention_days`). |
| **Providers** | `search_provider` + API key (Password), API key X/YouTube/GitHub (Password), koneksi OAuth per platform (5.4), `export_max_mb`. |
| **Page Fetching** | Mode pengambilan halaman (tabel di bawah) dan tombol **Test Fetch** (5.2). Hanya System Manager yang bisa mengubah; HR Manager hanya melihat. |
| **Social Accounts** | `fetch_use_login_session` dan daftar akun crawler per platform beserta statusnya, tombol Login/Test session/Disconnect (5.5). Hanya System Manager. |
| **Consent** | `consent_text_id`, `consent_text_en`, `consent_text_version`. |

Field bagian **Page Fetching** (semua `permlevel 1`):

| Field | Default | Keterangan |
|---|---|---|
| `fetch_respect_robots` | 1 | Patuhi robots.txt. Bila 0, halaman yang dilarang robots.txt tetap diambil dan dihitung di `robots_ignored_count`. |
| `fetch_identity` | `Company` | `Company`: User-Agent dari `fetch_user_agent`, tanpa peniruan. `Browser`: meniru header dan TLS fingerprint browser (`impersonate` Scrapling). |
| `fetch_user_agent` | `"<Nama Perusahaan> HR Background Check (+email kontak)"` | Dipakai bila `fetch_identity = Company`. |
| `fetch_stealth_mode` | 0 | `StealthyFetcher` (browser + penanganan tantangan anti-bot). Butuh browser terpasang. |
| `fetch_stealth_domains` | kosong | Satu domain per baris. Bila diisi, stealth hanya untuk domain ini. Kosong = semua domain. |
| `fetch_blocked_domains` | `instagram.com`, `instagr.am`, `facebook.com`, `fb.com`, `fb.me`, `tiktok.com`, `linkedin.com`, `lnkd.in` | Domain yang tidak pernah diambil. Pencocokan mencakup subdomain. Daftar yang sengaja dikosongkan dihormati (tidak diisi ulang). Mengeluarkan domain bawaan mewajibkan `fetch_risk_acknowledged`. |
| `fetch_auto_escalate` | 0 | Bila halaman terhalang (403, 429, tantangan anti-bot, halaman login), coba mode berikutnya: `Company` → `Browser` → `stealth`, tidak lebih tinggi dari yang diizinkan settingan lain. Rantai dicatat di `fetch_mode_used` (mis. `company>browser>stealth`). Wajib `fetch_risk_acknowledged`. |
| `fetch_use_login_session` | 0 | Pakai sesi akun crawler (5.5) untuk platform yang butuh login. Wajib `fetch_risk_acknowledged`. |
| `fetch_browser_status` | read only | `Installed` / `Not installed`. |
| `fetch_risk_acknowledged` | 0 | Wajib dicentang sebelum salah satu saklar di atas dilonggarkan dari default. Menyimpan `fetch_risk_ack_by` dan `fetch_risk_ack_on`. |

Validasi: menyimpan Settings dengan `fetch_respect_robots = 0`, `fetch_identity = Browser`, `fetch_stealth_mode = 1`, `fetch_auto_escalate = 1`, `fetch_use_login_session = 1`, atau daftar `fetch_blocked_domains` yang tidak lagi memuat domain bawaan ditolak bila `fetch_risk_acknowledged` belum dicentang.

Field lain: `social_max_posts` (default 200), `social_lookback_months` (default 12), `export_max_mb` (default 100), koneksi OAuth per platform (`oauth_<platform>_enabled`, `oauth_<platform>_client_id`, `oauth_<platform>_client_secret` (Password)).

### 4.6 Background Check Crawler Account

Akun asli milik perusahaan yang dipakai untuk membuka halaman yang butuh login (5.5). Doctype biasa (bukan child), hanya **System Manager** yang bisa membaca dan menulis. Satu akun aktif per platform.

| Field | Tipe | Keterangan |
|---|---|---|
| `platform` | Link Background Check Platform, wajib | Satu akun aktif per platform. |
| `account_label` | Data, wajib | Nama tampilan untuk daftar dan audit, mis. "HR Crawler IG". |
| `account_handle` | Data | Username akun di platform. |
| `enabled` | Check | |
| `risk_acknowledged` | Check | **Persetujuan di ERPNext per akun**, sama dengan pengakuan risiko di Settings. Wajib dicentang sebelum tombol Login atau penggunaan sesi. Menyimpan `risk_ack_by`, `risk_ack_on`. |
| `legal_reference` | Data, opsional | Rujukan persetujuan Legal (nomor/tanggal). |
| `status` | Select `Not connected` / `Connected` / `Challenge` / `Expired` / `Disabled`, read only | |
| `connected_by`, `connected_on` | read only | |
| `session_expires_on` | Date, read only | Dari kedaluwarsa cookie terpendek yang penting. |
| `last_checked_on`, `last_used_on` | Datetime, read only | |
| `last_error_template`, `last_error_params`, `last_error` | read only | Alasan terakhir gagal (netral bahasa). |
| `hourly_limit`, `daily_limit` | Int, default 5 dan 40 | Batas profil per jam dan per hari. |
| `min_delay_seconds`, `jitter_seconds` | Int, default 20 dan 25 | Jeda antar permintaan. |
| `session` | Password, tersembunyi | Status sesi hasil login (cookie dan storage state), terenkripsi. Tidak pernah tampil di form, log, cache, atau API. |

## 5. Sumber data

| Sumber | Cara | Catatan |
|---|---|---|
| Platform | Untuk tiap akun yang dinyatakan: ambil URL profil publik, cek sesuai `check_method`, urai nama tampilan/bio/lokasi (6.2.1). | Tidak ada pengecekan lewat email atau nomor telepon. Akun media sosial tunduk pada 3.1. |
| Social Media | Empat jalur untuk akun yang memenuhi 3.1: (1) halaman publik lewat `fetch.py`, (2) sesi akun crawler (5.5) bila halaman butuh login, (3) ekspor data yang diunggah kandidat (5.3), (4) koneksi OAuth resmi (5.4). | Profil: ada/tidaknya akun, nama tampilan, bio, lokasi. Post: teks (maks. 500 karakter), tanggal, tautan, jenis; tanpa unduhan media. Komentar milik kandidat hanya dari jalur ekspor dan API yang menyediakannya. Bila halaman login muncul dan tidak ada sesi, hasilnya `Failed` dengan alasan "login required". |
| Article | API pencarian web dengan kueri `"nama" + konteks`, dibatasi ke domain berita; atau GDELT. | Penyedia belum dipilih; selama itu `Skipped`. |
| File | Penyedia yang sama dengan kueri `filetype:pdf OR filetype:docx`. | |
| Case history | Direktori Putusan Mahkamah Agung (publik). | Hormati robots.txt dan batas laju. Banyak putusan menyamarkan nama pihak, jadi hasil bisa tidak lengkap. SKCK opsional sebagai pelengkap. |
| Posts | Platform dengan API resmi: X (berbayar), YouTube, GitHub, Mastodon, Reddit. | Belum dibangun; `Skipped`. Post di Instagram, Facebook, TikTok, LinkedIn masuk lewat sumber Social Media di atas. |

Setiap sumber adalah *provider* yang bisa diganti lewat Settings. Bila kredensial belum diisi, sumber berstatus `Skipped` dengan alasan yang jelas, bukan error.

### 5.1 Mesin pengambil halaman: Scrapling

Semua pengambilan dan penguraian halaman memakai **Scrapling** (`scrapling[fetchers]==0.5`, BSD-3), lewat satu modul `bgc/fetch.py`. Provider tidak boleh memanggil Scrapling atau `requests` langsung, supaya Settings 4.5 selalu berlaku. Agent-Reach tidak dipakai: dirancang untuk agen LLM dan aksesnya ke media sosial memakai cookie/login akun tanpa pengaman persetujuan.

| Fitur Scrapling | Dipakai untuk |
|---|---|
| `Fetcher` / `FetcherSession` (+ `impersonate` sebagai setting) | Semua pengambilan halaman biasa; session dipakai ulang dalam satu job. |
| `StealthyFetcher` / `StealthySession` (setting) | Mode stealth dan halaman yang butuh sesi login (cookie akun crawler dimuat ke sesi). |
| Selektor adaptif | Selektor halaman putusan MA dan profil tetap menemukan elemen walau tampilan situs berubah; data pelacakan di `sites/<site>/private/hris_ats/`. |
| `find_similar` | Mengambil semua baris hasil yang strukturnya sama. |
| `page.markdown()` | Isi artikel bersih untuk pencocokan konteks, setelah penyedia Article dipilih. Bukan LLM. |

Penelusuran halaman Direktori Putusan MA dikerjakan manual lewat `fetch.py` (kelas Spider yang tidak terpakai sudah dihapus). PDF putusan diunduh lewat `fetch.py` lalu dibaca dengan `pdfplumber`.

Fitur Scrapling yang **tidak** dipakai: `ProxyRotator`, server MCP, Agent Skill, extra `[ai]`.

Perilaku `bgc/fetch.py` menurut Settings:

| Setting | Perilaku |
|---|---|
| Default | `Fetcher` tanpa `impersonate`, User-Agent perusahaan, robots.txt dicek (Protego), batas laju per domain lewat Redis. |
| `fetch_respect_robots = 0` | Cek robots.txt tidak memblokir; tetap dicatat bila memang dilarang. |
| `fetch_identity = Browser` | `Fetcher` dengan `impersonate` browser. |
| `fetch_stealth_mode = 1` | `StealthyFetcher` untuk `fetch_stealth_domains` (atau semua). Browser belum terpasang → `Failed` dengan pesan jelas, tidak diam-diam turun ke mode biasa. |
| `fetch_auto_escalate = 1` | Naik mode otomatis saat terhalang (4.5), berhenti di percobaan pertama yang berhasil. |
| `fetch_use_login_session = 1` | Untuk platform dengan akun crawler `Connected`, halaman dibuka dengan sesi akun itu (5.5). |
| Domain di `fetch_blocked_domains` | Ditolak (`ForbiddenDomainError`) apa pun mode lainnya. |

Yang berlaku apa pun settingnya: batas laju per domain, cache maksimal 24 jam per kueri di Redis (kunci HMAC, tanpa nama kandidat dalam teks biasa), persetujuan kandidat dan `consent_scope`, 3.1 untuk media sosial, dan daftar yang tidak dibangun di 2.1. Saklar di Settings mengatur **cara** dan **domain mana yang diizinkan**, bukan melonggarkan persetujuan kandidat.

**Browser untuk mode stealth dan login interaktif** tidak dipasang secara default (`docker/dev-ats.sh --with-browsers`, dependensi sistem dipasang sebagai root; image produksi lewat langkah build terpisah).

**Jejak audit**: setiap Source Run mencatat `fetch_mode_used`, `robots_ignored_count`, `accounts_skipped`, dan `crawler_account`. Perubahan Settings tercatat lewat `track_changes`. Laporan PDF menyebut mode yang dipakai.

**Risiko yang ditampilkan di samping `fetch_risk_acknowledged` dan `risk_acknowledged` akun crawler**:
- Mengambil halaman dari platform media sosial, apalagi dengan akun yang login, melanggar ketentuan layanannya; dengan mode stealth dapat dianggap menerobos sistem pengamanan (UU ITE Pasal 30 ayat (3)). Akun crawler bisa dibatasi atau diblokir kapan saja.
- Mengabaikan robots.txt dan menyamar sebagai browser melanggar ketentuan layanan banyak situs dan bisa membuat IP server diblokir, termasuk untuk layanan lain di server yang sama.
- Keputusan mengaktifkannya sebaiknya disetujui Legal dan dicatat.

### 5.2 Tombol "Test Fetch" di Settings

Membuktikan dengan data apa yang benar-benar terambil dari sebuah URL, per mode, sebelum diandalkan.
- Hanya System Manager. Dialog meminta URL dan kotak centang wajib "Saya pemilik profil ini atau punya izin pemiliknya".
- Menjalankan `fetch.py` tiga kali (mode biasa, `Browser`, stealth) dengan konfigurasi eksplisit mode itu. Domain yang masih di `fetch_blocked_domains` ditolak. Stealth dilewati dengan pesan jelas bila browser belum terpasang.
- Hasil per mode: status HTTP, URL akhir setelah redirect, `mode_used`, ukuran isi, `<title>`, 300 karakter pertama teks tampilan, dan badge "Possible login page". Deteksi halaman login: URL akhir ke jalur login/checkpoint/authwall, atau judul halaman memuat login, atau ada kolom password, atau isi sangat pendek dengan frasa login tanpa konten profil. Halaman publik panjang dengan tautan "Sign in" di navigasi bukan halaman login.
- Tidak ada eskalasi otomatis antar mode di luar tombol ini dan tidak ada percobaan login. Isi halaman **tidak disimpan**; log hanya mencatat waktu, pengguna, domain, mode, status, dan hasil deteksi login.

### 5.3 Ekspor data yang diunggah kandidat

Cara paling lengkap dan paling sah untuk post dan komentar di platform yang menyembunyikan isinya di balik login: kandidat mengunduh arsip data akunnya sendiri (fitur "download your data" yang disediakan Instagram, Facebook, TikTok, dan LinkedIn) lalu mengunggahnya di halaman persetujuan.

- Pada tiap akun media sosial di halaman persetujuan, kandidat memilih "Unggah ekspor data saya (disarankan)". Halaman menampilkan petunjuk singkat per platform dan tautan ke halaman bantuan resminya; langkah menu tidak ditulis rinci karena sering berubah.
- Berkas ZIP/JSON/CSV/HTML sampai `export_max_mb`. Diproses di berkas sementara, **arsip asli dihapus segera setelah dibaca**. Hanya hasil ekstrak yang disimpan.
- Parser per platform (`bgc/export_parsers/<platform>.py`, fungsi murni) membaca **hanya daftar berkas yang di-allowlist**: profil, postingan, dan **komentar yang ditulis kandidat sendiri**. DM, kontak, riwayat lokasi, data iklan, like/reaksi, serta komentar atau nama orang lain **tidak dibaca dan tidak disimpan**.
- Komentar: hanya teks komentar kandidat (maks. 500 karakter), tanggal, dan tautan ke post bila ada. Isi post yang dikomentari dan nama pihak ketiga tidak disimpan; mention disamarkan `@[user]`.
- Hasil: Finding tipe `Post` atau `Comment` dengan `provenance = Candidate export` dan `text_source = Candidate export`; akun diberi `connection_method = Data export`. Format arsip yang tidak dikenali menghasilkan galat yang jelas, bukan hasil kosong.
- Mengunggah berkas tidak menggantikan kotak persetujuan: scope `Social Media` dan centang akun tetap wajib.
- Penarikan persetujuan dan retensi menghapus semua hasil ekstrak.

### 5.4 Koneksi OAuth resmi (opsional)

Kandidat mengotorisasi akses baca terbatas lewat OAuth platform (tombol "Hubungkan akun" di halaman persetujuan). Sistem tidak pernah melihat password. Token dipakai satu kali untuk mengambil data lalu dibuang dan, bila platform menyediakan, dicabut.

- Hanya platform yang API resminya memungkinkan membaca post milik sendiri: Google/YouTube, TikTok (Login Kit + Display API), X (berbayar), Reddit, GitHub, Mastodon. Meta (Instagram/Facebook) dan LinkedIn membatasi akses ke post lewat review aplikasi atau program mitra, jadi untuk keduanya jalur ekspor (5.3) dan sesi akun crawler (5.5) yang dipakai.
- Butuh client ID dan secret yang didaftarkan perusahaan di tiap platform; tersimpan sebagai Password di Settings dan nonaktif sampai diisi. Hasil: `provenance = OAuth API`, `connection_method = OAuth`.

### 5.5 Sesi akun crawler (login interaktif)

Untuk halaman yang hanya bisa dilihat setelah login (terutama Instagram, Facebook, TikTok, LinkedIn). Perusahaan menyediakan akun asli untuk tiap platform di tab **Social Accounts**.

**Tampilan di tab Social Accounts.** Daftar akun crawler per platform: platform, label, handle, status (Connected/Expired/Challenge/Not connected/Disabled), terakhir login, terakhir dipakai, kedaluwarsa sesi, dan tombol per baris: **Login**, **Test session**, **Disconnect**, serta aktif/nonaktif. Menambah akun baru butuh centang `risk_acknowledged` (persetujuan di ERPNext) dan hanya System Manager yang bisa.

**Tombol Login: pop-up browser jarak jauh.**
1. Tombol aktif hanya bila `fetch_risk_acknowledged` (Settings) dan `risk_acknowledged` (akun) dicentang, browser terpasang, dan pengguna System Manager.
2. Klik **Login** membuka dialog yang menampilkan browser sungguhan di server (headless Chromium lewat Patchright/Playwright) pada `login_url` platform. Layar dikirim ke dialog sebagai gambar yang diperbarui berkala; klik dan ketikan pengguna diteruskan ke browser itu.
3. **Manusia yang mengisi username, password, dan menyelesaikan 2FA, CAPTCHA, atau checkpoint.** Sistem tidak menyimpan password, tidak mencatat ketikan, tidak menyimpan tangkapan layar, dan tidak mencoba melewati tantangan apa pun.
4. Setelah login berhasil, pengguna menekan **Selesai**. Server memverifikasi sesi (membuka halaman beranda atau profil akun itu dan mencari penanda sudah login), mengambil `storage_state`, menyaringnya hanya ke `session_domains` platform, mengenkripsi ke field `session`, mengisi `status = Connected`, `connected_by/on`, `session_expires_on`, lalu menutup browser dan menghapus direktori profilnya.
5. Dialog punya batas waktu 10 menit, hanya satu sesi login sekaligus, dan menutup browser bila dialog ditutup.
6. **Cadangan bila browser jarak jauh tidak berfungsi** (mis. platform menolak login dari browser server): impor manual, System Manager menempelkan cookie sesi yang diekspor dari browser pribadinya ke dialog yang sama; hasil akhirnya sama (`session` terenkripsi). Ini cadangan, bukan jalur utama.

**Pemakaian saat crawling.**
- Hanya bila `fetch_use_login_session = 1`, platform punya akun `Connected` dan `enabled`, persetujuan kandidat per akun lolos (`assert_social_consent`), dan domain diizinkan. Source Run mencatat `crawler_account` dan `provenance = Crawled (session)`.
- **Hanya membaca**: membuka URL profil milik kandidat yang sudah setuju (dari username yang dia nyatakan). Tidak ada pencarian nama, daftar pengikut, mengikuti akun, like, komentar, DM, atau permintaan pertemanan. Profil privat tidak dijangkau.
- **Pelan dan manusiawi**: batas `hourly_limit` dan `daily_limit` per akun, jeda `min_delay_seconds` + acak `jitter_seconds`, satu permintaan pada satu waktu per akun.
- **Berhenti saat dihalangi**: checkpoint, tantangan, penguncian akun, atau sesi kedaluwarsa → akun `status = Challenge` atau `Expired`, sumber `Failed` dengan alasan terstruktur, admin diberi notifikasi, dan tidak ada percobaan ulang otomatis. Kandidat diarahkan ke jalur ekspor (5.3).
- **Test session**: membuka halaman beranda akun itu dan menampilkan hanya nama akun dan statusnya, untuk memastikan sesi masih sah.
- **Disconnect**: menghapus `session`, status menjadi `Not connected`. Menonaktifkan akun atau mematikan `fetch_use_login_session` menghentikan pemakaian seketika.
- Sesi tidak pernah masuk log, cache Redis, Finding, Source Run, respons API, atau tampilan peran selain System Manager. Penggunaan tercatat (waktu, platform, kandidat, hasil) tanpa isi sesi.

## 6. Algoritma (tanpa LLM)

### 6.1 Persiapan identitas
- Normalisasi nama: huruf kecil, hapus gelar (S.Kom., S.T., Dr., Ir., M.M., dll.), satukan spasi.
- Variasi nama: lengkap, nama depan + belakang, tanpa nama tengah. Nama satu kata (mononim) ditandai karena kemungkinan salah orang jauh lebih tinggi.
- Konteks dari Resume Screening: kota domisili, perusahaan, sekolah/universitas, jabatan.

### 6.2 Skor kecocokan identitas (Article, File, Case)

```
match_confidence = name_similarity (0–50)
                 + context_match   (0–40)
                 + uniqueness_bonus (0–10)
```

- **name_similarity**: rapidfuzz `token_sort_ratio` antara variasi nama dan nama di teks. Cocok persis = 50; ≥ 90 = 40; ≥ 80 = 25; di bawahnya = 0 (temuan dibuang).
- **context_match**: +15 per istilah konteks dalam radius 300 karakter dari nama (kota, perusahaan, sekolah, jabatan), maksimal 40.
- **uniqueness_bonus**: +10 bila pencarian nama persis menghasilkan < 20 hasil; 0 untuk mononim.
- Tingkat: ≥ 80 tinggi, 50–79 sedang, < 50 rendah (disembunyikan secara default).
- **Teks yang dipakai**: PDF putusan → teks lengkap halaman → cuplikan hasil pencarian. Skor dihitung ulang setiap kali teks yang lebih lengkap tersedia; `text_source` mencatatnya. Skor dari cuplikan saja maksimal 70.
- Bila nama muncul beberapa kali di teks lengkap, `context_match` dihitung di kemunculan dengan konteks terbanyak, dan potongan di sekitarnya disimpan sebagai `evidence_excerpt`.

### 6.2.1 Kecocokan identitas akun platform

Selain mengecek profil publik ada, halaman profil diurai (selektor di katalog platform) untuk nama tampilan, bio, dan lokasi:

```
identity_match = display_name_similarity (0–50)
               + location_matches_candidate_city (0–20)
               + bio_mentions_cv_company_school_title (0–20)
               + declared_by_candidate (+10)
```

Akun yang tidak dinyatakan kandidat dengan `identity_match` < 50 tidak ditampilkan sebagai milik kandidat. Akun media sosial hanya diurai bila syarat 3.1 terpenuhi dan platform punya selektor; bila tidak, `identity_match` dikosongkan.

### 6.3 Klasifikasi Article dan File
Cocokkan judul + cuplikan ke leksikon:
- `Achievement`: juara, meraih, penghargaan, award, winner, beasiswa, dll.
- `Professional`: narasumber, pembicara, peneliti, proyek, publikasi, jurnal.
- `Risky`: kategori leksikon dengan severity ≥ `Medium` (mis. ditangkap, tersangka, penipuan, korupsi, narkoba).
- Selain itu `Neutral`.

Severity temuan = severity leksikon tertinggi yang cocok, diturunkan satu tingkat bila `match_confidence` < 80.

### 6.4 Case history
1. Telusuri semua halaman hasil pencarian sampai `max_results_per_source`, buka halaman detail tiap hasil, dan ambil metadata: jenis perkara (Pidana, Perdata, Perdata Khusus, Agama, TUN), nomor, pengadilan, tanggal register/upload/putus, tautan PDF.
2. Unduh PDF putusan untuk hasil dengan `name_similarity` ≥ 80 dan baca dengan `pdfplumber`. Dari bagian identitas para pihak, ambil peran, pekerjaan, dan kota/kabupaten pihak yang namanya cocok; pekerjaan dan kota dipakai sebagai istilah konteks di 6.2. Nama pihak lain, NIK, alamat lengkap, dan data lain tidak disimpan. PDF dibuang setelah dibaca.
   Peran ditentukan dengan regex di sekitar nama: `Terdakwa`, `Tergugat`, `Penggugat`, `Pemohon`, `Termohon`, `Saksi`. Peran dari PDF mengalahkan peran dari cuplikan. PDF hasil scan → peran dari halaman detail, `text_source = Full text`.
3. Severity:

   | Jenis | Peran | Severity |
   |---|---|---|
   | Pidana | Terdakwa | High |
   | Perdata / Perdata Khusus | Tergugat | Medium |
   | Perdata | Penggugat / Pemohon (mis. ganti nama, penetapan ahli waris) | Info |
   | Apa pun | Saksi | Info |
   | Agama, TUN | apa pun | Info, disembunyikan secara default |

4. Putusan permohonan perdata (contoh layar 08) berseverity `Info`, bukan risiko.
5. Temuan Case **tidak pernah** menaikkan `risk_level_auto` di atas `Needs verification`. Hanya setelah HR menandainya `Relevant` (idealnya setelah konfirmasi ke kandidat atau dicek dengan SKCK) temuan ini dihitung.

### 6.5 Analisis post dan komentar (pengganti layar 10)
Sumber: API resmi, halaman publik, sesi akun crawler, ekspor yang diunggah kandidat, dan OAuth (5). Untuk setiap akun, ambil maksimal `social_max_posts` post terbaru dalam `social_lookback_months` (komentar milik kandidat dari ekspor ikut dihitung dalam periode yang sama), lalu hitung:

| Bagian | Isi | Cara |
|---|---|---|
| Aktivitas | Jumlah post dan komentar, last active, rata-rata per minggu, sebaran jam | Fakta saja, tanpa tafsiran kepribadian. |
| Kesantunan bahasa | % post dan komentar yang mengandung kata kasar/hinaan | Leksikon kategori `Profanity`. Skor = 100 − (persentase × faktor). |
| Konten berisiko | Post dan komentar yang cocok kategori `Hate speech`, `Threats/violence`, `Pornography`, `Online gambling`, `Narcotics`, `Fraud`, `Company information leak` | Leksikon + regex. Tiap yang cocok menjadi Finding tipe `Post` atau `Comment` dengan tautan ke aslinya. |
| Relevansi profesional | % post yang menyebut skill/topik dari lowongan | Cocokkan ke `required_skills` dan `preferred_skills` Job Opening. |
| Sentimen umum | Rasio positif : negatif | Leksikon sentimen bahasa Indonesia (cek lisensinya). Hanya informasi, tidak masuk tingkat risiko. |

Semua hasil berupa angka dan daftar bukti, bukan kesimpulan naratif tentang karakter orang. Like dan reaksi tidak dianalisis (2.1).

### 6.6 Tingkat risiko
`risk_level_auto` dihitung dari temuan dengan `match_confidence` ≥ ambang:
- `Needs verification`: ada temuan severity `High` yang belum ditinjau HR.
- `High`: ada temuan severity `High` yang ditandai `Relevant`.
- `Medium`: ≥ 3 temuan `Medium` yang `Relevant`, atau skor kesantunan < 60.
- `Low`: selain itu.

HR menetapkan `risk_level_final` dan `hr_conclusion`. Sistem tidak pernah menolak kandidat otomatis.

### 6.7 Ringkasan otomatis (layar 03)
Disusun dari templat kalimat yang diisi fakta, contoh (sumber Inggris; terjemahan Indonesia di `id.csv`):

> {name} applied for {title}. {n} public accounts were found ({platforms}). {a} articles are likely related, {p} of them about achievements. {c} case records need verification. Analysis of {m} posts shows a language politeness score of {score}/100 and {r} posts flagged as risky.

Kalimat yang nilainya nol dihilangkan; bila judul lowongan kosong, bagian "for {title}" dihilangkan. Ringkasan disimpan sebagai templat + parameter dan dirender dalam bahasa pembaca. HR bisa menimpanya lewat `summary_hr`.

## 7. Pemetaan layar ke Desk

| Layar | Di ERPNext |
|---|---|
| 01 list | List view Background Check: kandidat, kontak, region, lowongan, ikon akun, status, level. Filter Level & Applied to bawaan. |
| 02 add profile | Form Background Check baru (dari Job Applicant atau berdiri sendiri), tabel akun. |
| 03–10 tab | Form dengan Tab Break: Summary, Platform, Digital footprint by name (Article/File/Case), Digital footprint by account (Post/Comment/Analysis). Daftar temuan di field HTML dengan pencarian dan paginasi, plus tautan ke list Finding terfilter. |
| Tab GetContact | Tidak ada. |
| Panel "Candidate detail" | Sidebar form: tanggal lamaran, lowongan, kontak, region, ikon akun. Tanpa usia dan gender. |
| Pensil di header | Ubah input lalu "Jalankan ulang". |
| Unduh | Print Format "Background Check Report" (PDF), hanya temuan `Relevant` + kesimpulan HR + mode pengambilan. |
| Panah kiri/kanan | Prev/next bawaan form. |
| Halaman persetujuan | `/ats-consent`: bahasa kandidat, pemilih ID | EN, semua kotak kosong di awal, bagian akun media sosial per akun, unggah ekspor. |
| Settings | Tab General, Providers, Page Fetching (+ Test Fetch), Social Accounts (akun crawler + Login), Consent (4.5). |
| Crawler Account | List + form `Background Check Crawler Account`, hanya System Manager (4.6). |

## 8. Keamanan, akses, dan retensi

- Role **Background Check Officer**. Hanya role ini dan HR Manager yang bisa membaca Background Check dan Finding. **System Manager tidak** diberi akses baca data kandidat; ia hanya mengelola Settings (`permlevel 1`) dan akun crawler.
- Interviewer dan atasan pengguna hanya melihat `risk_level_final` dan `hr_conclusion` lewat Job Applicant.
- Setiap pembukaan dokumen dicatat (Access Log bawaan + `track_views`).
- `purge_after` = tanggal keputusan akhir pelamar (Rejected/Hired) + `retention_days`. Job harian menghapus Finding, ringkasan otomatis, data akun (termasuk `display_name`, `bio_snippet`, `profile_location`, `identity_*`), `skck_file`, dan berkas crawl, dan hanya menyisakan level, kesimpulan HR, `skck_status`, dan bukti persetujuan.
- Penarikan persetujuan menghapus hal yang sama seketika, termasuk entri cache terkait.
- Cache Redis menyimpan isi halaman paling lama 24 jam dengan kunci HMAC (rahasia site; gagal tertutup bila tidak ada); PDF putusan dibuang segera setelah dibaca. Mode live gagal tertutup bila Redis tidak tersedia.
- **Sesi akun crawler** disimpan terenkripsi (field Password), hanya terbaca oleh proses crawling di server, tidak pernah tampil di UI, log, cache, atau API, dan dihapus saat Disconnect. Akun crawler bukan akun pribadi karyawan; kredensialnya tidak pernah disimpan.
- Kandidat berhak meminta salinan dan koreksi (UU PDP). Laporan PDF dipakai untuk memenuhinya.
- Secara default crawling memakai User-Agent yang menyebut nama perusahaan, mematuhi robots.txt, dan memblokir domain media sosial; semuanya bisa dilonggarkan oleh System Manager dengan pengakuan risiko (5.1). Batas laju per domain dan cache 24 jam selalu berlaku.

## 9. Pemicu dan perpindahan tahap
- Tombol "Mulai background check" di Job Applicant (hanya bila Resume Screening `Done`) → Background Check dibuat, `recruitment_stage = Background Check`, email persetujuan terkirim dalam bahasa kandidat.
- Persetujuan `Granted` → satu background job per sumber yang disetujui (antrean `long`), `status = Crawling`, status per sumber via `publish_realtime`.
- Semua sumber selesai → `status = Done`, tingkat risiko dan ringkasan dihitung, notifikasi ke Background Check Officer.
- HR mengisi kesimpulan lalu membuat Interview → `recruitment_stage = Interview`. Interview tidak bisa dibuat sebelum `hr_conclusion` terisi (hanya untuk pelamar yang punya Background Check).

## 10. Keputusan

Sudah diputuskan: Dragonfly tidak dipakai; SKCK opsional; pengambil halaman Scrapling dengan mode longgar lewat Settings (termasuk eskalasi otomatis antar mode); domain media sosial bisa dibuka lewat Settings, tetap butuh persetujuan kandidat per akun, dan mencakup profil serta post publik; ekspor data kandidat dan OAuth resmi sebagai jalur lengkap; **akun crawler per platform dengan login interaktif (sesi disimpan terenkripsi), dengan persetujuan di ERPNext per akun**; semua platform (Instagram, Facebook, TikTok, LinkedIn); komentar milik kandidat lewat ekspor; Settings dirapikan jadi tab; UI mengikuti bahasa pengguna dengan sumber Inggris. Tidak dibangun: like/reaksi, akun palsu, penembusan 2FA/CAPTCHA/checkpoint, aksi tulis, proxy rotation.

Masih terbuka (tidak menghalangi pembangunan, karena sumbernya bisa dimatikan):
1. **Penyedia pencarian web** untuk Article/File, beserta anggarannya.
2. **API X** berbayar: perlu atau tidak? Tanpa itu, analisis post v1 hanya untuk YouTube, GitHub, Mastodon, dan Reddit.
3. **Review Legal** atas teks persetujuan (dua bahasa), isi awal leksikon, dan pemakaian akun crawler sebelum dipakai ke kandidat sungguhan.
4. **Tanggal dan tempat lahir** untuk pencocokan identitas (opsional): dipakai hanya untuk pencocokan, tidak ditampilkan di screening, tidak memengaruhi skor. Perlu diputuskan apakah diminta di form persetujuan.
5. **Hasil "Test Fetch" (5.2)** per platform: menentukan seberapa sering akun crawler diperlukan dibanding halaman publik.
6. **Pendaftaran aplikasi OAuth** (5.4): perlu client ID dan secret di tiap platform; tidak menghalangi pembangunan jalur lain.
7. **Pengecekan username di platform lain** (menemukan akun yang tidak dinyatakan kandidat): belum diputuskan.

## 11. Status pengerjaan
Kerangka app, Resume Screening, Background Check (doctype, persetujuan, mock, tampilan, retensi), lapisan `fetch.py`, provider live Platform dan Case history, akurasi data, perbaikan bahasa, domain terlarang sebagai settingan, persetujuan media sosial per akun, tombol Test Fetch, dan audit sudah ada di `feat/hris-ats` (Fase 1–5 `PROMPT-ANTIGRAVITY-PERBAIKAN.md` selesai). Berikutnya: `PROMPT-ANTIGRAVITY-SOSMED.md` (tab Settings, akun crawler, crawl media sosial, ekspor dengan komentar, OAuth opsional). Belum dikerjakan: penyedia pencarian Article/File, provider Posts untuk API resmi lainnya, penerapan ke srv-vllm (`hris_ats` perlu dipindah ke repo git sendiri dan ditambahkan ke `apps.json`; server produksi memakai site baru dengan `encryption_key` sendiri).

## 12. Bahasa dan terjemahan

- Bahasa UI mengikuti bahasa pengguna ERPNext (sama seperti aplikasi mobile yang mengikuti bahasa akun). Pengguna `en` melihat Inggris penuh dan pengguna `id` melihat Indonesia penuh.
- **Bahasa sumber semua string = Inggris** (label, pesan, template, nilai Select). Terjemahan Indonesia ada di `translations/id.csv`, kunci persis sama dengan string Inggris. Tidak ada string Indonesia di kode sumber, kecuali **kosakata isi CV/dokumen** (kata kunci judul bagian CV, sinonim, regex tanggal, istilah leksikon) yang memang dua bahasa. Nama jenjang pendidikan lokal (`SMA/SMK`, `D3`, `D4/S1`) dibiarkan.
- Nilai Select tersimpan dalam Inggris. Pemetaan dari versi sebelumnya:

  | Lama | Baru |
  |---|---|
  | Rendah / Sedang / Tinggi | Low / Medium / High |
  | Perlu verifikasi | Needs verification |
  | Prestasi / Profesional / Netral / Berisiko | Achievement / Professional / Neutral / Risky |
  | Belum ditinjau / Relevan / Bukan orang ini / Diabaikan | Not reviewed / Relevant / Not this person / Ignored |
  | Tidak diunggah / Belum diperiksa / Bersih / Ada catatan / Kedaluwarsa | Not uploaded / Not checked / Clear / Has records / Expired |
  | Cuplikan / Teks lengkap / PDF putusan | Snippet / Full text / Decision PDF |
  | Kategori leksikon (Kata kasar, Ujaran kebencian/SARA, Ancaman/kekerasan, Pornografi, Judi online, Narkoba, Penipuan, Kebocoran informasi perusahaan, Hukum-negatif, dst.) | Profanity, Hate speech, Threats/violence, Pornography, Online gambling, Narcotics, Fraud, Company information leak, Legal-negative, dst. |

- **Teks yang dibuat sistem** (alasan skor, alasan kecocokan, penanda risiko, ringkasan otomatis, pesan galat Source Run dan akun crawler) tidak disimpan sebagai kalimat jadi. Disimpan sebagai `*_template` (string Inggris bertanda `{param}`) + `*_params` (JSON) + `*` (hasil render Inggris sebagai cadangan dan untuk pencarian). Saat ditampilkan, `hris_ats/i18n.py` merender `_(template).format(**params)` dalam bahasa pengguna. Data lama tidak di-backfill; "Screen again" membuat ulang dalam format baru.
- **Halaman persetujuan kandidat dan email undangan** memakai bahasa **kandidat**, bukan bahasa HR (bagian 3). Teks persetujuan ada dua versi (`consent_text_id`, `consent_text_en`) dan bahasa serta versi yang disetujui disimpan sebagai bukti.
- Test penjaga: setiap string sumber punya baris di `id.csv`, tidak ada kata Indonesia umum di string sumber di luar modul kosakata CV yang di-allowlist, semua label/opsi di JSON doctype berbahasa Inggris, dan `render` benar pada bahasa `en` dan `id`.

## 13. Urutan pengerjaan yang tersisa
1. Rapikan Settings jadi tab (tanpa perubahan perilaku).
2. Akun crawler per platform: doctype, persetujuan di ERPNext, login interaktif, status.
3. Crawl media sosial: eskalasi mode, penjaga persetujuan terpusat, adaptor per platform, sesi akun crawler.
4. Ekspor data kandidat (post dan komentar).
5. OAuth resmi (opsional, bila ada client ID).
6. Verifikasi akhir dan audit.
7. Setelah itu: penyedia pencarian Article/File, provider Posts untuk API resmi lainnya, penerapan ke srv-vllm.
