import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "@/theme/ThemeContext";
import { tombolSekunder, tombolUtama } from "@/theme/colors";

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: "primary" | "danger" | "outline";
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  variant = "primary",
}: Props) {
  const c = useTheme();
  const bg =
    variant === "primary"
      ? c.accent
      : variant === "danger"
        ? c.bad.ink
        : c.card;
  const textColor = variant === "outline" ? c.accent : "#fff";

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={[
        styles.button,
        variant === "outline"
          ? { ...tombolSekunder(c), borderColor: c.accent }
          : { ...tombolUtama(c), backgroundColor: bg },
        variant === "danger" && { shadowColor: c.bad.ink },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 15, fontWeight: "600" },
});
