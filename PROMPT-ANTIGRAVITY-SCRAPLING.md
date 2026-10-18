# Prompt untuk Antigravity: Lapisan pengambil halaman Scrapling untuk Background Check

Salin seluruh isi di bawah garis ke Antigravity. Kerjakan **per fase**; setelah setiap fase agen wajib berhenti dan melapor.

---

## Konteks

Custom app `hris_ats` (Resume Screening + Background Check) sudah dibangun di branch `feat/hris-ats`, di `docker/apps/hris_ats/`, mengikuti `PROMPT-ANTIGRAVITY-ATS.md`. Tugas ini **lanjutan**, bukan membangun ulang. Jangan mengubah hal di luar cakupan di bawah.

Sumber kebenaran: `SPEC-BACKGROUND-CHECK.md`, terutama bagian **4.5** (bagian "Mode pengambilan halaman") dan **5.1** (Scrapling) yang baru ditambahkan. Baca ulang seluruh dokumen itu, termasuk bagian 2.1 dan 8.

Larangan keras di `PROMPT-ANTIGRAVITY-ATS.md` **tetap berlaku seluruhnya**. Settingan baru di tugas ini hanya mengatur *cara* mengambil halaman, bukan *apa* yang boleh diambil.

## Kondisi kode saat ini (sudah saya periksa; verifikasi ulang sebelum mengubah)

- `bgc/runner.py` **selalu memakai mock**: `check_single_account(..., is_mock=True)` di-hardcode; `WebSearchProvider()`, `CourtMAProvider()`, dan `PostsProvider()` dibuat dengan default mock. Field Settings `mock_provider` **tidak dibaca** di mana pun.
- `bgc/providers/platform_check.py` memakai `urllib.request` langsung, tanpa pengecekan robots.txt.
- `bgc/providers/base.py`: batas laju per instance provider (bukan per domain), dan cache disimpan di memori instance (`self._cache`), jadi hilang setiap job selesai. Spesifikasi meminta cache 24 jam per kueri.
- `bgc/providers/court_ma.py` hanya meneruskan ke `MockProvider`; belum ada implementasi live.
- `Background Check Settings` belum punya field mode pengambilan; `Background Check Source Run` belum punya `fetch_mode_used` dan `robots_ignored_count`.

## Tujuan

1. Satu lapisan pengambil halaman `bgc/fetch.py` berbasis **Scrapling**, yang menjadi satu-satunya jalan provider mengambil halaman web.
2. Settingan mode pengambilan yang bisa dilonggarkan ("trabas") oleh System Manager, dengan default ketat, pengakuan risiko, dan jejak audit.
3. Provider Platform dan Case history berjalan **live** lewat lapisan itu bila `mock_provider = 0`. Mock tetap ada untuk test dan demo.
4. Akurasi data naik lewat fitur Scrapling yang tepat (Fase 5): penelusuran semua halaman hasil, pembacaan PDF putusan, selektor adaptif, `find_similar`, dan pencocokan identitas akun dari isi profil publik.

**Di luar cakupan** (jangan dikerjakan, cukup sebutkan di laporan bila terlihat): penyedia pencarian web untuk Article/File (belum diputuskan, tetap mock/Skipped), API X, provider post live (GitHub/YouTube/Mastodon/Reddit), field tanggal/tempat lahir (belum diputuskan, spesifikasi bagian 10 no. 4), perubahan UI selain form Settings, kolom Source Run, dan field baru yang disebut di Fase 5.

**Fitur Scrapling yang dilarang dipakai**: `ProxyRotator` (dalam bentuk apa pun, termasuk sebagai setting), server MCP, Agent Skill, dan extra `[ai]`.

## Aturan kerja

