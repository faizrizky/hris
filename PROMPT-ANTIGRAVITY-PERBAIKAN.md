# Prompt untuk Antigravity: Perbaikan menyeluruh hris_ats (bahasa, persetujuan media sosial, audit)

Salin seluruh isi di bawah garis ke Antigravity. Kerjakan **per fase**; setelah setiap fase agen wajib berhenti dan melapor.

---

## Konteks

Custom app `hris_ats` (Resume Screening + Background Check) sudah dibangun di branch `feat/hris-ats`, di `docker/apps/hris_ats/`, lewat dua prompt sebelumnya: `PROMPT-ANTIGRAVITY-ATS.md` dan `PROMPT-ANTIGRAVITY-SCRAPLING.md`. Tugas ini **perbaikan dan penyempurnaan**: bukan membangun ulang.

Sumber kebenaran: `SPEC-RESUME-SCREENING.md`, `SPEC-BACKGROUND-CHECK.md`, dan dua prompt di atas. `SPEC-BACKGROUND-CHECK.md` dan `SPEC-RESUME-SCREENING.md` sudah diperbarui sesuai prompt ini (nilai Select Inggris, domain terlarang sebagai settingan, persetujuan media sosial per akun, bahasa kandidat, bagian 12 "Bahasa dan terjemahan"). Bila prompt dan spesifikasi tetap berbeda di suatu detail, **berhenti dan tanya**. Jangan mengedit berkas `SPEC-*.md`; catat penyimpangan di laporan.

Field tambahan yang ada di spesifikasi tetapi belum disebut rinci di bawah, dan harus dibuat: `Background Check Source Run.accounts_skipped`; nilai sumber `Social Media` di `Source Run.source` dan `Consent Scope.source`; `Background Check Account.social_consent_attested_by/_on`; `Background Check Platform.display_name_selector/bio_selector/location_selector`.

Larangan keras di `PROMPT-ANTIGRAVITY-ATS.md` **tetap berlaku seluruhnya**, kecuali satu hal yang diubah secara eksplisit di Bagian B (daftar domain terlarang menjadi settingan). Tetap tanpa: analisis politik/psikologis, GetContact, cek akun lewat email/telepon, **login atau cookie akun media sosial**, `ProxyRotator`, usia/gender dalam penilaian, penolakan otomatis, LLM/model ML, Dragonfly.

## Temuan yang sudah diketahui (verifikasi ulang sebelum mengubah)

Hasil pemeriksaan singkat sebelum prompt ini ditulis:

1. **Bahasa UI bercampur.** Semua pengguna di site punya `language = en` (dicek langsung). Namun banyak string sumber di kode ditulis dalam Bahasa Indonesia, sehingga pengguna berbahasa Inggris melihat teks Indonesia di tengah label Inggris. Contoh: `scoring/workflow.py` (`_("Dokumen Resume Screening {0} tidak ditemukan.")`, `_("Pelamar {0} tidak ditemukan.")`, pesan "Wawancara tidak dapat dibuat sebelum Kesimpulan HR…"), `bgc/consent.py` (`_("Persetujuan Pemeriksaan Latar Belakang - Rekrutmen")`), seluruh `www/ats_consent.html`, alasan skor di `scoring/metrics/*.py` (mis. "Format tanggal sangat konsisten…"), dan **nilai Select** di doctype (`Rendah/Sedang/Tinggi/Perlu verifikasi`, `Prestasi/Profesional/Netral/Berisiko`, `Belum ditinjau/Relevan/Bukan orang ini/Diabaikan`, `Tidak diunggah/Belum diperiksa/Bersih/Ada catatan/Kedaluwarsa`, kategori leksikon). Beberapa `frappe.throw(...)` (mis. `resume_screening_template.py` baris ±80, 97, 125; `background_check_settings.py` ±61; `scoring/workflow.py` ±398) mungkin belum dibungkus `_()` sama sekali.
2. **Checkbox persetujuan sudah tercentang di awal.** `www/ats_consent.html` ±baris 39: `<input class="source-checkbox" … checked>`. Persetujuan yang sah harus aktif (opt-in), bukan dicentang otomatis.
3. **Daftar domain terlarang di-hardcode** (`FORBIDDEN_DOMAINS` di `bgc/fetch.py`), padahal keputusannya settingan yang bisa dilonggarkan.
4. **`CourtMASpider`** di `bgc/providers/court_ma.py` hanya kelas kosong ("referensi arsitektur") dan tidak dipakai; penelusuran halaman dilakukan manual lewat `fetch()`.
5. Test murni (`tests/scoring`, `tests/bgc`) lulus (59 test). Test `FrappeTestCase` belum diverifikasi ulang.

