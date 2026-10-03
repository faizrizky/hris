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

export function PayslipListScreen({ navigation }: any) {
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

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
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Slip Gaji</Text>
        <PdfButton />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
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
            <PayslipHistoryCard
              items={previous}
              onPick={(p) =>
                navigation.navigate("PayslipDetail", { payslipId: p.id })
              }
            />
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

    sectionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: c.ink,
      marginTop: 20,
      marginBottom: 10,
      marginHorizontal: 2,
    },
  });
