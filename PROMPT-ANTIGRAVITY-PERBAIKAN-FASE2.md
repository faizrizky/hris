# Prompt untuk Antigravity: Perbaikan setelah uji Fase 2 (sosmed)

Salin seluruh isi di bawah garis ke chat Antigravity yang mengerjakan `PROMPT-ANTIGRAVITY-SOSMED.md`. **Kerjakan ini sebelum Fase 3.** Setelah selesai, berhenti dan lapor.

---

## Konteks

Fase 2 selesai dan pengguna sudah menguji sendiri:
- Login interaktif Instagram **berhasil**: akun `CRAWLER-Instagram-012` berstatus `Connected` (kedaluwarsa sesi 26-10-2026).
- Test Fetch ke `https://www.instagram.com/robbyimamp/` (profil publik milik pengguna) menghasilkan:
  - mode **Company**: status 200, 694.817 byte, judul `Robby Imam Prakoso (&#064;robbyimamp) • Instagram photos and videos`, **dilabeli "Likely login page"** padahal halamannya profil;
  - mode **Browser**: status 200, 791.083 byte, tidak dilabeli login, teks pratinjau memuat nama, `1,367 followers`, `414 following`, tab Posts/Reels/Tagged. Jadi Instagram mengembalikan data profil publik **tanpa login** pada mode Browser.
- Pengguna bertanya kenapa Test Fetch masih menunjukkan halaman login padahal akun crawler sudah login. Jawabannya ada dua: (1) deteksi login salah, (2) Test Fetch belum memakai sesi akun crawler.

Dua berkas sudah **diubah langsung oleh Claude** dan belum di-commit. **Jangan dikembalikan atau ditimpa; tinjau, lengkapi dengan test, lalu commit:**
- `bgc/crawler_session.py`: perintah `complete`/`close` dan hasil `crawler_result` sekarang dibaca dengan `get_value(..., use_local_cache=False)`; loop worker memakai `page.wait_for_timeout(150)` (bukan `time.sleep(0.5)`); TTL perintah 60 detik; `crawler_result` dihapus segera setelah terbaca dan TTL-nya 20 detik; Complete Login menunggu sampai 20 detik.
- `public/js/crawler_login_dialog.js`: polling 300 ms dengan penjaga agar permintaan tidak menumpuk dan tanpa spinner.

Akar masalah yang dulu membuat Complete Login selalu timeout: `frappe.cache().get_value()` menyimpan hasil, **termasuk `None`**, di `frappe.local.cache` selama proses hidup. Worker tidak pernah melihat perintah baru, dan handler Complete tidak pernah melihat hasil. Setiap pembacaan Redis dalam loop atau polling wajib melewati cache lokal itu.

Sumber kebenaran tetap `SPEC-BACKGROUND-CHECK.md` dan `PROMPT-ANTIGRAVITY-SOSMED.md` (aturan kerja dan larangan di sana berlaku penuh, termasuk: jangan menyimpan atau meminta password, jangan menembus 2FA/CAPTCHA/checkpoint, tanpa aksi tulis, tanpa proxy, jangan `git checkout/restore/stash/reset/clean` pada berkas yang bukan buatanmu, commit hanya berkas yang kamu ubah). Jangan mengisi `risk_acknowledged` atau mengubah Settings dan akun di `hris.localhost` lewat skrip; uji Frappe hanya di `ats-test.localhost` dengan kunci enkripsi acak.

## Perbaikan 1: Deteksi halaman login salah (positif palsu)

**Akar masalah (sudah diverifikasi):** `test_fetch` memanggil `detect_login_page(res.url, res.body, preview)` dengan `preview` = **300 karakter pertama** teks. Kriteria 4 ("teks < 500 karakter, ada frasa login, tanpa konten profil") jadi selalu memenuhi syarat panjang, dan 300 karakter awal halaman Instagram hanyalah menu dan footer ("Instagram Log In Sign Up Meta About Blog Jobs Help API Privacy Terms ..."), tanpa kata profil. Kriteria 3 (ada `<input type="password">`) juga ikut menjadi sinyal kuat padahal halaman profil publik Instagram/GitHub menyisipkan formulir login tersembunyi.

