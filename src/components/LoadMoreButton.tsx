import { useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { useT } from "@/i18n";

// Muncul di ujung daftar bila masih ada baris yang belum ditampilkan.
export function LoadMoreButton({
  remainingCount,
  onPress,
}: {
  remainingCount: number;
  onPress: () => void;
}) {
  const c = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.text}>
        {t("list.muatLagi", { n: remainingCount })}
      </Text>
      <Ionicons name="chevron-down" size={15} color={c.accent} />
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    button: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      height: 44,
      marginTop: 4,
      marginBottom: 10,
      borderRadius: 14,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.panelBorder,
    },
    text: { fontSize: 12.5, fontWeight: "700", color: c.accent },
  });
