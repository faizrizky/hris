// Company (tenant) yang dipakai aplikasi: kode company -> site di server lewat registry,
// lalu paket langganan site itu menentukan fitur yang tampil. Dipilih sebelum login.

import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { translate } from "@/i18n";
import {
  ApiError,
  DEFAULT_SERVER_ADDRESS,
  get,
  setServerAddress,
} from "@/services/api/http";

// Registry: site khusus yang memetakan kode company -> site (docker/seed/registry.py).
const REGISTRY_URL = (
  process.env.EXPO_PUBLIC_REGISTRY_URL ?? DEFAULT_SERVER_ADDRESS
).replace(/\/+$/, "");
const REGISTRY_SITE = process.env.EXPO_PUBLIC_REGISTRY_SITE ?? "";
const TENANT_KEY = "hris.tenant";
const LANGGANAN_KEY = "hris.langganan";
const TIMEOUT_MS = 10_000;

export type Fitur =
  | "absensi"
  | "koreksi_absensi"
  | "cuti"
  | "slip_gaji"
  | "keamanan"
  | "lembur"
  | "dinas_wfh"
  | "pajak_bpjs"
  | "dokumen"
  | "pengumuman"
  | "penilaian_kinerja";

export interface Tenant {
  kode: string;
  nama: string;
  site: string;
  baseUrl: string;
  channel: string;
}

export interface Langganan {
  paket: string;
  aktif: boolean;
  berlakuSampai: string | null;
  fitur: Fitur[];
}

async function cariDiRegistry(kode: string): Promise<Tenant> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(
      `${REGISTRY_URL}/api/method/hris_cek_company?kode=${encodeURIComponent(kode)}`,
      {
        headers: {
          Accept: "application/json",
          ...(REGISTRY_SITE ? { "X-Frappe-Site-Name": REGISTRY_SITE } : {}),
        },
        signal: controller.signal,
      },
    );
  } catch {
    throw new ApiError(translate("err.network"), 0, "Network");
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 404)
    throw new ApiError(translate("kode.tidakDikenal"), 404, "UnknownCompany");
  if (res.status === 429)
    throw new ApiError(translate("kode.terlaluSering"), 429, "RateLimited");
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status, null);
  const m = (await res.json()).message as {
    kode: string;
    nama_company: string;
    site: string;
    base_url: string | null;
    channel: string | null;
  };
  return {
    kode: m.kode,
    nama: m.nama_company,
    site: m.site,
    baseUrl: m.base_url || REGISTRY_URL,
    channel: m.channel ?? "",
  };
}

// Dipanggil setelah alamat & site company terpasang di lapisan HTTP.
async function ambilLangganan(): Promise<Langganan> {
  const { message: m } = await get<{
    message: {
      paket: string;
      aktif: boolean;
      berlaku_sampai: string | null;
      fitur: Fitur[];
    };
  }>("/api/method/hris_get_langganan");
  return {
    paket: m.paket,
    aktif: m.aktif,
    berlakuSampai: m.berlaku_sampai,
    fitur: m.fitur,
  };
}

async function simpan(key: string, value: object | null) {
  try {
    if (value) await AsyncStorage.setItem(key, JSON.stringify(value));
    else await AsyncStorage.removeItem(key);
  } catch {
    // penyimpanan gagal: nilai tetap dipakai selama aplikasi terbuka
  }
}

async function baca<T>(key: string): Promise<T | null> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

interface TenantContextValue {
  tenant: Tenant | null;
  langganan: Langganan | null;
  isReady: boolean; // false selama company tersimpan masih dibaca
  pilihCompany: (kode: string) => Promise<void>;
  // Cek ulang ke server saat aplikasi dibuka: paket bisa naik/turun atau habis.
  segarkan: () => Promise<void>;
  gantiCompany: () => Promise<void>;
  punyaFitur: (fitur: Fitur) => boolean;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [langganan, setLangganan] = useState<Langganan | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    Promise.all([baca<Tenant>(TENANT_KEY), baca<Langganan>(LANGGANAN_KEY)])
      .then(([t, l]) => {
        setTenant(t);
        setLangganan(l);
      })
      .finally(() => setIsReady(true));
  }, []);

  const pilihCompany = async (kode: string) => {
    const t = await cariDiRegistry(kode.trim());
    await setServerAddress(t.baseUrl, t.site);
    const l = await ambilLangganan();
    await Promise.all([simpan(TENANT_KEY, t), simpan(LANGGANAN_KEY, l)]);
    setTenant(t);
    setLangganan(l);
  };

  const gantiCompany = async () => {
    await setServerAddress("", "");
    await Promise.all([simpan(TENANT_KEY, null), simpan(LANGGANAN_KEY, null)]);
    setTenant(null);
    setLangganan(null);
  };

  const segarkan = async () => {
    if (!tenant) return;
    try {
      const t = await cariDiRegistry(tenant.kode);
      await setServerAddress(t.baseUrl, t.site);
      const l = await ambilLangganan();
      await Promise.all([simpan(TENANT_KEY, t), simpan(LANGGANAN_KEY, l)]);
      setTenant(t);
      setLangganan(l);
    } catch (e) {
      // Kode dicabut dari registry: kembali ke layar kode. Gagal jaringan: pakai data terakhir.
      if (e instanceof ApiError && e.excType === "UnknownCompany")
        await gantiCompany();
    }
  };

  return (
    <TenantContext.Provider
      value={{
        tenant,
        langganan,
        isReady,
        pilihCompany,
        segarkan,
        gantiCompany,
        // Belum tahu paketnya (mis. data lama): jangan sembunyikan apa pun, server tetap menolak yang di luar paket.
        punyaFitur: (f) => !langganan || langganan.fitur.includes(f),
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}
