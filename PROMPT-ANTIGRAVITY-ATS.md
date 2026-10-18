# Prompt untuk Antigravity: Resume Screening + Background Check di ERPNext

Salin seluruh isi di bawah garis ke Antigravity. Kerjakan **per fase**; setelah setiap fase agen wajib berhenti dan melapor.

---

## Peran dan tujuan

Kamu adalah engineer Frappe/ERPNext. Bangun dua modul rekrutmen di ERPNext v16 + Frappe HR (hrms v16) dalam satu **custom Frappe app** bernama `hris_ats`:

1. **Resume Screening**: menilai CV pelamar dengan algoritma berbasis aturan (tanpa LLM / tanpa AI generatif / tanpa model ML).
2. **Background Check**: pemeriksaan latar belakang kandidat terpilih, berbasis persetujuan kandidat, juga berbasis aturan.

Hanya untuk web (ERPNext Desk). **Jangan sentuh aplikasi mobile** (`src/`, `App.tsx`, `modules/`, `app.json`, `eas.json`, dll.).

## Sumber kebenaran

Baca dua dokumen ini sampai habis sebelum menulis kode. Keduanya mengalahkan desain Figma/SVG dan asumsimu sendiri:

- `SPEC-RESUME-SCREENING.md`
- `SPEC-BACKGROUND-CHECK.md`

Desain visual ada di `~/Downloads/Resume Screening List/01_Resume_Screening/` dan `02_Background_Checking/` (SVG). Pakai hanya sebagai rujukan tata letak. Bila desain dan spesifikasi berbeda, **ikuti spesifikasi**. Kamu tidak perlu meniru UI desain piksel per piksel: targetnya Desk bawaan Frappe (form, list, kanban, report view, print format, workspace) sesuai tabel "Pemetaan layar" di kedua spesifikasi.

Bila ada yang ambigu dan tidak terjawab oleh spesifikasi, **berhenti dan tanya**. Jangan menebak.

## Larangan keras (jangan dibangun dalam bentuk apa pun)

Ini keputusan hukum dan etika yang sudah final. Jangan dibangun walau desain memintanya, walau tampak mudah, dan jangan sebagai fitur tersembunyi, field cadangan, atau "nanti diaktifkan":

1. Analisis atau tebakan **pandangan politik, sikap terhadap pemerintah, atau partai politik** kandidat (layar BGC 10).
2. **Analisis psikologis atau kepribadian** dari post (ekstrover, introspektif, dsb.).
3. **GetContact** dalam bentuk apa pun (layar BGC 05). Tidak ada tab, doctype, atau field untuknya.
4. Mengecek keterdaftaran akun lewat **email atau nomor telepon** (alur lupa-password, alur registrasi, endpoint "cek ketersediaan"). Pengecekan platform hanya dari **username** dan **URL profil publik**.
5. **Scraping** Instagram, Facebook, TikTok, atau LinkedIn. Untuk platform ini hanya simpan tautan profil dengan `post_access = Manual review only`.
6. Memakai **usia, gender, foto, agama, suku, status pernikahan, kesehatan, atau orientasi seksual** dalam skor, tingkat risiko, filter, atau tampilan screening. Panel kandidat di desain ("26 | Male") ditampilkan **tanpa** usia dan gender.
7. **Penolakan otomatis**. Skor dan tingkat risiko hanya alat bantu; status pelamar hanya diubah oleh tindakan HR (kecuali perpindahan `recruitment_stage` yang ditulis di spesifikasi).
8. LLM, API AI, atau model ML (termasuk embedding dan sentimen berbasis model). Semua penilaian adalah aturan, regex, leksikon, dan `rapidfuzz`.
9. Integrasi "Dragonfly" yang disebut di catatan desain.
10. Menjalankan Background Check tanpa `consent_status = Granted`, atau menjalankan sumber yang tidak dicentang kandidat di `consent_scope`.

## Keputusan yang sudah final

- Custom app `hris_ats`, satu app untuk kedua modul.
- Bobot default metrik resume (total 100): ATS friendly 10, Grammar 5, Date consistency 10, Information completeness 10, Education relevance 10, Skill relevance 25, Experience relevance 20, Achievement relevance 5, Certification relevance 5.
- Template punya `pass_description` **dan** `fail_description`.
- Bahasa CV yang didukung: Indonesia dan Inggris. Format: PDF dan DOCX.
- SKCK **opsional** (field `skck_file`, `skck_number`, `skck_valid_until`, `skck_status`).
- Penyedia pencarian web dan API X **belum diputuskan**. Bangun sebagai provider yang bisa dipasang-cabut (lihat Fase 5). Tanpa kredensial, sumber berstatus `Skipped` dengan alasan, bukan error.
- Background Check hanya dimulai manual oleh HR untuk pelamar yang Resume Screening-nya `Done`.

