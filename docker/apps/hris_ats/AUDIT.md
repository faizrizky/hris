# AUDIT BASELINE & INVENTARIS SISTEM HRIS_ATS (FASE 1)

> **Tanggal Audit:** 19 Oktober 2026  
> **Branch:** `feat/hris-ats`  
> **Lingkungan:** Docker Compose (ERPNext v16, Frappe HR v16, Python 3.14.8, MariaDB 11.8, Redis 6.2)  

---

## 1. Ringkasan Eksekutif & Hasil Baseline

Audit baseline dilakukan tanpa mengubah perilaku kode atau memodifikasi file sumber. Seluruh pengujian murni, linting, pengujian FrappeTestCase pada site uji terisolasi, audit hak akses, dan verifikasi alur kepatuhan telah dijalankan dengan hasil sebagai berikut:

1. **Pengujian Unit Murni (`tests/scoring`, `tests/bgc`):**
   - Status: **65 lulus, 0 gagal** (7.01 detik).
   - Cakupan: scoring resume, analisis artikel, penanda risiko, parser direktori putusan MA, parser PDF putusan, dan fetch layer mock.
2. **Pengujian Integrasi FrappeTestCase (`tests/test_*.py`):**
   - Dijalankan pada site uji terisolasi `ats-test.localhost` (dibuat khusus untuk pengujian dan telah dihapus kembali).
   - Status awal (DB bersih tanpa master data): 17 lulus, 2 gagal, 10 error.
     - *Penyebab error:* Validasi pengetikan ketat Pydantic pada HRMS v16 (`get_active_staffing_plan_details`) mewajibkan `company: str`, sedangkan pembuatan `Job Opening` pada test tidak menyertakan company.
     - *Penyebab failure:* Asersi string user agent `HR Background Check` vs aktual `HRIS Background Check`, serta asersi user `hr.test@example.com` yang belum ada.
   - Status setelah seeding data master (`./seed/seed.sh`): **29 lulus, 0 gagal** (4.09 detik).
3. **Linter Ruff (`ruff check apps/hris_ats`):**
   - Status: **100 temuan linting**.
   - Rincian: 39 `I001` (impor belum rapi), 19 `UP015` (mode buka file redundan), 12 `W291` (trailing whitespace), 6 `RUF002` (karakter ambigu docstring), 5 `RUF059` (unpacked variable tak terpakai), 5 `F841` (variabel lokal tak terpakai), 3 `RUF001` (karakter ambigu string), 3 `F821` (**undefined name `Any`** pada `scoring/workflow.py:316, 334, 354`), 2 `RUF005`, 2 `UP035`, 1 `RUF010`, 1 `UP006`, 1 `RUF046`, 1 `B007`.
4. **Seed Idempotency & Smoke Test (`smoke.sh`):**
   - Seed dijalankan dua kali berturut-turut tanpa duplikasi data atau kegagalan.
   - `./seed/smoke.sh` menghasilkan: **SEMUA OK** (100% endpoint 200 OK untuk user Rani ESS, MSS, HR, Token auth, dan 403 untuk Guest).
5. **Integritas Repositori (`git diff main -- docker/server-scripts src App.tsx modules app.json eas.json`):**
   - Status: **Bersih (kosong)**.

---

## 2. Matriks Audit Kepatuhan Spesifikasi

| No | Butir Audit | Status | Bukti Teknis & Lokasi Kode |
|---|---|---|---|
| 1 | **Larangan Keras PROMPT-ANTIGRAVITY-ATS** (tanpa usia/gender/foto di scoring & BGC, tanpa GetContact, politik/partai, kepribadian, LLM, cookie/login sosmed, ProxyRotator, cek email/telepon) | **LULUS** | Grep menyeluruh pada `scoring/` dan `bgc/`: tidak ditemukan referensi ke GetContact, ProxyRotator, OpenAI, Anthropic, gender, atau usia. `posts.py:6` secara eksplisit mendokumentasikan larangan analisis politik/partai/psikologis. `article.py:39` menyetel `cookies={}`. |
| 2 | **BaseProvider & Fallback Cache di Worker** (`bgc/providers/base.py`, `bgc/fetch.py`) | **SEBAGIAN** | `BaseProvider` tidak menyimpan state cache atau rate limit di memori instance (`base.py:49-78`). Namun, `get_default_cache_backend()` di `fetch.py:141-148` diam-diam jatuh (*silent fallback*) ke `MemoryCacheBackend()` bila `frappe.cache` gagal, dan `FrappeRedisCacheBackend` menelan exception (`except Exception: pass`) tanpa log warning atau error. Di lingkungan worker produksi multi-proses, ini menyebabkan pembatasan laju dan cache tidak terbagi antar worker. |
| 3 | **Cache Redis: Kunci & Retensi Konten** (Kunci tidak memuat nama kandidat polos, TTL ≤ 24 jam, isi PDF/halaman tidak disimpan melebihi 24 jam) | **SEBAGIAN** | TTL disetel 86400 detik (24 jam) di `fetch.py:77`. Berkas PDF putusan MA dibersihkan seketika dari disk via `tempfile.TemporaryDirectory()` di `court_ma.py:443`. Namun, kunci cache di `fetch.py:366` (`hris_ats:fetch_cache:{mode}:{method}:{url}`) menyertakan URL polos yang memuat nama kandidat saat pencarian nama dilakukan (mis. query putusan MA atau link profil), membocorkan nama kandidat dalam teks biasa ke Redis. Selain itu, seluruh binary PDF disimpan dalam cache Redis (`content_bytes` di `fetch.py:506`). |
| 4 | **Hak Akses Nyata Dokumen & Field** (HR Manager, HR User, Interviewer, Employee, BGC Officer, System Manager pada BGC, Finding, Settings permlevel 1, Job Applicant) | **GAGAL** | Audit via `frappe.has_permission`: (1) `Background Check` & `Finding` hanya mengizinkan HR Manager & BGC Officer; System Manager **tidak memiliki hak baca/tulis** di JSON doctype (`background_check.json:368-393`). (2) Interviewer **tidak memiliki hak baca sama sekali** pada `Job Applicant` (`read=False`) dan tidak ada role permission untuk membatasi Interviewer hanya melihat `risk_level_final` dan `hr_conclusion`. (3) Settings permlevel 1 berfungsi benar (HR Manager hanya baca permlevel 1, System Manager baca/tulis permlevel 1 di `background_check_settings.json:305-316`). |
| 5 | **Alur Persetujuan (Consent)** (Tanpa Granted job tidak jalan, sumber tak dicentang dilewati, token sekali pakai & kedaluwarsa, penarikan menghapus data turunan) | **SEBAGIAN** | Verifikasi: `runner.py:98-101` melewati sumber yang tidak disetujui. `consent.py:157-159` membatalkan token sekali pakai. `submit_candidate_consent` memvalidasi tanggal kedaluwarsa. `background_check.py:53-54` menghapus `Background Check Finding` saat `consent_status == 'Withdrawn'`. Namun, `revoke_consent` **TIDAK** membersihkan data turunan akun pada baris tabel `accounts` (`display_name`, `bio_snippet`, `profile_location`, `identity_*`), tidak menghapus direktori crawl private, dan tidak menginvalir cache Redis. |
| 6 | **Retensi Harian (`daily_retention_purge`) & SKCK** (Pembersihan hasil sesuai spesifikasi 8, sisakan level, kesimpulan HR, bukti consent; periksa status berkas `skck_file`) | **LULUS** | `tasks.py:15-75` menghapus temuan mentah BGC kadaluwarsa (`purge_after <= today`), mengosongkan `summary_auto` dan `accounts`, menghapus direktori crawl, memperbarui status SKCK kadaluwarsa menjadi `Kedaluwarsa`, dan menandai `is_purged = 1`. Berkas `skck_file` **tidak dihapus**, yang mana sejalan dengan spesifikasi Bagian 8 (SKCK merupakan berkas resmi/verifikasi independen dan bukan hasil ekstrak web crawling sementara). |
| 7 | **Gerbang Interview** (Hanya berlaku untuk pelamar yang punya BGC; pesan galat bisa diterjemahkan) | **LULUS** | `scoring/workflow.py:375-402`: pemeriksaan hanya aktif bila pelamar memiliki berkas Background Check (`if bgc_name:`). Bila belum ada kesimpulan HR, melempar pesan kesalahan yang dibungkus `_()`. Catatan: string sumber saat ini ditulis dalam Bahasa Indonesia. |
| 8 | **Aturan Risiko 6.6 & Kasus 6.4** (Temuan perkara pengadilan tidak menaikkan risk_level_auto di atas 'Perlu verifikasi' sebelum ditandai Relevan) | **LULUS** | `bgc/analysis/risk.py:50-51` secara tegas memprioritaskan `has_unreviewed_high` menghasilkan `'Perlu verifikasi'`. Temuan perkara berkategori Tinggi (Pidana Terdakwa) yang berstatus `'Belum ditinjau'` tidak akan menaikkan level ke `'Tinggi'` sebelum HR mengubahnya menjadi `'Relevan'`. Diuji pada `tests/bgc/test_bgc_analysis.py:338`. |
| 9 | **Print Format Background Check Report** (Hanya memuat temuan Relevan + kesimpulan HR + mode pengambilan) | **LULUS** | `background_check_report.html:168-180` mencantumkan `fetch_mode_used` dan `robots_ignored_count` per sumber; baris 186-200 menampilkan `hr_conclusion` dan `summary_hr`; baris 208 melakukan query eksplisit `filters={'hr_verdict': 'Relevan'}` sehingga temuan mentah yang tidak relevan tidak pernah tercetak. Catatan: template saat ini masih berbahasa Indonesia. |
| 10 | **Status Spider `CourtMASpider`** (Dipakai atau kode mati) | **GAGAL** | `bgc/providers/court_ma.py:406-416` mendefinisikan `class CourtMASpider(Spider)` kosong dengan keterangan 'referensi arsitektur Spider'. Kelas ini tidak pernah diinstansiasi atau dipanggil di mana pun dalam kode aplikasi. Seluruh penelusuran MA dijalankan secara manual via `fetch.py` di `CourtMAProvider`. Kelas ini adalah **kode mati** (*dead code*). |
| 11 | **Integritas Branch & Repositori Git** | **LULUS** | Perintah `git diff main -- docker/server-scripts src App.tsx modules app.json eas.json` menghasilkan output kosong, membuktikan tidak ada modifikasi di luar lingkup aplikasi `hris_ats`. |
| 12 | **Idempotensi Seed & Uji Asap** | **LULUS** | Script `./seed/seed.sh` dijalankan 2 kali berturut-turut dengan status keluar 0 dan tanpa error duplikasi. Script `./seed/smoke.sh` menghasilkan status `SEMUA OK` pada seluruh endpoint API. |

