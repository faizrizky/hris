import { type ReactNode, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { useT } from "@/i18n";
import { searchableText } from "@/utils/searchText";
import { usePagedList } from "@/hooks/usePagedList";
import { ListSearchBar } from "@/components/ListSearchBar";
import { LoadMoreButton } from "@/components/LoadMoreButton";

// Daftar dengan pencarian di atas dan "Muat lagi" di ujung (5 baris per halaman).
export function PagedList<T>({
  items,
  getSearchText = searchableText,
  renderItem,
  hideSearch = false,
  gap = 0,
}: {
  items: T[];
  getSearchText?: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  hideSearch?: boolean;
  gap?: number;
}) {
  const c = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const paged = usePagedList(items, getSearchText);

  return (
    <View>
      {hideSearch ? null : (
        <ListSearchBar value={paged.query} onChangeText={paged.changeQuery} />
      )}
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
