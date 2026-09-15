import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { Card } from '@/components/Card';
import { colors } from '@/theme/colors';
import { hrisApi } from '@/services/api';
import { useSession } from '@/services/session';
import { Payslip } from '@/services/types';

function formatRupiah(value: number): string {
  return `Rp ${value.toLocaleString('id-ID')}`;
}

export function PayslipListScreen({ navigation }: any) {
  const { employee } = useSession();
  const [payslips, setPayslips] = useState<Payslip[]>([]);

  useEffect(() => {
    if (!employee) return;
    hrisApi.getPayslips(employee.id).then(setPayslips);
  }, [employee]);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 20 }}
      data={payslips}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Card onTouchEnd={() => navigation.navigate('PayslipDetail', { payslipId: item.id })}>
          <Text style={styles.period}>{item.period}</Text>
          <Text style={styles.net}>{formatRupiah(item.netPay)}</Text>
          <Text style={styles.muted}>Take home pay</Text>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  period: { fontSize: 13, color: colors.muted, marginBottom: 4 },
  net: { fontSize: 20, fontWeight: '700', color: colors.ink },
  muted: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
