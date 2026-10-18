# Spesifikasi: Resume Screening (ATS) di ERPNext

Status: draf untuk ditinjau, belum ada yang dibangun. Sumber desain: `~/Downloads/Resume Screening List/01_Resume_Screening/` (11 layar). Keputusan awal: hanya web (ERPNext Desk), skor dihitung algoritma berbasis aturan tanpa LLM.

## 1. Posisi di alur rekrutmen

```
Job Opening ─► Job Applicant ─► Resume Screening ─► Background Check ─► Interview ─► Job Offer ─► Employee ─► Employee Onboarding
 (bawaan)        (bawaan)          (BARU)              (BARU)             (bawaan)     (bawaan)     (bawaan)      (bawaan)
```

Resume Screening mengisi celah antara pelamar masuk dan wawancara. Tahap berikutnya, Background Check, dispesifikasikan di `SPEC-BACKGROUND-CHECK.md`. Onboarding tetap memakai `Employee Onboarding` + `Employee Onboarding Template` bawaan, dimulai setelah Job Offer diterima.

Pelamar masuk dari dua jalan, sesuai kolom "Applied to" di desain:
- Link lowongan: halaman `/jobs` bawaan HRMS (`Job Opening.publish` + `job_application_route`), formulirnya membuat Job Applicant dengan `resume_attachment`.
- Ditambahkan manual oleh HR di Desk ("Manually added").

## 2. Keputusan arsitektur: perlu custom app

Server Script berjalan di sandbox RestrictedPython dan tidak bisa `import` library. Membaca isi PDF membutuhkan `pdfplumber`/`pypdf`, yang sudah terpasang di image (`pdfplumber`, `pypdf`, `pdfminer`, `rapidfuzz`, `dateutil` tersedia; `python-docx` tidak, tapi DOCX bisa dibaca dengan `zipfile` + XML bawaan Python).

Usulan: buat custom Frappe app `hris_ats` berisi doctype, fungsi parsing, dan penilaian. Konsekuensinya:
- Butuh repo git sendiri, ditambahkan ke `docker/apps.json`, lalu image dibangun ulang (`build-image.sh`) lokal dan di srv-vllm.
- Penilaian berjalan sebagai background job (`frappe.enqueue`, antrean `long`), jadi upload CV tidak menunggu.

Alternatif tanpa custom app (tidak disarankan): ekstrak teks di browser dengan pdf.js lewat Client Script, kirim teksnya ke Server Script. Rapuh, tidak jalan untuk pelamar dari `/jobs`, dan teks bisa dimanipulasi dari klien.

## 3. Doctype baru

### 3.1 Resume Screening Template

Padanan layar 03–09 (Saved setting + wizard 5 langkah). Satu form biasa dengan tabel anak, wizard tidak ditiru.

| Field | Tipe | Keterangan |
|---|---|---|
| `template_name` | Data, unik, wajib | "Metric for design division". Dipakai sebagai nama dokumen. |
| `enabled` | Check, default 1 | Tombol Enable/Disable di kartu template. |
| `job_roles` | Table MultiSelect → `Resume Screening Template Role` | Daftar Designation. Dipakai memilih template otomatis. |
| `min_score_to_pass` | Int, default 75 | 0–100. |
| `pass_description` | Small Text | "Applicant resume is match with the applied job!" |
| `fail_description` | Small Text | Teks banner bila di bawah minimum (desain belum punya, perlu ditambah). |
| `score_labels` | Table → `Resume Screening Score Label` | Boleh kosong (layar 07). |
| `metric_weights` | Table → `Resume Screening Metric Weight` | Terisi 9 baris saat dokumen baru dibuat. |
| `total_weight` | Percent, read only | Dihitung otomatis, harus 100. |

Child `Resume Screening Template Role`: `designation` (Link Designation).

Child `Resume Screening Score Label`:

| Field | Tipe | Keterangan |
|---|---|---|
| `label_type` | Select `Fixed` / `Range` | Toggle di layar 06. |
| `score_from` | Int | Untuk Fixed, cukup ini. |
| `score_to` | Int | Hanya untuk Range (`depends_on`). |
| `label` | Data | Nama singkat, mis. "Perfect match". |
| `description` | Small Text | Teks di banner detail. |
| `indicator` | Select `green` / `orange` / `red` / `blue` | Warna banner dan badge. |

