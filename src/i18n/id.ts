// Kamus bahasa Indonesia. Kuncinya menjadi acuan tipe untuk en.ts, jadi
// menambah kunci di sini tanpa terjemahannya akan ditolak TypeScript.

export const id = {
  // Umum
  "umum.keluar": "Keluar",
  "umum.batal": "Batal",
  "umum.kirim": "Kirim",

  // Tab bawah
  "tab.home": "Home",
  "tab.absensi": "Absensi",
  "tab.absensiKry": "Absensi Kry",
  "tab.approval": "Approval",
  "tab.payroll": "Payroll",
  "tab.profil": "Profil",

  // Profil
  "profil.masaKerja": "Masa kerja",
  "profil.sisaCuti": "Sisa cuti",
  "profil.skorKpi": "Skor KPI",
  "profil.dataPribadi": "Data pribadi & keluarga",
  "profil.dataPribadiSub": "NIK, alamat, kontak darurat",
  "profil.dokumen": "Dokumen digital",
  "profil.dokumenSub": "Kontrak, sertifikat, SK",
  "profil.push": "Notifikasi push",
  "profil.pushSub": "Approval, payroll, pengumuman",
  "profil.modeGelap": "Mode gelap",
  "profil.modeGelapAktif": "Aktif",
  "profil.modeGelapIkuti": "Mengikuti pilihanmu",
  "profil.bahasa": "Bahasa",
  "profil.bahasaSub": "Indonesia atau English",
  "profil.keamanan": "Keamanan & Face ID",
  "profil.keamananSub": "Biometrik, ubah password",
  "profil.sinkron": "Status sinkronisasi",
  "profil.tersinkron": "Tersinkron dengan ERPNext",
  "profil.antrean": "2 data offline menunggu kirim",
  "profil.keluarJudul": "Keluar dari akun?",
  "profil.keluarPesan": "Kamu perlu login lagi untuk memakai aplikasi.",
  "profil.th": "th",

  // Galat
  "err.noBase": "EXPO_PUBLIC_API_BASE_URL belum diisi",
  "err.timeout": "Server tidak merespons",
  "err.network": "Tidak bisa terhubung ke server",
  "err.sesiBerakhir": "Sesi berakhir, silakan masuk lagi",
  "err.peran": "Gagal memuat peran akun",
  "err.peranCoba": "{pesan}. Coba lagi.",
  "err.tanpaKaryawan": "Akun belum terhubung ke karyawan",
  "err.tanpaKaryawanUser":
    "Akun ini belum terhubung ke data karyawan. Hubungi HR.",
  "err.tanpaApprover": "Belum ada approver. Hubungi HR.",
  "err.bentrokCuti": "Tanggal bertabrakan dengan pengajuan cuti lain",
  "err.passwordLama": "Password lama salah",
  "err.passwordLemah":
    "Password baru terlalu lemah. Gunakan kombinasi huruf besar, huruf kecil, angka, dan simbol.",
  "err.ditolak":
    "Pengajuan tidak bisa dibuat. Periksa tanggal (hari libur, sudah cuti, atau tumpang tindih).",
  "err.loginSalah": "Email atau password salah",
  "err.server": "Terjadi masalah di server.{kode} Coba lagi sebentar.",
  "err.takTerduga": "Terjadi kesalahan tak terduga",
  "err.gagalMemuat": "Gagal memuat",
  "err.cobaLagi": "Coba lagi",

  // Login
  "login.judul1": "Kelola HR Anda",
  "login.judul2": "dari satu aplikasi",
  "login.sub":
    "Presensi, cuti, payroll, dan approval — tersinkron langsung dengan ERPNext.",
  "login.masukAkun": "Masuk ke akun",
  "login.gunakanEmail": "Gunakan email kantor Anda",
  "login.email": "Email",
  "login.password": "Password",
  "login.passwordIsi": "Masukkan password",
  "login.sembunyikan": "Sembunyikan",
  "login.lihat": "Lihat",
  "login.ingat": "Ingat saya",
  "login.lupa": "Lupa password?",
  "login.memproses": "Memproses...",
  "login.masuk": "Masuk",
  "login.atau": "atau",
  "login.faceId": "Masuk dengan Face ID",

  "notif.hariIni": "Hari ini",
  "notif.kemarin": "Kemarin",
  "notif.sebelumnya": "Sebelumnya",

  // Pilihan bahasa
  "bahasa.id": "Indonesia",
  "bahasa.en": "English",
} as const;

export type Kunci = keyof typeof id;