- Tetap di branch `feat/hris-ats`. **Jangan push**, jangan merge. Commit per fase dengan gaya `FEAT: ...` / `FIX: ...` berbahasa Indonesia, **tanpa trailer `Co-Authored-By` atau atribusi AI apa pun**.
- Jangan `docker compose down -v`, `bench restore`, atau `drop-site`. Jangan `eas build`/`eas update`.
- Jangan mengubah `docker/server-scripts/`, aplikasi mobile, atau modul Resume Screening.
- **Semua test tanpa internet**: jaringan di-mock, halaman contoh disimpan sebagai fixture HTML. Tidak boleh ada test yang memanggil situs sungguhan.
- Jangan menebak API Scrapling. Baca source paket yang terpasang (`env/lib/python3.14/site-packages/scrapling/`) untuk nama kelas dan parameter versi 0.5 yang sebenarnya (mis. parameter impersonate, header, timeout, cara memakai session).
- Bila spesifikasi diam atau bertentangan, **berhenti dan tanya**.

---

## Fase 1: Dependensi dan setup

1. Tambahkan `"scrapling[fetchers]==0.5"` ke `dependencies` di `docker/apps/hris_ats/pyproject.toml`. Dry-run di env Python 3.14 container sudah berhasil (13 paket, termasuk `curl_cffi`, `Protego`, `playwright`, `patchright`).
2. `docker/dev-ats.sh`: dependensi ikut terpasang lewat `pip install -e`. Tambahkan opsi `--with-browsers` yang menjalankan `scrapling install` di setiap service Python, untuk mode stealth. **Tanpa opsi ini, browser tidak boleh diunduh.**
3. `docker/README.md`, bagian custom app: jelaskan opsi `--with-browsers`, ukuran tambahannya, dan bahwa image produksi butuh langkah build terpisah untuk browser (cukup didokumentasikan; jangan ubah `build-image.sh` atau `apps.json`).
4. Pastikan `import scrapling` dan `from scrapling.fetchers import Fetcher` berhasil di `backend`, `queue-long`, dan `queue-short`, **tanpa** browser terpasang. Bila `Fetcher` ternyata butuh Playwright/browser saat import atau saat dipakai, berhenti dan laporkan.

**Selesai bila:** `./dev-ats.sh` jalan bersih dua kali berturut-turut; impor di atas berhasil; test lama tetap lulus.
**Berhenti dan lapor.**

## Fase 2: Settings dan Source Run

Ikuti tabel `SPEC-BACKGROUND-CHECK.md` 4.5 (bagian "Mode pengambilan halaman") persis:

- Field baru di `Background Check Settings` dalam satu section "Mode Pengambilan Halaman": `fetch_respect_robots` (Check, default 1), `fetch_identity` (Select `Company` / `Browser`, default `Company`), `fetch_user_agent` (Data, default `"HRIS Background Check (+hr@example.com)"`; gunakan nama perusahaan dari `Company` default bila ada), `fetch_stealth_mode` (Check, default 0), `fetch_stealth_domains` (Small Text), `fetch_browser_status` (Data, read only), `fetch_risk_acknowledged` (Check), `fetch_risk_ack_by` (Link User, read only), `fetch_risk_ack_on` (Datetime, read only).
- Semua field section ini **`permlevel: 1`**. Tambahkan permission permlevel 1: System Manager baca/tulis, HR Manager baca saja.
- Validasi di controller Settings: menyimpan dengan `fetch_respect_robots = 0`, `fetch_identity = Browser`, atau `fetch_stealth_mode = 1` **ditolak** bila `fetch_risk_acknowledged` belum dicentang. Saat dicentang, isi `fetch_risk_ack_by`/`fetch_risk_ack_on` otomatis. Bila semua saklar kembali ke default, pengakuan boleh tetap tersimpan.
- Teks keterangan (`description`) di `fetch_risk_acknowledged` memuat tiga poin risiko dari spesifikasi 5.1 (UU ITE Pasal 30 ayat (3) dan ketentuan layanan; robots.txt/menyamar browser dan risiko IP server diblokir; sebaiknya disetujui Legal).
- `fetch_browser_status` diisi di `onload` controller: cek apakah browser Scrapling terpasang (cara mengeceknya ambil dari source Scrapling, jangan menebak path).
- Aktifkan `track_changes` di `Background Check Settings`.
- `Background Check Source Run`: tambah `fetch_mode_used` (Data, read only) dan `robots_ignored_count` (Int, read only).
- Label Bahasa Indonesia untuk semua field baru di `translations/id.csv`.