## Aturan kerja

- Tetap di branch `feat/hris-ats`. **Jangan push**, jangan merge. Commit per fase dengan gaya `FEAT: ...` / `FIX: ...` berbahasa Indonesia, **tanpa trailer `Co-Authored-By` atau atribusi AI apa pun**.
- Jangan `docker compose down -v`, `bench restore`, atau `drop-site` pada `hris.localhost`. Jangan `eas build`/`eas update`. Jangan mengubah `docker/server-scripts/`, aplikasi mobile, atau data pengguna yang ada.
- Semua test tanpa internet (jaringan di-mock). Data contoh fiktif.
- Jangan menebak API Scrapling atau Frappe; baca source yang terpasang.
- Bila spesifikasi atau prompt ini ambigu, **berhenti dan tanya**.

---

## Fase 1: Audit dan baseline (tanpa mengubah perilaku)

Tujuan: peta masalah yang akurat sebelum menyentuh kode. **Jangan memperbaiki apa pun di fase ini**, kecuali menambah test yang gagal.

1. Jalankan semua test: `tests/scoring`, `tests/bgc` (pytest murni) dan seluruh `FrappeTestCase` (`test_*.py` di `tests/`). Untuk `FrappeTestCase`, gunakan site uji sementara bernama persis `ats-test.localhost` (buat, jalankan, lalu hapus **hanya site itu**). Jangan menjalankan test di `hris.localhost`. Laporkan jumlah lulus/gagal.
2. `ruff check` pada `docker/apps/hris_ats` (konfigurasi ada di `pyproject.toml`). Laporkan temuan; jangan memperbaiki dulu.
3. Buat inventaris string pengguna (UI) dan klasifikasikan satu per satu: sumber berbahasa Indonesia / Inggris / belum dibungkus `_()` atau `__()`. Cakup: semua `_()` dan `__()`, `frappe.throw/msgprint/publish_realtime` message, label/deskripsi/opsi di semua `*.json` doctype dan `fixtures/`, Client Script dan berkas JS di `public/`, template HTML, print format, workspace, number card, kolom kanban, indikator list, judul email/notifikasi, dan teks hasil generator (`reason`, `summary_auto`, `match_reasons`, `risk_flags`, `error` di Source Run). Tampilkan sebagai tabel di laporan: berkas:baris | string | kategori.
4. Audit kepatuhan terhadap spesifikasi dan prompt sebelumnya. Untuk setiap butir, tulis **Lulus / Gagal / Sebagian** beserta bukti (file:baris atau keluaran perintah):
   - Larangan keras `PROMPT-ANTIGRAVITY-ATS.md`: cari penggunaan usia/gender/foto di `scoring/` dan `bgc/`; tidak ada GetContact, politik/partai, kepribadian, LLM, cookie/login, `ProxyRotator`, cek akun via email/telepon.
   - `bgc/providers/base.py`: tidak ada sisa cache atau rate limit di memori instance; `bgc/fetch.py` memakai Redis di worker (cek `get_default_cache_backend`: apakah bisa diam-diam jatuh ke `MemoryCacheBackend` di worker, dan apakah itu bisa terjadi di produksi).
   - Cache Redis: kunci tidak memuat nama kandidat dalam teks biasa, TTL ≤ 24 jam, dan isi halaman/PDF kandidat tidak tersimpan lebih lama dari itu.
   - Hak akses nyata: uji dengan pengguna berperan berbeda (HR Manager, HR User, Interviewer, Employee, Background Check Officer, System Manager) pada Background Check, Finding, Settings (permlevel 1), dan Job Applicant (interviewer hanya melihat `risk_level_final` dan `hr_conclusion`).
   - Persetujuan: tanpa `Granted`, tidak ada job; sumber yang tidak dicentang tidak jalan; token sekali pakai dan kedaluwarsa; penarikan persetujuan menghapus Finding **dan** data turunan di akun (`display_name`, `bio_snippet`, `profile_location`, `identity_*`) serta crawldir dan cache.
   - Retensi harian: hasil purge sesuai spesifikasi 8 (sisakan level, kesimpulan HR, bukti persetujuan; hapus Finding, ringkasan, akun, dan berkas sementara). Catat bila `skck_file` ikut dihapus atau tidak, dan apakah itu sesuai spesifikasi.
   - Gerbang Interview: hanya berlaku untuk pelamar yang punya Background Check; pesan galat bisa diterjemahkan.
   - Aturan risiko 6.6 dan Case 6.4 (temuan Case tidak pernah menaikkan `risk_level_auto` di atas "perlu verifikasi" sebelum ditandai Relevan) ada ujinya.
   - Print Format Background Check hanya memuat temuan Relevan + kesimpulan HR + mode pengambilan.
   - `CourtMASpider`: apakah dipakai atau kode mati.
   - `git diff main -- docker/server-scripts src App.tsx modules app.json eas.json` kosong.
   - Seed: dijalankan dua kali tanpa duplikat; `docker/seed/smoke.sh` lulus.
