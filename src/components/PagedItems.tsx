import { type ReactNode, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { useT } from "@/i18n";
import type { PagedState } from "@/hooks/usePagedList";
import { LoadMoreButton } from "@/components/LoadMoreButton";

// Isi daftar bertahap. Kolom cari-nya dipasang layar di luar area scroll
// (ListSearchBar inset) supaya tetap menempel di atas saat daftar digulir.
export function PagedItems<T>({
  paged,
  renderItem,
  gap = 0,
}: {
  paged: PagedState<T>;
  renderItem: (item: T, index: number) => ReactNode;
  gap?: number;
}) {
  const c = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View>
      {paged.matchedCount === 0 ? (
        <Text style={styles.noResult}>{t("list.tanpaHasil")}</Text>
      ) : (
        <View style={{ gap }}>
          {paged.visibleItems.map((item, index) => renderItem(item, index))}
        </View>
      )}
      {paged.hasMore ? (
        <LoadMoreButton
          remainingCount={paged.remainingCount}
          onPress={paged.loadMore}
        />
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    noResult: {
      textAlign: "center",
      fontSize: 12.5,
      fontWeight: "500",
      color: c.muted,
      paddingVertical: 28,
    },
  });
