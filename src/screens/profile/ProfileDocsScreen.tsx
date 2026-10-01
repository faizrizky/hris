import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { DocCategory, EmployeeDocument } from "@/services/types";
import { Skeleton } from "@/components/Skeleton";
import {
  DOC_CATEGORY_LABEL,
  DOC_STATUS_LABEL,
  DOC_STATUS_TONE,
} from "@/constants/statusLabels";

const SEMUA = "semua";
const KATEGORI: DocCategory[] = ["kontrak", "sk", "sertifikat", "identitas"];
const TAB: (DocCategory | typeof SEMUA)[] = [SEMUA, ...KATEGORI];

export function ProfileDocsScreen({ navigation }: any) {
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [docs, setDocs] = useState<EmployeeDocument[] | null>(null);
  const [tab, setTab] = useState<DocCategory | typeof SEMUA>(SEMUA);

  const muat = useCallback(() => {
    if (!employee) return;
    hrisApi.getDocuments(employee.id).then(setDocs);
  }, [employee]);

  useFocusEffect(muat);

  const items = docs ?? [];
  const loading = docs === null;

  const terverifikasi = items.filter((d) => d.status === "verified").length;
  const perluTindakan = items.length - terverifikasi;

  const hitung = (k: DocCategory | typeof SEMUA) =>
    k === SEMUA ? items.length : items.filter((d) => d.category === k).length;

  const tersaring = items.filter((d) => tab === SEMUA || d.category === tab);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Dokumen Digital</Text>
        <Pressable
          style={styles.uploadBtn}
          onPress={() => navigation.navigate("ProfileUpload")}
        >
          <Text style={styles.uploadText}>Unggah</Text>
        </Pressable>
      </View>

      <View style={styles.heroWrap}>
        <LinearGradient
          colors={[c.accent, c.accent2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroBlob} />
          <View>
            <Text style={styles.heroLabel}>Total dokumen</Text>
            <Text style={styles.heroTotal}>{loading ? "–" : items.length}</Text>
          </View>
          <View style={styles.heroPills}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>
                {loading ? "–" : terverifikasi} terverifikasi
              </Text>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>
                {loading ? "–" : perluTindakan} perlu tindakan
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 0, marginBottom: 12 }}
        contentContainerStyle={styles.chipRow}
      >
        {TAB.map((k) => {
          const on = tab === k;
          const label = k === SEMUA ? "Semua" : DOC_CATEGORY_LABEL[k];
          return (
            <Pressable
              key={k}
              onPress={() => setTab(k)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {label} ({hitung(k)})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.list}>
        {loading ? (
          <View style={{ gap: 10 }}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.row}>
                <Skeleton width={42} height={42} radius={13} />
                <View style={{ flex: 1, gap: 7 }}>
                  <Skeleton width="70%" height={12} radius={4} />
                  <Skeleton width="45%" height={10} radius={4} />
                </View>
              </View>
            ))}
          </View>
        ) : tersaring.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Belum ada dokumen</Text>
            <Text style={styles.emptyText}>
              Unggah dokumen pada kategori ini agar bisa diverifikasi HR.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {tersaring.map((d) => {
              const tone = c[DOC_STATUS_TONE[d.status]];
              const pdf = d.ext === "PDF";
              return (
                <View key={d.id} style={styles.row}>
                  <View
                    style={[
                      styles.extChip,
                      { backgroundColor: pdf ? c.bad.bg : c.info.bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.extText,
                        { color: pdf ? c.bad.ink : c.info.ink },
                      ]}
                    >
                      {d.ext}
                    </Text>
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.docName}>{d.name}</Text>
                    <Text style={styles.docMeta}>
                      {d.sizeLabel} · {d.dateLabel}
                    </Text>
                    <View
                      style={[styles.statusBadge, { backgroundColor: tone.bg }]}
                    >
                      <Text style={[styles.statusText, { color: tone.ink }]}>
                        {DOC_STATUS_LABEL[d.status]}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },

    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 20,
      paddingBottom: 16,
      backgroundColor: c.card,
      borderBottomWidth: 1,
      borderBottomColor: c.hair,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: c.chip,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: c.ink },
    uploadBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: c.accent,
    },
    uploadText: { fontSize: 11.5, fontWeight: "600", color: "#fff" },

    heroWrap: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12 },
    hero: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      borderRadius: 22,
      paddingHorizontal: 18,
      paddingVertical: 16,
      overflow: "hidden",
    },
    heroBlob: {
      position: "absolute",
      right: -40,
      bottom: -60,
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: "rgba(255,255,255,0.09)",
    },
    heroLabel: {
      fontSize: 11.5,
      fontWeight: "600",
      color: "rgba(255,255,255,0.85)",
    },
    heroTotal: {
      fontSize: 34,
      lineHeight: 36,
      fontWeight: "800",
      letterSpacing: -1.2,
      color: "#fff",
      marginTop: 7,
    },
    heroPills: { flex: 1, gap: 6 },
    heroPill: {
      backgroundColor: "rgba(255,255,255,0.16)",
      borderRadius: 11,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    heroPillText: { fontSize: 11, fontWeight: "600", color: "#fff" },

    chipRow: { paddingHorizontal: 18, gap: 7, alignItems: "center" },
    chip: {
      paddingHorizontal: 13,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.panelBorder,
    },
    chipOn: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { fontSize: 11.5, fontWeight: "600", color: c.muted },
    chipTextOn: { color: "#fff" },

    list: { paddingHorizontal: 18, paddingBottom: 130 },

    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: 18,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.panelBorder,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    extChip: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
    },
    extText: { fontSize: 10.5, fontWeight: "700" },
    docName: {
      fontSize: 12.5,
      lineHeight: 17,
      fontWeight: "600",
      color: c.ink,
    },
    docMeta: {
      fontSize: 10.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 4,
    },
    statusBadge: {
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 7,
      marginTop: 7,
    },
    statusText: { fontSize: 9.5, fontWeight: "700" },

    emptyCard: {
      alignItems: "center",
      borderRadius: 22,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.panelBorder,
      paddingVertical: 32,
      paddingHorizontal: 24,
    },
    emptyTitle: { fontSize: 13.5, fontWeight: "700", color: c.ink },
    emptyText: {
      fontSize: 11.5,
      fontWeight: "500",
      color: c.muted,
      lineHeight: 17,
      textAlign: "center",
      marginTop: 6,
    },
  });
