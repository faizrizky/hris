import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "@/theme/colors";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { Payslip } from "@/services/types";
import {
  PayslipCompareCard,
  PayslipHero,
  PayslipInfoCard,
  PayslipLinesCard,
} from "./PayslipCards";

export function PayslipDetailScreen({ navigation, route }: any) {
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const { payslipId } = route.params;

  const [payslips, setPayslips] = useState<Payslip[] | null>(null);

  useEffect(() => {
    if (!employee) return;
    hrisApi.getPayslips(employee.id).then(setPayslips);
  }, [employee]);

  // Ambil seluruh daftar, bukan satu slip: layar ini butuh slip tetangganya
  // untuk kartu perbandingan. Daftarnya sudah terurut dari terbaru.
  const idx = payslips ? payslips.findIndex((p) => p.id === payslipId) : -1;
  const payslip = idx >= 0 && payslips ? payslips[idx] : null;
  const sebelumnya =
    payslips && idx >= 0 && idx + 1 < payslips.length
      ? payslips[idx + 1]
      : null;

  const header = (title: string, sub?: string) => (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={18} color={colors.ink} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.headerTitle}>{title}</Text>
        {sub && <Text style={styles.headerSub}>{sub}</Text>}
      </View>
      {payslip && (
        <Pressable style={styles.pdfBtn}>
          <Text style={styles.pdfText}>Unduh PDF</Text>
        </Pressable>
      )}
    </View>
  );

  if (!payslip) {
    return (
      <View style={styles.container}>
        {header("Detail Slip Gaji")}
        <Text style={styles.state}>
          {payslips === null ? "Memuat slip…" : "Slip gaji tidak ditemukan."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header(payslip.period, `Salary Slip · ${payslip.note}`)}

      <ScrollView contentContainerStyle={styles.content}>
        <PayslipHero payslip={payslip} />

        <PayslipLinesCard
          title="Pendapatan (Earnings)"
          lines={payslip.earnings}
          totalLabel="Bruto"
          total={payslip.grossPay}
        />

        <PayslipLinesCard
          tight
          negative
          title="Potongan (Deductions)"
          lines={payslip.deductions}
          totalLabel="Total potongan"
          total={payslip.totalDeduction}
        />

        {sebelumnya && (
          <PayslipCompareCard current={payslip} previous={sebelumnya} />
        )}

        <PayslipInfoCard payslip={payslip} />
      </ScrollView>
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
  headerTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  headerSub: {
    fontSize: 10.5,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 3,
  },
  pdfBtn: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.info.bg,
  },
  pdfText: { fontSize: 11.5, fontWeight: "600", color: colors.info.ink },

  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 130 },

  state: {
    fontSize: 12.5,
    fontWeight: "500",
    color: colors.muted,
    textAlign: "center",
    marginTop: 40,
  },
});
