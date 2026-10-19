### HRIS ATS

Resume Screening and Background Check for ERPNext / Frappe HR

---

### Fitur Utama

Aplikasi `hris_ats` menambahkan kemampuan ATS (*Applicant Tracking System*) tingkat lanjut pada Frappe HR / ERPNext:

1. **Resume Screening**:
   - Ekstraksi informasi dari dokumen CV/resume kandidat (PDF/DOCX).
   - Penilaian otomatis berbasis metrik (pengalaman, pendidikan, keahlian, prestasi, sertifikasi, tata bahasa, kelengkapan informasi, dan keramahan format ATS).
   - Integrasi alur kerja `Job Applicant` dan `Interview Gate` (mencegah penjadwalan interview sebelum kesimpulan HR terisi).

2. **Background Check (BGC)**:
   - Penelusuran jejak digital multi-sumber yang patuh regulasi: putusan pengadilan Mahkamah Agung RI, artikel berita, dokumen publik, akun platform terdaftar, dan unggahan publik.
   - Pengecekan kesopanan bahasa menggunakan leksikon kata berisiko (`Background Check Lexicon`).
   - Pencocokan identitas cerdas berbasis nama dan variasi konteks profil pelamar.
   - Manajemen persetujuan kandidat (*Consent Management*) terintegrasi portal web publik sesuai UU No. 27/2022 (UU PDP).

---

### Aturan Internasionalisasi (i18n Rules)

Aplikasi ini menggunakan arsitektur multi-bahasa yang ketat:

- **Sumber Teks Baku (English Source)**:
  - Seluruh label, deskripsi field, opsi `Select`, dan pesan sistem pada file DocType JSON harus ditulis dalam **Bahasa Inggris**.
  - String dalam kode Python (`_("...")`) dan JavaScript (`__("...")`) wajib menggunakan Bahasa Inggris baku sebagai *msgid*.
- **Pemisahan String Dinamis (`*_template` & `*_params`)**:
  - Dilarang membungkus f-string langsung di dalam fungsi terjemahan (misal: `_(f"Hello {user}")` adalah anti-pattern karena menghasilkan entri terjemahan tak terbatas).
  - Untuk generator otomatis (alasan skor, ringkasan, alasan pencocokan, flag risiko), gunakan format netral bahasa: simpan string template berparameter di field `*_template` (contoh: `"Found {count} cases matching candidate"`) dan nilai variabel JSON di field `*_params` (contoh: `'{"count": 2}'`).
  - Gunakan helper `hris_ats.i18n.render(template, params)` untuk merender teks secara dinamis sesuai bahasa sesi pengguna aktif.
- **Kamus Terjemahan (Indonesian Translations)**:
  - Terjemahan ke Bahasa Indonesia dikelola secara terpusat pada berkas `docker/apps/hris_ats/hris_ats/translations/id.csv`.
  - Format baris CSV: `"English Source Text","Terjemahan Bahasa Indonesia"`.

---

### Pengaturan Domain & Anti-Scraping (Domain Settings)

Pengambilan data eksternal diatur secara ketat melalui **Background Check Settings**:

- **Domain Terblokir (`fetch_blocked_domains`)**:
  - Berada pada field dengan *permlevel 1* (hanya dapat diubah oleh administrator / role berwenang).
  - Melarang permintaan HTTP dan penelusuran otomatis ke domain berisiko tinggi atau domain dengan pembatasan ToS ketat (secara default memblokir `instagram.com`, `facebook.com`, `threads.net`, dan `linkedin.com`).
  - Domain terblokir akan langsung menolak pengambilan konten dan mencatat log penolakan tanpa melakukan koneksi jaringan.
- **Pengakuan Risiko Hukum (`fetch_risk_acknowledged`)**:
  - Penghapusan domain bawaan dari daftar terblokir atau pengaktifan mode penyamaran (*stealth mode*) mewajibkan pengguna mencentang pengakuan risiko hukum (kepatuhan UU ITE Pasal 30 ayat (3) terkait akses tanpa hak / menerobos sistem pengamanan).

