// Lapisan HTTP tunggal untuk semua panggilan ke ERPNext.
// Auth memakai cookie `sid` yang dikelola cookie jar native (credentials: "include").

import { translate } from "@/i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { recordServerContact } from "@/services/trustedTime";

// Alamat server bawaan dari build; diganti alamat site company hasil kode company
// (lihat services/tenant.ts), disimpan di HP.
export const DEFAULT_SERVER_ADDRESS =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "";
const ADDRESS_STORAGE_KEY = "hris.serverUrl";
const SITE_STORAGE_KEY = "hris.site";
let BASE_URL = DEFAULT_SERVER_ADDRESS;
// Satu server melayani banyak site (satu per company); header ini memilih site-nya.
let SITE = "";
const addressReady = Promise.all([
  AsyncStorage.getItem(ADDRESS_STORAGE_KEY).then((v) => {
    if (v) BASE_URL = v;
  }),
  AsyncStorage.getItem(SITE_STORAGE_KEY).then((v) => {
    if (v) SITE = v;
  }),
]).catch(() => {});

export function siteHeaders(): Record<string, string> {
  return SITE ? { "X-Frappe-Site-Name": SITE } : {};
}

// Alamat server siap dipakai setelah alamat tersimpan (jika ada) selesai dibaca.
export async function loadServerAddress(): Promise<string> {
  await addressReady;
  return BASE_URL;
}

export function getServerAddress(): string {
  return BASE_URL;
}

// Kosong = kembali ke alamat bawaan build. Mengembalikan alamat yang dipakai.
export async function setServerAddress(
  input: string,
  site = "",
): Promise<string> {
  let url = input.trim().replace(/\/+$/, "");
  if (url && !/^https?:\/\//i.test(url)) url = `http://${url}`;
  BASE_URL = url || DEFAULT_SERVER_ADDRESS;
  SITE = site;
  try {
    if (url) await AsyncStorage.setItem(ADDRESS_STORAGE_KEY, url);
    else await AsyncStorage.removeItem(ADDRESS_STORAGE_KEY);
    if (site) await AsyncStorage.setItem(SITE_STORAGE_KEY, site);
    else await AsyncStorage.removeItem(SITE_STORAGE_KEY);
  } catch {
    // penyimpanan gagal: alamat tetap dipakai selama aplikasi terbuka
  }
  return BASE_URL;
}
const REQUEST_TIMEOUT_MS = 15_000;

let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

// Site company dikunci server karena langganannya tidak aktif (HTTP 402, lihat hris_ats.subscription).
let onSubscriptionInactive: (() => void) | null = null;
export function setSubscriptionInactiveHandler(handler: (() => void) | null) {
  onSubscriptionInactive = handler;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number, // 0 = request tidak sampai ke server
    readonly excType: string | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Frappe menaruh alasan penolakan di `_server_messages` (JSON berlapis, bisa berisi HTML).
function serverMessage(obj: Record<string, unknown>): string | null {
  if (typeof obj._server_messages !== "string") return null;
  try {
    const list = JSON.parse(obj._server_messages) as string[];
    // Frappe bisa mengirim beberapa pesan (peringatan lalu galat). Pakai yang
    // memicu galat; bila tidak ada, yang terakhir.
    const all = list.map(
      (m) => JSON.parse(m) as { message?: string; raise_exception?: number },
    );
    const first =
      all.find((m) => m.raise_exception) ?? all[all.length - 1] ?? {};
    const text = (first.message ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text || null;
  } catch {
    return null;
  }
}

type Params = Record<string, string | number | boolean | object | undefined>;

function encode(params: Params): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    const text =
      typeof value === "object" ? JSON.stringify(value) : String(value);
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(text)}`);
  }
  return parts.join("&");
}

async function request<T>(
  method: "GET" | "POST" | "PUT",
  path: string,
  params?: Params,
  formData?: FormData,
): Promise<T> {
  await addressReady;
  if (!BASE_URL) {
    throw new ApiError(translate("err.noBase"), 0, null);
  }

  const query = method === "GET" && params ? `?${encode(params)}` : "";
  const isForm = method !== "GET" && params !== undefined;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}${query}`, {
      method,
      headers: {
        Accept: "application/json",
        ...siteHeaders(),
        // Untuk multipart, Content-Type (beserta boundary) diisi runtime.
        ...(isForm
          ? { "Content-Type": "application/x-www-form-urlencoded" }
          : {}),
      },
      body: formData ?? (isForm ? encode(params) : undefined),
      credentials: "include",
      signal: controller.signal,
    });
  } catch (e) {
    const timeout = e instanceof Error && e.name === "AbortError";
    throw new ApiError(
      timeout ? translate("err.timeout") : translate("err.network"),
      0,
      timeout ? "Timeout" : "Network",
    );
  } finally {
    clearTimeout(timer);
  }

  // Setiap kontak berhasil memperbarui jangkar jam terpercaya (lihat trustedTime.ts).
  if (res.ok) recordServerContact(res.headers.get("date"));

  // Frappe selalu membalas JSON, tapi jangan percaya buta (mis. halaman 502 dari nginx).
  let body: unknown = null;
  try {
    body = JSON.parse(await res.text());
  } catch {
    body = null;
  }
  const obj = (body ?? {}) as Record<string, unknown>;

  if (!res.ok) {
    if (res.status === 403 && obj.session_expired === 1) {
      onSessionExpired?.();
      throw new ApiError(translate("err.sesiBerakhir"), 403, "SessionExpired");
    }
    const excType = typeof obj.exc_type === "string" ? obj.exc_type : null;
    if (res.status === 402 || excType === "SubscriptionInactive") {
      onSubscriptionInactive?.();
      throw new ApiError(
        translate("err.langgananNonaktif"),
        402,
        "SubscriptionInactive",
      );
    }
    // Nginx menolak file terlalu besar dengan halaman HTML, bukan JSON.
    if (res.status === 413) {
      throw new ApiError(translate("err.fileBesar"), 413, "TooLarge");
    }
    const message =
      serverMessage(obj) ??
      (typeof obj.message === "string" ? obj.message : `HTTP ${res.status}`);
    throw new ApiError(message, res.status, excType);
  }

  return body as T;
}