**Perbaikan:**
1. Pisahkan ekstraksi dari pratinjau. `extract_page_signals(html)` mengembalikan: `title` (sudah di-`html.unescape`), `full_text` (teks bersih **penuh**, skrip dan gaya dibuang), `text_len`, `og_title`, `og_description`, `meta_description`, `has_password_input`, `has_profile_jsonld`. Pratinjau 300 karakter hanya untuk tampilan.
2. `detect_login_page` memakai sinyal bertingkat dan **teks penuh**:
   - **Sinyal kuat (cukup sendirian):** URL akhir berjalur login/checkpoint/authwall/signin; atau `<title>` yang intinya halaman login (mis. judul diawali atau seluruhnya "Log in", "Login", "Sign in", "Masuk", "Instagram" tanpa nama profil bergaya `Nama (@handle)`).
   - **Sinyal lemah (hanya berlaku bila tidak ada sinyal profil positif):** ada `<input type="password">`; atau ada frasa login di teks. Sinyal lemah menghasilkan "login page" **hanya jika** `text_len` penuh < 1500 **dan** tidak ada sinyal profil.
   - **Sinyal profil positif (menetralkan sinyal lemah):** `og:title`/`og:description`/`meta description` memuat pola profil (`followers`, `following`, `pengikut`, `posts`, `postingan`, `repositories`, `contributions`, `connections`); judul bergaya `Nama (@handle)`; JSON-LD `Person`/`ProfilePage`; atau teks penuh panjang (> 2000 karakter) yang memuat kata profil.
3. Perbaiki tampilan hasil Test Fetch: judul dan pratinjau di-`html.unescape` (sekarang tampil `&#064;` dan `&amp;`), dan tampilkan juga `og:title` serta `og:description` (sering berisi jumlah pengikut dan post) sebagai baris terpisah. Pratinjau diambil dari konten utama bila ada `<main>`/`role="main"`, bukan dari menu.
4. **Test (fixture sintetis yang meniru struktur, bukan salinan halaman platform):**
   - Profil publik bergaya Instagram: `<title>Nama (&#064;handle) • Instagram photos and videos</title>`, `<meta property="og:description" content="1,367 Followers, 414 Following, 25 Posts - See Instagram photos and videos from Nama (@handle)">`, dialog login tersembunyi dengan `<input type="password">`, teks menu/footer "Instagram Log In Sign Up Meta About Blog Jobs Help API Privacy Terms" di awal, isi total > 5000 karakter → **bukan** halaman login.
   - Halaman login sungguhan (`/accounts/login/`, judul "Login • Instagram", ada kolom password, teks pendek) → login.
   - Authwall bergaya LinkedIn dan checkpoint bergaya Facebook → login.
   - Fixture GitHub profil dan login yang sudah ada tetap lulus tanpa diubah.
   - Judul dengan entitas HTML terbuka dengan benar di hasil.

## Perbaikan 2: Test Fetch belum memakai sesi akun crawler