**Selesai bila:** test untuk validasi pengakuan risiko, permlevel (HR Manager tidak bisa mengubah, System Manager bisa), dan pengisian otomatis `ack_by/ack_on` lulus.
**Berhenti dan lapor.**

## Fase 3: Lapisan `bgc/fetch.py`

Buat modul pengambil tunggal. Bagian penentu mode dan pengecekan aturan harus berupa **fungsi murni** tanpa `import frappe`, supaya bisa diuji dengan `pytest` biasa. Bagian yang butuh Frappe (membaca Settings, Redis) dipisah tipis.

Antarmuka yang diharapkan (nama boleh disesuaikan, perilakunya tidak):

```python
@dataclass
class FetchConfig:        # dibangun dari Background Check Settings
    respect_robots: bool
    identity: str          # "Company" | "Browser"
    user_agent: str
    stealth: bool
    stealth_domains: list[str]
    rate_limit_per_minute: int
    cache_ttl_seconds: int = 86400
    timeout_seconds: int = 15

@dataclass
class FetchResult:
    url: str
    status: int
    body: str              # sudah didekode
    mode_used: str         # "company+robots", "company", "browser+robots", "browser", "stealth", ...
    robots_ignored: bool
    from_cache: bool
    page: Any | None       # objek Scrapling untuk diurai dengan selektor

def fetch(url: str, config: FetchConfig, *, method: str = "GET") -> FetchResult: ...
```

Aturan perilaku (lihat tabel spesifikasi 5.1):

1. **Domain terlarang**: URL dengan domain Instagram, Facebook, TikTok, LinkedIn (termasuk subdomain dan domain pendek resminya; daftar sebagai konstanta) **selalu ditolak** dengan exception khusus, apa pun settingnya. Pengecekan profil untuk platform ini tidak mengambil halaman; cukup susun `profile_url` dan set `post_access = Manual review only`.
2. **robots.txt**: bila `respect_robots`, ambil dan cache robots.txt per domain (Protego, TTL 24 jam), cek izin dengan User-Agent yang dipakai. URL yang dilarang → exception `RobotsDisallowed`, tidak diambil. Bila `respect_robots = False`, lewati cek dan tandai `robots_ignored = True` **hanya bila** robots.txt memang melarang URL itu (tetap dicek untuk keperluan audit, tapi tidak memblokir).
3. **Identitas**: `Company` → `Fetcher` tanpa impersonate, header `User-Agent` = `user_agent`. `Browser` → `Fetcher` dengan impersonate browser.
4. **Stealth**: bila `stealth` dan domain cocok `stealth_domains` (atau daftar kosong = semua) → `StealthyFetcher`. Bila browser tidak terpasang → exception dengan pesan "Mode stealth aktif tapi browser belum terpasang". **Jangan** turun diam-diam ke mode biasa.
5. **Batas laju per domain**, berlaku lintas proses worker: simpan waktu panggilan terakhir per domain di Redis (`frappe.cache`), dengan jeda minimum `60 / rate_limit_per_minute`.
6. **Cache 24 jam** untuk hasil GET per URL + mode, di Redis (`frappe.cache`, dengan TTL), bukan di memori instance.
7. Timeout dan error jaringan dibungkus jadi exception yang jelas; jangan menelan error jadi "tidak ditemukan".
8. Tidak ada login, cookie akun, atau header Authorization di modul ini.

Refaktor `bgc/providers/base.py`: hapus cache dan rate limit di memori instance, ganti dengan pemanggilan `bgc/fetch.py`. Provider yang memanggil API resmi berbasis JSON (nanti) boleh punya klien HTTP sendiri, tapi tetap memakai batas laju Redis yang sama.