export const get = <T>(path: string, params?: Params) =>
  request<T>("GET", path, params);

export const post = <T>(path: string, params?: Params) =>
  request<T>("POST", path, params);

// Unggah multipart (mis. upload_file); form tidak boleh ikut dikodekan sebagai urlencoded.
export const upload = <T>(path: string, form: FormData) =>
  request<T>("POST", path, undefined, form);

// Mengunduh berkas privat dengan sesi aplikasi (cookie yang sama dengan panggilan API).
export async function downloadFile(path: string): Promise<Uint8Array> {
  await addressReady;
  if (!BASE_URL) throw new ApiError(translate("err.noBase"), 0, null);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      credentials: "include",
      headers: siteHeaders(),
    });
  } catch {
    throw new ApiError(translate("err.network"), 0, "Network");
  }
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status, null);
  return new Uint8Array(await res.arrayBuffer());
}

export const put = <T>(path: string, params?: Params) =>
  request<T>("PUT", path, params);

// Pesan untuk pengguna akhir (Bahasa Indonesia), dipakai di layar.
export function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.excType === "NoEmployeeLinked") {
      return translate("err.tanpaKaryawanUser");
    }
    if (e.excType === "SessionExpired") return e.message;
    if (e.excType === "RoleFetchFailed")
      return translate("err.peranCoba", { pesan: e.message });
    if (e.excType === "NoApprover") {
      return translate("err.tanpaApprover");
    }
    if (e.excType === "OverlapError") {
      return translate("err.bentrokCuti");
    }
    if (e.excType === "UnknownCompany" || e.excType === "RateLimited") {
      return e.message;
    }
    if (e.excType === "TooLarge" || e.excType === "NoAppraisal") {
      return e.message;
    }
    if (e.excType === "WrongPassword" || e.excType === "WeakPassword") {
      return e.message;
    }
    if (e.status === 417) {
      // Alasan asli dari server (bahasa Inggris) lebih berguna daripada pesan umum.
      return e.message && !e.message.startsWith("HTTP ")
        ? translate("err.ditolakServer", { pesan: e.message })
        : translate("err.ditolak");
    }
    if (e.status === 401) return translate("err.loginSalah");
    if (e.status === 0) return e.message;
    const code = __DEV__ ? ` [${e.status} ${e.excType ?? ""}]` : "";
    return translate("err.server", { kode: code });
  }
  return translate("err.takTerduga");
}
