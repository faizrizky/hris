import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LineIcon } from "@/components/LineIcon";
import { useConfirm } from "@/components/ConfirmDialog";
import { ICON } from "@/constants/icons";
import { useT } from "@/i18n";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { bukaLampiran } from "@/utils/lampiran";

// Daftar lampiran (bukti lembur/biaya) yang bisa diketuk untuk dibuka.
export function LampiranList({
  items,
}: {
  items?: { name: string; url: string }[];
}) {
  const c = useTheme();
  const t = useT();
  const confirm = useConfirm();
  const styles = useMemo(() => makeStyles(c), [c]);
  if (!items?.length) return null;

  const buka = async (x: { name: string; url: string }) => {
    try {
      if (!(await bukaLampiran(x.url, x.name))) throw new Error("unavailable");
    } catch {
      void confirm({
        title: t("lamp.gagalJudul"),
        message: t("lamp.gagalPesan"),
        tone: "warn",
        confirmText: t("umum.mengerti"),
        cancelText: null,
      });
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t("lamp.judul")}</Text>
      {items.map((x) => (
        <Pressable key={x.url} style={styles.row} onPress={() => buka(x)}>
          <LineIcon d={ICON.fileCheck} color={c.info.ink} size={14} />
          <Text style={styles.name} numberOfLines={1}>
            {x.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    wrap: { marginTop: 10, gap: 6 },
    label: { fontSize: 10, fontWeight: "700", color: c.mutedLabel },
    row: { flexDirection: "row", alignItems: "center", gap: 7 },
    name: { flex: 1, fontSize: 11.5, fontWeight: "600", color: c.info.ink },
  });