Child `Resume Screening Metric Weight`: `metric` (Select, 9 pilihan di bagian 5, read only), `weight` (Percent), `enabled` (Check).

Validasi (`validate`):
- Setiap metrik muncul tepat sekali; total bobot metrik yang aktif = 100. Desain menyebut "sistem otomatis menyesuaikan metrik lain"; di Desk cukup Client Script yang menampilkan total berjalan dan menolak simpan bila ≠ 100.
- Rentang label di 0–100, `score_from ≤ score_to`, tidak tumpang tindih.
- Satu Designation hanya boleh ada di satu template yang aktif (supaya pemilihan template tidak ambigu).

### 3.2 Resume Screening

Satu dokumen per pelamar per penilaian. Padanan layar 01 (tabel), 10 dan 11 (detail).

| Field | Tipe | Keterangan |
|---|---|---|
| `naming_series` | `RS-.YYYY.-.#####` | |
| `job_applicant` | Link Job Applicant, wajib | |
| `applicant_name`, `email_id`, `phone_number` | fetch dari applicant | Kolom Candidate dan Contact. |
| `job_opening` | fetch `job_applicant.job_title` | Kolom Applied to. |
| `designation` | fetch dari job opening | |
| `source` | fetch `job_applicant.source` | "Manually added" atau link lowongan. |
| `template` | Link Resume Screening Template | Diisi otomatis (bagian 6), boleh diganti HR. |
| `resume_file` | Attach, fetch `job_applicant.resume_attachment` | |
| `status` | Select `Queued` / `Screening` / `Done` / `Failed` | Badge "Screening..." dan "Done". Layar 10 juga menampilkan "Scoring..." di samping skor selama metrik belum selesai semua. |
| `total_score` | Float (0–100), read only | Angka besar hijau. |
| `passed` | Check, read only | `total_score ≥ min_score_to_pass`. |
| `result_label`, `result_description`, `result_indicator` | read only | Dari label yang cocok, atau pass/fail description. |
| `results` | Table → `Resume Screening Result`, read only | Daftar per metrik di panel kanan. |
| `resume_text` | Long Text, read only | Hasil ekstraksi, ditampilkan di panel kiri. |
| `criteria_snapshot` | JSON, read only | Kriteria lowongan dan bobot saat dinilai, supaya hasil bisa ditelusuri walau template berubah. |
| `screened_on` | Datetime | |
| `error` | Small Text | Alasan gagal (file rusak, PDF hasil scan, dsb.). |
| `experience_level` | Select `Fresh Graduate` / `Experienced`, read only | Teks "Experienced" di panel kandidat. Dihitung dari total tahun pengalaman (≥ 1 tahun = Experienced). |
| `hr_override_label`, `hr_override_note` | Data, Small Text | Ikon pensil di banner layar 11: HR boleh mengganti label hasil. Skor asli tetap tersimpan. |

Child `Resume Screening Result`: `metric`, `weight` (bobot efektif setelah normalisasi), `score` (0–100), `passed` (Check), `applicable` (Check), `metric_status` (Select `Pending` / `Done`), `reason` (Small Text, mis. "Unstructured resume", "Format tanggal tidak konsisten").

Metrik dinilai satu per satu dan setiap metrik yang selesai langsung disimpan, lalu dikabarkan ke browser lewat `frappe.publish_realtime`. Dengan begitu layar detail bisa menampilkan sebagian metrik "Done" dan sisanya "Screening..." seperti layar 10.

Tidak disubmit (bukan dokumen submittable). Penilaian ulang menimpa hasil di dokumen yang sama.

### 3.3 Resume Screening Settings (Single)

| Field | Default | Keterangan |
|---|---|---|
| `enabled` | 1 | Saklar "Enable all screening setting" di layar 03. Kalau mati, tidak ada penilaian sama sekali. |
| `auto_screen` | 1 | Nilai otomatis saat Job Applicant baru punya CV. |
| `metric_pass_threshold` | 60 | Batas ✓/✗ per metrik di panel detail. |
| `max_file_mb` | 5 | |
| `min_text_chars_per_page` | 200 | Di bawah ini dianggap PDF hasil scan (tanpa OCR). |

## 4. Field tambahan di doctype bawaan

**Job Opening** (bagian baru "Kriteria Screening"). Kriteria bergantung lowongan, jadi disimpan di sini, bukan di template:

| Field | Tipe | Dipakai metrik |
|---|---|---|
| `screening_template` | Link Resume Screening Template | Menimpa pemilihan otomatis. |
| `required_skills` | Small Text, satu per baris | Skill relevance |
| `preferred_skills` | Small Text | Skill relevance |
| `min_education` | Select `SMA/SMK` / `D3` / `D4/S1` / `S2` / `S3` | Education relevance |
| `education_majors` | Small Text | Education relevance |
| `min_years_experience` | Float | Experience relevance |
| `relevant_titles` | Small Text | Experience relevance |
| `certification_keywords` | Small Text | Certification relevance |

**Job Applicant**:

| Field | Tipe | Keterangan |
|---|---|---|
| `recruitment_stage` | Select `New Applied` / `Screening` / `Background Check` / `Interview` / `Offer` / `Hired` / `Rejected` | Kolom kanban layar 02. `status` bawaan tidak punya Interview/Hired. Desain kanban belum punya kolom Background Check; perlu ditambahkan. |
| `city`, `address`, `postal_code` | Data | Kolom Region ("East sumatra, 40286, A street No.41"). Job Applicant bawaan hanya punya `country`. Diisi dari formulir lamaran atau hasil ekstraksi CV. |
| `resume_screening` | Link Resume Screening, read only | |
| `resume_score` | Float, read only | Disalin dari screening untuk filter/sort di list. |
| `screening_status` | Select, read only | Disalin dari screening. |

Perpindahan `recruitment_stage` otomatis (doc_events di custom app):
- Job Applicant dibuat → `New Applied`. Pelamar dari formulir `/jobs` diberi `source` = "Website" beserta URL lowongan, supaya kolom Applied to bisa membedakannya dari "Manually added".
- Screening `Done` → `Screening` (menunggu keputusan HR). HR yang memindahkan ke tahap berikutnya.
- Background Check dibuat → `Background Check`.
- Interview dibuat → `Interview`.
- Job Offer dibuat → `Offer`; Job Offer `Accepted` → `Hired`.
- `status` = `Rejected` → `Rejected`.

## 5. Algoritma penilaian (tanpa LLM)

### 5.1 Ekstraksi
1. Ambil file dari `resume_attachment`. PDF: `pdfplumber` (teks + posisi kata + deteksi tabel). DOCX: `zipfile` → `word/document.xml`. Format lain → `Failed`.
2. Teks per halaman < `min_text_chars_per_page` → `Failed` dengan alasan "CV berupa gambar/scan, tidak bisa dibaca". OCR di luar cakupan v1.
3. Normalisasi: huruf kecil untuk pencocokan, hapus spasi ganda, satukan tanda hubung.
4. Pecah per bagian dengan mencari judul bagian (ID + EN), mis. `pengalaman|pengalaman kerja|experience|work experience`, `pendidikan|education`, `keahlian|skill(s)`, `sertifikat|sertifikasi|certification(s)`, `prestasi|penghargaan|achievement(s)|awards`, `ringkasan|profil|summary|objective`.

### 5.2 Metrik (masing-masing 0–100)

