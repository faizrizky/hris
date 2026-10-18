// Antrean check-in yang dibuat saat tidak ada sinyal. Disimpan di perangkat
// sampai berhasil dikirim; tiap item membawa jam terpercaya saat ditekan.

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "hris.checkinQueue";

export interface QueueItem {
  clientId: string; // kunci unik: server tidak membuat check-in dobel
  logType: "IN" | "OUT";
  capturedMs: number; // jam terpercaya saat ditekan (epoch UTC ms); 0 bila tidak
  deviceMs: number; // jam dinding HP saat ditekan
  trusted: boolean;
  anchorAgeS: number;
  faceVec?: number[]; // embedding wajah saat check-in; server mencocokkannya
  spoof?: { mean: number; scores: number[] }; // skor anti-spoofing (mode bayangan)
  lokasi?: {
    lat: number;
    lng: number;
    accuracyM: number;
    gpsMs: number;
    mocked: boolean;
  };
}

type Listener = (count: number) => void;
const listeners = new Set<Listener>();
let cache: QueueItem[] | null = null;

async function readQueue(): Promise<QueueItem[]> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as QueueItem[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

async function save(list: QueueItem[]): Promise<void> {
  cache = list;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Tetap ada di memori selama aplikasi hidup.
  }
  listeners.forEach((p) => p(list.length));
}

export const getQueue = readQueue;

export async function getQueueCount(): Promise<number> {
  return (await readQueue()).length;
}

export async function antre(item: QueueItem): Promise<void> {
  const list = await readQueue();
  if (list.some((x) => x.clientId === item.clientId)) return;
  await save([...list, item]);
}

export async function removeFromQueue(clientId: string): Promise<void> {
  await save((await readQueue()).filter((x) => x.clientId !== clientId));
}

export function listenToQueue(p: Listener): () => void {
  listeners.add(p);
  void getQueueCount().then(p);
  return () => {
    listeners.delete(p);
  };
}
