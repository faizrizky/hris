import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Palette, secondaryButtonStyle } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";

// Ikon di kotak putih berbingkai tipis, seragam di Beranda dan Profil.
export function IconBox({
  icon,
  color,
  size = 40,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  size?: number;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <Ionicons name={icon} size={Math.round(size * 0.55)} color={color} />
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    box: {
      ...secondaryButtonStyle(c),
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
  });