5. Hasil akhir fase ini: satu berkas `docker/apps/hris_ats/AUDIT.md` berisi tabel inventaris string, matriks audit, dan daftar masalah diurutkan menurut keparahan, ditambah temuan di luar daftar "temuan yang sudah diketahui".

**Berhenti dan lapor.** Jangan lanjut ke fase berikutnya sebelum saya menjawab.

---

## Fase 2: Bahasa yang konsisten

### Keputusan

- Bahasa UI aplikasi mengikuti bahasa pengguna ERPNext (sama seperti aplikasi mobile yang mengikuti bahasa akun).
- **Bahasa sumber semua string = Inggris**, sesuai konvensi Frappe. Bahasa Indonesia hanya lewat `translations/id.csv`. Dengan begitu pengguna `en` melihat Inggris penuh, dan pengguna `id` melihat Indonesia penuh. Tidak ada string Indonesia di dalam kode sumber, kecuali pengecualian di bawah.
- **Pengecualian: kosakata isi CV.** Kata kunci pada pemecah bagian CV, daftar sinonim, regex tanggal, dan **istilah leksikon** (mis. "korupsi", "slot gacor") adalah data tentang bahasa dokumen yang dinilai, bukan teks UI. Tetap dua bahasa (Indonesia dan Inggris) dan jangan diterjemahkan atau diubah.

### Pekerjaan

