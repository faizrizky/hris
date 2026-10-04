// Lapisan HTTP tunggal untuk semua panggilan ke ERPNext.
// Auth memakai cookie `sid` yang dikelola cookie jar native (credentials: "include").

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
  method: "GET" | "POST",
  path: string,
  params?: Params,
): Promise<T> {
  if (!BASE_URL) {
    throw new ApiError("EXPO_PUBLIC_API_BASE_URL belum diisi", 0, null);
  }

  const query = method === "GET" && params ? `?${encode(params)}` : "";
  const isForm = method === "POST" && params !== undefined;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}${query}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(isForm
          ? { "Content-Type": "application/x-www-form-urlencoded" }
          : {}),
      },
      body: isForm ? encode(params) : undefined,
      credentials: "include",
      signal: controller.signal,
    });
  } catch (e) {
    const timeout = e instanceof Error && e.name === "AbortError";
    throw new ApiError(
      timeout ? "Server tidak merespons" : "Tidak bisa terhubung ke server",
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
      throw new ApiError(
        "Sesi berakhir, silakan masuk lagi",
        403,
        "SessionExpired",
      );
    }
    const excType = typeof obj.exc_type === "string" ? obj.exc_type : null;
    const message =
      typeof obj.message === "string" ? obj.message : `HTTP ${res.status}`;
    throw new ApiError(message, res.status, excType);
  }

  return body as T;
}

export const get = <T>(path: string, params?: Params) =>
  request<T>("GET", path, params);

export const post = <T>(path: string, params?: Params) =>
  request<T>("POST", path, params);

// Pesan untuk pengguna akhir (Bahasa Indonesia), dipakai di layar.
export function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.excType === "NoEmployeeLinked") {
      return "Akun ini belum terhubung ke data karyawan. Hubungi HR.";
    }
    if (e.excType === "SessionExpired") return e.message;
    if (e.excType === "RoleFetchFailed") return `${e.message}. Coba lagi.`;
    if (e.excType === "NoApprover") {
      return "Belum ada approver. Hubungi HR.";
    }
    if (e.excType === "OverlapError") {
      return "Tanggal bertabrakan dengan pengajuan cuti lain";
    }
    if (e.status === 401) return "Email atau password salah";
    if (e.status === 0) return e.message;
    const kode = __DEV__ ? ` [${e.status} ${e.excType ?? ""}]` : "";
    return `Terjadi masalah di server.${kode} Coba lagi sebentar.`;
  }
  return "Terjadi kesalahan tak terduga";
}