Test (`tests/bgc/test_fetch.py`), dengan jaringan di-mock:
- setiap kombinasi `identity` × `respect_robots` × `stealth` memilih fetcher dan header yang benar, dan `mode_used` sesuai;
- robots.txt melarang + `respect_robots=True` → ditolak; + `respect_robots=False` → diambil dan `robots_ignored=True`;
- domain terlarang ditolak di semua kombinasi, termasuk bila dicantumkan di `stealth_domains`;
- stealth tanpa browser → exception, bukan fallback;
- cache: panggilan kedua dalam 24 jam tidak menyentuh jaringan;
- batas laju: dua panggilan ke domain sama berjarak ≥ jeda minimum (pakai jam palsu, jangan `sleep` sungguhan).

**Selesai bila:** semua test di atas dan test lama lulus.
**Berhenti dan lapor.**

## Fase 4: Provider live lewat `fetch.py` dan pemakaian `mock_provider`

1. `bgc/runner.py`: baca `mock_provider` dari Settings. `1` → semua provider mock seperti sekarang. `0` → provider live di bawah. Hapus `is_mock=True` yang di-hardcode.
2. Bangun `FetchConfig` dari Settings satu kali per job, oper ke provider.
3. **Platform check live**: `platform_check.py` memakai `fetch.py` (HEAD bila didukung, selain itu GET). Pertahankan logika `check_method` yang ada. Platform terlarang (poin 1 Fase 3) tidak diambil.
4. **Case history live (versi dasar)**: `court_ma.py` mengambil **halaman pertama** hasil pencarian Direktori Putusan Mahkamah Agung lewat `fetch.py`, lalu mengurai daftar hasil dan halaman detail dengan selektor Scrapling (penelusuran semua halaman dan PDF menyusul di Fase 5): judul, nomor perkara, jenis perkara, pengadilan, tanggal register/upload/putus, cuplikan. Teruskan hasilnya ke analisis yang sudah ada (`identity.py`, `case.py`) tanpa mengubah aturan analisisnya.
   - Pelajari struktur halaman sungguhan **sekali** secara manual untuk menulis selektor, simpan 2–3 contoh halaman sebagai fixture HTML di `tests/fixtures/court_ma/`, dan tulis test parser terhadap fixture itu. Data di fixture yang memuat nama orang sungguhan **wajib disamarkan** sebelum disimpan.
   - Batas laju default untuk domain ini: 5 permintaan per menit; maksimal `max_results_per_source` hasil.
   - Bila struktur halaman tidak bisa diurai (selektor tidak menemukan apa pun), sumber `Failed` dengan pesan jelas, bukan `Done` dengan 0 hasil.
5. Article, File, dan Posts **tidak diubah**: bila `mock_provider = 0` dan provider/kredensial belum tersedia, sumber berstatus `Skipped` dengan alasan ("Penyedia pencarian belum dikonfigurasi", dst.), bukan memakai mock diam-diam.
6. Isi `fetch_mode_used` dan `robots_ignored_count` di setiap `Background Check Source Run`. Bila dalam satu sumber dipakai lebih dari satu mode (mis. stealth hanya untuk sebagian domain), tulis semuanya dipisah koma.
7. Print Format "Background Check Report": tambahkan baris mode pengambilan per sumber.

**Selesai bila:**
- test runner: `mock_provider=1` memakai mock; `mock_provider=0` memanggil provider live (jaringan di-mock); Article/File/Posts menjadi `Skipped` dengan alasan;
- test parser `court_ma` terhadap fixture lulus;
- satu uji manual di Desk dengan `mock_provider = 0` dan setting default terhadap kandidat fiktif berhasil untuk Platform (pakai username GitHub publik milik tim, bukan orang lain) dan Case history (nama fiktif, boleh 0 hasil). Lampirkan screenshot Source Run beserta `fetch_mode_used`.

