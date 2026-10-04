import React, { useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { useConfirm } from "./ConfirmDialog";

// Sengaja satu komponen untuk Slip Gaji dan Detail Slip: saat unduhan asli
// dikerjakan di Fase 2, hanya file ini yang perlu diubah.
export function PdfButton() {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const confirm = useConfirm();
  const pdfRef = useRef<View>(null);

  return (
    <Pressable
      ref={pdfRef}
      style={styles.btn}
      onPress={() =>
        void confirm({
          title: "Belum tersedia",
          message:
            "Unduh PDF aktif setelah aplikasi terhubung ke ERPNext. Untuk sekarang rincian slip bisa dilihat langsung di layar.",
          tone: "info",
          confirmText: "Mengerti",
          cancelText: null,
          from: pdfRef,
          fromColor: c.chip,
          fromTextColor: c.mutedLabel,
          fromLabel: "Unduh PDF",
        })
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