## Kondisi repo dan lingkungan

- Repo git: folder ini (`hris-mobile`), branch `main`. Stack ERPNext ada di `docker/`:
  - `docker/docker-compose.yml`: service `backend`, `frontend`, `websocket`, `queue-short`, `queue-long`, `scheduler`, `db`, `redis-*`. Site: `hris.localhost`. Web lokal: `http://localhost:8082`.
  - `docker/build-image.sh` + `docker/apps.json`: image `hris-erpnext:16` dibangun dari frappe_docker; app hanya bisa masuk image lewat URL git di `apps.json`.
  - `docker/seed/seed.py` + `docker/seed/seed.sh`: seed idempoten (pakai `exists()` / `make()`).
  - `docker/server-scripts/`: Server Script yang sudah ada (modul mobile). **Jangan diubah.**
  - `docker/README.md`: dokumentasi stack, berbahasa Indonesia.
- Container sudah berjalan dengan nama `hris-erpnext-*`. Di `env` sudah tersedia `pdfplumber`, `pypdf`, `pdfminer`, `rapidfuzz`, `python-dateutil`, `beautifulsoup4`. **`python-docx` tidak ada**: baca DOCX dengan `zipfile` + `xml.etree`.
- Server Script berjalan di sandbox dan tidak bisa `import`, itulah alasan logika ini ditaruh di custom app, bukan Server Script.
- Akun uji HR: `hr.test@example.com` (password ada di `docker/.credentials.local`). Jangan menguji sebagai Administrator untuk hal yang menyangkut hak akses.

## Aturan kerja

- Buat branch `feat/hris-ats` sebelum mengubah apa pun. **Jangan push**, jangan merge ke `main`, jangan membuat repo remote. Commit per fase dengan gaya repo: `FEAT: ...` / `FIX: ...`, deskripsi berbahasa Indonesia. **Jangan menambahkan trailer `Co-Authored-By` atau atribusi AI apa pun** di commit.
- Jangan menjalankan `eas build`, `eas update`, atau skrip rilis mobile apa pun.
- Jangan menghapus volume Docker (`docker compose down -v`) dan jangan `bench restore`/`drop-site`. Data site berisi data uji yang dipakai aplikasi mobile.
- Jangan membuat data orang sungguhan. Semua contoh CV, artikel, putusan, dan post adalah fiktif dan disimpan sebagai fixture.
- Nama doctype dan field memakai bahasa Inggris (konsisten dengan doctype custom yang ada, mis. `Overtime Request`). Label tampilan Bahasa Indonesia lewat `hris_ats/translations/id.csv`.
- Logika penilaian ditulis sebagai **fungsi murni tanpa import `frappe`** di `hris_ats/scoring/` dan `hris_ats/bgc/analysis/`, supaya bisa diuji dengan `pytest` biasa. Lapisan doctype hanya memanggil fungsi ini.
- Setiap aturan, ambang, dan bobot yang disebut di spesifikasi harus berupa konstanta bernama atau field Settings, bukan angka ajaib di tengah kode.

## Struktur app yang diharapkan

```
docker/apps/hris_ats/                 # source app (dev), nanti dipindah ke repo git sendiri
  pyproject.toml
  hris_ats/
    hooks.py
    modules.txt                        # "HRIS ATS"
    patches.txt
    translations/id.csv
    hris_ats/doctype/...               # semua doctype
    scoring/                           # resume: extract.py, sections.py, metrics/*.py, total.py
    bgc/
      providers/                       # base.py, platform_check.py, web_search_*.py, court_ma.py, posts_*.py, mock.py
      analysis/                        # identity.py, classify.py, case.py, posts.py, risk.py, summary.py
    fixtures/                          # custom_field.json, property_setter.json, role.json, workspace, print_format
    tests/fixtures/                    # CV dan data contoh fiktif
    tests/                             # pytest murni + FrappeTestCase
docker/docker-compose.dev.yml          # mount app untuk pengembangan
docker/dev-ats.sh                      # pasang/perbarui app di container yang berjalan
```