---

## 3. Inventaris String UI (Total: 552 Entri)

Inventaris dikelompokkan ke dalam tiga kategori utama:
- **Sumber Bahasa Indonesia (128 entri):** String yang dibungkus `_()` atau `__()` tetapi teks aslinya ditulis dalam Bahasa Indonesia, menyebabkan pengguna dengan bahasa `en` melihat teks Indonesia.
- **Belum dibungkus `_()` / `__()` (80 entri):** Teks UI pada generator (`reason`, `summary_auto`, `match_reasons`), template email, dialog, dan custom fields yang belum dibungkus fungsi terjemahan sama sekali.
- **Sumber Bahasa Inggris (344 entri):** Label dan teks yang sudah sesuai standar Frappe berbahasa Inggris.

### 3.1 Rincian Masalah Kritis String UI

1. **Nilai Select DocType Tersimpan dalam Bahasa Indonesia:**
   - `Background Check.risk_level_auto / risk_level_final`: `Rendah`, `Sedang`, `Tinggi`, `Perlu verifikasi`
   - `Background Check Finding.category`: `Prestasi`, `Profesional`, `Netral`, `Berisiko`
   - `Background Check Finding.hr_verdict`: `Belum ditinjau`, `Relevan`, `Bukan orang ini`, `Diabaikan`
   - `Background Check.skck_status`: `Tidak diunggah`, `Belum diperiksa`, `Bersih`, `Ada catatan`, `Kedaluwarsa`
   - `Background Check Finding.text_source`: `Cuplikan`, `Teks lengkap`, `PDF putusan`
   - `Background Check Lexicon.category`: `Kata kasar`, `Ujaran kebencian/SARA`, `Ancaman/kekerasan`, `Pornografi`, `Judi online`, `Narkoba`, `Penipuan`, `Kebocoran informasi perusahaan`, `Hukum-negatif`
2. **Teks Hasil Generator Tidak Netral Bahasa:**
   - Seluruh metrik scoring (`scoring/metrics/*.py`) menghasilkan string kalimat lengkap dalam bahasa Indonesia dan disimpan ke `Resume Screening Result.reason`.
   - `bgc/analysis/summary.py` menyusun ringkasan profil kandidat (`summary_auto`) dalam bahasa Indonesia.
   - `bgc/analysis/identity.py` dan `case.py` menghasilkan `match_reasons` dan `risk_flags` dalam bahasa Indonesia.
3. **Persetujuan Kandidat (`www/ats_consent.html` & `ats_consent.py`):**
   - Checkbox persetujuan sumber tercentang otomatis di HTML (`checked` pada baris 39).
   - Seluruh label dan penjelasan di halaman persetujuan ditulis dalam Bahasa Indonesia.
   - Email permohonan persetujuan di `bgc/consent.py:68-75` ditulis langsung dalam bahasa Indonesia tanpa internasionalisasi.

### 3.2 Tabel Lengkap Inventaris String

