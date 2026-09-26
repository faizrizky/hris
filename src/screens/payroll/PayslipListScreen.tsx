import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import { rupiah, angka } from "@/utils/currency";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { Payslip, PayslipLine } from "@/services/types";

export function PayslipListScreen({ navigation }: any) {
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const [payslips, setPayslips] = useState<Payslip[]>([]);

  useEffect(() => {
    if (!employee) return;
    hrisApi.getPayslips(employee.id).then(setPayslips);
  }, [employee]);

  const latest = payslips[0];
  const previous = payslips.slice(1);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.getParent()?.navigate("Beranda")}
        >
          <Ionicons name="chevron-back" size={18} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Slip Gaji</Text>
        <Pressable style={styles.pdfBtn}>
          <Text style={styles.pdfText}>Unduh PDF</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {latest && (
          <>
            <View style={styles.heroShadow}>
              <LinearGradient
                colors={[colors.accent, colors.accent2]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <View style={styles.heroBlob} />

                <View style={styles.heroTop}>
                  <Text style={styles.heroLabel}>
                    Take home pay · {latest.period}
                  </Text>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusText}>{latest.status}</Text>
                  </View>
                </View>

                <Text style={styles.heroAmount}>{rupiah(latest.netPay)}</Text>
                <Text style={styles.heroSub}>
                  {latest.bankAccount} · {latest.paidAt}
                </Text>
              </LinearGradient>
            </View>

            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>Pendapatan (Earnings)</Text>
              <View style={styles.lines}>
                {latest.earnings.map((line) => (
                  <Line key={line.label} line={line} />
                ))}
                <View style={styles.divider} />
                <View style={styles.lineRow}>
                  <Text style={styles.totalLabel}>Bruto</Text>
                  <Text style={styles.totalValue}>
                    {angka(latest.grossPay)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.sheet, { marginTop: 10 }]}>
              <View style={styles.sheetHead}>
                <Text style={styles.sheetTitle}>Potongan (Deductions)</Text>
                <Text style={styles.sheetLink}>Rincian</Text>
              </View>
              <View style={styles.lines}>
                {latest.deductions.map((line) => (
                  <Line key={line.label} line={line} negative />
                ))}
                <View style={styles.divider} />
                <View style={styles.lineRow}>
                  <Text style={styles.totalLabel}>Total potongan</Text>
                  <Text style={styles.totalValue}>
                    {angka(latest.totalDeduction)}
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}

        {previous.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Slip sebelumnya</Text>
            <View style={styles.historyCard}>
              {previous.map((p, i) => (
                <Pressable
                  key={p.id}
                  onPress={() =>
                    navigation.navigate("PayslipDetail", { payslipId: p.id })
                  }
                  style={[
                    styles.historyRow,
                    i < previous.length - 1 && styles.historyDivider,
                  ]}
                >
                  <View style={styles.monthChip}>
                    <Text style={styles.monthText}>{p.monthShort}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.historyPeriod}>{p.period}</Text>
                    <Text style={styles.historyNote}>{p.note}</Text>
                  </View>
                  <Text style={styles.historyAmount}>{angka(p.netPay)}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Line({ line, negative }: { line: PayslipLine; negative?: boolean }) {
  return (
    <View style={styles.lineRow}>
      <Text style={styles.lineLabel}>{line.label}</Text>
      <Text style={[styles.lineValue, negative && styles.lineValueNeg]}>
        {negative ? "− " : ""}
        {angka(line.amount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.hair,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.ink },
  pdfBtn: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.info.bg,
  },
  pdfText: { fontSize: 11.5, fontWeight: "600", color: colors.info.ink },

  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 130 },

  heroShadow: {
    borderRadius: 22,
    shadowColor: colors.accent2,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 6,
  },
  heroCard: { borderRadius: 22, padding: 20, overflow: "hidden" },
  heroBlob: {
    position: "absolute",
    right: -50,
    bottom: -70,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  statusText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  heroAmount: {
    fontSize: 34,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -1.2,
    color: "#fff",
    marginTop: 12,
  },
  heroSub: {
    fontSize: 11.5,
    fontWeight: "500",
    color: "rgba(255,255,255,0.7)",
    marginTop: 10,
  },

  sheet: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 22,
    padding: 16,
    marginTop: 12,
    shadowColor: "#0F1720",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  sheetHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sheetTitle: { fontSize: 13.5, fontWeight: "700", color: colors.ink },
  sheetLink: { fontSize: 11.5, fontWeight: "600", color: colors.accent },

  lines: { gap: 11, marginTop: 13 },
  lineRow: { flexDirection: "row", justifyContent: "space-between" },
  lineLabel: { fontSize: 12.5, fontWeight: "500", color: colors.muted },
  lineValue: { fontSize: 12.5, fontWeight: "600", color: colors.ink },
  lineValueNeg: { color: colors.bad.ink },
  divider: { height: 1, backgroundColor: colors.hair },
  totalLabel: { fontSize: 12.5, fontWeight: "700", color: colors.ink },
  totalValue: { fontSize: 13, fontWeight: "700", color: colors.ink },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
    marginTop: 20,
    marginBottom: 10,
    marginHorizontal: 2,
  },
  historyCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 22,
    overflow: "hidden",
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  historyDivider: { borderBottomWidth: 1, borderBottomColor: colors.hair },
  monthChip: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  monthText: { fontSize: 10, fontWeight: "700", color: "#475569" },
  historyPeriod: { fontSize: 12.5, fontWeight: "600", color: colors.ink },
  historyNote: {
    fontSize: 10.5,
    fontWeight: "500",
    color: colors.muted,
    marginTop: 2,
  },
  historyAmount: { fontSize: 12, fontWeight: "700", color: colors.ink },
});
