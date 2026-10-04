# ERPNext + Frappe HR (hrms) untuk Pengembangan Lokal

Folder ini berisi semua yang dibutuhkan untuk menjalankan satu instance
ERPNext lengkap dengan modul HR (app `hrms` / Frappe HR) di Mac Apple
Silicon, sebagai backend nyata untuk aplikasi mobile HRIS pada Fase 2.

Instance ini **khusus pengembangan**. Tidak ada HTTPS, password defaultnya
`admin`, dan database di dalamnya memang dianggap bisa dibuang kapan saja.
Justru itu tujuannya: kamu harus bebas merusak lalu membangun ulang dari nol
tanpa rasa sayang. Jangan pernah pakai konfigurasi ini di server yang bisa
diakses dari internet.

Satu hal yang paling sering membuat orang buntu di tahap ini, dan karena itu
diberi bagiannya sendiri di bawah: aplikasi Expo yang diuji di HP fisik
**tidak bisa memakai `localhost`**. Baca bagian
[Mengakses dari HP lewat Expo](#mengakses-dari-hp-lewat-expo) sebelum kamu
menyentuh kode aplikasi mobile.

---

## Apa yang kamu dapat

Setelah selesai, kamu punya:

- ERPNext v16 beserta app `hrms` (Frappe HR), lengkap dengan doctype
  Employee, Attendance, Leave Application, Salary Slip, dan seterusnya.
- Satu site siap pakai, bernama `hris.localhost` secara default.
- UI web ERPNext di `http://localhost:8080`.
- REST API yang sama persis, bisa dihubungi dari HP lewat
  `http://<IP-LAN-Mac>:8080`.
- Akun `Administrator` dengan password `admin`.

---

## Kenapa setup ini, bukan yang lain

Repo resmi `frappe/frappe_docker` menyediakan beberapa cara menjalankan
Frappe, dan ketiganya tidak saling menggantikan. Ringkasan pilihan dan alasan
kenapa yang dipakai di sini adalah yang ketiga:

**`pwd.yml` (satu berkas compose sekali pakai).** Paling cepat dinyalakan,
tapi dokumentasi resminya menyatakan secara eksplisit bahwa setup ini
*tidak bisa dipasangi app tambahan*. Karena `hrms` adalah app terpisah dari
`erpnext`, jalur ini langsung mentok untuk kebutuhan kita.

**VS Code Devcontainer (`development/`).** Secara resmi inilah cara yang
dianjurkan untuk "local development". Tapi yang dimaksud adalah
pengembangan *di dalam* Frappe: menulis app Python sendiri, mengubah source
Frappe, memakai debugger. Di situ seluruh bench berada di bind mount dan
`bench start` dijalankan manual. Untuk kebutuhan kita, backend ERPNext cuma
perlu menyala stabil di satu alamat HTTP dan tidak akan disentuh source
code-nya, jadi devcontainer hanya menambah lapisan kerumitan tanpa manfaat.

**Image kustom + compose (yang dipakai di sini).** Kita membangun satu image
lokal berisi `frappe` + `erpnext` + `hrms` lewat alur resmi
(`images/layered/Containerfile` dengan `apps.json`), lalu menjalankannya
dengan `docker-compose.yml` di folder ini. Hasilnya: app lengkap, container
yang bisa dimatikan dan dihidupkan ulang tanpa kehilangan site, dan susunan
service yang mirip deployment sungguhan, sehingga nanti saat naik ke staging
tidak ada kejutan.

### Kenapa harus build image sendiri

Ini konsep Frappe yang wajib dipahami supaya tidak menghabiskan waktu di
jalan yang salah. Di Frappe berbasis Docker, **daftar app adalah bagian dari
image**, bukan sesuatu yang dipasang ke container yang sudah berjalan.

Secara teknis `docker compose exec backend bench get-app hrms` memang akan
jalan dan kelihatan berhasil. Tapi hasilnya hilang, karena dua alasan:
direktori `apps/` tidak ikut dipasang sebagai volume, dan service lain
(`frontend`, `queue-*`, `scheduler`) adalah container terpisah dari image
yang sama, sehingga tetap tidak melihat app baru itu. Begitu container dibuat
ulang, `hrms` lenyap. Dokumentasi resmi menyebut `bench get-app` di dalam
container sebagai tindakan yang tidak didukung.

Alurnya yang benar: daftarkan app di `apps.json`, build image, jalankan
stack. Itulah yang dilakukan `build-image.sh`.

---

## Prasyarat

**Docker Desktop for Mac (Apple Silicon).** Periksa dulu apakah sudah
terpasang dan hidup:

```sh
docker --version
docker compose version
docker info | head -5
```

Perintah pertama harus menunjukkan Docker Engine **versi 23 atau lebih
baru**. Versi itu bukan sekadar anjuran: proses build memakai BuildKit
secret (`--secret`) untuk mengirim `apps.json`, dan BuildKit baru menjadi
builder default sejak Engine 23. Docker Desktop keluaran beberapa tahun
terakhir sudah jauh di atas itu.

Kalau `docker info` menggantung atau mengeluh soal daemon, berarti aplikasi
Docker Desktop-nya belum dibuka. Buka dari Applications, lalu tunggu sampai
ikon paus di menu bar berhenti beranimasi.

Belum punya Docker Desktop: unduh varian **Apple Silicon** dari
<https://docs.docker.com/desktop/setup/install/mac-install/>.

**Alokasi resource Docker Desktop.** Buka Settings, lalu Resources. ERPNext
plus MariaDB plus tiga worker cukup rakus. Anjuran minimal:

- CPU: 4
- Memory: 8 GB (6 GB masih bisa, tapi worker rentan kena OOM saat payroll)
- Disk: sisakan sekitar 20 GB; image hasil build saja sekitar 2-3 GB, dan
  layer perantara saat build jauh lebih besar

**Git.** Sudah ada bersama Command Line Tools. Kalau belum:
`xcode-select --install`.

---

## Isi folder ini

| Berkas              | Fungsi |
| ------------------- | ------ |
| `apps.json`         | Daftar app yang diikutkan ke dalam image: `erpnext` dan `hrms`, beserta branch-nya. Berkas inilah yang menentukan modul HR ada atau tidak. |
| `build-image.sh`    | Membangun image lokal `hris-erpnext:16`. Dijalankan sekali di awal, dan setiap kali `apps.json` berubah. |
| `docker-compose.yml`| Definisi semua service: backend, nginx, websocket, tiga worker, MariaDB, dua Redis, plus satu service sekali-jalan yang membuat site. |
| `.env`              | Konfigurasi lokal: nama site, password dev, port. Sudah terisi nilai yang masuk akal. Diabaikan git. |
| `.env.example`      | Salinan `.env` sebagai acuan, ikut masuk git. |
| `.gitignore`        | Mengabaikan `.env` dan `.frappe_docker/`. |
| `.frappe_docker/`   | Muncul setelah build pertama. Clone repo resmi yang hanya dipakai sebagai konteks build. Aman dihapus kapan saja. |

---

## Urutan perintah, dari nol sampai bisa login

Semua perintah dijalankan dari dalam folder ini:

```sh
cd ~/"Faiz Things/Project/HRIS/docker"
```

### 1. Siapkan konfigurasi

`.env` sudah ikut disertakan dan sudah berisi nilai yang bisa langsung
dipakai, jadi langkah ini bisa dilewati. Kalau `.env` hilang (misalnya
setelah clone ulang repo, karena berkas itu diabaikan git):

```sh
cp .env.example .env
```

### 2. Build image

```sh
./build-image.sh
```

Ini bagian yang paling lama: sekitar 10-30 menit pada percobaan pertama,
karena harus mengunduh image dasar Frappe lalu mengambil dan membangun aset
`erpnext` dan `hrms`. Boleh ditinggal.

Yang dilakukan script ini: memeriksa Docker hidup, meng-clone
`frappe_docker` ke `.frappe_docker/` sebagai konteks build, lalu menjalankan
`docker build` atas `images/layered/Containerfile` dengan `apps.json`
dikirim sebagai BuildKit secret.

Di akhir, script mencetak arsitektur image, ukurannya, dan daftar app di
dalamnya. Perhatikan dua baris ini:

- **Arsitektur** harus `arm64`. Kalau `amd64`, image kamu berjalan lewat
  emulasi dan semuanya akan terasa berat. Lihat Pemecahan Masalah.
- **Daftar app** harus memuat `frappe erpnext hrms`. Kalau `hrms` tidak
  muncul, build-nya tidak memakai `apps.json` dan site nanti pasti gagal
  memasang modul HR.

### 3. Nyalakan stack

```sh
docker compose up -d
```

Lalu tonton proses pembuatan site:

```sh
docker compose logs -f create-site
```

Site dibuat otomatis oleh service `create-site`, termasuk memasang `erpnext`
dan `hrms` sekaligus. Butuh sekitar 2-5 menit. Tunggu sampai muncul:

```
Site hris.localhost siap.
Login: Administrator / admin
```

Setelah itu tekan `Ctrl+C` untuk keluar dari mode mengikuti log. Service
`create-site` akan berstatus `exited (0)`; itu normal, dia memang sekali
jalan. Begitu juga `configurator`.

Periksa semuanya sehat:

```sh
docker compose ps
```

Yang harus `running`: `backend`, `frontend`, `websocket`, `queue-short`,
`queue-long`, `scheduler`, `db`, `redis-cache`, `redis-queue`.

### 4. Login pertama

Buka di browser Mac:

```
http://localhost:8080
```

Masuk dengan:

- Pengguna: `Administrator`
- Password: `admin`

ERPNext akan menyapa dengan wizard setup awal (bahasa, negara, mata uang,
nama perusahaan). Untuk keperluan pengujian API, wizard ini **boleh
diselesaikan dengan data apa saja** asal konsisten: pilih Indonesia dan IDR
supaya format angka dan tanggalnya mirip kondisi nyata. Beberapa doctype HR
memerlukan Company yang sudah ada, jadi wizard sebaiknya jangan dilewati.

Setelah masuk, pastikan modul HR benar-benar terpasang:

```sh
docker compose exec backend bench --site hris.localhost list-apps
```

Keluarannya harus memuat `frappe`, `erpnext`, dan `hrms`. Di UI web, buka
`http://localhost:8080/app/hr` dan kamu semestinya melihat workspace HR.

### Kalau ingin membuat site secara manual

Service `create-site` sudah menangani ini, tapi kalau kamu perlu site kedua
atau ingin melakukannya sendiri, inilah perintahnya:

```sh
docker compose exec backend bench new-site hris2.localhost \
  --mariadb-user-host-login-scope='%' \
  --db-root-username=root \
  --db-root-password=admin \
  --admin-password=admin \
  --install-app erpnext \
  --install-app hrms
```

`--mariadb-user-host-login-scope='%'` wajib ada. Tanpa itu, Frappe membuat
user database yang terikat pada satu IP container, dan koneksi akan putus
begitu Docker memberi container tersebut IP baru setelah restart.

Catatan: site kedua hanya akan bisa diakses lewat `localhost` kalau kamu juga
mengubah `FRAPPE_SITE_NAME_HEADER`, karena nginx di sini dipaksa selalu
melayani satu site. Lihat penjelasannya di bagian berikut.

---

## Mengakses dari HP lewat Expo

Ini bagian yang wajib dibaca utuh. Hampir semua kemacetan di tahap
integrasi berawal dari sini.

### Kenapa `localhost` tidak bisa dipakai

Di Mac, `http://localhost:8080` menunjuk ke Mac itu sendiri. Ketika kode yang
sama berjalan di HP fisik lewat Expo Go, `localhost` menunjuk ke **HP itu
sendiri**, bukan ke Mac kamu. Di HP tidak ada apa pun yang mendengarkan di
port 8080, jadi request langsung gagal dan React Native melaporkannya sebagai
`TypeError: Network request failed` tanpa penjelasan lebih lanjut.

Sama halnya dengan `127.0.0.1`. Keduanya harus diganti dengan alamat IP Mac
di jaringan Wi-Fi lokal.

Perlu diketahui, `localhost` kebetulan tetap bekerja di simulator iOS (karena
berbagi jaringan dengan Mac) dan `10.0.2.2` adalah alias khusus emulator
Android. Dua pengecualian itulah yang membuat banyak orang mengira kodenya
sudah benar, lalu bingung saat mencobanya di HP sungguhan.

### Cari IP LAN Mac

```sh
ipconfig getifaddr en0
```

`en0` adalah antarmuka Wi-Fi di hampir semua Mac. Kalau keluarannya kosong
(misalnya kamu memakai adapter Ethernet atau urutan antarmukanya berbeda):

```sh
ipconfig getifaddr en1
```

Atau lihat semua alamat sekaligus:

```sh
ifconfig | grep "inet " | grep -v 127.0.0.1
```

Hasilnya akan berupa sesuatu seperti `192.168.1.10`, `192.168.100.23`, atau
`10.0.0.5`. Itulah alamat yang dipakai aplikasi mobile:

```
http://192.168.1.10:8080
```

Sesuaikan dengan hasil di Mac kamu, dan jangan lupa `http://` di depan serta
`:8080` di belakang.

### Uji dulu dari browser HP, bukan dari aplikasi

Langkah ini menghemat banyak waktu. Sebelum menyentuh kode Expo, buka
`http://192.168.1.10:8080` di Safari atau Chrome **di HP**.

- **Halaman login ERPNext muncul.** Jalur jaringannya sudah beres. Kalau
  nanti aplikasi masih gagal, masalahnya ada di kode atau konfigurasi
  aplikasi, bukan di jaringan atau Docker. Ini memangkas separuh kemungkinan
  penyebab.
- **Berputar lalu timeout.** Masalahnya di jaringan atau firewall. Jangan
  lanjut ke kode aplikasi dulu; selesaikan sesuai daftar di Pemecahan
  Masalah.

### Kenapa akses lewat IP bisa jalan di setup ini

Secara default Frappe memilih site berdasarkan Host header. Artinya membuka
`http://192.168.1.10:8080` akan membuat Frappe mencari site bernama
`192.168.1.10`, tidak menemukannya, lalu membalas 404.

`docker-compose.yml` di folder ini menghindari itu dengan memasang
`FRAPPE_SITE_NAME_HEADER` ke nama site, pada service `frontend`. nginx jadi
selalu melayani site yang sama, Host header apa pun yang datang. Jadi
`localhost:8080` dari Mac dan `192.168.1.10:8080` dari HP sama-sama tiba di
site `hris.localhost`, tanpa perlu mengubah apa pun saat IP Mac berganti.

Konsekuensinya, satu stack hanya melayani satu site. Untuk kebutuhan
pengembangan ini justru yang kita mau.

### Memakainya dari aplikasi Expo

Simpan alamatnya sebagai variabel lingkungan di root repo (bukan di folder
`docker/` ini), yaitu di `~/Faiz Things/Project/HRIS/.env`:

```
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:8080
```

Awalan `EXPO_PUBLIC_` wajib supaya nilainya ikut terbawa ke bundle aplikasi,
dan dibaca dari kode sebagai `process.env.EXPO_PUBLIC_API_BASE_URL`.

Satu jebakan di sini: nilai `EXPO_PUBLIC_*` disisipkan ke dalam bundle saat
bundling, bukan dibaca saat aplikasi berjalan. Jadi setiap kali kamu
mengubah berkas `.env` itu, Metro harus dinyalakan ulang dengan cache
dibuang:

```sh
npx expo start -c
```

Tanpa `-c`, aplikasi masih memakai alamat yang lama dan kamu akan mengejar
kesalahan yang sudah tidak ada.

### IP Mac berubah-ubah

Alamat dari DHCP bisa berganti saat kamu pindah jaringan, setelah router
restart, atau setelah Mac tidur lama. Kalau tiba-tiba semua request gagal
padahal tadi lancar, periksa dulu `ipconfig getifaddr en0` sebelum mencurigai
hal lain.

Dua cara mengurangi gangguan ini:

1. **Kunci alamatnya.** Di router, buat DHCP reservation untuk MAC address
   Mac kamu. Cara paling bebas masalah.
2. **Pakai nama Bonjour.** macOS mengumumkan dirinya sebagai
   `<nama-lokal>.local`. Lihat namanya dengan:

   ```sh
   scutil --get LocalHostName
   ```

   Lalu alamatnya menjadi `http://nama-mac.local:8080`. Di iOS ini bekerja
   mulus. Di Android dukungan mDNS tidak merata antar versi dan antar pabrikan,
   jadi anggap ini kenyamanan tambahan, bukan jalur utama. Kalau Android gagal,
   kembali ke IP numerik.

---

## Autentikasi ERPNext untuk klien mobile

Bagian ini hanya penjelasan dan langkah di UI, tanpa kode klien. Tujuannya
supaya kamu memilih mekanisme yang tepat sebelum menulis lapisan API di
aplikasi, karena mengganti pilihan ini di tengah jalan cukup merepotkan.

Frappe punya tiga cara autentikasi di REST API: session cookie, token
API key/secret, dan OAuth 2.0 bearer token. Untuk Fase 2, yang relevan dua
yang pertama.

### Session cookie (berbasis password)

Cara kerjanya: kirim `POST` ke `/api/method/login` dengan body berisi `usr`
dan `pwd`. Kalau benar, Frappe membalas data pengguna dan menyetel cookie
`sid` lewat header `Set-Cookie`. Semua request setelahnya harus menyertakan
cookie itu agar dikenali.

Cocok untuk: browser dan UI web, karena cookie ditangani otomatis.

Hal yang perlu diperhatikan di React Native:

- **Cookie memang tersimpan, tapi tidak terlihat.** `fetch` di React Native
  memakai cookie store bawaan platform, jadi sesi bisa bertahan tanpa kamu
  mengelola apa pun. Sisi buruknya, kamu tidak punya kendali: sulit
  memeriksa isinya, sulit menghapusnya dengan pasti saat logout, dan
  perilakunya bisa sedikit berbeda antara iOS dan Android.
- **Sesi punya masa berlaku.** Saat `sid` kedaluwarsa, request yang tadinya
  lancar mulai membalas 401 atau 403, dan aplikasi harus tahu cara
  memulihkannya.
- **Request tulis butuh CSRF token.** Untuk `POST`, `PUT`, dan `DELETE`
  berbasis cookie, Frappe memeriksa `X-Frappe-CSRF-Token`. Ini sumber error
  403 yang membingungkan: `GET` berjalan mulus, lalu pengajuan cuti pertama
  langsung gagal.
- Logout dilakukan lewat `/api/method/logout`.

### Token API key dan secret (per pengguna)

Cara kerjanya: setiap record User bisa punya sepasang `api_key` dan
`api_secret`. Keduanya dikirim di setiap request lewat satu header:

```
Authorization: token <api_key>:<api_secret>
```

Tidak ada sesi, tidak ada cookie, tidak ada CSRF token. Request dijalankan
sebagai pengguna pemilik kunci, dengan hak akses dan role pengguna itu,
sehingga permission ERPNext tetap berlaku sepenuhnya.

Cocok untuk: klien mobile. Stateless, mudah diuji ulang di Postman atau
curl, dan gampang disimpan dengan aman di `expo-secure-store`.

Satu hal yang perlu diluruskan sejak awal: **API key tidak bisa ditukar dari
password lewat endpoint login.** Kunci itu dibuatkan, bukan dihasilkan oleh
proses login. Jadi untuk alur login sungguhan di aplikasi, pola yang umum
adalah: validasi kredensial lewat `/api/method/login`, lalu dalam sesi yang
baru terbentuk itu panggil method whitelisted milik Frappe untuk membuatkan
kunci bagi pengguna yang sedang login, simpan kuncinya di secure store, dan
seluruh request selanjutnya memakai header `token`. Method yang dipakai UI
untuk tombol Generate Keys adalah
`frappe.core.doctype.user.user.generate_keys`. **Perlu kamu verifikasi
sendiri di versi v16** apakah method itu masih whitelisted dan apakah
pengguna biasa boleh memanggilnya untuk dirinya sendiri; aturan permission
di sekitar method ini pernah berubah antar versi.

Untuk `login` dan `getCurrentEmployee` di Fase 2, saran paling praktis:
mulai dengan kunci yang dibuat manual di UI dan ditaruh di `.env`, supaya
dua endpoint itu cepat terbukti jalan. Setelah itu baru rancang alur login
yang sebenarnya, dengan pilihan mekanisme di atas sudah kamu pahami.

### Cara membuat API key lewat UI

1. Masuk ke `http://localhost:8080` sebagai `Administrator`.
2. Buka daftar pengguna di `http://localhost:8080/app/user`.
3. Klik pengguna yang diinginkan.
4. Pindah ke tab **Settings**.
5. Buka bagian **API Access**, lalu klik **Generate Keys**.
6. **API Secret hanya ditampilkan sekali**, tepat setelah tombol itu
   diklik. Salin saat itu juga. Kalau terlewat, tidak ada cara
   melihatnya lagi; kamu harus Generate Keys sekali lagi, yang membuat
   kunci lama tidak berlaku.
7. API Key tetap bisa dilihat kapan saja di field yang sama.

Hanya pengguna dengan role System Manager yang bisa membuat kunci untuk
pengguna lain.

### Jangan uji dengan akun Administrator

Ini akan menghemat waktumu saat mengerjakan `getCurrentEmployee`.
`Administrator` adalah akun sistem dan **tidak punya record Employee**.
Memanggil endpoint apa pun yang mencari Employee berdasarkan pengguna yang
sedang login akan membalas daftar kosong, dan hasil kosong itu mudah
disalahartikan sebagai bug di aplikasi.

Siapkan satu akun uji yang menyerupai karyawan sungguhan:

1. Buat User baru di `/app/user/new`, misalnya `karyawan@contoh.test`,
   dengan password yang kamu ingat.
2. Beri role `Employee` dan `Employee Self Service`.
3. Buat Employee baru di `/app/employee/new`: isi nama, tanggal bergabung,
   tanggal lahir, perusahaan, dan **tautkan field `user_id` ke user yang
   baru dibuat**. Field `user_id` inilah jembatan antara akun login dan
   data karyawan; tanpa itu tidak ada yang menghubungkan keduanya.
4. Buatkan API key untuk user itu lewat langkah di atas.

Endpoint yang relevan untuk `getCurrentEmployee` adalah
`GET /api/resource/Employee` dengan filter pada `user_id`, atau
`GET /api/method/frappe.client.get_value`. Pengguna yang sedang terautentikasi
sendiri bisa diperiksa lewat `GET /api/method/frappe.auth.get_logged_user`,
yang juga merupakan cara tercepat memastikan header `Authorization` kamu
sudah benar sebelum menyalahkan hal lain.

### Catatan CORS

Di iOS dan Android native, `fetch` tidak menerapkan aturan CORS, jadi
Expo Go di HP fisik tidak akan tersandung masalah ini. Tapi kalau sewaktu-waktu
kamu membuka aplikasi lewat Expo Web di browser, request akan diblokir
karena asalnya berbeda. Untuk kebutuhan itu, dan **hanya untuk instance
pengembangan ini**:

```sh
docker compose exec backend bench --site hris.localhost set-config allow_cors '*'
docker compose restart backend frontend
```

Jangan pernah menyalin setelan itu ke instance yang dipakai bersama atau ke
server produksi.

---

## Perintah harian

Semua dijalankan dari folder ini.

**Menghentikan dan menyalakan kembali, data tetap utuh:**

```sh
docker compose stop
docker compose start
```

**Menghapus container tapi menyimpan data** (site, database, dan berkas
unggahan tetap ada di volume):

```sh
docker compose down
docker compose up -d
```

**Melihat log:**

```sh
docker compose logs -f backend          # error aplikasi Python
docker compose logs -f frontend         # log akses nginx, 404, 502
docker compose logs -f create-site      # proses pembuatan site
docker compose logs --tail=100          # semua service sekaligus
```

**Masuk ke shell container backend** (tempat semua perintah `bench`
dijalankan):

```sh
docker compose exec backend bash
```

**Perintah bench yang sering dipakai:**

```sh
docker compose exec backend bench --site hris.localhost list-apps
docker compose exec backend bench --site hris.localhost set-admin-password rahasiabaru
docker compose exec backend bench --site hris.localhost migrate
docker compose exec backend bench --site hris.localhost clear-cache
docker compose exec backend bench --site hris.localhost backup --with-files
docker compose exec backend bench --site hris.localhost console
```

Hasil `backup` tersimpan di dalam volume `sites`, di
`sites/hris.localhost/private/backups`.

**Menyalakan developer mode** (menampilkan traceback yang lebih lengkap saat
API error, sangat membantu saat mengejar penyebab error 500):

```sh
docker compose exec backend bench --site hris.localhost set-config developer_mode 1
docker compose restart backend
```

### Membangun ulang dari nol

Ini yang membuat instance pengembangan nyaman: kalau kamu merasa sudah
mengacaukan datanya, buang saja.

**Reset total, hapus database dan site, pakai image yang sudah ada:**

```sh
docker compose down -v
docker compose up -d
docker compose logs -f create-site
```

`-v` adalah bagian pentingnya: tanpa itu volume tetap tinggal, site lama
masih ada, dan `create-site` akan melewati pembuatan site baru.

**Reset benar-benar total, termasuk image:**

```sh
docker compose down -v
docker image rm hris-erpnext:16
rm -rf .frappe_docker
./build-image.sh
docker compose up -d
```

**Membangun ulang image saja** (misalnya setelah mengubah branch di
`apps.json` atau ingin mengambil versi `hrms` terbaru):

```sh
./build-image.sh --no-cache
docker compose down
docker compose up -d
docker compose exec backend bench --site hris.localhost migrate
```

`migrate` di akhir penting setelah versi app berubah: dia menyesuaikan skema
database site yang sudah ada dengan kode yang baru.

**Memeriksa dan membersihkan ruang disk:**

```sh
docker volume ls | grep hris-erpnext
docker system df
docker builder prune          # membuang cache build yang bisa puluhan GB
```

---

## Pemecahan masalah

### Aplikasi: `TypeError: Network request failed`

Pesan ini dari React Native dan artinya request tidak pernah sampai ke
server. Isinya tidak pernah memberi petunjuk, jadi telusuri berurutan dari
atas; yang di atas jauh lebih sering jadi penyebabnya.

1. **Base URL masih `localhost` atau `127.0.0.1`.** Penyebab paling umum.
   Di HP, dua alamat itu menunjuk ke HP sendiri. Harus IP LAN Mac.
2. **Metro belum di-restart setelah `.env` diubah.** Nilai `EXPO_PUBLIC_*`
   disisipkan saat bundling, jadi aplikasi masih memegang alamat lama.
   Jalankan `npx expo start -c`.
3. **IP Mac sudah berganti.** Cek ulang `ipconfig getifaddr en0` dan
   bandingkan dengan isi `.env`.
4. **Mac dan HP tidak di jaringan yang sama.** Sering terjadi saat HP
   diam-diam pindah ke jaringan lain, atau saat salah satunya memakai
   hotspot. Pastikan nama Wi-Fi keduanya identik.
5. **Wi-Fi dengan isolasi klien.** Jaringan kantor, hotel, kafe, dan jaringan
   tamu umumnya melarang perangkat saling menghubungi. Jaringan apa pun
   bernama "Guest" patut dicurigai. Solusi tercepat: nyalakan Personal
   Hotspot di HP lain dan sambungkan Mac serta HP uji ke situ.
6. **VPN aktif.** VPN di HP atau di Mac bisa mengalihkan trafik keluar dari
   jaringan lokal. iCloud Private Relay juga pernah menyebabkan hal serupa.
   Matikan dulu saat menguji.
7. **Stack belum jalan.** Jalankan `docker compose ps` dan pastikan
   `frontend` berstatus `running`.
8. **Salah port.** Harus `:8080`, kecuali kamu mengubah
   `HTTP_PUBLISH_PORT` di `.env`.
9. **Masih menulis `https://`.** Instance ini hanya melayani HTTP biasa.
   Request `https://` akan gagal di tahap TLS handshake dengan pesan yang
   sama.
10. **Khusus development build atau aplikasi rilis, bukan Expo Go.** Expo Go
    mengizinkan HTTP biasa ke jaringan lokal saat pengembangan. Begitu kamu
    membuat development build atau build rilis sendiri, HTTP ke alamat IP
    akan diblokir: iOS memblokirnya lewat App Transport Security, Android
    sejak versi 9 memblokir cleartext secara default. Perlu
    `NSAllowsLocalNetworking` di iOS dan `usesCleartextTraffic` di Android,
    lewat konfigurasi `app.json`. Di iOS juga akan muncul permintaan izin
    "Local Network" yang harus disetujui, dan kalau pernah ditolak harus
    dinyalakan ulang lewat Settings pada aplikasinya.

Pemastian paling cepat tetap yang di bagian sebelumnya: buka
`http://<IP-Mac>:8080` di browser HP. Kalau halaman login ERPNext muncul,
poin 4 sampai 9 bisa langsung kamu singkirkan.

### Browser HP timeout, tapi di Mac lancar

Jaringannya yang jadi soal, bukan Docker. Urutan pemeriksaan:

```sh
# Pastikan port benar-benar dibuka ke semua antarmuka, bukan hanya ke Mac.
# Keluarannya harus memuat 0.0.0.0:8080.
docker compose ps
```

Lalu periksa firewall macOS di System Settings, Network, Firewall. Kalau
aktif, tambahkan Docker ke daftar yang diizinkan, atau matikan sementara
untuk memastikan memang itu penyebabnya.

### Browser menampilkan 404 atau "Site does not exist"

`FRAPPE_SITE_NAME_HEADER` tidak sama dengan nama site yang benar-benar ada.
Biasanya terjadi setelah kamu mengubah `SITE_NAME` di `.env` padahal site
lama masih yang terpasang di volume. Periksa site yang sesungguhnya ada:

```sh
docker compose exec backend ls sites
```

Cocokkan `SITE_NAME` di `.env` dengan salah satu nama di situ, lalu
`docker compose up -d --force-recreate frontend`.

### `docker compose up` gagal: image tidak ditemukan

Pesannya kurang lebih `pull access denied for hris-erpnext` atau
`image not found`. Image ini hanya ada di Mac kamu, tidak ada di Docker Hub,
dan `PULL_POLICY=never` memang dipasang supaya Docker tidak mencoba
menariknya. Artinya kamu belum menjalankan `./build-image.sh`, atau image-nya
sudah terhapus. Periksa:

```sh
docker image ls | grep hris-erpnext
```

### `create-site` keluar dengan error

```sh
docker compose logs create-site
```

- **"konfigurasi bersama tidak pernah lengkap"** berarti `configurator`
  gagal. Lihat `docker compose logs configurator`. Umumnya karena image-nya
  tidak utuh, jadi build ulang.
- **`Access denied for user 'root'@'...'`** berarti `DB_ROOT_PASSWORD` di
  `.env` tidak sama dengan password yang tersimpan di volume `db-data` dari
  percobaan sebelumnya. Password root MariaDB hanya ditetapkan pada saat
  volume pertama dibuat, dan setelah itu tidak ikut berubah. Karena ini
  instance pengembangan, cara termudah adalah menghapus volumenya:
  `docker compose down -v && docker compose up -d`.
- **`App hrms not found`** atau pemasangan `hrms` gagal: image-nya terbangun
  tanpa `hrms`. Pastikan dengan
  `docker compose exec backend ls apps` dan
  `docker compose exec backend cat sites/apps.txt`. Kalau `hrms` tidak ada,
  periksa isi `apps.json` lalu `./build-image.sh --no-cache`.
- **Pembuatan site dilewati padahal kamu ingin yang baru.** Service ini
  memang sengaja tidak merusak site yang sudah ada. Pakai
  `docker compose down -v`.

### Build image gagal

- **`no matching manifest for linux/arm64`** pada salah satu image dasar.
  Berarti tag yang diminta belum punya varian arm64. Jalan pintasnya: build
  image dasar sendiri. Dari dalam `.frappe_docker`:
  `docker buildx bake --no-cache --set "*.platform=linux/arm64"`, lalu
  jalankan `./build-image.sh` lagi. Ini butuh waktu jauh lebih lama.
- **`--secret` tidak dikenali** atau `the --mount option requires BuildKit`.
  Docker Engine kamu di bawah versi 23. Perbarui Docker Desktop.
- **Build mati di tengah tanpa pesan jelas**, biasanya saat tahap build aset
  Node. Hampir selalu karena memori Docker Desktop kurang. Naikkan ke 8 GB
  di Settings, Resources, lalu coba lagi.
- **Gagal saat `git clone` app.** Cek koneksi internet, dan cek apakah
  branch di `apps.json` memang ada di repo yang bersangkutan.

### Semuanya terasa sangat lambat

Periksa arsitektur image yang sedang dipakai:

```sh
docker image inspect --format '{{.Architecture}}' hris-erpnext:16
```

Di Apple Silicon jawabannya harus `arm64`. Kalau `amd64`, setiap instruksi
diterjemahkan lewat emulasi dan ERPNext bisa beberapa kali lebih lambat.
Perbaikannya: pastikan tidak ada baris `platform: linux/amd64` yang kamu
tambahkan ke `docker-compose.yml` (berkas aslinya sengaja tidak punya baris
itu), lalu build ulang dengan `./build-image.sh --no-cache`.

Perlu dicatat, `compose.yaml` resmi di repo `frappe_docker` justru mencantumkan
`platform: linux/amd64` pada service-service-nya. Itu salah satu alasan
`docker-compose.yml` di folder ini ditulis sendiri alih-alih memakai berkas
resmi apa adanya.

Kalau arsitekturnya sudah `arm64` tapi tetap berat, naikkan CPU dan memori
di Docker Desktop. Permintaan pertama setelah restart juga selalu lambat
karena Frappe membangun cache.

### Port 8080 sudah dipakai

```sh
lsof -i :8080
```

Ubah `HTTP_PUBLISH_PORT` di `.env` ke port lain, misalnya `8081`, lalu
`docker compose up -d`. Jangan lupa menyesuaikan
`EXPO_PUBLIC_API_BASE_URL` di repo root.

### Container restart terus-menerus

```sh
docker compose ps
docker compose logs --tail=50 backend
```

Penyebab tersering adalah memori Docker Desktop yang terlalu kecil, sehingga
worker dimatikan oleh OOM killer. Penyebab kedua: `db` belum sehat ketika
service lain mencoba menyambung; tunggu satu menit dan lihat apakah stabil
sendiri.

### API membalas 401 atau 403

- **401 pada `/api/method/login`**: `usr` atau `pwd` salah. Perhatikan bahwa
  nama penggunanya `Administrator` dengan huruf A besar, sedangkan pengguna
  lain memakai alamat email.
- **403 dengan pesan soal CSRF** pada request `POST` berbasis cookie: inilah
  keterbatasan sesi cookie yang dibahas di bagian autentikasi. Pakai header
  `Authorization: token <key>:<secret>`, atau kirimkan
  `X-Frappe-CSRF-Token`.
- **401 padahal header `token` sudah dikirim**: periksa formatnya persis,
  `token`, satu spasi, lalu `key:secret` tanpa spasi di sekitar titik dua.
  Uji dengan `GET /api/method/frappe.auth.get_logged_user`; kalau yang
  kembali nama pengguna yang benar, headernya sudah beres.
- **`PermissionError` saat mengambil Employee**: pengguna itu tidak punya
  role HR yang memadai, atau tidak ada Employee yang `user_id`-nya menunjuk
  ke dia. Lihat bagian "Jangan uji dengan akun Administrator".

### Daftar Employee kembali kosong padahal datanya ada

Hampir selalu karena field `user_id` pada record Employee belum ditautkan ke
akun yang kamu pakai login. Buka Employee itu di UI dan periksa field
tersebut. ERPNext memfilter data berdasarkan permission, jadi daftar kosong
dan tidak punya hak akses terlihat sama dari sisi API.

### Mengulang dari benar-benar awal

Kalau sudah bingung di mana salahnya, reset saja. Instance ini dirancang
untuk itu:

```sh
docker compose down -v
docker compose up -d
docker compose logs -f create-site
```

---

## Versi yang dipakai dan hal yang perlu kamu verifikasi

Berkas-berkas di folder ini disusun dari repo resmi `frappe/frappe_docker`
per **3 Oktober 2026**. Ekosistem Frappe berubah cukup cepat, jadi bagian ini
mencatat apa yang sudah dipastikan, dan apa yang belum. Yang belum pasti
sebaiknya kamu periksa sendiri daripada dianggap benar.

### Sudah dipastikan langsung dari repo resmi

- `pwd.yml` resmi saat ini memakai `frappe/erpnext:v16.37.0`,
  `mariadb:11.8`, dan `redis:6.2-alpine`. Versi MariaDB dan Redis di
  `docker-compose.yml` sini mengikuti itu.
- Build v16 di CI resmi memakai Python 3.14 dan Node 24.
- Alur pemasangan app lewat `apps.json` dan BuildKit secret
  (`--secret=id=apps_json,src=apps.json`) adalah yang didokumentasikan saat
  ini, dan `--build-arg` untuk `apps.json` secara eksplisit tidak dianjurkan.
- Dokumentasi resmi menyatakan `pwd.yml` tidak bisa dipasangi app tambahan,
  dan `bench get-app` di dalam container tidak didukung.
- Workflow CI resmi (`core-publish-images.yml`) mendorong image dengan
  `*.platform=linux/amd64,linux/arm64`, jadi image dasar `frappe/base` dan
  `frappe/build` untuk `version-16` semestinya tersedia dalam arm64.
- Branch `version-16` pada repo `frappe/hrms` ada dan berisi `pyproject.toml`.
- Format header token REST API adalah `Authorization: token api_key:api_secret`,
  dan tombol Generate Keys ada di tab Settings, bagian API Access, pada
  record User.

### Perlu kamu verifikasi

- **Arsitektur image dasar.** Verifikasi ketersediaan arm64 di atas berasal
  dari berkas workflow CI, bukan dari pemeriksaan manifest Docker Hub secara
  langsung, karena Docker Hub tidak bisa diakses dari lingkungan tempat
  berkas ini disusun. Pembuktiannya satu perintah, setelah build selesai:
  `docker image inspect --format '{{.Architecture}}' hris-erpnext:16` harus
  menjawab `arm64`.
- **Versi `hrms` yang serasi dengan `erpnext` v16.37.0.** `apps.json` di
  sini meminta branch `version-16` untuk keduanya, yang merupakan praktik
  normal. Tapi `erpnext` dan `hrms` dirilis terpisah, sehingga ada
  kemungkinan kecil ketidakserasian sesaat kalau salah satunya baru saja
  rilis. Kalau `install-app hrms` gagal dengan keluhan versi, periksa
  rilis `hrms` di <https://github.com/frappe/hrms/releases> dan sematkan tag
  yang pasti di `apps.json`, menggantikan `"branch": "version-16"`.
- **`chromium_path` di service `configurator`.** Nilai
  `/usr/bin/chromium-headless-shell` diambil dari `compose.yaml` resmi untuk
  v16, dan dipakai untuk cetak PDF. Kalau cetak payslip atau format cetak
  lain gagal, pastikan binary-nya memang ada:
  `docker compose exec backend ls -l /usr/bin/chromium-headless-shell`.
  Kalau tidak ada, hapus baris itu dari `docker-compose.yml`, atau cari
  path chromium yang benar di dalam image.
- **`frappe.core.doctype.user.user.generate_keys` di v16.** Dibahas di bagian
  autentikasi. Method ini dipakai UI, tapi apakah pengguna non-admin boleh
  memanggilnya untuk dirinya sendiri di v16 belum diverifikasi. Uji dulu
  dengan akun karyawan sebelum merancang alur login di atasnya.
- **Dokumen resmi berpindah tempat.** Folder `docs/` di `frappe_docker` baru
  direorganisasi, dan beberapa panduan lama masih tertinggal isinya. Catatan
  ARM64 resmi, misalnya, masih menyarankan `docker buildx bake` dengan versi
  image lama `v16.19.1`; menurut temuan di atas langkah itu seharusnya tidak
  lagi diperlukan dan hanya berguna sebagai jalan terakhir. Rujukan
  terkini ada di <https://frappe.github.io/frappe_docker/>.
- **Wizard setup awal ERPNext.** Isi wizard berpengaruh ke doctype HR yang
  mensyaratkan Company, tapi kombinasi field minimal yang dibutuhkan modul
  HR belum dipastikan. Kalau ada doctype HR yang menolak disimpan karena
  field induk kosong, lengkapi dulu setup Company dan Holiday List.

### Rujukan

- Repo resmi: <https://github.com/frappe/frappe_docker>
- Dokumentasi: <https://frappe.github.io/frappe_docker/>
- Memilih metode deployment:
  <https://github.com/frappe/frappe_docker/blob/main/docs/01-getting-started/01-choosing-a-deployment-method.md>
- Immutability dan persistensi:
  <https://github.com/frappe/frappe_docker/blob/main/docs/01-getting-started/02-docker-immutability.md>
- Build image kustom:
  <https://github.com/frappe/frappe_docker/blob/main/docs/02-setup/02-build-setup.md>
- Operasi site:
  <https://github.com/frappe/frappe_docker/blob/main/docs/04-operations/01-site-operations.md>
- REST API Frappe: <https://docs.frappe.io/framework/user/en/api/rest>

---

## Data uji dan Server Script (seed)

Semua data uji (company, department, leave type + alokasi, employee, user, role,
User Permission, shift, slip gaji contoh, dan Server Script) bisa dibuat ulang
dengan satu perintah. Skrip bersifat idempotent: aman dijalankan berulang, hanya
membuat yang belum ada.

```sh
cd docker
./seed/seed.sh
```

Prasyarat: stack sudah jalan (`docker compose up -d`) dan site sudah dibuat.
Setelah `docker compose down -v`, jalankan `docker compose up -d`, tunggu
`create-site` selesai, lalu `./seed/seed.sh` lagi.

- Password dan API key dibaca/ditulis di `docker/.credentials.local` (di-ignore
  git). Kalau berkas belum ada, `seed.sh` membuatnya dengan nilai bawaan dev
  (`USER_*`, `MSS_USER_*`, `HR_USER_*`). Ubah nilainya di berkas itu sebelum
  menjalankan seed bila perlu. Tidak ada rahasia di berkas yang ter-track git.
- API key/secret untuk `rani.test@example.com` dibuat bila belum ada, lalu ditulis
  ke `.credentials.local`. Paksa buat ulang dengan mengosongkan `API_SECRET`.
- Akun uji: `rani.test@example.com` (ESS, hanya melihat Employee miliknya),
  `mss.test@example.com` (manajer Keuangan, Leave Approver untuk Rani, hanya
  melihat Employee miliknya), `hr.test@example.com` (HR User/Manager, melihat semua).
- Server Script ada di `docker/server-scripts/`, satu berkas `.py` per script.
  Nama berkas = nama method API (`/api/method/<nama>`). Saat ini:
  `hris_get_colleagues` (rekan se-departemen, hanya `name`, `employee_name`,
  `designation`, melewati User Permission, Guest ditolak).
  Perlu `server_script_enabled=1`, yang diatur oleh `seed.sh`.
- Seed juga memberi role Employee izin tulis permlevel 1 pada Employee Checkin,
  supaya field `time` yang dikirim klien (antrean offline) tidak diganti jam server.
- Catatan: kalau Server Script tidak terbaca (error "Failed to get method"),
  jalankan `docker compose exec backend bench --site hris.localhost clear-cache`.

### Smoke test endpoint aplikasi

Setelah mengubah role, User Permission, atau Server Script, cek ulang semua
endpoint yang dipakai aplikasi dengan satu perintah:

```sh
cd docker
./seed/smoke.sh            # VERBOSE=1 ./seed/smoke.sh untuk melihat potongan body
```

Skrip login sebagai rani (sid dan token), mss.test, dan hr.test, memanggil login,
`get_logged_user`, Employee (filter `user_id`), `hris_get_my_roles`,
`hris_get_colleagues`, `get_leave_details`, dan daftar Leave Application, lalu
mencetak status HTTP tiap panggilan. Kode keluar 0 bila semua 200 dan Guest
mendapat 403. Kredensial dibaca dari `.credentials.local`; password dan secret
tidak dicetak.

Server Script `hris_get_my_roles` mengembalikan daftar role pemanggil, berupa
`All`, `Guest`, lalu role yang ditetapkan (dibaca dari Has Role, karena
`frappe.get_roles` tidak tersedia di sandbox Server Script).