| Berkas:Baris | String / Teks UI | Kategori | Tipe Entri |
|---|---|---|---|
| `hris_ats/bgc/analysis/identity.py:126` | Nama persis cocok (+50): '{matched_variant}' | **Belum dibungkus _()** | Identity Reasons |
| `hris_ats/bgc/analysis/identity.py:129` | Kemiripan nama tinggi {best_ratio:.0f}% (+40) | **Belum dibungkus _()** | Identity Reasons |
| `hris_ats/bgc/analysis/identity.py:132` | Kemiripan nama sedang {best_ratio:.0f}% (+25) | **Belum dibungkus _()** | Identity Reasons |
| `hris_ats/bgc/analysis/identity.py:134` | Kemiripan nama {best_ratio:.0f}% di bawah ambang 80% (temuan dibuang) | **Belum dibungkus _()** | Identity Reasons |
| `hris_ats/bgc/analysis/identity.py:180` | Konteks cocok (+{context_score}): {terms} | **Belum dibungkus _()** | Identity Reasons |
| `hris_ats/bgc/analysis/identity.py:196` | Mononim: tidak ada bonus keunikan nama (+0) | **Belum dibungkus _()** | Identity Reasons |
| `hris_ats/bgc/analysis/identity.py:199` | Bonus nama unik {total_hits} hasil (+10) | **Belum dibungkus _()** | Identity Reasons |
| `hris_ats/bgc/analysis/identity.py:206` | Skor dari cuplikan saja dibatasi maksimal 70 | **Belum dibungkus _()** | Identity Reasons |
| `hris_ats/bgc/analysis/identity.py:281` | Nama tampilan persis cocok (+50): '{display_name}' | **Belum dibungkus _()** | Identity Reasons |
| `hris_ats/bgc/analysis/identity.py:284` | Kemiripan nama tampilan tinggi {best_ratio:.0f}% (+40) | **Belum dibungkus _()** | Identity Reasons |
| `hris_ats/bgc/analysis/identity.py:287` | Kemiripan nama tampilan sedang {best_ratio:.0f}% (+25) | **Belum dibungkus _()** | Identity Reasons |
| `hris_ats/bgc/analysis/identity.py:289` | Kemiripan nama tampilan rendah {best_ratio:.0f}% (+0) | **Belum dibungkus _()** | Identity Reasons |
| `hris_ats/bgc/analysis/identity.py:291` | Nama tampilan tidak tersedia (+0) | **Belum dibungkus _()** | Identity Reasons |
| `hris_ats/bgc/analysis/identity.py:300` | Lokasi profil cocok dengan kota kandidat '{candidate_city}' (+20) | **Belum dibungkus _()** | Identity Reasons |
| `hris_ats/bgc/analysis/identity.py:302` | Lokasi profil '{location}' berbeda dari kota kandidat (+0) | **Belum dibungkus _()** | Identity Reasons |
| `hris_ats/bgc/analysis/identity.py:320` | Bio menyebut entitas CV '{matched_cv_term}' (+20) | **Belum dibungkus _()** | Identity Reasons |
| `hris_ats/bgc/analysis/identity.py:326` | Akun dinyatakan sendiri oleh kandidat (+10) | **Belum dibungkus _()** | Identity Reasons |
| `hris_ats/bgc/analysis/identity.py:89` | Teks atau nama kosong | **Belum dibungkus _()** | Identity Reasons |
| `hris_ats/bgc/analysis/summary.py:32` | {name} melamar sebagai {title}. | **Belum dibungkus _()** | Automated Summary |
| `hris_ats/bgc/analysis/summary.py:45` | Ditemukan {count} akun publik ({p_str}). | **Belum dibungkus _()** | Automated Summary |
| `hris_ats/bgc/analysis/summary.py:51` | Ada {article_count} artikel yang kemungkinan besar terkait, {achievement_count} di antaranya tentang... | **Belum dibungkus _()** | Automated Summary |
| `hris_ats/bgc/analysis/summary.py:54` | Ada {article_count} artikel yang kemungkinan besar terkait. | **Belum dibungkus _()** | Automated Summary |
| `hris_ats/bgc/analysis/summary.py:58` | Ditemukan {case_count} catatan perkara yang perlu diverifikasi. | **Belum dibungkus _()** | Automated Summary |
| `hris_ats/bgc/analysis/summary.py:64` | Analisis {posts_count} post menunjukkan kesantunan bahasa {politeness_score}/100 dan {risk_posts_cou... | **Belum dibungkus _()** | Automated Summary |
| `hris_ats/bgc/analysis/summary.py:68` | Analisis {posts_count} post menunjukkan kesantunan bahasa {politeness_score}/100 tanpa post yang ter... | **Belum dibungkus _()** | Automated Summary |
| `hris_ats/bgc/consent.py:102` | Token persetujuan tidak valid atau tidak disertakan. | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/bgc/consent.py:106` | Token persetujuan tidak valid atau sudah pernah digunakan. | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/bgc/consent.py:112` | Tautan persetujuan telah kedaluwarsa. Silakan hubungi tim HR. | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/bgc/consent.py:115` | Persetujuan untuk berkas ini sudah pernah diproses sebelumnya. | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/bgc/consent.py:171` | Persetujuan berhasil dicatat. Terima kasih. | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/bgc/consent.py:180` | Dokumen {0} tidak ditemukan. | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/bgc/consent.py:190` | Persetujuan ditarik. {0} temuan berhasil dihapus. | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/bgc/consent.py:22` | Pelamar {0} tidak ditemukan. | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/bgc/consent.py:67` | Persetujuan Pemeriksaan Latar Belakang - Rekrutmen | **Sumber Bahasa Indonesia** | Email Subject _() |
| `hris_ats/bgc/consent.py:67` | Persetujuan Pemeriksaan Latar Belakang - Rekrutmen | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/bgc/consent.py:68` | Halo {full_name}, Terima kasih telah mengikuti tahapan rekrutmen. Sesuai ketentuan perlindungan data... | **Belum dibungkus _()** | Email Body Template |
| `hris_ats/bgc/consent.py:73` | Buka Formulir Persetujuan | **Belum dibungkus _()** | Email Action Button |
| `hris_ats/bgc/consent.py:74` | Tautan ini bersifat rahasia, sekali pakai, dan kedaluwarsa dalam 7 hari. | **Belum dibungkus _()** | Email Note |
| `hris_ats/bgc/consent.py:87` | Background Check berhasil dibuat dan undangan persetujuan telah dikirim. | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/bgc/runner.py:100` | Sumber tidak disetujui oleh kandidat. | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/bgc/runner.py:196` | Penyedia pencarian belum dikonfigurasi. | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/bgc/runner.py:213` | Penyedia pencarian belum dikonfigurasi. | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/bgc/runner.py:274` | Kredensial API media sosial belum dikonfigurasi. | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/hris_ats/doctype/background_check/background_check.js:118` | Pemeriksaan Background Check selesai | **Sumber Bahasa Indonesia** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check.js:12` | Jalankan Ulang | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check.js:14` | Jalankan ulang pemeriksaan Background Check untuk kandidat ini? | **Sumber Bahasa Indonesia** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check.js:141` | Tidak ada temuan artikel, dokumen, atau perkara hukum untuk kandidat ini. | **Sumber Bahasa Indonesia** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check.js:157` | Halaman Detail | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check.js:158` | Unduh Salinan PDF | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check.js:159` | Text Source | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check.js:185` | Evidence Excerpt | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check.js:20` | Memulai ulang background check... | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check.js:203` | Cari judul atau isi temuan... | **Sumber Bahasa Indonesia** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check.js:229` | Verdict diperbarui | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check.js:24` | Pemeriksaan ulang dijadwalkan | **Sumber Bahasa Indonesia** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check.js:254` | Tidak ada post publik yang terindikasi berisiko dari akun kandidat. | **Sumber Bahasa Indonesia** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check.js:285` | Post Terindikasi Berisiko | **Sumber Bahasa Indonesia** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check.js:299` | Verdict diperbarui | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check.js:33` | Aksi | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check.js:37` | Lihat Pelamar | **Sumber Bahasa Indonesia** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check.js:39` | Navigasi | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check.js:42` | Buka List Finding | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check.js:44` | Navigasi | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check.js:60` | Keputusan Final HR | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check.js:60` | Indikasi Otomatis | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check.js:86` | Pemeriksaan belum dijalankan atau belum ada temuan. | **Sumber Bahasa Indonesia** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:account_findings_html` | Field Label: Temuan Jejak Digital Akun | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:accounts` | Field Label: Accounts | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:consent_at` | Field Label: Consent Granted At | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:consent_file` | Field Label: Signed Consent Document | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:consent_ip` | Field Label: Consent IP Address | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:consent_method` | Field Label: Consent Method | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:consent_method` | Select Option: Web form | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:consent_method` | Select Option: Uploaded document | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:consent_scope` | Field Label: Consent Scope | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:consent_status` | Field Label: Consent Status | **Sumber Bahasa Indonesia** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:consent_status` | Select Option: Pending | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:consent_status` | Select Option: Granted | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:consent_status` | Select Option: Declined | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:consent_status` | Select Option: Withdrawn | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:consent_text_version` | Field Label: Consent Text Version | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:consent_token` | Field Label: Consent Token | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:consent_token_expires_at` | Field Label: Token Expires At | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:context_terms` | Field Label: Context Terms (dari Resume Screening) | **Sumber Bahasa Indonesia** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:email` | Field Label: Email | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:full_name` | Field Label: Full Name | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:hr_conclusion` | Field Label: HR Conclusion (Wajib sebelum Interview) | **Sumber Bahasa Indonesia** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:is_purged` | Field Label: Is Purged | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:job_applicant` | Field Label: Job Applicant | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:name_findings_html` | Field Label: Temuan Jejak Digital Nama | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:name_variants` | Field Label: Name Variants (satu per baris) | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:naming_series` | Field Label: Series | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:naming_series` | Select Option: BGC-.YYYY.-.##### | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:phone` | Field Label: Phone (+62) | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:politeness_score` | Field Label: Politeness Score (0-100) | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:purge_after` | Field Label: Purge Raw Findings After | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:reviewed_by` | Field Label: Reviewed By | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:reviewed_on` | Field Label: Reviewed On | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:risk_level_auto` | Field Label: Indicated Risk Level | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:risk_level_auto` | Select Option: Rendah | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:risk_level_auto` | Select Option: Sedang | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:risk_level_auto` | Select Option: Tinggi | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:risk_level_auto` | Select Option: Perlu verifikasi | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:risk_level_final` | Field Label: Final Risk Level | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:risk_level_final` | Select Option: Rendah | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:risk_level_final` | Select Option: Sedang | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:risk_level_final` | Select Option: Tinggi | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:risk_level_final` | Select Option: Perlu verifikasi | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:section_break_accounts` | Field Label: Registered Accounts | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:section_break_applicant_header` | Field Label: Informasi Kandidat | **Sumber Bahasa Indonesia** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:section_break_audit` | Field Label: Review Audit | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:section_break_consent` | Field Label: Candidate Consent (UU PDP Compliance) | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:section_break_identity` | Field Label: Identity & Context Terms | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:section_break_scope` | Field Label: Consented Check Scopes | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:section_break_skck` | Field Label: SKCK Verification (Opsional) | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:section_break_source_runs` | Field Label: Source Status | **Sumber Bahasa Indonesia** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:section_break_summary` | Field Label: Profile Summary & HR Conclusion | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:skck_file` | Field Label: SKCK Document | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:skck_number` | Field Label: SKCK Number | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:skck_status` | Field Label: SKCK Status | **Sumber Bahasa Indonesia** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:skck_status` | Select Option: Tidak diunggah | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:skck_status` | Select Option: Belum diperiksa | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:skck_status` | Select Option: Bersih | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:skck_status` | Select Option: Ada catatan | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:skck_status` | Select Option: Kedaluwarsa | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:skck_valid_until` | Field Label: SKCK Valid Until | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:source_runs` | Field Label: Source Runs | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:status` | Field Label: Status | **Sumber Bahasa Indonesia** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:status` | Select Option: Waiting Consent | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:status` | Select Option: Queued | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:status` | Select Option: Crawling | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:status` | Select Option: Done | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:status` | Select Option: Failed | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:summary_auto` | Field Label: Automated Summary | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:summary_hr` | Field Label: HR Summary Review | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:tab_account_trace` | Field Label: Jejak Digital Akun | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:tab_consent_audit` | Field Label: Persetujuan & Audit | **Sumber Bahasa Indonesia** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:tab_name_trace` | Field Label: Jejak Digital Nama | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:tab_overview` | Field Label: Ringkasan | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.json:tab_platform` | Field Label: Platform | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check/background_check.py:152` | Dokumen {0} tidak ditemukan. | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/hris_ats/doctype/background_check/background_check.py:156` | Background Check tidak dapat dijalankan tanpa persetujuan kandidat (status saat ini: {0}). | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/hris_ats/doctype/background_check/background_check.py:171` | Pemeriksaan ulang Background Check telah dijadwalkan. | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/hris_ats/doctype/background_check/background_check.py:81` | Temuan {0} tidak ditemukan. | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/hris_ats/doctype/background_check/background_check_list.js:10` | Done (Tinggi) | **Sumber Bahasa Indonesia** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check_list.js:12` | Done (Perlu verifikasi) | **Sumber Bahasa Indonesia** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check_list.js:14` | Done (Sedang) | **Sumber Bahasa Indonesia** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check_list.js:16` | Done (Rendah) | **Sumber Bahasa Indonesia** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check_list.js:19` | Crawling... | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check_list.js:21` | Queued | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check_list.js:23` | Waiting Consent | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/background_check/background_check_list.js:25` | Failed | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/background_check_account/background_check_account.json:bio_snippet` | Field Label: Bio Snippet | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_account/background_check_account.json:declared_by` | Field Label: Declared By | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_account/background_check_account.json:declared_by` | Select Option: Candidate | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_account/background_check_account.json:declared_by` | Select Option: HR | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_account/background_check_account.json:display_name` | Field Label: Display Name | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_account/background_check_account.json:exists` | Field Label: Exists | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_account/background_check_account.json:identity_match` | Field Label: Identity Match (%) | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_account/background_check_account.json:identity_reasons` | Field Label: Identity Match Reasons | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_account/background_check_account.json:last_active` | Field Label: Last Active | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_account/background_check_account.json:platform` | Field Label: Platform | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_account/background_check_account.json:post_access` | Field Label: Post Access | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_account/background_check_account.json:post_access` | Select Option: API | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_account/background_check_account.json:post_access` | Select Option: Manual review only | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_account/background_check_account.json:post_access` | Select Option: Not supported | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_account/background_check_account.json:profile_location` | Field Label: Profile Location | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_account/background_check_account.json:profile_url` | Field Label: Profile URL | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_account/background_check_account.json:username` | Field Label: Username | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_consent_scope/background_check_consent_scope.json:granted` | Field Label: Granted | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_consent_scope/background_check_consent_scope.json:source` | Field Label: Source | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_consent_scope/background_check_consent_scope.json:source` | Select Option: Platform | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_consent_scope/background_check_consent_scope.json:source` | Select Option: Article | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_consent_scope/background_check_consent_scope.json:source` | Select Option: File | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_consent_scope/background_check_consent_scope.json:source` | Select Option: Case history | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_consent_scope/background_check_consent_scope.json:source` | Select Option: Posts | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:account` | Field Label: Account | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:adjudicated_on` | Field Label: Adjudicated On | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:background_check` | Field Label: Background Check | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:case_number` | Field Label: Case Number | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:case_type` | Field Label: Case Type | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:category` | Field Label: Category | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:category` | Select Option: Prestasi | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:category` | Select Option: Profesional | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:category` | Select Option: Netral | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:category` | Select Option: Berisiko | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:court` | Field Label: Court | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:detail_url` | Field Label: Detail URL | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:evidence_excerpt` | Field Label: Evidence Excerpt | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:file_type` | Field Label: File Type | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:finding_type` | Field Label: Finding Type | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:finding_type` | Select Option: Article | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:finding_type` | Select Option: File | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:finding_type` | Select Option: Case | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:finding_type` | Select Option: Post | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:hr_note` | Field Label: HR Review Note | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:hr_verdict` | Field Label: HR Verdict | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:hr_verdict` | Select Option: Belum ditinjau | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:hr_verdict` | Select Option: Relevan | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:hr_verdict` | Select Option: Bukan orang ini | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:hr_verdict` | Select Option: Diabaikan | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:match_confidence` | Field Label: Match Confidence (%) | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:match_reasons` | Field Label: Match Reasons | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:party_role` | Field Label: Party Role | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:pdf_url` | Field Label: PDF URL | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:published_on` | Field Label: Published On | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:registered_on` | Field Label: Registered On | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:risk_flags` | Field Label: Risk Flags | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:section_break_case` | Field Label: Case Details (Putusan MA) | **Sumber Bahasa Indonesia** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:section_break_content` | Field Label: Content & Match Reason | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:section_break_hr` | Field Label: HR Review | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:severity` | Field Label: Severity | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:severity` | Select Option: Info | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:severity` | Select Option: Rendah | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:severity` | Select Option: Sedang | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:severity` | Select Option: Tinggi | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:snippet` | Field Label: Snippet / Excerpt | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:source_name` | Field Label: Source Name | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:text_source` | Field Label: Text Source | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:text_source` | Select Option: Cuplikan | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:text_source` | Select Option: Teks lengkap | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:text_source` | Select Option: PDF putusan | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:title` | Field Label: Title / Identifier | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:uploaded_on` | Field Label: Uploaded On | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_finding/background_check_finding.json:url` | Field Label: URL | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_lexicon/background_check_lexicon.json:category` | Field Label: Category | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_lexicon/background_check_lexicon.json:category` | Select Option: Kata kasar | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_lexicon/background_check_lexicon.json:category` | Select Option: Ujaran kebencian/SARA | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_lexicon/background_check_lexicon.json:category` | Select Option: Ancaman/kekerasan | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_lexicon/background_check_lexicon.json:category` | Select Option: Pornografi | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_lexicon/background_check_lexicon.json:category` | Select Option: Judi online | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_lexicon/background_check_lexicon.json:category` | Select Option: Narkoba | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_lexicon/background_check_lexicon.json:category` | Select Option: Penipuan | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_lexicon/background_check_lexicon.json:category` | Select Option: Kebocoran informasi perusahaan | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_lexicon/background_check_lexicon.json:category` | Select Option: Prestasi | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_lexicon/background_check_lexicon.json:category` | Select Option: Profesional | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_lexicon/background_check_lexicon.json:category` | Select Option: Hukum-negatif | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_lexicon/background_check_lexicon.json:enabled` | Field Label: Enabled | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_lexicon/background_check_lexicon.json:is_regex` | Field Label: Is Regex | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_lexicon/background_check_lexicon.json:language` | Field Label: Language | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_lexicon/background_check_lexicon.json:language` | Select Option: id | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_lexicon/background_check_lexicon.json:language` | Select Option: en | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_lexicon/background_check_lexicon.json:severity` | Field Label: Severity | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_lexicon/background_check_lexicon.json:severity` | Select Option: Info | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_lexicon/background_check_lexicon.json:severity` | Select Option: Rendah | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_lexicon/background_check_lexicon.json:severity` | Select Option: Sedang | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_lexicon/background_check_lexicon.json:severity` | Select Option: Tinggi | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_lexicon/background_check_lexicon.json:term` | Field Label: Term / Keyword | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_lexicon/background_check_lexicon.json:weight` | Field Label: Weight | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:bio_selector` | Field Label: Bio Selector | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:category` | Field Label: Category | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:category` | Select Option: Creative | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:category` | Select Option: Social | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:category` | Select Option: Professional | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:category` | Select Option: Developer | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:category` | Select Option: Other | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:check_method` | Field Label: Check Method | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:check_method` | Select Option: Status code | **Sumber Bahasa Indonesia** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:check_method` | Select Option: Body contains | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:check_method` | Select Option: Body not contains | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:check_value` | Field Label: Check Value | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:display_name_selector` | Field Label: Display Name Selector | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:enabled` | Field Label: Enabled | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:icon` | Field Label: Icon (SVG / FontAwesome) | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:location_selector` | Field Label: Location Selector | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:platform_name` | Field Label: Platform Name | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:post_api` | Field Label: Post API Integration | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:post_api` | Select Option: None | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:post_api` | Select Option: X | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:post_api` | Select Option: YouTube | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:post_api` | Select Option: GitHub | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:post_api` | Select Option: Mastodon | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:post_api` | Select Option: Reddit | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:profile_url_template` | Field Label: Profile URL Template | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:section_break_adaptive` | Field Label: Adaptive Selectors | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_platform/background_check_platform.json:section_break_check` | Field Label: Verification Method | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:consent_text` | Field Label: Consent Terms Text | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:consent_text_version` | Field Label: Consent Text Version | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:enable_article` | Field Label: Enable News Articles | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:enable_case_history` | Field Label: Enable Case History (Putusan MA) | **Sumber Bahasa Indonesia** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:enable_file` | Field Label: Enable Public Files (PDF/DOCX) | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:enable_platform` | Field Label: Enable Registered Platforms | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:enable_posts` | Field Label: Enable Public Posts API | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:enabled` | Field Label: Enable Background Check | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:fetch_browser_status` | Field Label: Browser Status | **Sumber Bahasa Indonesia** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:fetch_identity` | Field Label: Fetch Identity | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:fetch_identity` | Select Option: Company | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:fetch_identity` | Select Option: Browser | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:fetch_respect_robots` | Field Label: Respect robots.txt | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:fetch_risk_ack_by` | Field Label: Risk Acknowledged By | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:fetch_risk_ack_on` | Field Label: Risk Acknowledged On | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:fetch_risk_acknowledged` | Field Label: Acknowledge Legal and Technical Risks | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:fetch_risk_acknowledged` | Field Desc: 1. Menembus proteksi anti-bot dapat dianggap "menerobos atau menjebol sistem pengamanan"... | **Sumber Bahasa Indonesia** | DocType Field Description |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:fetch_stealth_domains` | Field Label: Stealth Domains | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:fetch_stealth_mode` | Field Label: Enable Stealth Mode | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:fetch_user_agent` | Field Label: User Agent | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:github_token` | Field Label: GitHub Personal Access Token | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:max_results_per_source` | Field Label: Max Results Per Source | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:min_match_confidence` | Field Label: Min Match Confidence (0-100) | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:mock_provider` | Field Label: Use Mock Provider (Offline / Testing) | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:rate_limit_per_minute` | Field Label: Rate Limit Per Minute | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:retention_days` | Field Label: Retention Days (Purge Raw Findings) | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:search_api_key` | Field Label: Search API Key | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:search_provider` | Field Label: Web Search Provider | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:search_provider` | Select Option: Mock | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:search_provider` | Select Option: Brave | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:search_provider` | Select Option: Google | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:search_provider` | Select Option: SerpAPI | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:section_break_consent` | Field Label: Consent Configuration | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:section_break_fetch_mode` | Field Label: Mode Pengambilan Halaman | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:section_break_providers` | Field Label: Provider API Credentials | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:section_break_sources` | Field Label: Source Toggles | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:section_break_thresholds` | Field Label: Parameters & Retention | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:x_api_key` | Field Label: X (Twitter) API Key | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.json:youtube_api_key` | Field Label: YouTube Data API Key | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_settings/background_check_settings.py:66` | Pengakuan Risiko Diperlukan | **Sumber Bahasa Inggris** | _() |
| `hris_ats/hris_ats/doctype/background_check_source_run/background_check_source_run.json:error` | Field Label: Error | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_source_run/background_check_source_run.json:fetch_mode_used` | Field Label: Fetch Mode Used | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_source_run/background_check_source_run.json:finished_on` | Field Label: Finished On | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_source_run/background_check_source_run.json:items_found` | Field Label: Items Found | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_source_run/background_check_source_run.json:robots_ignored_count` | Field Label: Robots Ignored Count | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_source_run/background_check_source_run.json:source` | Field Label: Source | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_source_run/background_check_source_run.json:source` | Select Option: Platform | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_source_run/background_check_source_run.json:source` | Select Option: Article | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_source_run/background_check_source_run.json:source` | Select Option: File | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_source_run/background_check_source_run.json:source` | Select Option: Case history | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_source_run/background_check_source_run.json:source` | Select Option: Posts | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_source_run/background_check_source_run.json:started_on` | Field Label: Started On | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_source_run/background_check_source_run.json:status` | Field Label: Status | **Sumber Bahasa Indonesia** | DocType Field Label |
| `hris_ats/hris_ats/doctype/background_check_source_run/background_check_source_run.json:status` | Select Option: Pending | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_source_run/background_check_source_run.json:status` | Select Option: Crawling | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_source_run/background_check_source_run.json:status` | Select Option: Done | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_source_run/background_check_source_run.json:status` | Select Option: Failed | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/background_check_source_run/background_check_source_run.json:status` | Select Option: Skipped | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.js:10` | Screen Ulang | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.js:113` | Ubah Label Hasil Screening | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.js:116` | Label Pengganti HR | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.js:120` | Menimpa label tampilan tanpa mengubah skor asli. | **Sumber Bahasa Indonesia** | __() |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.js:123` | Catatan Alasan Perubahan | **Sumber Bahasa Indonesia** | __() |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.js:129` | Simpan | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.js:17` | Memulai screening ulang... | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.js:20` | Screening ulang berhasil dimulai | **Sumber Bahasa Indonesia** | __() |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.js:30` | Unduh Berkas CV | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.js:32` | Aksi | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.js:56` | Lolos Kualifikasi | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.js:56` | Tidak Lolos | **Sumber Bahasa Indonesia** | __() |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:applicant_name` | Field Label: Applicant Name | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:criteria_snapshot` | Field Label: Criteria Snapshot | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:designation` | Field Label: Designation | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:email_id` | Field Label: Email | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:error` | Field Label: Error | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:experience_level` | Field Label: Experience Level | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:experience_level` | Select Option: Fresh Graduate | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:experience_level` | Select Option: Experienced | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:hr_override_label` | Field Label: HR Override Label | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:hr_override_note` | Field Label: HR Override Note | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:job_applicant` | Field Label: Job Applicant | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:job_opening` | Field Label: Job Opening | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:naming_series` | Field Label: Series | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:naming_series` | Select Option: RS-.YYYY.-.##### | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:passed` | Field Label: Passed | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:phone_number` | Field Label: Phone Number | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:result_description` | Field Label: Result Description | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:result_indicator` | Field Label: Result Indicator | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:result_indicator` | Select Option: green | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:result_indicator` | Select Option: orange | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:result_indicator` | Select Option: red | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:result_indicator` | Select Option: blue | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:result_label` | Field Label: Result Label | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:results` | Field Label: Metric Results | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:resume_file` | Field Label: Resume File | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:resume_text` | Field Label: Extracted Text | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:screened_on` | Field Label: Screened On | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:section_break_cv` | Field Label: Resume & Evidence | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:section_break_override` | Field Label: HR Override | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:section_break_results` | Field Label: Metric Results | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:section_break_status` | Field Label: Status & Result | **Sumber Bahasa Indonesia** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:source` | Field Label: Source | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:status` | Field Label: Status | **Sumber Bahasa Indonesia** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:status` | Select Option: Queued | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:status` | Select Option: Screening | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:status` | Select Option: Done | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:status` | Select Option: Failed | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:template` | Field Label: Screening Template | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening.json:total_score` | Field Label: Total Score | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening_list.js:11` | Done (Failed) | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening_list.js:14` | Screening... | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening_list.js:16` | Queued | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening_list.js:18` | Failed | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening_list.js:22` | Screen Ulang | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening_list.js:35` | Menjadwalkan screening ulang... | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening_list.js:38` | Screening ulang berhasil dijadwalkan | **Sumber Bahasa Indonesia** | __() |
| `hris_ats/hris_ats/doctype/resume_screening/resume_screening_list.js:9` | Done (Passed) | **Sumber Bahasa Inggris** | __() |
| `hris_ats/hris_ats/doctype/resume_screening_metric_weight/resume_screening_metric_weight.json:enabled` | Field Label: Enabled | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_metric_weight/resume_screening_metric_weight.json:metric` | Field Label: Metric | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_metric_weight/resume_screening_metric_weight.json:metric` | Select Option: ATS friendly | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening_metric_weight/resume_screening_metric_weight.json:metric` | Select Option: Grammar | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening_metric_weight/resume_screening_metric_weight.json:metric` | Select Option: Date consistency | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening_metric_weight/resume_screening_metric_weight.json:metric` | Select Option: Information completeness | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening_metric_weight/resume_screening_metric_weight.json:metric` | Select Option: Education relevance | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening_metric_weight/resume_screening_metric_weight.json:metric` | Select Option: Skill relevance | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening_metric_weight/resume_screening_metric_weight.json:metric` | Select Option: Experience relevance | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening_metric_weight/resume_screening_metric_weight.json:metric` | Select Option: Achievement relevance | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening_metric_weight/resume_screening_metric_weight.json:metric` | Select Option: Certification relevance | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening_metric_weight/resume_screening_metric_weight.json:weight` | Field Label: Weight | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_result/resume_screening_result.json:applicable` | Field Label: Applicable | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_result/resume_screening_result.json:metric` | Field Label: Metric | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_result/resume_screening_result.json:metric_status` | Field Label: Metric Status | **Sumber Bahasa Indonesia** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_result/resume_screening_result.json:metric_status` | Select Option: Pending | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening_result/resume_screening_result.json:metric_status` | Select Option: Done | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening_result/resume_screening_result.json:passed` | Field Label: Passed | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_result/resume_screening_result.json:reason` | Field Label: Reason | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_result/resume_screening_result.json:score` | Field Label: Score | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_result/resume_screening_result.json:weight` | Field Label: Effective Weight | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_score_label/resume_screening_score_label.json:description` | Field Label: Description | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_score_label/resume_screening_score_label.json:indicator` | Field Label: Indicator | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_score_label/resume_screening_score_label.json:indicator` | Select Option: green | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening_score_label/resume_screening_score_label.json:indicator` | Select Option: orange | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening_score_label/resume_screening_score_label.json:indicator` | Select Option: red | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening_score_label/resume_screening_score_label.json:indicator` | Select Option: blue | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening_score_label/resume_screening_score_label.json:label` | Field Label: Label | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_score_label/resume_screening_score_label.json:label_type` | Field Label: Label Type | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_score_label/resume_screening_score_label.json:label_type` | Select Option: Fixed | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening_score_label/resume_screening_score_label.json:label_type` | Select Option: Range | **Sumber Bahasa Inggris** | DocType Select Option |
| `hris_ats/hris_ats/doctype/resume_screening_score_label/resume_screening_score_label.json:score_from` | Field Label: Score From | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_score_label/resume_screening_score_label.json:score_to` | Field Label: Score To | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_settings/resume_screening_settings.json:auto_screen` | Field Label: Auto Screen on Application | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_settings/resume_screening_settings.json:enabled` | Field Label: Enable Resume Screening | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_settings/resume_screening_settings.json:max_file_mb` | Field Label: Max File Size (MB) | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_settings/resume_screening_settings.json:metric_pass_threshold` | Field Label: Metric Pass Threshold (%) | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_settings/resume_screening_settings.json:min_text_chars_per_page` | Field Label: Min Text Chars Per Page (Scan Detection) | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_template/resume_screening_template.json:enabled` | Field Label: Enabled | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_template/resume_screening_template.json:fail_description` | Field Label: Fail Description | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_template/resume_screening_template.json:job_roles` | Field Label: Designations | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_template/resume_screening_template.json:metric_weights` | Field Label: Metric Weights | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_template/resume_screening_template.json:min_score_to_pass` | Field Label: Minimum Score to Pass | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_template/resume_screening_template.json:pass_description` | Field Label: Pass Description | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_template/resume_screening_template.json:score_labels` | Field Label: Score Labels | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_template/resume_screening_template.json:section_break_descriptions` | Field Label: Result Descriptions | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_template/resume_screening_template.json:section_break_labels` | Field Label: Score Labels | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_template/resume_screening_template.json:section_break_roles` | Field Label: Target Job Roles | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_template/resume_screening_template.json:section_break_weights` | Field Label: Metric Weights | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_template/resume_screening_template.json:template_name` | Field Label: Template Name | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_template/resume_screening_template.json:total_weight` | Field Label: Total Weight | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/hris_ats/doctype/resume_screening_template/resume_screening_template.py:34` | Applicant resume is match with the applied job! | **Sumber Bahasa Inggris** | _() |
| `hris_ats/hris_ats/doctype/resume_screening_template/resume_screening_template.py:36` | Applicant resume does not meet the minimum criteria. | **Sumber Bahasa Inggris** | _() |
| `hris_ats/hris_ats/doctype/resume_screening_template/resume_screening_template.py:45` | Tabel bobot metrik tidak boleh kosong. | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/hris_ats/doctype/resume_screening_template/resume_screening_template.py:55` | Metrik berikut belum ada di template: {0} | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/hris_ats/doctype/resume_screening_template/resume_screening_template.py:59` | Metrik tidak dikenal: {0} | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/hris_ats/doctype/resume_screening_template/resume_screening_template.py:65` | Total bobot metrik aktif harus 100% (saat ini {0}%). | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/hris_ats/doctype/resume_screening_template_role/resume_screening_template_role.json:designation` | Field Label: Designation | **Sumber Bahasa Inggris** | DocType Field Label |
| `hris_ats/public/js/job_applicant.js:14` | Memulai screening ulang resume... | **Sumber Bahasa Inggris** | __() |
| `hris_ats/public/js/job_applicant.js:17` | Screening ulang berhasil dijadwalkan | **Sumber Bahasa Indonesia** | __() |
| `hris_ats/public/js/job_applicant.js:28` | Mulai Background Check | **Sumber Bahasa Inggris** | __() |
| `hris_ats/public/js/job_applicant.js:38` | Membuat dokumen Background Check... | **Sumber Bahasa Indonesia** | __() |
| `hris_ats/public/js/job_applicant.js:42` | Background Check berhasil dibuat. | **Sumber Bahasa Indonesia** | __() |
| `hris_ats/public/js/job_applicant.js:51` | Actions | **Sumber Bahasa Inggris** | __() |
| `hris_ats/public/js/job_applicant.js:7` | Screen Ulang | **Sumber Bahasa Inggris** | __() |
| `hris_ats/public/js/job_applicant_list.js:15` | Screen Ulang | **Sumber Bahasa Inggris** | __() |
| `hris_ats/public/js/job_applicant_list.js:28` | Menjadwalkan screening ulang... | **Sumber Bahasa Inggris** | __() |
| `hris_ats/public/js/job_applicant_list.js:31` | Screening ulang berhasil dijadwalkan | **Sumber Bahasa Indonesia** | __() |
| `hris_ats/scoring/metrics/achievement_relevance.py:46` | Ditemukan {count} klausa pencapaian terukur dengan angka/metrik. | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/achievement_relevance.py:48` | Belum ditemukan klausa pencapaian atau kontribusi dengan metrik kuantitatif. | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/ats_friendly.py:27` | Teks CV tidak dapat dibaca atau diekstrak oleh parser ATS. | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/ats_friendly.py:37` | Kurang dari 3 judul bagian standar yang dikenali | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/ats_friendly.py:48` | Email dan nomor telepon tidak terbaca | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/ats_friendly.py:51` | Email tidak ditemukan | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/ats_friendly.py:54` | Nomor telepon tidak ditemukan | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/ats_friendly.py:59` | Tata letak multi-kolom (dua kolom atau lebih) menyulitkan pembacaan urutan ATS | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/ats_friendly.py:64` | Terdapat {table_count} tabel yang berpotensi memecah teks pada parser ATS | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/ats_friendly.py:72` | Panjang CV melebihi rekomendasi ({page_count} halaman, idealnya 1-3 halaman) | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/ats_friendly.py:79` | Format CV sangat ramah ATS (tata letak rapi, kontak dan bagian utama lengkap). | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/certification_relevance.py:28` | Lowongan tidak mensyaratkan sertifikasi tertentu. | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/certification_relevance.py:58` | Sertifikasi cocok: {matched} | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/certification_relevance.py:60` | Belum memiliki: {missing} | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/date_consistency.py:122` | Rentang tanggal pekerjaan tidak ditemukan atau format tidak terbaca. | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/date_consistency.py:135` | Format tanggal campuran (terdapat format berbeda, mis. nama bulan dan angka) | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/date_consistency.py:147` | Terdapat {count} rentang di mana tanggal mulai lebih akhir dari tanggal selesai | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/date_consistency.py:162` | Terdapat tanggal pekerjaan di masa depan | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/date_consistency.py:182` | Tanggal jabatan tumpang tindih ({overlaps}) | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/date_consistency.py:195` | Terdapat celah karier > 12 bulan (informasi) | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/date_consistency.py:200` | Format tanggal sangat konsisten dan urutan kronologis rapi. | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/education_relevance.py:28` | Tidak ada syarat jenjang atau jurusan yang ditentukan di lowongan. | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/education_relevance.py:69` | Jenjang pendidikan cocok ({edu}) | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/education_relevance.py:71` | Jenjang pendidikan di bawah kualifikasi ({edu} < {min_edu}) | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/education_relevance.py:85` | Jurusan cocok: {matched_majors} | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/education_relevance.py:87` | Jurusan belum cocok ({majors_list}) | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/experience_relevance.py:102` | Judul jabatan relevan cocok: {matched_titles} | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/experience_relevance.py:104` | Belum ditemukan judul jabatan relevan ({titles_list}) | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/experience_relevance.py:28` | Tidak ada syarat pengalaman atau judul jabatan yang ditentukan di lowongan. | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/experience_relevance.py:86` | Total pengalaman {years} tahun memenuhi syarat ({min_years} thn) | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/experience_relevance.py:88` | Pengalaman {years} tahun kurang dari syarat {min_years} tahun | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/grammar.py:85` | Penggunaan tata bahasa sangat rapi dan konsisten. | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/grammar.py:87` | Ditemukan {typo_count} kemungkinan salah ketik / inkonsistensi tanda baca. | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/information_completeness.py:90` | Informasi pelamar lengkap (nama, kontak, domisili, pendidikan, pengalaman, skill). | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/information_completeness.py:92` | Bagian/kontak yang belum lengkap: {missing} | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/skill_relevance.py:53` | Tidak ada kriteria keahlian wajib atau tambahan yang ditentukan di lowongan. | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/skill_relevance.py:87` | Cocok {count} dari {total} skill wajib | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/skill_relevance.py:89` | belum ada: {missing_req} | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/metrics/skill_relevance.py:91` | Cocok {count} dari {total} skill tambahan | **Belum dibungkus _()** | Generator Reason |
| `hris_ats/scoring/workflow.py:156` | Belum ada template untuk jabatan ini. | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/scoring/workflow.py:157` | Gagal | **Sumber Bahasa Inggris** | _() |
| `hris_ats/scoring/workflow.py:158` | Belum ada template untuk jabatan ini. | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/scoring/workflow.py:206` | Gagal Dievaluasi | **Sumber Bahasa Inggris** | _() |
| `hris_ats/scoring/workflow.py:304` | Resume screening selesai: {0} ({1} poin) | **Sumber Bahasa Inggris** | _() |
| `hris_ats/scoring/workflow.py:319` | Dokumen Resume Screening {0} tidak ditemukan. | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/scoring/workflow.py:350` | {0} pelamar dijadwalkan untuk screening ulang. | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/scoring/workflow.py:357` | Pelamar {0} tidak ditemukan. | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/scoring/workflow.py:399` | Wawancara tidak dapat dibuat sebelum Kesimpulan HR (hr_conclusion) pada berkas Background Check {0} ... | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/setup.py:175` | Tahap Rekrutmen | **Belum dibungkus _()** | Kanban Board Title |
| `hris_ats/setup.py:208` | Pelamar Baru | **Belum dibungkus _()** | Number Card Label |
| `hris_ats/setup.py:216` | Tahap Screening | **Belum dibungkus _()** | Number Card Label |
| `hris_ats/setup.py:224` | Tahap Background Check | **Belum dibungkus _()** | Number Card Label |
| `hris_ats/setup.py:232` | Tahap Wawancara | **Belum dibungkus _()** | Number Card Label |
| `hris_ats/setup.py:259` | Rekrutmen | **Belum dibungkus _()** | Workspace Title |
| `hris_ats/setup.py:271` | Lowongan Kerja | **Belum dibungkus _()** | Workspace Shortcut |
| `hris_ats/setup.py:272` | Pelamar (Kanban) | **Belum dibungkus _()** | Workspace Shortcut |
| `hris_ats/setup.py:273` | Resume Screening | **Sumber Bahasa Inggris** | Workspace Shortcut |
| `hris_ats/setup.py:274` | Background Check | **Sumber Bahasa Inggris** | Workspace Shortcut |
| `hris_ats/setup.py:275` | Wawancara | **Belum dibungkus _()** | Workspace Shortcut |
| `hris_ats/setup.py:276` | Penawaran Kerja | **Belum dibungkus _()** | Workspace Shortcut |
| `hris_ats/setup.py:277` | Onboarding Karyawan | **Belum dibungkus _()** | Workspace Shortcut |
| `hris_ats/setup.py:278` | Template Screening | **Belum dibungkus _()** | Workspace Shortcut |
| `hris_ats/setup.py:453` | Saya menyatakan bahwa seluruh informasi dan akun media sosial yang saya berikan adalah benar... | **Belum dibungkus _()** | Settings Default Consent Text |
| `hris_ats/www/ats_consent.html:10` | Tautan Tidak Dapat Dibuka | **Sumber Bahasa Indonesia** | Template {{ _() }} |
| `hris_ats/www/ats_consent.html:103` | Saya telah membaca, memahami, dan menyetujui seluruh ketentuan pemeriksaan latar belakang di atas. | **Sumber Bahasa Indonesia** | Template {{ _() }} |
| `hris_ats/www/ats_consent.html:110` | Kirim Persetujuan | **Sumber Bahasa Indonesia** | Template {{ _() }} |
| `hris_ats/www/ats_consent.html:118` | Persetujuan Berhasil Dicatat | **Sumber Bahasa Indonesia** | Template {{ _() }} |
| `hris_ats/www/ats_consent.html:120` | Terima kasih atas persetujuan yang Anda berikan. Proses pemeriksaan latar belakang akan dilakukan se... | **Sumber Bahasa Indonesia** | Template {{ _() }} |
| `hris_ats/www/ats_consent.html:122` | Anda dapat menutup halaman ini sekarang. | **Sumber Bahasa Indonesia** | Template {{ _() }} |
| `hris_ats/www/ats_consent.html:16` | Pemeriksaan Latar Belakang | **Sumber Bahasa Indonesia** | Template {{ _() }} |
| `hris_ats/www/ats_consent.html:173` | Memproses... | **Sumber Bahasa Inggris** | Template {{ _() }} |
| `hris_ats/www/ats_consent.html:18` | Formulir Persetujuan Kandidat Rekrutmen (Kepatuhan UU No. 27/2022 UU PDP) | **Sumber Bahasa Indonesia** | Template {{ _() }} |
| `hris_ats/www/ats_consent.html:206` | Kirim Persetujuan | **Sumber Bahasa Indonesia** | Template {{ _() }} |
| `hris_ats/www/ats_consent.html:212` | Kirim Persetujuan | **Sumber Bahasa Indonesia** | Template {{ _() }} |
| `hris_ats/www/ats_consent.html:23` | Halo, | **Sumber Bahasa Inggris** | Template {{ _() }} |
| `hris_ats/www/ats_consent.html:25` | Sebagai bagian dari proses seleksi, kami memerlukan persetujuan eksplisit Anda sebelum melakukan pem... | **Sumber Bahasa Indonesia** | Template {{ _() }} |
| `hris_ats/www/ats_consent.html:34` | Pilih Sumber Pemeriksaan yang Disetujui | **Sumber Bahasa Indonesia** | Template {{ _() }} |
| `hris_ats/www/ats_consent.html:51` | Akun Profil Publik (Opsional) | **Sumber Bahasa Inggris** | Template {{ _() }} |
| `hris_ats/www/ats_consent.html:54` | Cantumkan akun media sosial atau profil profesional yang ingin Anda nyatakan untuk diperiksa. | **Sumber Bahasa Indonesia** | Template {{ _() }} |
| `hris_ats/www/ats_consent.html:60` | Pilih Platform | **Sumber Bahasa Inggris** | Template {{ _() }} |
| `hris_ats/www/ats_consent.html:67` | Username / Handle | **Sumber Bahasa Inggris** | Template {{ _() }} |
| `hris_ats/www/ats_consent.html:70` | Hapus | **Sumber Bahasa Inggris** | Template {{ _() }} |
| `hris_ats/www/ats_consent.html:75` | Tambah Akun | **Sumber Bahasa Inggris** | Template {{ _() }} |
| `hris_ats/www/ats_consent.html:81` | Unggah SKCK (Opsional) | **Sumber Bahasa Inggris** | Template {{ _() }} |
| `hris_ats/www/ats_consent.html:84` | Jika memiliki Surat Keterangan Catatan Kepolisian (SKCK) yang masih berlaku, Anda dapat melampirkann... | **Sumber Bahasa Indonesia** | Template {{ _() }} |
| `hris_ats/www/ats_consent.html:91` | Pernyataan Persetujuan & Retensi | **Sumber Bahasa Indonesia** | Template {{ _() }} |
| `hris_ats/www/ats_consent.html:96` | Ketentuan Retensi: | **Sumber Bahasa Inggris** | Template {{ _() }} |
| `hris_ats/www/ats_consent.py:16` | Tautan tidak valid atau token tidak disertakan. | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/www/ats_consent.py:21` | Tautan persetujuan tidak valid atau sudah pernah digunakan. | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/www/ats_consent.py:26` | Tautan persetujuan telah kedaluwarsa. Silakan hubungi tim HR. | **Sumber Bahasa Indonesia** | _() |
| `hris_ats/www/ats_consent.py:30` | Persetujuan untuk berkas ini sudah pernah diproses sebelumnya. | **Sumber Bahasa Indonesia** | _() |

---

## 4. Status Penyelesaian Temuan Audit (Fase 1 s.d. 4)

Seluruh temuan berkeparahan tinggi dan sedang dari audit baseline telah diperbaiki secara menyeluruh dengan pengujian regresi otomatis. Tabel berikut menyajikan status penyelesaian masing-masing temuan:

### 4.1 Tabel Rekapitulasi Temuan Tinggi & Sedang

| No | Temuan / Area Audit | Keparahan | Status | Fase Penyelesaian | Rincian Mitigasi & Implementasi |
|---|---|---|---|---|---|
| 1 | **Penarikan Persetujuan (Data Turunan, Crawldir, Cache)** | **Tinggi** | **Resolved (Selesai)** | Fase 3 & 4 | `revoke_consent()` di `bgc/consent.py` kini menghapus semua baris `Background Check Finding`, mengosongkan data turunan akun pada `Background Check Account` (`display_name`, `bio_snippet`, `profile_location`, `identity_*`, `social_consent`), menghapus direktori crawl private di disk (`sites/<site>/private/crawldir/<bgc_name>`), dan menginvalir seluruh cache Redis melalui `clean_bgc_cache()`. |
| 2 | **Kunci Cache Redis HMAC-SHA256 (Privasi Data Kandidat)** | **Tinggi** | **Resolved (Selesai)** | Fase 4 | Kunci cache URL di `bgc/fetch.py` diubah dari URL polos menjadi HMAC-SHA256 dengan secret key site (`frappe.local.conf.secret_key` / `encryption_key`), sehingga URL pencarian Direktori Putusan MA dan link profil kandidat tidak membocorkan nama kandidat atau informasi identitas ke Redis. Fungsi `get_cache_key()` dan `hash_url()` disinkronkan dengan `clean_bgc_cache()`. |
| 3 | **Checkbox Persetujuan Opt-in Aktif (UU PDP)** | **Tinggi** | **Resolved (Selesai)** | Fase 3 | Atribut `checked` bawaan pada checkbox di `www/ats_consent.html` dihapus. Tombol "Kirim Persetujuan" dinonaktifkan secara dinamis hingga kandidat mencentang pernyataan persetujuan dan minimal satu sumber pemeriksaan. |
| 4 | **Hak Akses BGC & Finding Tanpa System Manager (Spesifikasi 8)** | **Tinggi** | **Resolved (Selesai)** | Fase 4 | **Analisis Usulan Awal:** Pada audit Fase 1, penambahan `System Manager` sempat diusulkan karena secara default FrappeTestCase dan pengguna Administrator Frappe mengandalkan role `System Manager`, sehingga observasi `frappe.has_permission()` bernilai false untuk role tersebut.<br>**Koreksi Spesifikasi:** Sesuai **Spesifikasi 8** dan prinsip perlindungan privasi data pribadi (UU No. 27/2022), data investigasi Background Check dan catatan putusan pengadilan **HANYA BOLEH diakses oleh `Background Check Officer` dan `HR Manager`**. Role `System Manager` TIDAK ditambahkan ke DocType `Background Check` maupun `Background Check Finding`. Seluruh pengujian `FrappeTestCase` disesuaikan menggunakan role `HR Manager` / `Background Check Officer` (via `frappe.set_user`), dan ditambahkan uji regresi eksplisit yang memverifikasi bahwa `System Manager` dilarang membaca/menulis BGC dan Finding. |
| 5 | **Nilai Database (Select Options) Menjadi Bahasa Inggris** | **Tinggi** | **Resolved (Selesai)** | Fase 2 | Seluruh opsi Select pada DocType BGC, Finding, Lexicon, dan Custom Field `Job Applicant` dimigrasi ke istilah baku Bahasa Inggris (`Low/Medium/High`, `Needs verification`, `Achievement/Professional/Neutral/Risky`, `Not reviewed/Relevant/Not this person/Ignored`, `Not uploaded/Not checked/Clear/Has records/Expired`). Patch idempoten dibuat di `patches/v1_0/migrate_select_options_to_english.py` dan terdaftar di `patches.txt`. Tampilan bahasa Indonesia didukung 100% via `translations/id.csv`. |
| 6 | **Undefined Name `Any` pada `scoring/workflow.py`** | **Tinggi** | **Resolved (Selesai)** | Fase 2 & 4 | Impor `from typing import Any` ditambahkan pada `scoring/workflow.py`. Dibuat dua unit test regresi: (1) `test_workflow_typing_and_any_defined()` di `test_scoring.py` yang memvalidasi AST dan impor `Any`, dan (2) `test_workflow_typing_and_any_runtime_resolution()` di `test_resume_screening_workflow.py` yang memvalidasi `typing.get_type_hints()` saat runtime tanpa `NameError`. |
| 7 | **Cache Redis Fallback Fail-Closed di Mode Live** | **Sedang** | **Resolved (Selesai)** | Fase 4 | `bgc/fetch.py` dan `bgc/runner.py` menerapkan kebijakan *fail-closed*: pada mode live (bukan mock dan bukan `in_test`), jika Redis tidak tersedia, fungsi melempar `RedisUnavailableError` dan runner menandai sumber sebagai `Failed` dengan `error_template = "Redis not available"`, `error_params = "{}"`, serta mencatat error ke log Frappe. Fallback ke `MemoryCacheBackend` HANYA diizinkan saat pengujian (`frappe.flags.in_test`) atau mock (`is_mock=True`). |
| 8 | **Domain Media Sosial Terblokir Sebagai Settingan** | **Sedang** | **Resolved (Selesai)** | Fase 3 | Menghapus konstanta statis `FORBIDDEN_DOMAINS` dan menggantinya dengan field `fetch_blocked_domains` pada `Background Check Settings` (`permlevel 1`). Mengeluarkan domain bawaan dari daftar memerlukan centang `fetch_risk_acknowledged` (kepatuhan UU ITE Pasal 30 ayat (3) & ToS). |
| 9 | **Kode Mati `CourtMASpider` & Impor Spider** | **Sedang** | **Resolved (Selesai)** | Fase 4 | Kelas kosong `CourtMASpider` dan impor Scrapling `Spider` yang tidak terpakai dihapus dari `bgc/providers/court_ma.py`. Didokumentasikan bahwa penelusuran Direktori Putusan MA dijalankan secara prosedural lewat `CourtMAProvider` menggunakan `fetch.py` agar batas laju, robots.txt, stealth, dan HMAC cache ditegakkan seragam. |
| 10 | **Teks Hasil Generator Netral Bahasa (`*_template` & `*_params`)** | **Sedang** | **Resolved (Selesai)** | Fase 2 | Seluruh generator alasan skor (`reason`), ringkasan otomatis (`summary_auto`), dan pencocokan identitas (`match_reasons`, `risk_flags`) kini menyimpan pasangan netral bahasa: `*_template` (string template Inggris bertanda `{param}`) + `*_params` (JSON). Helper `hris_ats.i18n.render()` merender string secara dinamis sesuai bahasa sesi pengguna ERPNext. |
| 11 | **Email Undangan Persetujuan Multi-Bahasa** | **Sedang** | **Resolved (Selesai)** | Fase 2 | Email permohonan persetujuan kandidat kini dikirim dalam bahasa kandidat (`candidate_language` di BGC: `id` atau `en`). Teks persetujuan di Settings mendukung dua bahasa terpisah (`consent_text_id` dan `consent_text_en`). |
| 12 | **Kunci Versi Dependensi `pyproject.toml`** | **Sedang** | **Resolved (Selesai)** | Fase 4 | Dependensi `rapidfuzz==3.14.6` dan `pdfplumber==0.11.10` ditambahkan dengan versi terkunci pada `dependencies` di `pyproject.toml` sesuai versi yang terpasang di container. |
| 13 | **Pembersihan Retensi Harian (`daily_retention_purge`) & SKCK** | **Sedang** | **Resolved (Selesai)** | Fase 1, 4 & 5 | Tugas terjadwal `daily_retention_purge()` di `tasks.py` membersihkan temuan mentah BGC kadaluwarsa (`purge_after <= today`), mengosongkan `summary_auto` dan `accounts`, menghapus direktori crawl, menandai `is_purged = 1`, dan memperbarui status SKCK kadaluwarsa menjadi `Expired`. Berkas fisik `skck_file` dan nilai field-nya **dihapus** baik saat retensi harian maupun saat penarikan persetujuan (`revoke_consent`), sedangkan `skck_status` tetap dipertahankan sesuai ketentuan kepatuhan Spesifikasi 8 & UU PDP. (Commit: `c504de0`) |
| 14 | **Gerbang Interview (Interview Gate)** | **Sedang** | **Lulus / Resolved** | Fase 1 & 4 | Hook `validate_interview()` di `scoring/workflow.py` memblokir pembuatan atau penyimpanan dokumen `Interview` jika pelamar memiliki Background Check yang belum diisi `hr_conclusion` oleh HR. Pesan kesalahan dibungkus `_()` dan mendukung multi-bahasa. (Commit: `08efbea`) |
| 15 | **Pembersihan Kode Linter Ruff (100% Bersih)** | **Rendah** | **Resolved (Selesai)** | Fase 4 | Seluruh temuan linter (impor tak terpakai, variabel tak terpakai, format unpacking, argumen mode buka file) diperbaiki dan `uvx ruff check docker/apps/hris_ats` menghasilkan 0 error (*All checks passed*). (Commit: `08efbea`) |
| 16 | **Pengetatan Deteksi Halaman Login & Checkpoint** | **Tinggi** | **Resolved (Selesai)** | Fase 5 | Fungsi `detect_login_page()` di `background_check_settings.py` diperketat dengan 4 kriteria: (1) URL akhir mengarah ke jalur login/checkpoint/authwall, (2) tag `<title>` mengandung kata login/sign in/masuk, (3) form memuat `<input type="password">`, dan (4) isi teks sangat pendek (< 500 karakter) yang memuat frasa login dan tanpa konten profil. Halaman profil publik panjang dengan tautan navigasi "Sign in" (seperti profil GitHub) diverifikasi bukan halaman login. (Commit: `c504de0`) |
| 17 | **Kunci Cache HMAC Fail-Closed Tanpa Cadangan Nama Site** | **Tinggi** | **Resolved (Selesai)** | Fase 5 | Menghapus cadangan nama site `frappe.local.site` dan fallback statis `hris_ats_cache_secret` pada `get_site_secret()` di `bgc/fetch.py`. Bila `secret_key` maupun `encryption_key` tidak ada, fungsi langsung gagal tertutup (*fail-closed*) dengan melempar `RuntimeError`. (Commit: `c504de0`) |
| 18 | **Isolasi Penuh Pengujian FrappeTestCase di `ats-test.localhost`** | **Tinggi** | **Resolved (Selesai)** | Fase 5 | Seluruh pengujian `FrappeTestCase` dijalankan murni di site uji sementara bernama persis `ats-test.localhost` (dibuat via `bench new-site`, diuji 45 test OK, lalu dihapus melalui `bench drop-site`), menjamin nol efek samping terhadap data di `hris.localhost`. (Commit: `c504de0`) |

---

## 5. Temuan Tak Terduga & Kondisi Lingkungan

1. **Kapasitas Disk Host Mac Rendah:**
   - Partisi `/System/Volumes/Data` pada Mac host sempat mencapai kapasitas 100% (tersisa ~500 MB) akibat file update Docker Desktop yang ter-mount di `/var/folders/4t/.../Docker (242831).dmg`.
   - Hal ini menyebabkan MariaDB mengalami `I/O error` saat inisialisasi awal site baru.
   - Tindakan mitigasi yang diambil: image update telah di-unmount dan dibersihkan sehingga disk kembali memiliki ruang bebas ~3.7 GB.
2. **Validasi Pengetikan Ketat Frappe v16 / HRMS:**
   - Frappe v16 mengaktifkan validasi tipe Pydantic saat request/test. Fungsi `hrms.hr.doctype.staffing_plan.staffing_plan.get_active_staffing_plan_details` melempar `FrappeTypeError` jika argumen `company` bernilai `None`. Pembuatan dokumen `Job Opening` pada pengujian harus selalu menyertakan atribut `company` yang valid.

---
*Laporan audit ini disiapkan secara otomatis sebagai dasar pelaksanaan Fase 2 (Bahasa yang Konsisten), Fase 3 (Domain Sosmed & Persetujuan), dan Fase 4 (Perbaikan Audit).*