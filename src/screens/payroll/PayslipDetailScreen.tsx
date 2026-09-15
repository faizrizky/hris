import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { colors } from '@/theme/colors';
import { hrisApi } from '@/services/api';
import { useSession } from '@/services/session';
import { Payslip } from '@/services/types';

function formatRupiah(value: number): string {
  return `Rp ${value.toLocaleString('id-ID')}`;
}

export function PayslipDetailScreen({ route }: any) {
  const { employee } = useSession();
  const { payslipId } = route.params;
  const [payslip, setPayslip] = useState<Payslip | null>(null);

  useEffect(() => {
    if (!employee) return;
    hrisApi.getPayslips(employee.id).then((list) => {
      setPayslip(list.find((p) => p.id === payslipId) ?? null);
    });
  }, [employee, payslipId]);

  if (!payslip) return null;

  return (
    <View style={styles.container}>
      <Card>
        <Text style={styles.period}>{payslip.period}</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Gaji kotor</Text>
          <Text style={styles.value}>{formatRupiah(payslip.grossPay)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Potongan</Text>
          <Text style={styles.valueNeg}>- {formatRupiah(payslip.deductions)}</Text>
        </View>
        <View style={[styles.row, styles.totalRow]}>
          <Text style={styles.totalLabel}>Take home pay</Text>
          <Text style={styles.totalValue}>{formatRupiah(payslip.netPay)}</Text>
        </View>
      </Card>

      <Text style={styles.note}>
        Data dummy — komponen gaji detail (tunjangan, pajak, BPJS, dll) akan mengikuti
        struktur Salary Slip ERPNext saat integrasi Fase 2.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  period: { fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  label: { fontSize: 14, color: colors.muted },
  value: { fontSize: 14, color: colors.ink },
  valueNeg: { fontSize: 14, color: colors.bad.ink },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.hair, marginTop: 8, paddingTop: 14 },
  totalLabel: { fontSize: 15, fontWeight: '700', color: colors.ink },
  totalValue: { fontSize: 15, fontWeight: '700', color: colors.accent },
  note: { fontSize: 11, color: colors.muted, marginTop: 16, textAlign: 'center' },
});
