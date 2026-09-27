import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";

export interface ApprovalStep {
  ini: string;
  name: string;
  role: string;
}

export function ApprovalFlowCard({ steps }: { steps: ApprovalStep[] }) {
  return (
    <View style={[styles.card, { marginTop: 12 }]}>
      <Text style={styles.cardTitle}>Alur approval</Text>

      <View style={{ marginTop: 14 }}>
        {steps.map((s, i) => (
          <View key={s.ini} style={styles.stepRow}>
            <View style={styles.rail}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{s.ini}</Text>
              </View>
              {i < steps.length - 1 && <View style={styles.line} />}
            </View>

            <View style={styles.stepBody}>
              <Text style={styles.stepName}>{s.name}</Text>
              <Text style={styles.stepRole}>
                Tahap {i + 1} · {s.role}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function FormDoneView({
  title,
  waitingOn,
  rows,
  doc,
  onLihat,
  onHome,
}: {
  title: string;
  waitingOn: string;
  rows: { k: string; v: string }[];
  doc: string;
  onLihat: () => void;
  onHome: () => void;
}) {
  return (
    <>
      <LinearGradient
        colors={[colors.accent, colors.accent2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.doneCard}
      >
        <View style={styles.doneCheck}>
          <Ionicons name="checkmark" size={30} color="#fff" />
        </View>
        <Text style={styles.doneTitle}>{title}</Text>
        <Text style={styles.doneSub}>Menunggu approval {waitingOn}</Text>
      </LinearGradient>

      <View style={[styles.card, { marginTop: 12 }]}>
        <View style={{ gap: 11 }}>
          {rows.map((r) => (
            <View key={r.k} style={styles.detailRow}>
              <Text style={styles.detailKey}>{r.k}</Text>
              <Text style={styles.detailValue}>{r.v}</Text>
            </View>
          ))}
        </View>

        <View style={styles.divider} />
        <Text style={styles.syncLabel}>Tersinkron ke ERPNext</Text>
        <Text style={styles.syncValue}>{doc}</Text>
      </View>

      <View style={styles.doneActions}>
        <Pressable style={styles.secondaryBtn} onPress={onLihat}>
          <Text style={styles.secondaryText}>Lihat pengajuan</Text>
        </Pressable>
        <Pressable style={styles.primaryBtn} onPress={onHome}>
          <Text style={styles.primaryText}>Kembali ke Beranda</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 22,
    padding: 16,
    shadowColor: "#0F1720",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  cardTitle: { fontSize: 13.5, fontWeight: "700", color: colors.ink },

  stepRow: { flexDirection: "row", gap: 12 },
  rail: { alignItems: "center" },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.info.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 11, fontWeight: "700", color: colors.info.ink },
  line: {
    width: 2,
    flex: 1,
    minHeight: 14,
    marginVertical: 4,
    backgroundColor: colors.hair,
  },
  stepBody: { flex: 1, minWidth: 0, paddingTop: 5, paddingBottom: 14 },
  stepName: { fontSize: 12.5, fontWeight: "600", color: colors.ink },
  stepRole: {
    fontSize: 10.5,
    fontWeight: "500",
    color: colors.muted,
    marginTop: 3,
  },

  doneCard: {
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 26,
    alignItems: "center",
  },
  doneCheck: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  doneTitle: { fontSize: 19, fontWeight: "800", color: "#fff", marginTop: 14 },
  doneSub: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "rgba(255,255,255,0.82)",
    marginTop: 5,
  },

  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  detailKey: { fontSize: 12.5, fontWeight: "500", color: colors.muted },
  detailValue: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "right",
  },
  divider: { height: 1, backgroundColor: colors.hair, marginVertical: 13 },
  syncLabel: { fontSize: 11, fontWeight: "600", color: colors.muted },
  syncValue: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.info.ink,
    marginTop: 5,
  },

  doneActions: { flexDirection: "row", gap: 9, marginTop: 12 },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: colors.chip,
    alignItems: "center",
  },
  secondaryText: { fontSize: 12.5, fontWeight: "700", color: colors.ink },
  primaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: "center",
  },
  primaryText: { fontSize: 12.5, fontWeight: "700", color: "#fff" },
});
