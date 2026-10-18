import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { LineIcon } from "@/components/LineIcon";
import { ICON } from "@/constants/icons";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { useT, translate } from "@/i18n";

export const TRANSPORT_MODES = [
  { value: "Pesawat", icon: ICON.plane },
  { value: "Kereta", icon: ICON.train },
  { value: "Mobil kantor", icon: ICON.car },
  { value: "Lainnya", icon: ICON.dots },
] as const;

export type TransportMode = (typeof TRANSPORT_MODES)[number]["value"];

export function DinasTujuanCard({
  destination,
  onChange,
}: {
  destination: string;
  onChange: (v: string) => void;
}) {
  const c = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t("fc.kotaTujuan")}</Text>
      <View style={styles.inputBox}>
        <LineIcon d={ICON.location} color={c.accent} size={17} />
        <TextInput
          style={styles.input}
          value={destination}
          onChangeText={onChange}
          placeholder={t("fc.kotaTujuan")}
          placeholderTextColor={c.mutedLabel}
        />
      </View>
    </View>
  );
}

export function DinasDetailCard({
  transport,
  onPickTransport,
  purpose,
  onChangePurpose,
}: {
  transport: TransportMode | null;
  onPickTransport: (t: TransportMode) => void;
  purpose: string;
  onChangePurpose: (v: string) => void;
}) {
  const c = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={[styles.card, { marginTop: 12 }]}>
      <Text style={styles.cardTitle}>{t("fc.transportasi")}</Text>

      <View style={styles.transGrid}>
        {TRANSPORT_MODES.map((transportMode) => {
          const isOn = transport === transportMode.value;
          return (
            <Pressable
              key={transportMode.value}
              onPress={() => onPickTransport(transportMode.value)}
              style={[styles.transCard, isOn && styles.transCardOn]}
            >
              <LineIcon
                d={transportMode.icon}
                color={isOn ? "#fff" : c.ink}
                size={20}
              />
              <Text style={[styles.transLabel, isOn && styles.transLabelOn]}>
                {translate(`tr.${transportMode.value}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>{t("fc.keperluan")}</Text>
      <TextInput
        style={styles.textarea}
        value={purpose}
        onChangeText={onChangePurpose}
        placeholder={t("fc.keperluanContoh")}
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

    inputBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 10,
      borderWidth: 1,
      borderColor: c.fieldBorder,
      borderRadius: 14,
      paddingHorizontal: 13,
    },
    input: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 12,
      fontSize: 13.5,
      fontWeight: "600",
      color: c.ink,
    },

    transGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 12,
    },
    transCard: {
      width: "48%",
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.fieldBorder,
    },
    transCardOn: { backgroundColor: c.accent, borderColor: c.accent },
    transLabel: {
      flex: 1,
      fontSize: 11.5,
      fontWeight: "700",
      color: c.ink,
    },
    transLabelOn: { color: "#fff" },

    label: {
      fontSize: 10,
      fontWeight: "600",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: c.mutedLabel,
      marginTop: 14,
    },
    textarea: {
      minHeight: 72,
      marginTop: 8,
      borderWidth: 1,
      borderColor: c.fieldBorder,
      borderRadius: 14,
      paddingHorizontal: 13,
      paddingVertical: 11,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "500",
      color: c.ink,
      textAlignVertical: "top",
    },
  });
