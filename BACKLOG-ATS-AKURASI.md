# Backlog: ide perbaikan akurasi skor Resume Screening (ATS)

Status: **ditunda** (disimpan 2026-10-19). Dikerjakan setelah rangkaian prompt perbaikan, sosmed, dan Scrapling selesai. Semua solusi berbasis aturan, tanpa LLM. Dasar: pembacaan kode `docker/apps/hris_ats/hris_ats/scoring/`. Butir bertanda *(perlu dicek)* belum dibuktikan lewat uji.

## Kelemahan dan solusi

### Dampak tinggi
1. **Lowongan tanpa kriteria membuat skor menyesatkan.** Semua metrik relevansi menjadi N/A, skor hanya dari kerapian CV.
   Solusi: hitung "cakupan kriteria"; di bawah batas (mis. 40% bobot) hasil berlabel "Kriteria lowongan belum cukup", bukan lolos. Wajibkan kriteria minimal di Job Opening bila screening otomatis aktif.
2. **Rata-rata berbobot menutupi kekurangan fatal.** Tanpa satu pun skill wajib masih bisa lolos berkat poin format (35%).
   Solusi: syarat wajib (knockout): skill wajib < 50%, jenjang di bawah minimal, atau tahun pengalaman di bawah batas → skor dibatasi (mis. maks. 60) dan status "Perlu ditinjau HR" (bukan penolakan otomatis). Pisahkan dua skor: **Kecocokan** (skill, pengalaman, pendidikan, sertifikasi, prestasi) dan **Kualitas CV** (ATS, tanggal, kelengkapan, grammar); ambang lolos hanya di Kecocokan.
3. **Bobot format 35% menghukum CV kreatif** (dua kolom, tabel) yang lazim pada desainer/UX.
   Solusi: turunkan total bobot format (maks. 15–20%), atau ubah ATS friendly menjadi indikator "datanya berhasil dibaca" tanpa pengurangan skor bila ekstraksi berhasil.
4. **Bobot dan ambang belum dikalibrasi** (85, 75, 60, bobot default adalah angka awal).
   Solusi: 30–50 CV nyata tersamarkan dengan hasil yang diketahui; jalankan, lihat pemisahan, sesuaikan; versi bobot/ambang tersimpan; jalankan ulang set uji tiap perubahan. Kalibrasi **setelah** butir 1–3 selesai.
5. **Bagian CV tak dikenali → memakai seluruh teks.** "Scrum Master" terbaca S2, tahun sekolah terhitung pengalaman. PDF dua kolom bisa tercampur urutannya *(perlu dicek di `extract.py`)*.
   Solusi: kamus judul bagian yang bisa diedit HR + pencocokan fuzzy; ekstraksi per kolom; bila bagian tidak ditemukan jangan pakai seluruh teks, beri penanda dan turunkan keyakinan hasil.

### Dampak sedang
6. **Skill:** tanpa sinonim ("UI/UX" ≠ "desain antarmuka"), dicari di seluruh teks (termasuk objektif "ingin belajar Python"); skill pendek (R, C) rawan salah cocok *(perlu diuji)*.
   Solusi: doctype kamus alias skill yang diedit HR; bukti per bagian (Skill/Pengalaman bernilai penuh, bagian lain lebih rendah); tampilkan baris CV yang menjadi bukti.
7. **Bug kecil:**
   - Achievement: satuan `tim` tanpa batas kata (cocok di "optimal", "maksimal"); baris duplikat. Perbaiki dengan batas kata, dedupe, batasi ke bagian pengalaman/prestasi.
   - Education: jenjang dari kata "master" tanpa konteks. Pakai pola berkonteks, abaikan baris judul jabatan.
   - Date: singkatan "Agt" tidak dikenali, "s.d." belum dikenali; tanggal "sekarang" dihitung sekali saat modul dimuat (usang di worker panjang); rentang hanya tahun dianggap Jan–Jan. Perluas pembaca tanggal, hitung "sekarang" saat dipanggil, hanya baca bagian pengalaman.
   - Experience: total tahun semua jabatan sama rata termasuk magang. Hitung tahun pada jabatan relevan; bobot lebih rendah untuk magang.
8. **Information completeness hampir selalu penuh:** domisili cocok dengan "indonesia"/"location"; nama lolos bila baris pertama ≥ 2 kata.
   Solusi: deteksi domisili dari pola alamat/kota/kabupaten; cocokkan nama dengan nama pelamar di Job Applicant.
10. **PDF scan:** tanpa OCR, skor 0 dengan alasan "tidak terbaca".
    Solusi: OCR opsional (Tesseract self-host, saklar di Settings), atau status "perlu input manual" alih-alih skor 0.
11. **Dependensi dan set uji:** `rapidfuzz` dan `pdfplumber` dipakai tetapi tidak dideklarasikan di `pyproject.toml`; test hanya 10 CV fiktif.
    Solusi: deklarasikan dan kunci versi; bangun set uji CV nyata tersamarkan.

### Dampak rendah
9. **Grammar bukan pemeriksa tata bahasa** (kesalahan mekanis + daftar salah ketik kecil; penutur non-native dan kata sah seperti "had had" ikut kena).
   Solusi: jadikan informasi atau bobot ≤ 3. Catatan koreksi: dukungan bahasa Indonesia di LanguageTool **belum dipastikan**; cek dulu sebelum diandalkan.

### Keyakinan dan keadilan
12. **Tidak ada penanda keyakinan.** "Skor rendah karena CV lemah" tak dibedakan dari "karena CV gagal dibaca".
    Solusi: hitung kualitas ekstraksi (bagian terdeteksi, tanggal terbaca, teks tidak berantakan); tampilkan "Keyakinan hasil: rendah" agar HR memeriksa manual.
13. **Pemantauan keadilan.** Usia/gender tidak dipakai, tetapi tata letak dan jenjang pendidikan formal bisa menjadi proxy.
    Solusi: pantau sebaran skor per format CV dan per jenjang; tampilkan alasan dan bukti per metrik; keputusan akhir tetap di HR.

## Urutan yang disarankan
1. Butir 1, 2, 12 (mengubah arti hasil).
2. Butir 7, 8, 5 (bug dan pembacaan bagian/kolom).
3. Butir 6, 3 (alias skill, bobot format).
4. Butir 4, 11 (kalibrasi, dependensi).
5. Butir 10, 9 (OCR, Grammar).

## Catatan lain yang ikut dibereskan
- Label cadangan "Lolos Kualifikasi" dan "Tidak Memenuhi Kriteria" di `scoring/total.py` masih berbahasa Indonesia (tertangkap inventaris bahasa Fase 2 prompt perbaikan).
- Rumus dan angka saat ini dijelaskan di percakapan; bobot default: ATS 10, Grammar 5, Date 10, Information 10, Education 10, Skill 25, Experience 20, Achievement 5, Certification 5; ambang lolos 75; ambang ✓/✗ per metrik 60; ambang kemiripan teks 85.