---

### Manajemen Persetujuan Kandidat & Privasi (UU PDP)

Modul Background Check dirancang dengan prinsip *Privacy by Design* mengacu pada UU No. 27/2022 (UU Perlindungan Data Pribadi):

- **Persetujuan Eksplisit (Opt-In Aktif)**:
  - Kandidat menerima tautan unik bertoken untuk portal persetujuan (`/ats_consent?token=...`).
  - Formulir persetujuan tidak menyediakan opsi yang dicentang otomatis (*pre-checked* dilarang). Kandidat harus memilih secara aktif sumber data yang diizinkan untuk diperiksa.
- **Persetujuan Per-Akun Media Sosial (`social_consent`)**:
  - Pemeriksaan postingan publik pada akun media sosial kandidat mewajibkan persetujuan eksplisit per akun.
- **Penarikan Persetujuan (`revoke_consent`)**:
  - Jika kandidat menarik persetujuan, sistem secara otomatis:
    1. Menghapus seluruh temuan terkait (`Background Check Finding`).
    2. Menghapus data turunan profil akun kandidat (`display_name`, `bio_snippet`, dll.).
    3. Menghapus direktori artefak crawl di disk server (`sites/<site>/private/crawldir/<bgc_name>`).
    4. Menginvalir seluruh cache Redis terkait kandidat via `clean_bgc_cache()`.
- **Retensi Harian & Purge Otomatis**:
  - Scheduler harian `daily_retention_purge()` membersihkan temuan mentah kandidat setelah melewati masa retensi yang ditetapkan (`retention_days`), menjaga agar data sensitif tidak tersimpan melampaui batas waktu yang sah.

---

### Pengambilan Halaman & Dialog "Test Fetch"

Untuk memverifikasi konektivitas ke situs target tanpa menjalankan audit penuh:

- **Dialog Test Fetch**:
  - Tombol **Test Fetch** tersedia pada bilah navigasi formulir `Background Check Settings`.
  - Membuka modal interaktif untuk menguji URL target secara langsung dengan pilihan metode pengambilan:
    1. `Company`: Header bot transparan yang mencantumkan identitas perusahaan dan kontak tim HR.
    2. `Browser`: Emulasi browser modern via HTTP client (`curl_cffi`).
    3. `Stealth`: Penyamaran penuh menggunakan Scrapling headless browser (Chromium/Patchright).
- **Fail-Closed & Keamanan Cache**:
  - Kunci cache Redis di-hash menggunakan HMAC-SHA256 dengan *site secret key*, sehingga nama kandidat dan URL pencarian tidak pernah bocor ke Redis keyspace.
  - Pada lingkungan live produksi, jika Redis tidak dapat dihubungi, sistem menerapkan kebijakan *fail-closed* (sumber ditandai gagal dengan `Redis not available`, mencegah crawl tanpa kontrol cache).

---

### Model Hak Akses (Permissions)

Sesuai **Spesifikasi 8** dan asas isolasi data investigasi:
- Dokumen `Background Check` dan `Background Check Finding` **HANYA** dapat diakses oleh role:
  - `Background Check Officer`
  - `HR Manager`
- Role `System Manager` **tidak diberikan akses** ke dokumen Background Check maupun Finding guna mencegah akses yang tidak sah terhadap data catatan hukum dan jejak digital sensitif.

---

### Audit & Kepatuhan

Seluruh catatan audit arsitektur, kepatuhan hukum, dan daftar perbaikan temuan audit terdokumentasi lengkap pada:
👉 **[AUDIT.md](AUDIT.md)**

---

### Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch feat/hris-ats
bench install-app hris_ats
```

### Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/hris_ats
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade

### License

MIT

### Attribution

Katalog platform publik pada modul Background Check menggunakan data dari dataset terbuka [WhatsMyName](https://github.com/WebBreacher/WhatsMyName) yang dilisensikan di bawah [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/).

