const IGNORED_KEY = /(^id$|Id$|url$|Url$|uri$|Uri$|read$|tone$)/;

// Gabungan semua teks/angka sebuah item (tanpa id dan URL) untuk pencarian daftar.
export function searchableText(item: unknown, depth = 2): string {
  if (item === null || item === undefined) return "";
  if (typeof item === "string" || typeof item === "number") return String(item);
  if (typeof item !== "object" || depth === 0) return "";
  if (Array.isArray(item))
    return item.map((entry) => searchableText(entry, depth - 1)).join(" ");
  return Object.entries(item as Record<string, unknown>)
    .filter(([key]) => !IGNORED_KEY.test(key))
    .map(([, value]) => searchableText(value, depth - 1))
    .join(" ");
}
