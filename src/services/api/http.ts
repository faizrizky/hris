// Lapisan HTTP tunggal untuk semua panggilan ke ERPNext.
// Auth memakai cookie `sid` yang dikelola cookie jar native (credentials: "include").

import { tt } from "@/i18n";

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const TIMEOUT_MS = 15_000;

let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
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
function pesanServer(obj: Record<string, unknown>): string | null {
  if (typeof obj._server_messages !== "string") return null;
  try {
    const daftar = JSON.parse(obj._server_messages) as string[];
    const pertama = JSON.parse(daftar[0] ?? "{}") as { message?: string };
    const teks = (pertama.message ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return teks || null;
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
  if (!BASE_URL) {
    throw new ApiError(tt("err.noBase"), 0, null);
  }

  const query = method === "GET" && params ? `?${encode(params)}` : "";
  const isForm = method !== "GET" && params !== undefined;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}${query}`, {
      method,
      headers: {
        Accept: "application/json",
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
      timeout ? tt("err.timeout") : tt("err.network"),
      0,
      timeout ? "Timeout" : "Network",
    );
  } finally {
    clearTimeout(timer);
  }

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
      throw new ApiError(tt("err.sesiBerakhir"), 403, "SessionExpired");
    }
    const excType = typeof obj.exc_type === "string" ? obj.exc_type : null;
    // Nginx menolak file terlalu besar dengan halaman HTML, bukan JSON.
    if (res.status === 413) {
      throw new ApiError(tt("err.fileBesar"), 413, "TooLarge");
    }
    const message =
      pesanServer(obj) ??
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
export async function unduhBerkas(path: string): Promise<Uint8Array> {
  if (!BASE_URL) throw new ApiError(tt("err.noBase"), 0, null);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { credentials: "include" });
  } catch {
    throw new ApiError(tt("err.network"), 0, "Network");
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
      return tt("err.tanpaKaryawanUser");
    }
    if (e.excType === "SessionExpired") return e.message;
    if (e.excType === "RoleFetchFailed")
      return tt("err.peranCoba", { pesan: e.message });
    if (e.excType === "NoApprover") {
      return tt("err.tanpaApprover");
    }
    if (e.excType === "OverlapError") {
      return tt("err.bentrokCuti");
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
        ? tt("err.ditolakServer", { pesan: e.message })
        : tt("err.ditolak");
    }
    if (e.status === 401) return tt("err.loginSalah");
    if (e.status === 0) return e.message;
    const kode = __DEV__ ? ` [${e.status} ${e.excType ?? ""}]` : "";
    return tt("err.server", { kode });
  }
  return tt("err.takTerduga");
}
