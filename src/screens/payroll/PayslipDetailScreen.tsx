import { useEffect, useState, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { Payslip } from "@/services/types";
import {
  PayslipCompareCard,
  PayslipHero,
  PayslipInfoCard,
  PayslipLinesCard,
} from "./PayslipCards";
import { Skeleton } from "@/components/Skeleton";
import { PdfButton } from "@/components/PdfButton";

export function PayslipDetailScreen({ navigation, route }: any) {
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const { payslipId } = route.params;
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

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
        <Ionicons name="chevron-back" size={18} color={c.ink} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.headerTitle}>{title}</Text>
        {sub && <Text style={styles.headerSub}>{sub}</Text>}
      </View>
      {payslip && <PdfButton />}
    </View>
  );

  if (!payslip) {
    if (payslips === null) {
      return (
        <View style={styles.container}>
          {header("Detail Slip Gaji")}
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.skelCard}>
              <Skeleton width="42%" height={11} radius={4} />
              <Skeleton
                width="64%"
                height={26}
                radius={8}
                style={{ marginTop: 12 }}
              />
            </View>

            {[0, 1].map((i) => (
              <View key={i} style={[styles.skelCard, { marginTop: 12 }]}>
                <Skeleton width="46%" height={12} radius={4} />
                <View style={{ gap: 13, marginTop: 16 }}>
                  {[0, 1, 2, 3].map((j) => (
                    <View key={j} style={styles.skelRow}>
                      <Skeleton width="40%" height={11} radius={4} />
                      <Skeleton width="24%" height={11} radius={4} />
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        {header("Detail Slip Gaji")}
        <Text style={styles.state}>Slip gaji tidak ditemukan.</Text>
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
    headerSub: {
      fontSize: 10.5,
      fontWeight: "600",
      color: c.muted,
      marginTop: 3,
    },

    content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 130 },

    state: {
      fontSize: 12.5,
      fontWeight: "500",
      color: c.muted,
      textAlign: "center",
      marginTop: 40,
    },

    skelCard: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 16,
    },
    skelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
  });
