// Bantuan navigasi kembali.
//
// Tombol kembali di layar menandai bahwa kepulangan ini disengaja, supaya
// halaman tujuan memutar animasi masuknya. Kembali lewat geser (gesture) tidak
// memberi tanda: halaman sebelumnya sudah terlihat selama gesture, jadi memutar
// ulang animasinya terasa seperti dimuat ulang (lihat RevealScope).

let lewatTombol = false;

export function kembali(navigation: any) {
  lewatTombol = true;
  navigation.goBack();
}

/** Dibaca sekali oleh halaman yang mendapat fokus kembali. */
export function ambilTandaKembali(): boolean {
  const v = lewatTombol;
  lewatTombol = false;
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
    lewatTombol = true;
    navigation.popToTop();
  } else {
    navigation.getParent()?.navigate("Beranda");
  }
}
