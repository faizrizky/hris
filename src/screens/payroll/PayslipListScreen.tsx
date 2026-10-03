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
  PayslipHero,
  PayslipHistoryCard,
  PayslipLinesCard,
} from "./PayslipCards";
import { PdfButton } from "@/components/PdfButton";
import { Skeleton } from "@/components/Skeleton";

export function PayslipListScreen({ navigation }: any) {
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const [payslips, setPayslips] = useState<Payslip[] | null>(null);
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  useEffect(() => {
    if (!employee) return;
    hrisApi.getPayslips(employee.id).then(setPayslips);
  }, [employee]);

  const memuat = payslips === null;
  const latest = payslips?.[0];
  const previous = payslips?.slice(1) ?? [];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.getParent()?.navigate("Beranda")}
        >
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Slip Gaji</Text>
        <PdfButton />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {memuat && (
          <>
            <View style={styles.skelHero}>
              <Skeleton
                width="46%"
                height={11}
                radius={4}
                color={c.onDark.track}
              />
              <Skeleton
                width="68%"
                height={28}
                radius={8}
                color={c.onDark.track}
                style={{ marginTop: 14 }}
              />
              <Skeleton
                width="34%"
                height={10}
                radius={4}
                color={c.onDark.track}
                style={{ marginTop: 14 }}
              />
            </View>

            {[0, 1].map((i) => (
              <View key={i} style={styles.skelCard}>
                <Skeleton width="48%" height={12} radius={4} />
                <View style={{ gap: 13, marginTop: 16 }}>
                  {[0, 1, 2, 3].map((j) => (
                    <View key={j} style={styles.skelRow}>
                      <Skeleton width="42%" height={11} radius={4} />
                      <Skeleton width="26%" height={11} radius={4} />
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </>
        )}

        {latest && (
          <>
            <PayslipHero payslip={latest} />

            <PayslipLinesCard
              title="Pendapatan (Earnings)"
              lines={latest.earnings}
              totalLabel="Bruto"
              total={latest.grossPay}
            />

            <PayslipLinesCard
              tight
              negative
              title="Potongan (Deductions)"
              lines={latest.deductions}
              totalLabel="Total potongan"
              total={latest.totalDeduction}
              linkLabel="Rincian"
              onLink={() => navigation.navigate("TaxDetail")}
            />
          </>
        )}

        {previous.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Slip sebelumnya</Text>
            <PayslipHistoryCard items={previous} />
          </>
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
    headerTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: "700",
      color: c.ink,
    },

    content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 130 },

    skelHero: { backgroundColor: c.statBg, borderRadius: 22, padding: 18 },
    skelCard: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 16,
      marginTop: 12,
    },
    skelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },

    sectionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: c.ink,
      marginTop: 20,
      marginBottom: 10,
      marginHorizontal: 2,
    },
  });