---

## Fase 0: Kerangka dan setup pengembangan

1. Baca kedua spesifikasi, `docker/README.md`, `docker/docker-compose.yml`, `docker/seed/seed.sh`.
2. Buat app `hris_ats` (pakai `bench new-app` di dalam container lalu salin keluar, atau tulis manual mengikuti struktur app Frappe v16).
3. Buat `docker/docker-compose.dev.yml` yang me-mount `docker/apps/hris_ats` ke `/home/frappe/frappe-bench/apps/hris_ats` di **semua** service yang menjalankan kode Python (`backend`, `queue-short`, `queue-long`, `scheduler`, `websocket`, `configurator`).
4. Buat `docker/dev-ats.sh` yang: `pip install -e apps/hris_ats` di env setiap container terkait (env ada di image, jadi hilang setiap container dibuat ulang; skrip ini harus aman dijalankan berulang), memastikan `hris_ats` ada di `sites/apps.txt`, menjalankan `bench --site hris.localhost install-app hris_ats` bila belum terpasang (atau `migrate` bila sudah), lalu `bench build --app hris_ats` dan `clear-cache`.
5. Tambahkan bagian "Custom app hris_ats" di `docker/README.md`: cara menyalakan mode dev, dan catatan bahwa untuk image produksi app harus dipindah ke repo git lalu ditambahkan ke `apps.json` (**jangan** ubah `apps.json` sekarang).

**Selesai bila:** `bench --site hris.localhost list-apps` memuat `hris_ats`; Desk terbuka normal; Server Script lama tetap jalan (`docker/seed/smoke.sh` lulus seperti sebelumnya).
**Berhenti dan lapor.**

## Fase 1: Doctype Resume Screening

Buat sesuai `SPEC-RESUME-SCREENING.md` bagian 3–4 dan 8:
- `Resume Screening Template` + child `Resume Screening Template Role`, `Resume Screening Score Label`, `Resume Screening Metric Weight`.
- `Resume Screening` + child `Resume Screening Result`.
- `Resume Screening Settings` (Single).
- Custom Field di `Job Opening` (bagian "Screening Criteria") dan `Job Applicant` (`recruitment_stage` dengan nilai `New Applied` / `Screening` / `Background Check` / `Interview` / `Offer` / `Hired` / `Rejected`, `resume_screening`, `resume_score`, `screening_status`, `city`, `address`, `postal_code`). Ekspor sebagai fixtures.
- Template baru otomatis berisi 9 baris bobot default. Validasi: total bobot metrik aktif = 100; tiap metrik tepat sekali; rentang label 0–100, `score_from ≤ score_to`, tidak tumpang tindih; satu Designation hanya di satu template aktif. Client Script form template menampilkan total bobot berjalan.
- Hak akses sesuai tabel bagian 8.

**Selesai bila:** HR bisa membuat, menduplikasi, mengaktifkan/menonaktifkan template di Desk; semua validasi menolak input salah dengan pesan Bahasa Indonesia; ada test untuk tiap validasi.
**Berhenti dan lapor.**

## Fase 2: Ekstraksi dan 9 metrik (fungsi murni)

Ikuti `SPEC-RESUME-SCREENING.md` bagian 5 secara harfiah.
- `extract.py`: PDF lewat `pdfplumber` (teks, posisi kata, tabel), DOCX lewat `zipfile`. Deteksi PDF scan (`min_text_chars_per_page`).
- `sections.py`: pemecah bagian dengan judul ID + EN.
- Satu modul per metrik; setiap metrik mengembalikan `score` (0–100), `applicable` (bool), dan `reason` (string ID). Date consistency **wajib** mendeteksi tanggal yang tumpang tindih antar jabatan.
- `total.py`: normalisasi bobot untuk metrik yang tidak berlaku, skor total dibulatkan, pencocokan label (Fixed/Range), fallback ke `pass_description`/`fail_description`.
- Buat minimal 10 CV fiktif di `tests/fixtures/`: PDF satu kolom, PDF dua kolom, PDF scan (gambar saja), DOCX, CV berbahasa Inggris, CV berbahasa Indonesia, CV tanpa telepon, CV dengan format tanggal campuran, CV dengan jabatan tumpang tindih, CV fresh graduate.
- `pytest` untuk setiap metrik dengan ekspektasi skor dan alasan yang eksplisit.

