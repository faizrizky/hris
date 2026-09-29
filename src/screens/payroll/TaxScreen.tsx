import { useEffect, useState, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { BpjsItem, TaxSummary } from "@/services/types";
import { angka, rupiah } from "@/utils/currency";

/** 3.7 -> "3,7" · 2 -> "2" */
function persen(n: number) {
  return String(n).replace(".", ",");
}

export function TaxScreen({ navigation }: any) {
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const [tax, setTax] = useState<TaxSummary | null>(null);
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  useEffect(() => {
    if (!employee) return;
    hrisApi.getTaxSummary(employee.id).then(setTax);
  }, [employee]);

  const head = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={18} color={c.ink} />
      </Pressable>
      <Text style={styles.headerTitle}>PPh 21 & BPJS</Text>
    </View>
  );

  if (!tax) {
    return (
      <View style={styles.container}>
        {head}
        <Text style={styles.state}>Memuat data pajak…</Text>
      </View>
    );
  }

  // YTD dan bulan puncak sama-sama diturunkan dari monthly, jadi tidak
  // mungkin melenceng dari bar yang digambar di bawahnya.
  const ytd = tax.monthly.reduce((a, m) => a + m.amount, 0);
  const maks = Math.max(...tax.monthly.map((m) => m.amount), 1);
  const puncak = tax.monthly.find((m) => m.amount === maks);
  const pertama = tax.monthly[0]?.monthShort ?? "";
  const terakhir = tax.monthly[tax.monthly.length - 1]?.monthShort ?? "";

  const dasar = [
    { k: "Penghasilan bruto", v: angka(tax.grossPay) },
    { k: "Kategori TER", v: tax.terCategory },
    { k: "Status PTKP", v: tax.ptkpStatus },
    { k: "NPWP", v: tax.npwpMasked },
  ];

  return (
    <View style={styles.container}>
      {head}

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.darkCard}>
          <View style={styles.darkHead}>
            <Text style={styles.darkLabel}>
              PPh 21 terpotong {tax.year} (YTD)
            </Text>
            <View style={styles.schemePill}>
              <Text style={styles.schemeText}>{tax.scheme}</Text>
            </View>
          </View>

          <Text style={styles.darkAmount}>{rupiah(ytd)}</Text>

          <View style={styles.chart}>
            {tax.monthly.map((m) => {
              const tinggi = (m.amount / maks) * 100;
              const on = m.amount === maks;
              return (
                <View
                  key={m.monthShort}
                  style={[
                    styles.bar,
                    {
                      height: `${tinggi}%`,
                      backgroundColor: on ? c.accent : "rgba(36,144,239,0.45)",
                    },
                  ]}
                />
              );
            })}
          </View>

          <Text style={styles.chartNote}>
            {pertama} — {terakhir}
            {puncak ? ` · puncak ${puncak.monthShort} (${tax.peakReason})` : ""}
          </Text>
        </View>

        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>
            Dasar perhitungan {tax.basePeriod}
          </Text>
          <View style={styles.lines}>
            {dasar.map((r) => (
              <View key={r.k} style={styles.lineRow}>
                <Text style={styles.lineLabel}>{r.k}</Text>
                <Text style={styles.lineValue}>{r.v}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.lineRow}>
              <Text style={styles.totalLabel}>PPh 21 bulan ini</Text>
              <Text style={styles.totalValue}>{angka(tax.monthTax)}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.sheet, { marginTop: 10 }]}>
          <Text style={styles.sheetTitle}>Iuran BPJS</Text>
          <Text style={styles.sheetDesc}>
            Porsi karyawan dan perusahaan per bulan
          </Text>

          <View style={{ gap: 12, marginTop: 14 }}>
            {tax.bpjs.map((b) => (
              <BpjsRow key={b.label} item={b} />
            ))}

            <View style={styles.legend}>
              <LegendDot color={c.accent} label="Karyawan" />
              <LegendDot color={c.info.bg} label="Perusahaan" />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function BpjsRow({ item }: { item: BpjsItem }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const total = item.employeePct + item.companyPct;
  const porsi = total === 0 ? 0 : (item.employeePct / total) * 100;

  return (
    <View>
      <View style={styles.bpjsHead}>
        <Text style={styles.bpjsLabel}>{item.label}</Text>
        <Text style={styles.bpjsPct}>
          {persen(item.employeePct)}% / {persen(item.companyPct)}%
        </Text>
      </View>

      <View style={styles.bpjsTrack}>
        <View
          style={{
            width: `${porsi}%`,
            backgroundColor: c.accent,
            borderRadius: 4,
          }}
        />
        <View
          style={{
            width: `${100 - porsi}%`,
            backgroundColor: c.info.bg,
            borderRadius: 4,
          }}
        />
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
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
    headerTitle: { fontSize: 15, fontWeight: "700", color: c.ink },

    content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 130 },

    state: {
      fontSize: 12.5,
      fontWeight: "500",
      color: c.muted,
      textAlign: "center",
      marginTop: 40,
    },

    darkCard: {
      backgroundColor: c.dark.bg,
      borderRadius: 22,
      padding: 18,
    },
    darkHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    darkLabel: {
      fontSize: 11.5,
      fontWeight: "500",
      color: "rgba(255,255,255,0.55)",
    },
    schemePill: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: "rgba(36,144,239,0.2)",
    },
    schemeText: { fontSize: 10, fontWeight: "700", color: c.accentLight },
    darkAmount: {
      fontSize: 30,
      lineHeight: 32,
      fontWeight: "800",
      letterSpacing: -0.9,
      color: "#fff",
      marginTop: 10,
    },

    chart: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 3,
      height: 40,
      marginTop: 16,
    },
    bar: { flex: 1, borderRadius: 3 },
    chartNote: {
      fontSize: 10,
      fontWeight: "500",
      color: "rgba(255,255,255,0.4)",
      marginTop: 8,
    },

    sheet: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 16,
      marginTop: 12,
      shadowColor: "#0F1720",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 3,
    },
    sheetTitle: { fontSize: 13.5, fontWeight: "700", color: c.ink },
    sheetDesc: {
      fontSize: 11,
      fontWeight: "500",
      color: c.muted,
      lineHeight: 16,
      marginTop: 4,
    },

    lines: { gap: 11, marginTop: 13 },
    lineRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
    },
    lineLabel: { fontSize: 12.5, fontWeight: "500", color: c.muted },
    lineValue: { fontSize: 12.5, fontWeight: "600", color: c.ink },
    divider: { height: 1, backgroundColor: c.hair },
    totalLabel: { fontSize: 12.5, fontWeight: "700", color: c.ink },
    totalValue: { fontSize: 13, fontWeight: "700", color: c.ink },

    bpjsHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      gap: 10,
    },
    bpjsLabel: { fontSize: 12.5, fontWeight: "600", color: c.ink },
    bpjsPct: { fontSize: 11.5, fontWeight: "600", color: c.muted },
    bpjsTrack: { flexDirection: "row", gap: 4, height: 8, marginTop: 7 },

    legend: { flexDirection: "row", gap: 14, marginTop: 2 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    legendSwatch: { width: 8, height: 8, borderRadius: 3 },
    legendText: { fontSize: 10.5, fontWeight: "500", color: c.muted },
  });
