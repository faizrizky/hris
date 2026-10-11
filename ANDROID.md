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
   - Buat proyek di https://console.firebase.google.com, tambahkan app Android dengan package `com.falah.hrismobile`.
   - Unduh `google-services.json`, letakkan di root proyek, dan tambahkan di app.json: `"android": { "googleServicesFile": "./google-services.json" }`.
   - Unggah FCM credentials: `eas credentials` (Android → Push Notifications / FCM V1 service account key).
4. Bangun APK: `eas build -p android --profile preview`. Hasilnya tautan unduh APK.
5. Buka tautan itu di HP, izinkan "pasang dari sumber ini", pasang APK.
6. Untuk pengembangan dengan hot reload pakai profil `development`: `eas build -p android --profile development`, lalu `npx expo start --dev-client`.

Catatan:
- Alamat server memakai `http://` (LAN). Pengaturan `usesCleartextTraffic` sudah diaktifkan lewat plugin `expo-build-properties` di app.json, jadi APK boleh memanggil http.
- Ganti `EXPO_PUBLIC_API_BASE_URL` di `.env` ke alamat yang bisa dijangkau HP **sebelum** membangun APK; nilainya ikut tertanam saat build.
- Build lokal tanpa EAS: `npx expo run:android` (perlu Android Studio dan SDK, HP tersambung USB dengan debugging aktif).