**Selesai bila:** semua test lulus di dalam container (`env/bin/python -m pytest apps/hris_ats/hris_ats/tests/scoring`) dan hasil tiap CV fiktif masuk akal untuk dibaca manusia. Lampirkan tabel skor per CV dalam laporan.
**Berhenti dan lapor.**

## Fase 3: Alur Resume Screening

- Pemilihan template (urutan di spesifikasi bagian 6), pemicu otomatis dari Job Applicant (`after_insert`/`on_update` saat `resume_attachment` terisi), background job di antrean `long`.
- Metrik dinilai satu per satu; setiap metrik selesai → simpan `metric_status = Done` dan kirim `frappe.publish_realtime` supaya form detail memperbarui diri tanpa reload.
- Salin `total_score`/`status` ke Job Applicant; perpindahan `recruitment_stage` sesuai spesifikasi bagian 4; pelamar dari `/jobs` mendapat `source` Website.
- Aksi "Screen ulang" di form dan aksi massal di list Job Applicant.
- Field `hr_override_label` / `hr_override_note`, `experience_level`, `criteria_snapshot`.
- Lowongan ditutup: **jangan menghapus data apa pun**; list default difilter lowongan Open.
- Notification Log ke pembuat lowongan saat selesai.

**Selesai bila:** mengunggah CV fiktif lewat form `/jobs` dan lewat Desk sama-sama menghasilkan Resume Screening `Done` dengan hasil per metrik; mengganti CV memicu penilaian ulang; ada FrappeTestCase untuk alur ini.
**Berhenti dan lapor.**

## Fase 4: Tampilan Resume Screening

Sesuai tabel "Pemetaan layar" bagian 7: list view dengan kolom dan indikator, Kanban board Job Applicant berdasarkan `recruitment_stage` (kolom Background Check ikut), form detail (banner hasil, teks CV + pratinjau file, panel kandidat **tanpa usia/gender**, hasil per metrik ✓/✗ + alasan + status), Print Format PDF, Workspace "Rekrutmen" dengan shortcut dan number card per tahap.

**Selesai bila:** semua layar resume screening punya padanan yang bisa dipakai HR dari login `hr.test@example.com`. Lampirkan screenshot tiap layar.
**Berhenti dan lapor.**

## Fase 5: Doctype dan persetujuan Background Check

Sesuai `SPEC-BACKGROUND-CHECK.md` bagian 3–4 dan 8:
- `Background Check` + child `Background Check Account`, `Background Check Source Run`, `Background Check Consent Scope`; `Background Check Finding`; `Background Check Platform`; `Background Check Lexicon`; `Background Check Settings`.
- Role baru `Background Check Officer`. Background Check dan Finding hanya bisa dibaca role ini dan HR Manager. Interviewer hanya melihat `risk_level_final` dan `hr_conclusion` di Job Applicant. Aktifkan `track_views`.
- Tombol "Mulai background check" di Job Applicant (hanya bila screening `Done`) → dokumen dibuat dengan `consent_status = Pending`, `recruitment_stage = Background Check`.
- Web Form persetujuan untuk kandidat dengan tautan bertoken sekali pakai yang kedaluwarsa (jangan memakai nama/email sebagai token): penjelasan sumber, retensi, hak kandidat, centang per sumber, tabel akun media sosial, unggah SKCK opsional. Simpan versi teks, waktu, IP. Email undangan lewat Email Queue bawaan.
- Jalur alternatif: HR mengunggah formulir bertanda tangan (`consent_method = Uploaded document`).
- Penarikan persetujuan → hapus semua Finding milik dokumen itu.
- Isi awal `Background Check Lexicon` sebagai fixture, ditandai jelas sebagai **draf yang wajib ditinjau Legal**. Jangan masukkan kategori yang menandai agama, suku, politik, kesehatan, atau orientasi sebagai risiko.

**Selesai bila:** alur persetujuan bisa diuji ujung ke ujung dengan email uji; tanpa `Granted`, tidak ada job yang berjalan (ada test untuk ini); hak akses terbukti lewat test dengan user berbeda role.
**Berhenti dan lapor.**

## Fase 6: Provider dan analisis Background Check

