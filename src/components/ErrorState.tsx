import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { useT } from "@/i18n";

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const t = useT();
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{t("err.gagalMemuat")}</Text>
      <Text style={styles.content}>{message}</Text>
      <Pressable style={styles.btn} onPress={onRetry}>
        <Text style={styles.btnText}>{t("err.cobaLagi")}</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    box: {
      backgroundColor: c.bad.bg,
      borderRadius: 20,
      padding: 18,
      marginHorizontal: 2,
    },
    title: { fontSize: 14, fontWeight: "800", color: c.bad.ink },
    content: { fontSize: 12.5, lineHeight: 19, color: c.bad.ink, marginTop: 4 },
    btn: {
      alignSelf: "flex-start",
      marginTop: 12,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: c.bad.ink,
    },
    btnText: { fontSize: 12.5, fontWeight: "700", color: "#fff" },
  });