1. **String sumber**: ubah semua string sumber di `_()`, `__()`, template, Client Script, JS, dan pesan ke Inggris yang wajar; bungkus yang belum dibungkus. String berparameter ditulis `_("... {0} ...").format(x)`; jangan menyambung string dengan `+` atau f-string di dalam `_()`.
2. **`translations/id.csv`**: setiap string sumber punya baris Indonesia dengan **kunci persis sama** dengan string Inggris (termasuk `{0}`). Rapikan baris lama yang kuncinya sudah berubah. Terjemahan natural untuk HR Indonesia; istilah ketenagakerjaan baku (mis. "Pemeriksaan Latar Belakang", "Skrining Resume").
3. **Nilai Select menjadi Inggris** (nilai tersimpan di database), terjemahan tampilan lewat `id.csv`. Pemetaan wajib:

   | Lama | Baru |
   |---|---|
   | Rendah / Sedang / Tinggi | Low / Medium / High |
   | Perlu verifikasi | Needs verification |
   | Prestasi / Profesional / Netral / Berisiko | Achievement / Professional / Neutral / Risky |
   | Belum ditinjau / Relevan / Bukan orang ini / Diabaikan | Not reviewed / Relevant / Not this person / Ignored |
   | Tidak diunggah / Belum diperiksa / Bersih / Ada catatan / Kedaluwarsa | Not uploaded / Not checked / Clear / Has records / Expired |
   | Cuplikan / Teks lengkap / PDF putusan (`Background Check Finding.text_source`) | Snippet / Full text / Decision PDF |
   | Kategori leksikon (Kata kasar, Ujaran kebencian/SARA, Ancaman/kekerasan, Pornografi, Judi online, Narkoba, Penipuan, Kebocoran informasi perusahaan, Hukum-negatif, dst.) | Profanity, Hate speech, Threats/violence, Pornography, Online gambling, Narcotics, Fraud, Company information leak, Legal-negative, dst. (baca daftar lengkap dari doctype dan fixture) |

   Terapkan di: JSON doctype, `fixtures/` (termasuk Custom Field `risk_level` di Job Applicant), konstanta dan perbandingan di Python dan JS (`tasks.py`, `analysis/*`, `scoring/*`, `runner.py`, `workflow.py`, print format, list view, indikator), test, dan seed.
   - Buat **patch** idempoten di `patches.txt` yang memigrasi data yang sudah ada pada: `Background Check` (`risk_level_auto`, `risk_level_final`, `skck_status`), `Background Check Finding` (`category`, `severity`, `hr_verdict`), `Background Check Lexicon` (`category`, `severity`), dan field risiko di `Job Applicant`. Patch aman dijalankan dua kali.
4. **Teks hasil generator** (alasan skor, ringkasan otomatis, alasan kecocokan, penanda risiko, pesan galat Source Run) tersimpan di database saat dibuat, jadi tidak bisa mengikuti bahasa pembaca. Ubah supaya netral bahasa:
   - Buat `hris_ats/i18n.py` dengan helper `render(template, params)` yang melakukan `_(template).format(**params)` pada saat **ditampilkan**.
   - Simpan di dokumen: `*_template` (string Inggris bertanda `{param}`) + `*_params` (JSON) + `*` (hasil render Inggris sebagai cadangan/untuk pencarian). Terapkan pada `Resume Screening Result.reason`, `Background Check Finding.match_reasons` dan `risk_flags`, `Background Check Account.identity_reasons`, `Background Check.summary_auto`, dan `Background Check Source Run.error` (nama field pendamping: `<field>_template` dan `<field>_params`; lihat `SPEC-BACKGROUND-CHECK.md` 4.1, 4.2, dan 12).
   - Tempat penampilan (form, HTML field, print format, laporan) memanggil `render` pada bahasa pengguna saat itu. Terjemahan template ada di `id.csv`.
   - Data lama: tidak perlu backfill. Tombol "Screen again" membuat ulang hasil dalam format baru. Tulis catatan ini di laporan.
   - Ubah test yang membandingkan teks alasan: bandingkan `*_template` + `*_params`, bukan hasil render.
5. **Halaman persetujuan kandidat** (`www/ats_consent.html`, `ats_consent.py`, email undangan) berbahasa **kandidat**, bukan bahasa HR:
   - Tambah field `candidate_language` (Select `id` / `en`, default `id`) di Background Check, bisa diubah HR saat memulai background check.
   - Halaman memilih bahasa dari `?lang=` bila ada, lalu dari `candidate_language` yang tertaut pada token, lalu dari Accept-Language. Tampilkan pemilih bahasa **ID | EN** yang terlihat dan berfungsi. Baca cara Frappe menetapkan bahasa untuk pengunjung Guest (`frappe.translate.get_language`, cookie, header); jangan menebak.
   - Teks persetujuan tersedia dua bahasa: ganti `consent_text` menjadi `consent_text_id` dan `consent_text_en` di Settings (patch menyalin teks lama ke `consent_text_id`; isi `consent_text_en` dengan terjemahan yang setara). `consent_text_version` naik bila salah satu berubah.
   - Simpan di Background Check `consent_language` dan versi teks yang disetujui, sebagai bukti.
   - Email undangan dikirim dalam bahasa kandidat (subjek dan isi).