| Metrik | Cara hitung | Contoh alasan |
|---|---|---|
| ATS friendly | Rata-rata cek: teks bisa diekstrak; ≥ 3 judul bagian standar dikenali; email dan telepon terbaca; tidak ada tata letak multi-kolom (posisi x kata mengelompok ke ≥ 2 kolom pada > 50% halaman); tidak ada tabel besar; 1–3 halaman. | "Tata letak dua kolom", "Judul bagian tidak dikenali" |
| Grammar (kerapian tulisan) | Heuristik, bukan pemeriksa tata bahasa: kata berulang ("the the"), spasi/tanda baca ganda, awal kalimat bukan huruf besar, kalimat > 40 kata, rasio huruf kapital semua, daftar salah ketik umum. Skor = 100 − penalti per 100 kata. | "Banyak kata berulang dan spasi ganda" |
| Date consistency | Cari tanggal dengan regex (`Jan 2021`, `Januari 2021`, `01/2021`, `2021`, `sekarang/present`). Cek: satu format dominan (≥ 80%), mulai ≤ selesai, tidak ada tanggal di masa depan, urutan kronologis dalam satu bagian, dan pekerjaan yang tanggalnya tumpang tindih (layar 10). Tumpang tindih diberi penalti ringan, karena bisa jadi kerja paruh waktu yang sah. Celah > 12 bulan dicatat di alasan, tidak mengurangi skor. | "Format tanggal campuran", "Tanggal Jabatan A dan Jabatan B tumpang tindih" |
| Information completeness | Bobot cek: nama 15, email 20, telepon 20, domisili 10, bagian pendidikan 15, bagian pengalaman 15, bagian keahlian 5. | "Nomor telepon tidak ditemukan" |
| Education relevance | Deteksi jenjang tertinggi (SMA/SMK, D3, D4/S1/Sarjana/Bachelor, S2/Master, S3/PhD). Jenjang ≥ `min_education` = 60 poin; jurusan cocok `education_majors` (rapidfuzz `partial_ratio` ≥ 85) = 40 poin. | "Jenjang D3, lowongan minta S1" |
| Skill relevance | Cocokkan `required_skills` (bobot 2) dan `preferred_skills` (bobot 1) ke teks dengan rapidfuzz `token_set_ratio` ≥ 85. Skor = poin cocok / poin maksimal. | "Cocok 4 dari 6 skill wajib: belum ada Figma, SQL" |
| Experience relevance | Gabungkan rentang tanggal di bagian pengalaman (rentang tumpang tindih dihitung sekali) → total tahun. 70 poin = min(total / `min_years_experience`, 1); 30 poin = ada judul jabatan yang cocok `relevant_titles`. | "Pengalaman 1,5 tahun dari minimal 3 tahun" |
| Achievement relevance | Hitung poin pengalaman yang terukur (angka dengan %, Rp, x, juta, orang, proyek) dan kata kerja aksi. Skor naik per temuan, maksimal 100 di 5 temuan. | "Belum ada pencapaian yang terukur" |
| Certification relevance | Cocokkan `certification_keywords` ke bagian sertifikat/seluruh teks. | "Tidak ada sertifikasi yang diminta" |

### 5.3 Skor total dan label
- Metrik dianggap **tidak berlaku** bila lowongan tidak mengisi kriterianya (mis. `certification_keywords` kosong). Bobotnya dibagi ulang secara proporsional ke metrik lain yang berlaku, supaya kandidat tidak dihukum karena kriteria yang tidak ada.
- `total_score = Σ(bobot_i × skor_i) / Σ(bobot_i)` atas metrik yang berlaku, dibulatkan ke bilangan bulat.
- `passed = total_score ≥ min_score_to_pass`.
- Label: cari baris `score_labels` yang cocok (Fixed: sama persis; Range: di dalam rentang). Kalau tidak ada yang cocok, pakai `pass_description` atau `fail_description`.
- Per metrik: `passed = skor ≥ metric_pass_threshold`, ditampilkan ✓/✗ beserta alasan.

### 5.4 Batasan yang harus diketahui
- **Grammar** paling lemah karena tanpa kamus atau LLM hanya bisa mendeteksi kesalahan mekanis. Usulan: ganti nama jadi "Kerapian tulisan" dan beri bobot kecil. Bisa ditingkatkan nanti dengan LanguageTool self-host (bukan LLM, mendukung bahasa Indonesia).
- **Relevansi** hanya sebaik kriteria di Job Opening. Lowongan tanpa kriteria hanya dinilai dari metrik format.
- Sinonim (mis. "UI/UX" vs "desain antarmuka") tidak dikenali kecuali dimasukkan ke daftar skill. Bisa ditambah doctype kamus sinonim di v2.

## 6. Alur proses

1. **Pemilihan template**: `Job Opening.screening_template` → kalau kosong, template aktif yang `job_roles`-nya memuat Designation lowongan → kalau tidak ada, screening `Failed` dengan alasan "Belum ada template untuk jabatan ini".
2. **Pemicu**: `after_insert` / `on_update` Job Applicant ketika `resume_attachment` terisi dan `auto_screen` aktif → buat Resume Screening `Queued` → `frappe.enqueue`.
3. **Penilaian ulang**: tombol "Screen ulang" di form Resume Screening, aksi massal di list Job Applicant (fitur "3 Selected" di desain), dan otomatis bila CV diganti.
4. **Selesai**: salin `total_score`, `status` ke Job Applicant; kirim Notification Log ke pembuat lowongan.
5. **Lowongan ditutup**: data tidak dihapus (desain meminta dihapus). List default difilter `job_opening.status = Open`. Penghapusan data pelamar mengikuti kebijakan retensi (UU PDP), bukan otomatis saat lowongan ditutup.

