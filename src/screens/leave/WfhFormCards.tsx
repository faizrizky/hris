import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { useT } from "@/i18n";

export const HARI_WFH = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function WfhDetailCard({
  hari,
  onToggle,
  alasan,
  onChangeAlasan,
}: {
  hari: string[];
  onToggle: (d: string) => void;
  alasan: string;
  onChangeAlasan: (v: string) => void;
}) {
  const c = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={[styles.card, { marginTop: 12 }]}>
      <Text style={styles.cardTitle}>{t("fc.hariWfh")}</Text>
      <Text style={styles.desc}>{t("fc.hariWfhInfo")}</Text>
      <View style={styles.chips}>
        {HARI_WFH.map((d) => {
          const on = hari.includes(d);
          return (
            <Pressable
              key={d}
              onPress={() => onToggle(d)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {t(`hari.${d}` as never)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.cardTitle, { marginTop: 16 }]}>
        {t("fc.alasanWfh")}
      </Text>
      <TextInput
        style={styles.textarea}
        value={alasan}
        onChangeText={onChangeAlasan}
        placeholder={t("fc.alasanWfhContoh")}
        placeholderTextColor={c.mutedLabel}
        multiline
      />
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 16,
      shadowColor: "#0F1720",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 3,
    },
    cardTitle: { fontSize: 13.5, fontWeight: "700", color: c.ink },
    desc: {
      fontSize: 10.5,
      lineHeight: 16,
      fontWeight: "500",
      color: c.muted,
      marginTop: 4,
    },
    chips: { flexDirection: "row", gap: 6, marginTop: 12 },
    chip: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.fieldBorder,
    },
    chipOn: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { fontSize: 11.5, fontWeight: "700", color: c.ink },
    chipTextOn: { color: "#fff" },
    textarea: {
      marginTop: 10,
      minHeight: 72,
      borderWidth: 1,
      borderColor: c.fieldBorder,
      borderRadius: 14,
      paddingHorizontal: 13,
      paddingVertical: 10,
      fontSize: 13,
      fontWeight: "500",
      color: c.ink,
      textAlignVertical: "top",
    },
  });