6. **Elemen lain yang sering terlewat**: judul app dan modul (`hooks.py`, `modules.txt`), nama workspace dan shortcut, label number card, nama kolom kanban dan indikator list, judul dialog dan tombol (`frappe.confirm`, `frappe.prompt`), label kolom HTML field, judul PDF/print format, pesan toast/realtime, dan `description` field.
7. **Test dan penjaga**:
   - `tests/test_i18n.py`: (a) semua string sumber di `_()`/`__()` punya baris di `id.csv`; (b) tidak ada string sumber yang memuat kata Indonesia umum (daftar kecil: "dan", "yang", "tidak", "dengan", "untuk", "belum", "sudah", "pada", "dari", "atau", "adalah", "harus") di luar modul kosakata CV yang di-allowlist eksplisit; (c) semua `label`, `description`, dan `options` di JSON doctype berbahasa Inggris dan terkover di `id.csv`; (d) `render` menghasilkan teks Indonesia saat bahasa `id` dan Inggris saat `en`; (e) patch migrasi nilai Select idempoten.
   - Verifikasi manual dengan tangkapan layar: Background Check (tiap tab), Resume Screening (form dan list), Settings, kanban, workspace, halaman persetujuan, email, print format, masing-masing dalam bahasa `en` dan `id`. Ganti bahasa lewat pengguna uji khusus yang kamu buat (jangan mengubah bahasa pengguna yang sudah ada). Hapus pengguna uji setelahnya. Jalankan `bench clear-cache` setelah mengubah terjemahan.

**Selesai bila:** test baru dan semua test lama lulus; tidak ada string Indonesia di UI pada bahasa `en` dan tidak ada string Inggris yang tertinggal pada bahasa `id` (kecuali istilah teknis yang memang dibiarkan, dan daftarkan); tangkapan layar terlampir.
**Berhenti dan lapor.**

---

## Fase 3: Domain media sosial sebagai settingan, persetujuan kandidat, dan tombol uji

### 3a. Domain terlarang menjadi settingan

- Ganti `FORBIDDEN_DOMAINS` (kebijakan tetap) dengan field `fetch_blocked_domains` (Small Text, satu domain per baris, `permlevel 1`) di Background Check Settings. Isi awal: `instagram.com`, `instagr.am`, `facebook.com`, `fb.com`, `fb.me`, `tiktok.com`, `linkedin.com`, `lnkd.in`. Konstanta di kode menjadi `DEFAULT_BLOCKED_DOMAINS` yang hanya dipakai untuk mengisi nilai awal dan validasi.
- Pencocokan domain: cocok dengan domain itu sendiri dan semua subdomainnya.
- Validasi: menyimpan Settings dengan daftar yang **tidak lagi memuat** salah satu domain bawaan **ditolak** bila `fetch_risk_acknowledged` belum dicentang. Teks risiko di keterangan field diperbarui: mengambil halaman dari platform ini melanggar ketentuan layanannya dan, dengan mode stealth, dapat dianggap menerobos sistem pengamanan (UU ITE Pasal 30 ayat (3)); hasilnya sering hanya halaman login; sebaiknya disetujui Legal.
- `fetch.py` membaca daftar dari Settings (bukan konstanta). Domain di daftar → `ForbiddenDomainError`. Test: domain dikeluarkan dari daftar → bisa diambil; ditambahkan lagi → ditolak; subdomain ikut.

### 3b. Persetujuan kandidat untuk media sosial (wajib, per akun)

Menjadikan domain terbuka di Settings **tidak** cukup untuk mengambil data seorang kandidat. Untuk akun di platform media sosial berlaku syarat tambahan per kandidat:

1. Tambah sumber consent baru **`Social Media`** di `Background Check Consent Scope` (terpisah dari `Platform` dan `Posts`).
2. Tambah di `Background Check Platform` field `requires_social_consent` (Check; default 1 untuk Instagram, Facebook, TikTok, LinkedIn). Akun pada platform bertanda ini dan/atau domain yang ada di `fetch_blocked_domains` default dianggap "akun media sosial".
3. Tambah di `Background Check Account` field `social_consent` (Check, read only). Diisi hanya oleh alur persetujuan.
4. Akun media sosial **hanya** diambil bila: scope `Social Media` = granted, **dan** `social_consent = 1` pada akun itu, **dan** domainnya diizinkan di Settings. Selain itu akun dilewati dan Source Run mencatat jumlah akun yang dilewati beserta alasannya. Akun yang dilewati tidak pernah memicu permintaan jaringan (uji dengan mock jaringan: nol panggilan).
5. Halaman persetujuan:
   - **Semua checkbox sumber tidak tercentang di awal** (perbaikan temuan 2). Tombol Kirim nonaktif sampai kandidat mencentang pernyataan akhir **dan** minimal satu sumber.
   - Bagian "Akun media sosial" terpisah: tampilkan setiap akun media sosial (yang diisi HR atau kandidat) dengan checkbox sendiri yang tidak tercentang di awal, pernyataan "Akun ini milik saya", dan penjelasan bahwa halaman profil publik akan diambil otomatis. Kandidat boleh menambah dan menghapus akun sendiri; akun yang ditambah kandidat otomatis `declared_by = Candidate`.
   - Bagian ini tampil dan menyimpan hasil hanya bila scope `Social Media` dicentang.
6. Jalur "formulir bertanda tangan" (`consent_method = Uploaded document`): HR harus mencentang per akun "Dikonfirmasi kandidat di dokumen" dan `consent_file` wajib terlampir sebelum `social_consent` bisa diisi. Catat siapa dan kapan.
7. Penarikan persetujuan menghapus semua data turunan akun media sosial (sama seperti Fase 1 butir persetujuan).
8. Test: tanpa scope → nol permintaan; scope ada tapi akun A saja yang dicentang → hanya A diambil; akun tambahan HR yang tidak dikonfirmasi kandidat → dilewati; jalur dokumen tanpa `consent_file` → ditolak.

### 3c. Tombol "Uji pengambilan" di Settings

Tujuan: membuktikan dengan data apa yang benar-benar terambil dari sebuah URL, per mode, sebelum diandalkan.

- Hanya System Manager. Form dialog: URL uji + kotak centang wajib **"Saya pemilik profil ini atau punya izin pemiliknya"** (teks diterjemahkan). Hanya URL `http(s)`.
- Menjalankan `fetch.py` **tiga kali** (mode biasa, `Browser`, stealth), masing-masing dengan **konfigurasi eksplisit yang diperlukan mode itu**, bukan dengan nilai Settings tersimpan. Hormati batas laju dan daftar domain terlarang (domain yang masih diblokir ditolak). Hormati robots.txt hanya bila `fetch_respect_robots = 1`. Mode stealth dilewati dengan pesan jelas bila browser belum terpasang.
- Hasil per mode: status HTTP, URL akhir setelah redirect, `mode_used`, ukuran isi, `<title>`, 300 karakter pertama dari teks tampilan, dan **deteksi halaman login**: URL akhir memuat `login`/`accounts/`/`checkpoint`/`authwall`/`signin`, atau isi sangat pendek dengan frasa seperti "log in", "sign in", "masuk" dan tanpa konten profil. Tampilkan sebagai badge "Kemungkinan halaman login".
- **Tidak ada eskalasi otomatis** antar mode di luar tombol ini, dan tidak ada percobaan login.
- Isi halaman **tidak disimpan** (hanya ditampilkan di dialog). Simpan di log hanya: waktu, pengguna, domain, mode, status, hasil deteksi login.
- Test dengan jaringan di-mock: tiap mode dipanggil dengan fetcher yang benar; deteksi login benar pada fixture halaman login dan halaman profil; tidak ada penyimpanan isi.

