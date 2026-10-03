import React, { useMemo } from "react";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";

// Sengaja satu komponen untuk Slip Gaji dan Detail Slip: saat unduhan asli
// dikerjakan di Fase 2, hanya file ini yang perlu diubah.
export function PdfButton() {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <Pressable
      style={styles.btn}
      onPress={() =>
        Alert.alert(
          "Belum tersedia",
          "Unduh PDF aktif setelah aplikasi terhubung ke ERPNext. Untuk sekarang rincian slip bisa dilihat langsung di layar.",
        )
      }
    >
      <Text style={styles.text}>Unduh PDF</Text>
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    btn: {
      paddingHorizontal: 13,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: c.chip,
    },
    text: { fontSize: 11.5, fontWeight: "600", color: c.mutedLabel },
  });
