import { useMemo } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { useT } from "@/i18n";

export function ListSearchBar({
  value,
  onChangeText,
  placeholder,
  inset = false,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  inset?: boolean; // true: dipasang di luar area scroll, dengan jarak samping halaman
}) {
  const c = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const bar = (
    <View style={styles.box}>
      <Ionicons name="search-outline" size={17} color={c.mutedLabel} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? t("list.cari")}
        placeholderTextColor={c.mutedLabel}
        style={styles.input}
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText("")} hitSlop={10}>
          <Ionicons name="close-circle" size={17} color={c.mutedLabel} />
        </Pressable>
      ) : null}
    </View>
  );
  return inset ? <View style={styles.inset}>{bar}</View> : bar;
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    inset: { paddingHorizontal: 18, paddingTop: 4 },
    box: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      height: 44,
      paddingHorizontal: 14,
      marginBottom: 12,
      borderRadius: 14,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.panelBorder,
    },
    input: {
      flex: 1,
      fontSize: 13,
      fontWeight: "500",
      color: c.ink,
      padding: 0,
    },
  });