**Selesai bila:** semua test baru dan lama lulus; uji manual dengan `mock_provider = 0` terhadap URL profil milik tim sendiri menampilkan hasil tiga mode di dialog (lampirkan tangkapan layar); halaman persetujuan menampilkan semua checkbox kosong dan bagian media sosial terpisah.
**Berhenti dan lapor.**

---

## Fase 4: Perbaikan temuan audit

1. Kerjakan semua masalah di `AUDIT.md` berkeparahan tinggi dan sedang yang belum tercakup Fase 2 dan 3, **kecuali** yang saya tandai ditunda di balasan saya setelah Fase 1. Satu commit per kelompok masalah yang berkaitan.
2. **`CourtMASpider`**: pilih salah satu dan jelaskan di laporan. (a) Implementasikan sungguhan dengan Spider Scrapling selama **semua** aturan `fetch.py` (domain terlarang, robots, batas laju Redis, identitas/stealth, `fetch_mode_used`, `robots_ignored_count`) bisa ditegakkan di dalamnya; atau (b) hapus kelas kosong dan impor Spider yang tidak terpakai, lalu dokumentasikan bahwa penelusuran halaman dilakukan manual lewat `fetch.py`. Jangan meninggalkan kode mati.
3. **`get_default_cache_backend`**: di proses worker atau web, kegagalan memakai Redis tidak boleh jatuh diam-diam ke cache memori. Lempar galat yang jelas atau catat peringatan, kecuali dalam mode test.
4. Bereskan temuan `ruff check` yang berarti (impor tak terpakai, variabel tak terpakai, dll.) tanpa mengubah perilaku.
5. Perbarui `docker/README.md` dan README app: bahasa dan terjemahan (cara menambah string baru), settingan domain, persetujuan media sosial, tombol uji, dan `AUDIT.md`.
6. Tambahkan test regresi untuk setiap masalah yang diperbaiki.

**Selesai bila:** semua temuan berkeparahan tinggi dan sedang di `AUDIT.md` berstatus selesai atau ditunda dengan persetujuan; `ruff check` bersih atau sisanya dijelaskan.
**Berhenti dan lapor.**

---

## Fase 5: Verifikasi akhir

1. Semua test (pytest murni + `FrappeTestCase` di site uji `ats-test.localhost`, lalu hapus site itu) lulus. Tempel keluaran.
2. `./dev-ats.sh` dijalankan dua kali berturut-turut tanpa galat; `bench migrate` bersih; patch idempoten.
3. Seed dua kali tanpa duplikat; `docker/seed/smoke.sh` lulus.
4. Jalan penuh di Desk dengan data fiktif: pelamar → Resume Screening → mulai Background Check → persetujuan kandidat (bahasa `id` dan `en`) → job berjalan (`mock_provider = 1`, lalu `0` untuk Platform dan Case history terhadap fixture) → tinjau temuan → kesimpulan HR → Interview. Tangkapan layar tiap tahap dalam dua bahasa.
5. `git diff main --stat` untuk `docker/server-scripts`, `src`, `App.tsx`, `modules`, `app.json`, `eas.json` kosong.
6. Perbarui `AUDIT.md` menjadi laporan akhir: setiap masalah dengan status dan commit-nya.

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

- Terjemahan sebuah istilah hukum atau ketenagakerjaan meragukan.
- Mengubah nilai Select akan merusak data atau integrasi yang tidak tercakup di prompt ini.
- Frappe tidak mendukung bahasa kandidat pada halaman Guest dengan cara yang dijelaskan.
- Sebuah langkah butuh kredensial, layanan berbayar, atau akun pihak ketiga.
- Kamu tergoda menambah login/cookie akun, `ProxyRotator`, eskalasi mode otomatis, atau pengambilan post dari media sosial. Itu semua di luar cakupan.
- Ada test lama yang gagal dan penyebabnya tidak jelas.
