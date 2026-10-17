// Bantuan navigasi kembali.
//
// Tombol kembali di layar menandai bahwa kepulangan ini disengaja, supaya
// halaman tujuan memutar animasi masuknya. Kembali lewat geser (gesture) tidak
// memberi tanda: halaman sebelumnya sudah terlihat selama gesture, jadi memutar
// ulang animasinya terasa seperti dimuat ulang (lihat RevealScope).

// Tanda berlaku singkat: tombol kembali Android yang tidak jadi kembali (mis. di akar) tidak boleh "menempel" ke
// perpindahan halaman berikutnya.
let lewatTombolSampai = 0;

export function tandaiKembali() {
  lewatTombolSampai = Date.now() + 1200;
}

export function kembali(navigation: any) {
  tandaiKembali();
  navigation.goBack();
}

/** Dibaca sekali oleh halaman yang mendapat fokus kembali. */
export function ambilTandaKembali(): boolean {
  const v = Date.now() <= lewatTombolSampai;
  lewatTombolSampai = 0;
  return v;
}

// Kembali ke halaman sebelumnya bila ada; bila ini akar sebuah tab, ke Beranda.
export function kembaliAtauBeranda(navigation: any) {
  if (navigation.canGoBack()) kembali(navigation);
  else navigation.getParent()?.navigate("Beranda");
}

// Ke Beranda: bila halaman ini ada di tumpukan Beranda, kembali ke akarnya;
// bila di tab lain, pindah ke tab Beranda.
export function keBeranda(navigation: any) {
  const nama: string[] = navigation.getState()?.routeNames ?? [];
  if (nama.includes("HomeMain")) {
    tandaiKembali();
    navigation.popToTop();
  } else {
    navigation.getParent()?.navigate("Beranda");
  }
}
