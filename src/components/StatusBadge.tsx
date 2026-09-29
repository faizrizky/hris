import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Palette, SemanticTone } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";

interface Props {
  label: string;
  tone: SemanticTone;
  variant?: "pill" | "compact";
}

export function StatusBadge({ label, tone, variant = "pill" }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { bg, ink } = c[tone];

  return (
    <View
      style={[
        styles.badge,
        variant === "compact" && styles.compact,
        { backgroundColor: bg },
      ]}
    >
      <Text
        style={[
          styles.label,
          variant === "pill" && styles.compactLabel,
          { color: ink },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const makeStyles = (_c: Palette) =>
  StyleSheet.create({
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      alignSelf: "flex-start",
    },
    compact: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
    label: { fontSize: 11, fontWeight: "700" },
    compactLabel: { fontSize: 10 },
  });
