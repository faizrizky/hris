import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { angka, rupiah } from "@/utils/currency";
import { Payslip, PayslipLine } from "@/services/types";

/* ---------- Hero take-home ---------- */

export function PayslipHero({
  payslip,
  label = "Take home pay",
}: {
  payslip: Payslip;
  label?: string;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.heroShadow}>
      <LinearGradient
        colors={[c.accent, c.accent2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroBlob} />

        <View style={styles.heroTop}>
          <Text style={styles.heroLabel}>
            {label} · {payslip.period}
          </Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{payslip.status}</Text>
          </View>
        </View>

        <Text style={styles.heroAmount}>{rupiah(payslip.netPay)}</Text>
        <Text style={styles.heroSub}>
          {payslip.bankAccount} · {payslip.paidAt}
        </Text>
      </LinearGradient>
    </View>
  );
}

/* ---------- Kartu rincian baris (earnings / deductions) ---------- */

function Line({ line, negative }: { line: PayslipLine; negative?: boolean }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

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

export function PayslipLinesCard({
  title,
  lines,
  totalLabel,
  total,
  negative,
  linkLabel,
  onLink,
  tight,
}: {
  title: string;
  lines: PayslipLine[];
  totalLabel: string;
  total: number;
  negative?: boolean;
  linkLabel?: string;
  onLink?: () => void;
  tight?: boolean;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={[styles.sheet, { marginTop: tight ? 10 : 12 }]}>
      <View style={styles.sheetHead}>
        <Text style={styles.sheetTitle}>{title}</Text>
        {linkLabel && (
          <Pressable onPress={onLink} hitSlop={8}>
            <Text style={styles.sheetLink}>{linkLabel}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.lines}>
        {lines.map((line) => (
          <Line key={line.label} line={line} negative={negative} />
        ))}
        <View style={styles.divider} />
        <View style={styles.lineRow}>
          <Text style={styles.totalLabel}>{totalLabel}</Text>
          <Text style={styles.totalValue}>{angka(total)}</Text>
        </View>
      </View>
    </View>
  );
}

/* ---------- Informasi slip ---------- */

export function PayslipInfoCard({ payslip }: { payslip: Payslip }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const rows = [
    { k: "Periode", v: payslip.period },
    { k: "Keterangan", v: payslip.note },
    { k: "Status", v: payslip.status },
    { k: "Rekening", v: payslip.bankAccount },
    { k: "Tanggal bayar", v: payslip.paidAt },
  ];

  return (
    <View style={[styles.sheet, { marginTop: 10 }]}>
      <Text style={styles.sheetTitle}>Informasi slip</Text>
      <View style={styles.lines}>
        {rows.map((r) => (
          <View key={r.k} style={styles.lineRow}>
            <Text style={styles.lineLabel}>{r.k}</Text>
            <Text style={styles.infoValue}>{r.v}</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <Text style={styles.syncLabel}>Tersinkron ke ERPNext</Text>
        <Text style={styles.syncValue}>
          Salary Slip · {payslip.id.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

/* ---------- Perbandingan dengan slip sebelumnya ---------- */

export function PayslipCompareCard({
  current,
  previous,
}: {
  current: Payslip;
  previous: Payslip;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const delta = current.netPay - previous.netPay;
  const naik = delta >= 0;
  const persen =
    previous.netPay === 0 ? 0 : Math.abs(delta / previous.netPay) * 100;

  return (
    <View style={[styles.sheet, { marginTop: 10 }]}>
      <Text style={styles.sheetTitle}>Dibanding {previous.period}</Text>

      <View style={styles.compareRow}>
        <View
          style={[styles.arrow, { backgroundColor: naik ? c.ok.bg : c.bad.bg }]}
        >
          <Ionicons
            name={naik ? "arrow-up" : "arrow-down"}
            size={16}
            color={naik ? c.ok.ink : c.bad.ink}
          />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[
              styles.compareValue,
              { color: naik ? c.ok.ink : c.bad.ink },
            ]}
          >
            {delta === 0 ? "" : naik ? "+ " : "− "}
            {rupiah(Math.abs(delta))}
          </Text>
          <Text style={styles.compareNote}>
            {delta === 0
              ? "Take home pay sama dengan bulan sebelumnya"
              : `${persen.toFixed(1)}% ${naik ? "lebih tinggi" : "lebih rendah"} · ${previous.note}`}
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ---------- Daftar slip sebelumnya ---------- */

// Barisnya sengaja tidak bisa ditekan: layar Detail Slip dihapus karena tidak
// ada di mockup, dan di mockup pun baris riwayat ini memang tidak punya tujuan.
export function PayslipHistoryCard({ items }: { items: Payslip[] }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.historyCard}>
      {items.map((p, i) => (
        <View
          key={p.id}
          style={[
            styles.historyRow,
            i < items.length - 1 && styles.historyDivider,
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
        </View>
      ))}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    heroShadow: {
      borderRadius: 22,
      shadowColor: c.accent2,
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
      backgroundColor: c.onDark.surface,
    },
    heroTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    heroLabel: {
      flex: 1,
      fontSize: 12,
      fontWeight: "600",
      color: c.onDark.ink,
    },
    statusPill: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: c.onDark.pill,
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
      color: c.onDark.soft,
      marginTop: 10,
    },

    sheet: {
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
    sheetHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    sheetTitle: { fontSize: 13.5, fontWeight: "700", color: c.ink },
    sheetLink: { fontSize: 11.5, fontWeight: "600", color: c.accent },

    lines: { gap: 11, marginTop: 13 },
    lineRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
    },
    lineLabel: { fontSize: 12.5, fontWeight: "500", color: c.muted },
    lineValue: { fontSize: 12.5, fontWeight: "600", color: c.ink },
    lineValueNeg: { color: c.bad.ink },
    infoValue: {
      flexShrink: 1,
      fontSize: 12.5,
      fontWeight: "600",
      color: c.ink,
      textAlign: "right",
    },
    divider: { height: 1, backgroundColor: c.hair },
    totalLabel: { fontSize: 12.5, fontWeight: "700", color: c.ink },
    totalValue: { fontSize: 13, fontWeight: "700", color: c.ink },

    syncLabel: {
      fontSize: 10,
      fontWeight: "600",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: c.mutedLabel,
    },
    syncValue: { fontSize: 11, fontWeight: "700", color: c.accent },

    compareRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 13,
    },
    arrow: {
      width: 38,
      height: 38,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
    },
    compareValue: { fontSize: 16, fontWeight: "800" },
    compareNote: {
      fontSize: 10.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 3,
    },

    historyCard: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
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
    historyDivider: { borderBottomWidth: 1, borderBottomColor: c.hair },
    monthChip: {
      width: 34,
      height: 34,
      borderRadius: 11,
      backgroundColor: c.chip,
      alignItems: "center",
      justifyContent: "center",
    },
    monthText: { fontSize: 10, fontWeight: "700", color: c.muted },
    historyPeriod: { fontSize: 12.5, fontWeight: "600", color: c.ink },
    historyNote: {
      fontSize: 10.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 2,
    },
    historyAmount: { fontSize: 12, fontWeight: "700", color: c.ink },
  });