## 7. Pemetaan layar desain ke Desk

| Layar | Di ERPNext |
|---|---|
| 01 list tabel | List view Resume Screening: kolom pelamar, kontak, lowongan, sumber, skor, status. Filter skor & status bawaan. |
| 02 card/kanban | Kanban board Job Applicant berdasarkan `recruitment_stage`. Kartu: lowongan, nama, skor, sumber, waktu. |
| 01/02 unduh XLSX | Report view → Export (bawaan). |
| 01/02 "3 Selected" | Seleksi baris list bawaan + aksi "Screen ulang". |
| 03 saved setting | List view Resume Screening Template (bisa mode card lewat list settings). Aktif/nonaktif dari field `enabled`. |
| 04–09 wizard | Satu form Resume Screening Template. "Use template" = Duplicate (bawaan). |
| 10/11 detail | Form Resume Screening: banner label (indicator, bisa diubah HR lewat `hr_override_label`), panel kiri teks CV + pratinjau file, panel kanan detail pelamar dan hasil per metrik dengan status per metrik. Navigasi kandidat sebelum/sesudah = tombol prev/next bawaan form. |
| 03 badge "New" | Indikator list untuk template yang dibuat ≤ 7 hari lalu; urutan default terbaru dulu (catatan desain: template baru muncul paling kiri atas). |
| 09 "New setting has been added" | Pesan sukses bawaan saat simpan, plus tombol ke list template. |
| 10/11 unduh PDF | Print Format "Resume Screening". |
| Sidebar "HR analytic" | Workspace "Rekrutmen": shortcut Job Opening, Job Applicant (kanban), Resume Screening, Interview, Job Offer, Employee Onboarding, plus number card jumlah per tahap. |

## 8. Hak akses

| Role | Template | Resume Screening | Kriteria di Job Opening |
|---|---|---|---|
| HR Manager | baca/tulis | baca/tulis/hapus | baca/tulis |
| HR User | baca | baca/tulis (screen ulang) | baca/tulis |
| Interviewer | - | baca, hanya pelamar yang diwawancarainya | - |
| Employee | - | - | - |

## 9. Privasi dan keadilan
- Gender, usia, foto, agama, dan status pernikahan tidak dibaca dan tidak memengaruhi skor. Info "26 | Male" di kartu desain dihapus dari tampilan.
- Skor adalah alat bantu. Kandidat di bawah minimum tidak ditolak otomatis; HR tetap memutuskan.
- `criteria_snapshot` dan alasan per metrik disimpan supaya setiap skor bisa dijelaskan.

## 10. Hal yang perlu diputuskan sebelum dibangun

1. **Bobot default.** Desain tidak konsisten: layar saved metric berjumlah 115% (50/30/7×5), layar edit 90% (9×10). Usulan default berjumlah 100%, dengan bobot terbesar di relevansi karena itu yang paling bermakna:

   | ATS | Grammar | Tanggal | Kelengkapan | Pendidikan | Skill | Pengalaman | Prestasi | Sertifikasi |
   |---|---|---|---|---|---|---|---|---|
   | 10 | 5 | 10 | 10 | 10 | 25 | 20 | 5 | 5 |

2. **Custom app `hris_ats`** dan repo git-nya (bagian 2). Setuju, atau pakai jalur pdf.js?
3. **`fail_description`**: tambahkan, karena desain hanya punya banner untuk kandidat yang lolos.
4. **Bahasa CV** yang didukung v1: Indonesia dan Inggris.
5. **Ketidakkonsistenan kecil di desain** yang perlu dirapikan desainer: layar 10 hanya menampilkan 8 metrik (Information completeness tidak ada), sedangkan layar 11 menampilkan 9; kanban layar 02 belum punya kolom Background Check; panel kandidat masih menampilkan usia dan gender.

## 11. Urutan pengerjaan setelah disetujui
1. Kerangka custom app, tambah ke `apps.json`, build image lokal.
2. Doctype template + settings + field tambahan, beserta validasinya.
3. Ekstraksi dan 9 metrik, dengan unit test memakai 5–10 contoh CV (PDF satu kolom, dua kolom, scan, DOCX).
4. Doctype Resume Screening, background job, pemicu dan aksi massal.
5. Kanban, workspace, print format, hak akses.
6. Seed contoh (lowongan + template + pelamar) di `seed.py`, lalu deploy ke srv-vllm.
