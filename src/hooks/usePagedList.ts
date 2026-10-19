import { useState } from "react";

export const LIST_PAGE_SIZE = 5;

// Daftar bertahap: tampil 5 baris, tombol "Muat lagi" menambah 5 baris, dan
// pencarian menyaring seluruh item (bukan hanya yang sudah tampil).
export function usePagedList<T>(
  items: T[],
  getSearchText: (item: T) => string,
  pageSize: number = LIST_PAGE_SIZE,
) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(pageSize);

  // Daftar paling banyak ratusan baris, jadi disaring langsung saat render.
  const keyword = query.trim().toLowerCase();
  const matched = keyword
    ? items.filter((item) =>
        getSearchText(item).toLowerCase().includes(keyword),
      )
    : items;

  const changeQuery = (next: string) => {
    setQuery(next);
    setVisibleCount(pageSize);
  };

  return {
    visibleItems: matched.slice(0, visibleCount),
    query,
    changeQuery,
    hasMore: matched.length > visibleCount,
    remainingCount: Math.max(0, matched.length - visibleCount),
    loadMore: () => setVisibleCount((count) => count + pageSize),
    matchedCount: matched.length,
    isSearching: query.trim().length > 0,
  };
}

export type PagedState<T> = ReturnType<typeof usePagedList<T>>;