Tambahkan mode keempat, **Session**, di dialog Test Fetch:
- Platform ditentukan dari domain URL uji (lewat `session_domains` di katalog). Mode Session muncul **hanya bila** ada akun crawler platform itu dengan `status = Connected`, `enabled = 1`, `risk_acknowledged = 1`, dan pengguna System Manager. Label mode: `Session (<account_label>)`.
- Mengambil halaman dengan `storage_state` akun itu lewat `fetch.py` (Scrapling: muat cookie ke sesi, cek API Scrapling 0.5; jangan menebak). Sesi didekripsi di dalam proses, tidak pernah dicatat, tidak masuk cache, log, atau respons.
- **Hanya membaca**: satu permintaan GET ke URL uji. Tidak ada klik atau aksi tulis. Hormati batas `hourly_limit`/`daily_limit`/jeda akun, perbarui `last_used_on`, dan bila respons berupa checkpoint atau tantangan ubah akun ke `Challenge` dengan alasan (`last_error_*`) tanpa percobaan ulang.
- Hasil memuat: akun yang dipakai (label saja), status HTTP, URL akhir, judul, `og:*`, pratinjau, badge login wall, dan **perbandingan dengan mode tanpa sesi**: jumlah post yang terlihat di HTML/JSON tertanam dan ada tidaknya nama, bio, dan jumlah pengikut. Tujuannya supaya pengguna bisa menilai apakah sesi memberi data tambahan dibanding mode Browser.
- Tidak ada eskalasi otomatis dari tombol ini; pengguna memilih lewat daftar mode yang tampil.
- Test (jaringan di-mock): mode Session tidak muncul tanpa akun Connected, tanpa `risk_acknowledged`, atau untuk non-System Manager; sesi tidak muncul di log, cache, atau respons; batas laju dihormati; checkpoint mengubah status akun.

## Perbaikan 3: Default field Settings baru tidak terisi (nilai 0)

Setelah pengguna menekan Save di `hris.localhost`, tab Activity mencatat `Social Max Posts`, `Social Lookback Months`, dan `Max Candidate Export Size (MB)` berubah **dari null menjadi 0**, dan `enable_social_media` bernilai **0**. Default di JSON hanya berlaku untuk dokumen baru, bukan untuk Single yang sudah ada. Dengan nilai itu sumber Social Media nonaktif dan batas post/bulan nol.

**Perbaikan:**
1. Patch idempoten di `patches.txt` dan `setup_default_settings()`: isi `social_max_posts = 200`, `social_lookback_months = 12`, `export_max_mb = 100`, dan `enable_social_media = 1` bila barisnya belum ada **atau** nilainya `0`/`None`. Jangan menimpa nilai yang sengaja diubah menjadi angka positif.
2. Validasi di controller Settings: `social_max_posts`, `social_lookback_months`, dan `export_max_mb` harus ≥ 1 (pesan lewat `_()` dengan terjemahan `id.csv`). `enable_social_media` boleh 0 hanya bila dicentang sengaja.
3. Audit **semua** field yang ditambahkan di Fase 1–2 untuk masalah yang sama (default hanya di JSON) dan perbaiki.
4. Test: Single tanpa baris → patch mengisi default; nilai 0 ditolak; nilai positif yang sudah diubah tidak ditimpa; patch dua kali tidak mengubah apa pun.

## Perbaikan 4: Browser jarak jauh (lanjutan dari temuan sebelumnya)

