import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, SemanticTone } from "@/theme/colors";

interface Props {
  label: string;
  tone: SemanticTone;
  variant: "pill" | "compact";
}

export function StatusBadge({ label, tone, variant = "pill" }: Props) {
  const { bg, ink } = colors[tone];
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

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
  },
  compact: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  compactLabel: { fontSize: 10.5, fontWeight: "700" },
});
