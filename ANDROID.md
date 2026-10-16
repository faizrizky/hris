# Menjalankan di Android tanpa Play Store

Ada dua jalan. Keduanya tanpa Play Store dan tanpa akun Google Play.

## A. Cepat: Expo Go (tanpa build)
1. Pasang **Expo Go** dari Play Store di HP, satu kali.
2. HP dan Mac satu Wi-Fi. Jalankan `npx expo start -c`, lalu pindai QR dengan Expo Go.
3. Semua fitur jalan kecuali **push notification** (Expo Go tidak mendukungnya di Android).

## B. Aplikasi sendiri (APK) lewat EAS Build — untuk push dan pemakaian harian
Perlu akun Expo gratis (https://expo.dev).
1. `npm i -g eas-cli` lalu `eas login`.
2. Di folder proyek: `eas init` (mengisi `extra.eas.projectId` di app.json; ini yang dibutuhkan push).
3. Push Android memerlukan Firebase (gratis):
   - Buat proyek di https://console.firebase.google.com, tambahkan app Android dengan package `com.hrismobile`.
   - Unduh `google-services.json`, letakkan di root proyek, dan tambahkan di app.json: `"android": { "googleServicesFile": "./google-services.json" }`.
   - Unggah FCM credentials: `eas credentials` (Android → Push Notifications / FCM V1 service account key).
4. Bangun APK: `eas build -p android --profile preview`. Hasilnya tautan unduh APK.
5. Buka tautan itu di HP, izinkan "pasang dari sumber ini", pasang APK.
6. Untuk pengembangan dengan hot reload pakai profil `development`: `eas build -p android --profile development`, lalu `npx expo start --dev-client`.

Catatan:
- Alamat server memakai `http://` (LAN). Pengaturan `usesCleartextTraffic` sudah diaktifkan lewat plugin `expo-build-properties` di app.json, jadi APK boleh memanggil http.
- Ganti `EXPO_PUBLIC_API_BASE_URL` di `.env` ke alamat yang bisa dijangkau HP **sebelum** membangun APK; nilainya ikut tertanam saat build.
- Build lokal tanpa EAS: `npx expo run:android` (perlu Android Studio dan SDK, HP tersambung USB dengan debugging aktif).


## Memperbarui aplikasi tanpa build ulang (EAS Update)

Perubahan yang hanya JavaScript, teks, animasi, atau gambar tidak perlu build baru:

```bash
./scripts/kirim-update.sh "pesan perubahan"
```

HP mengambilnya saat aplikasi dibuka (layar pembuka menampilkan "Memperbarui aplikasi…") lalu memuat ulang sendiri.

- **Perlu build baru:** library native baru, modul `hris-clock` / `hris-face`, model wajah, izin, ikon, splash native,
  atau pengaturan native di `app.json`. Rilis build itu lewat `./scripts/rilis-apk.sh <build-id>`.
- **Runtime version = fingerprint proyek.** Update hanya diterima build yang runtime-nya sama, jadi perubahan native tidak
  bisa membuat build lama crash karena paket JS yang tidak cocok.
- **Kuota:** paket gratis EAS Update 1.000 pengguna aktif per bulan (terpisah dari jatah build).
- **Build pertama dengan EAS Update:** HP yang berjalan di build lama (tanpa `expo-updates`) perlu memasang build baru sekali.
- `.env` lokal ikut terbaca saat memaketkan (alamat server, `EXPO_PUBLIC_USE_ERPNEXT`), jadi kirim update dari folder proyek ini.


## Konfigurasi terkini (2026-10-16)
- **ID paket:** `com.hrismobile` (sementara; mengubahnya = aplikasi baru, APK lama tidak bisa diperbarui ke versi baru).
- **Firebase:** proyek `hris-2d0e4`; `google-services.json` ada di akar proyek (`android.googleServicesFile` di app.json). Kunci FCM V1 sudah diunggah ke EAS (profil `preview`, `com.hrismobile`). Mengganti ID paket: tambah app Android baru di Firebase, ganti `google-services.json`, unggah ulang kunci bila perlu, build ulang.
- **Keystore:** dibuat EAS untuk `com.hrismobile` ("hris preview"). Jangan dihapus: pembaruan APK berikutnya harus ditandatangani kunci yang sama. Cadangan: `npx eas-cli credentials --platform android` > Download existing keystore.
- **Uji push langsung:** `./scripts/tes-push.sh [email]`. Push dari server aktif bila Dry Run di Push Settings dimatikan.
- **Modul native:** `hris-face` (ML Kit, SFace, anti-spoofing Minivision mode bayangan), `expo-local-authentication`, `expo-secure-store` (kunci otomatis dan login biometrik).
- Perintah EAS di proyek ini memakai `npx eas-cli ...` (bukan `npx eas`).