**Berhenti dan lapor.**

## Fase 5: Akurasi data

Ikuti `SPEC-BACKGROUND-CHECK.md` 4.1, 4.2, 5.1 (tabel "Fitur Scrapling yang dipakai"), 6.2, 6.2.1, dan 6.4 versi terbaru.

### 5a. Field baru
- `Background Check Account`: `display_name`, `bio_snippet` (maks. 300 karakter), `profile_location`, `identity_match` (Int), `identity_reasons` (Small Text). Semua read only.
- `Background Check Finding`: `text_source` (Select `Cuplikan` / `Teks lengkap` / `PDF putusan`), `evidence_excerpt` (Small Text, maks. 600 karakter), `detail_url`, `pdf_url`.
- Tampilkan `identity_match` + alasannya di tab Platform, dan `text_source` + `evidence_excerpt` di daftar temuan. Label ID di `translations/id.csv`.
- Patch migrasi untuk dokumen lama: field baru dibiarkan kosong, jangan dihitung ulang otomatis.

### 5b. Penelusuran semua halaman (Spider)
- Ganti pengambilan halaman pertama di `court_ma.py` dengan **Spider** Scrapling: ikuti pagination sampai `max_results_per_source`, lalu `response.follow` ke halaman detail tiap hasil.
- `crawldir` di `sites/<site>/private/hris_ats/crawl/<nama Background Check>/`, dihapus saat sumber selesai atau saat job retensi berjalan.
- **Wajib**: Spider mematuhi semua aturan `fetch.py` (domain terlarang, `robots_txt_obey` mengikuti `fetch_respect_robots`, batas laju per domain lewat Redis, mode identitas/stealth, pencatatan `fetch_mode_used` dan `robots_ignored_count`). Baca source Spider di Scrapling 0.5 untuk cara mengonfigurasi session dan hook-nya. Kalau ada aturan yang tidak bisa ditegakkan di Spider, **jangan pakai Spider**: tulis penelusuran halaman manual lewat `fetch.py`, lalu jelaskan alasannya di laporan.
- Spider bersifat async. Pastikan berjalan benar di worker RQ (tidak bentrok event loop) dan tidak menahan worker lebih lama dari timeout job; bila perlu, batasi `concurrent_requests` ke 1–2 untuk domain MA.

### 5c. Selektor adaptif dan `find_similar`
- Pakai Smart Element Tracking Scrapling untuk selektor halaman hasil, halaman detail putusan, dan halaman profil platform. Simpan data pelacakannya di `sites/<site>/private/hris_ats/` (bukan di folder app, bukan di `/tmp`). Cek nama parameter dan mekanisme penyimpanannya di source Scrapling 0.5.
- Pakai `find_similar` dari baris hasil pertama untuk mengambil semua baris hasil.
- Bila selektor adaptif "menemukan" elemen dengan kemiripan rendah, tulis peringatan ke `error` di Source Run supaya ketahuan bahwa situs berubah. Jangan diam-diam memakai elemen yang salah.

### 5d. PDF putusan
- Untuk hasil dengan `kemiripan_nama` ≥ 80, unduh PDF lewat `fetch.py` (batas ukuran 20 MB, timeout), baca dengan `pdfplumber`.
- Dari bagian identitas para pihak, ambil **hanya** untuk pihak yang namanya cocok: peran, pekerjaan, kota/kabupaten. Jangan menyimpan NIK, alamat lengkap, nama pihak lain, atau isi putusan. Simpan `evidence_excerpt` (≤ 600 karakter di sekitar nama) dan `pdf_url`. Hapus berkas PDF setelah dibaca (pakai direktori sementara yang dibersihkan di `finally`).
- Peran dari PDF mengalahkan peran dari cuplikan. PDF hasil scan (tanpa teks) → turun ke halaman detail, `text_source = Teks lengkap`.
- Pekerjaan dan kota dari PDF dipakai sebagai istilah konteks di `identity.py`. Ubah `identity.py` supaya menerima teks dari sumber mana pun, memakai urutan prioritas di 6.2, membatasi skor dari cuplikan saja maksimal 70, dan memilih kemunculan nama dengan konteks terbanyak. Aturan lain di `identity.py` dan `case.py` jangan diubah.

