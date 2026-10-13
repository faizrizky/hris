// Antrean check-in yang dibuat saat tidak ada sinyal. Disimpan di perangkat
// sampai berhasil dikirim; tiap item membawa jam terpercaya saat ditekan.

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "hris.checkinQueue";

export interface ItemAntrean {
  clientId: string; // kunci unik: server tidak membuat check-in dobel
  logType: "IN" | "OUT";
  capturedMs: number; // jam terpercaya saat ditekan (epoch UTC ms); 0 bila tidak
  deviceMs: number; // jam dinding HP saat ditekan
  trusted: boolean;
  anchorAgeS: number;
  lokasi?: {
    lat: number;
    lng: number;
    accuracyM: number;
    gpsMs: number;
    mocked: boolean;
  };
}

type Pendengar = (jumlah: number) => void;
const pendengar = new Set<Pendengar>();
let cache: ItemAntrean[] | null = null;

async function baca(): Promise<ItemAntrean[]> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as ItemAntrean[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

async function simpan(daftar: ItemAntrean[]): Promise<void> {
  cache = daftar;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(daftar));
  } catch {
    // Tetap ada di memori selama aplikasi hidup.
  }
  pendengar.forEach((p) => p(daftar.length));
}

export const ambilAntrean = baca;

export async function jumlahAntrean(): Promise<number> {
  return (await baca()).length;
}

export async function antre(item: ItemAntrean): Promise<void> {
  const daftar = await baca();
  if (daftar.some((x) => x.clientId === item.clientId)) return;
  await simpan([...daftar, item]);
}

export async function hapusDariAntrean(clientId: string): Promise<void> {
  await simpan((await baca()).filter((x) => x.clientId !== clientId));
}

export function dengarkanAntrean(p: Pendengar): () => void {
  pendengar.add(p);
  void jumlahAntrean().then(p);
  return () => {
    pendengar.delete(p);
  };
}