- `providers/base.py`: antarmuka `run(check, settings) -> list[FindingData]`, dengan batas laju per domain, cache 24 jam per kueri, User-Agent bernama perusahaan, dan kepatuhan robots.txt.
- `providers/mock.py`: provider palsu yang membaca fixture, dipakai test dan demo. **Semua test memakai provider ini, tanpa akses internet.**
- `platform_check.py`: cek profil publik berdasarkan username dan `Background Check Platform` (`Status code` / `Body contains` / `Body not contains`). Isi awal katalog diimpor dari dataset WhatsMyName dengan atribusi CC BY-SA 4.0 di README app.
- Web search provider untuk Article/File: buat antarmukanya beserta satu implementasi yang **mati secara default** sampai kredensial diisi. Jangan memilih atau mendaftar ke layanan berbayar sendiri.
- `court_ma.py`: Direktori Putusan MA, deteksi jenis perkara dan peran (`Terdakwa`, `Tergugat`, `Penggugat`, `Pemohon`, `Termohon`, `Saksi`) dengan tabel severity di spesifikasi 6.4.
- Posts: implementasi API resmi yang bisa dikerjakan tanpa biaya (GitHub, YouTube, Mastodon, Reddit); X sebagai provider yang mati secara default.
- Analisis murni: `identity.py` (rumus `match_confidence` di 6.2, termasuk penanganan mononim dan gelar), `classify.py` (6.3), `case.py` (6.4), `posts.py` (6.5, **hanya** aktivitas, kesantunan, konten berisiko, relevansi profesional, sentimen leksikon), `risk.py` (6.6), `summary.py` (templat 6.7, kalimat bernilai nol dihilangkan).
- Satu background job per sumber yang disetujui; status per sumber di `source_runs` + `publish_realtime`.

**Selesai bila:** dengan provider mock, satu Background Check fiktif menghasilkan temuan di semua tab, skor kecocokan dan severity sesuai spesifikasi, tingkat risiko otomatis benar, dan ringkasan terbentuk. Sertakan test untuk nama kembar (dua orang bernama sama, konteks berbeda) dan untuk putusan permohonan perdata yang harus berseverity `Info`.
**Berhenti dan lapor.**

## Fase 7: Tampilan Background Check, retensi, seed

- Form dengan Tab Break: Ringkasan, Platform, Jejak digital nama (Article/File/Case), Jejak digital akun (Post/Analisis). Daftar temuan di field HTML dengan pencarian dan paginasi + tautan ke list Finding terfilter. Sidebar detail kandidat tanpa usia/gender. `hr_verdict` per temuan bisa diubah dari tab. **Tidak ada tab GetContact.**
- List view dengan filter Level dan Applied to; Print Format "Background Check Report" yang hanya memuat temuan `Relevan` + kesimpulan HR.
- `hr_conclusion` wajib sebelum Interview dibuat untuk pelamar itu.
- Job harian retensi: setelah `purge_after`, hapus Finding, ringkasan otomatis, dan data akun; sisakan level, kesimpulan, dan bukti persetujuan. `skck_status` otomatis `Kedaluwarsa`.
- Tambah bagian seed di `docker/seed/seed.py` (idempoten, mengikuti pola `exists()`/`make()` yang ada): satu Job Opening berkriteria, satu template, tiga pelamar fiktif dengan CV fixture, satu Background Check fiktif memakai provider mock.

**Selesai bila:** seed bisa dijalankan dua kali tanpa duplikat; semua test lulus; screenshot tiap tab terlampir; `docker/seed/smoke.sh` tetap lulus.
**Berhenti dan lapor.**

---

## Format laporan setiap fase

1. Ringkasan yang dikerjakan (≤ 10 baris).
2. Daftar file yang dibuat/diubah.
3. Perintah verifikasi yang dijalankan beserta hasilnya (tempel keluaran test).
4. Penyimpangan dari spesifikasi beserta alasannya. Kalau tidak ada, tulis "tidak ada".
5. Pertanyaan yang perlu dijawab sebelum fase berikutnya.

## Kapan wajib berhenti dan bertanya

- Spesifikasi diam atau bertentangan dengan dirinya sendiri.
- Sebuah langkah membutuhkan kredensial, layanan berbayar, atau akun pihak ketiga.
- Kamu tergoda menambahkan sesuatu dari daftar larangan, atau fitur di luar spesifikasi.
- Sebuah perubahan akan menyentuh Server Script, seed, atau data yang dipakai aplikasi mobile di luar yang diminta di Fase 7.
- Ada test lama yang gagal.