### 5e. Kecocokan identitas akun platform
- Di `platform_check.py`, untuk profil yang ada dan **bukan** platform terlarang, urai nama tampilan, bio, dan lokasi dari halaman profil publik dengan selektor adaptif. Selektor per platform disimpan di `Background Check Platform` (field baru `display_name_selector`, `bio_selector`, `location_selector`, opsional). Platform tanpa selektor dilewati untuk langkah ini.
- Hitung `identity_match` dengan rumus 6.2.1 sebagai fungsi murni di `bgc/analysis/identity.py`.
- Akun yang tidak dinyatakan kandidat dengan `identity_match` < 50 tidak ditampilkan sebagai milik kandidat.

### 5f. Isi artikel bersih (disiapkan, belum dipakai)
- Siapkan fungsi `extract_article_text(url, config)` yang memakai `fetch.py` + `page.markdown()`. Fungsi ini dipanggil provider Article **setelah** penyedia pencarian dipilih. Untuk sekarang cukup fungsi + test terhadap fixture HTML artikel fiktif; jangan sambungkan ke runner.

### Test (semua tanpa internet)
- Spider: fixture 3 halaman hasil + halaman detail; semua halaman ditelusuri, berhenti di `max_results_per_source`; robots.txt yang melarang dihormati bila setting aktif; domain terlarang ditolak.
- Selektor adaptif: fixture halaman MA versi lama dan versi "berubah" (kelas CSS diganti) tetap menghasilkan data yang sama.
- PDF: fixture PDF putusan fiktif (buat sendiri, dengan dua pihak dan satu saksi) → peran, pekerjaan, dan kota pihak yang cocok terambil; data pihak lain tidak tersimpan; berkas sementara terhapus.
- Identitas: kasus nama kembar (dua putusan, nama sama, kota dan pekerjaan berbeda) → hanya satu yang skornya Tinggi; skor dari cuplikan saja tidak pernah > 70.
- Akun platform: profil dengan nama tampilan dan kota cocok vs tidak cocok.

**Selesai bila:** semua test di atas dan test lama lulus, dan satu uji manual dengan `mock_provider = 0` (nama fiktif, setting default) berjalan tanpa error dengan `text_source` terisi. Lampirkan contoh satu Finding Case dari fixture beserta `match_reasons` dan `evidence_excerpt`.
**Berhenti dan lapor.**

---

## Format laporan setiap fase

1. Ringkasan yang dikerjakan (≤ 10 baris).
2. Daftar file yang dibuat/diubah.
3. Perintah verifikasi beserta hasilnya (tempel keluaran test).
4. Penyimpangan dari spesifikasi dan alasannya, atau "tidak ada".
5. Temuan di luar cakupan yang perlu diketahui (mis. bagian lain yang masih mock).
6. Pertanyaan sebelum fase berikutnya.

## Kapan wajib berhenti dan bertanya

- API Scrapling 0.5 berbeda dari yang diasumsikan di sini (mis. `Fetcher` butuh browser, atau tidak ada cara mematikan impersonate).
- Situs Direktori Putusan MA memblokir akses dengan setting default, atau struktur halamannya tidak memungkinkan pengambilan nomor/jenis perkara.
- Sebuah langkah butuh kredensial, layanan berbayar, atau akun pihak ketiga.
- Ada test lama yang gagal.
- Kamu tergoda menambah sesuatu dari daftar larangan keras, memakai mode longgar sebagai default, atau memakai `ProxyRotator`.
- Spider, selektor adaptif, atau pembacaan PDF tidak bisa memenuhi aturan di Fase 5 tanpa melonggarkan aturan `fetch.py`.