1. **Antrean dan worker khusus.** Sesi browser sekarang berjalan di antrean `long` yang hanya punya satu worker. Selama dialog terbuka (sampai 10 menit) job lain (Resume Screening, Background Check) ikut tertahan; sebuah sesi uji yang tidak ditutup sempat menahan 6 job sekaligus. Pindahkan ke antrean khusus (mis. `browser`) dengan container worker sendiri di `docker-compose.dev.yml`, dan dokumentasikan untuk produksi.
2. **Job tidak boleh berjalan bila sesinya tidak dibutuhkan lagi.** Job keluar segera bila sesinya sudah ditutup, kedaluwarsa, atau tidak ada polling dari klien selama 30 detik. Perintah `close`/`complete` memakai penanda status yang bertahan sampai dibaca (bukan TTL pendek).
3. **Cookie tidak boleh melewati Redis.** Sekarang `crawler_result` berisi `storage_state` (cookie) dalam JSON biasa meski hanya sesaat. Worker harus menyaring ke `session_domains`, mengenkripsi, dan menyimpan langsung ke akun crawler **di dalam job**, lalu mengirim hanya status ke klien. Hapus `crawler_result` sepenuhnya. Tambahkan test yang memastikan tidak ada cookie yang pernah ditulis ke Redis.
4. **Pembersihan kunci.** `redis.delete(...)` pada `frappe.cache()` adalah method Redis mentah dan tidak menghapus kunci berawalan site; gunakan `delete_value` (dan `lpop`/`delete` mentah hanya untuk kunci yang ditulis mentah seperti `crawler_inputs`). Hapus `crawler_active_session:*`, `crawler_meta:*`, dan `crawler_frame:*` saat sesi berakhir.
5. **Latensi.** Terukur: worker menulis frame tiap ~0,2 detik, tetapi klien mengambilnya tiap 300 ms dan satu ketikan masih melewati beberapa siklus. Perbaiki:
   - kirim input **segera** lewat endpoint ringan (tanpa menunggu interval polling), lalu minta frame berikutnya dalam ± 150 ms;
   - polling adaptif: 150–300 ms saat ada interaksi dalam 3 detik terakhir, 1 detik saat diam;
   - `frame_seq` supaya frame yang sama tidak dikirim ulang (hemat bandwidth);
   - gabungkan ketikan beruntun menjadi satu event;
   - evaluasi CDP `Page.startScreencast` (frame hanya saat tampilan berubah, dengan ack) menggantikan `page.screenshot` per putaran, bila stabil;
   - target: ketikan tampil < 500 ms.
6. **Regression test** untuk bug `frappe.local.cache`: cache palsu yang menyimpan `None`; loop worker harus tetap membaca perintah baru; perintah `complete` selesai dalam < 2 detik; handler Complete membaca hasil dalam satu permintaan.
7. Semua skrip uji dan tangkapan layar menutup sesinya dan membersihkan kunci `crawler_*` di `finally`. Verifikasi symlink aset di container `frontend` bertahan setelah container dibuat ulang (jangan mengandalkan `ln -s` manual).

## Perbaikan 5: Penyesuaian rencana Fase 3

Hasil uji di atas mengubah dua hal di `PROMPT-ANTIGRAVITY-SOSMED.md` Fase 3:
1. **Urutan eskalasi** menjadi `Company → Browser → stealth → session`. Sesi akun crawler adalah langkah **terakhir**, dipakai hanya bila mode tanpa sesi terhalang atau mendarat di halaman login, `fetch_use_login_session = 1`, dan akun `Connected`. Rantai dicatat di `fetch_mode_used` (mis. `company>browser>session`) dan `provenance = Crawled (session)` hanya untuk hasil yang memang diambil dengan sesi.
2. **Laporan Fase 3 per platform** harus memuat perbandingan tanpa sesi vs dengan sesi (nama, bio, jumlah pengikut, jumlah post yang terlihat) supaya terlihat nilai tambah sesi. Untuk Instagram, mode Browser sudah memberi data profil publik tanpa login.

## Aturan kerja ringkas
- Branch `feat/hris-ats`, tanpa push, commit per kelompok perbaikan berbahasa Indonesia, tanpa `Co-Authored-By`, commit hanya berkas yang kamu ubah (termasuk dua berkas dari Claude di atas).
- Semua string UI Bahasa Inggris dengan terjemahan `id.csv` dan terkover `test_i18n.py`.
- Semua test tanpa internet dan tidak login ke platform sungguhan. Test Frappe di `ats-test.localhost`.
- `ruff check` bersih untuk berkas yang diubah.

## Format laporan
1. Ringkasan per perbaikan (≤ 10 baris).
2. Daftar file yang dibuat/diubah.
3. Perintah verifikasi beserta hasilnya (tempel keluaran).
4. Penyimpangan dan alasannya, atau "tidak ada".
5. Temuan di luar cakupan.
6. Pertanyaan sebelum Fase 3.
