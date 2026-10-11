import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LineIcon } from "@/components/LineIcon";
import { ICON } from "@/constants/icons";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";

// Keadaan kosong yang seragam: ikon dalam kotak, judul, dan penjelasan,
// diletakkan di tengah area daftar.
export function EmptyState({
  icon = ICON.document,
  title,
  text,
  children,
  tinggi = 380,
}: {
  icon?: string;
  title: string;
  text?: string;
  children?: React.ReactNode; // mis. tombol aksi
  tinggi?: number; // lebih pendek bila di atasnya sudah ada kartu ringkasan
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={[styles.wrap, { minHeight: tinggi }]}>
      <View style={styles.icon}>
        <LineIcon d={icon} color={c.accent} size={26} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {text ? <Text style={styles.text}>{text}</Text> : null}
      {children}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    wrap: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
    },
    icon: {
      width: 64,
      height: 64,
      borderRadius: 22,
      backgroundColor: c.info.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontSize: 15,
      fontWeight: "700",
      color: c.ink,
      marginTop: 16,
      textAlign: "center",
    },
    text: {
      fontSize: 12,
      fontWeight: "500",
      color: c.muted,
      lineHeight: 18,
      textAlign: "center",
      marginTop: 6,
    },
  });
