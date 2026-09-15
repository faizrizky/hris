import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/theme/colors';
import { hrisApi } from '@/services/api';
import { useSession } from '@/services/session';
import { LeaveBalance, LeaveRequest } from '@/services/types';

export function LeaveListScreen({ navigation }: any) {
  const { employee } = useSession();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);

  const load = useCallback(() => {
    if (!employee) return;
    hrisApi.getLeaveBalances(employee.id).then(setBalances);
    hrisApi.getLeaveRequests(employee.id).then(setRequests);
  }, [employee]);

  useEffect(load, [load]);
  useFocusEffect(load); // refresh tiap kali balik dari form pengajuan

  if (!employee) return null;

  return (
    <View style={styles.container}>
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20 }}
        ListHeaderComponent={
          <>
            <Card>
              <Text style={styles.cardTitle}>Sisa kuota</Text>
              {balances.map((b) => (
                <View key={b.type} style={styles.balanceRow}>
                  <Text style={styles.balanceLabel}>{b.label}</Text>
                  <Text style={styles.balanceValue}>{b.remaining} {b.unit}</Text>
                </View>
              ))}
            </Card>
            <PrimaryButton label="Ajukan Cuti / Lembur / Dinas Luar" onPress={() => navigation.navigate('LeaveRequest')} />
            <Text style={styles.sectionTitle}>Riwayat pengajuan</Text>
          </>
        }
        ListEmptyComponent={<Text style={styles.muted}>Belum ada pengajuan.</Text>}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <Text style={styles.reqLabel}>{item.label}</Text>
              <StatusBadge
                label={item.decision === 'approve' ? 'Disetujui' : item.decision === 'reject' ? 'Ditolak' : 'Pending'}
                tone={item.decision === 'approve' ? 'ok' : item.decision === 'reject' ? 'bad' : 'warn'}
              />
            </View>
            <Text style={styles.muted}>{item.reason}</Text>
            <Text style={styles.stage}>{item.stage}</Text>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.ink, marginBottom: 10 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  balanceLabel: { fontSize: 13, color: colors.muted },
  balanceValue: { fontSize: 13, fontWeight: '600', color: colors.ink },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.ink, marginTop: 8, marginBottom: 10 },
  muted: { fontSize: 13, color: colors.muted },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  reqLabel: { fontSize: 14, fontWeight: '600', color: colors.ink, flex: 1, marginRight: 8 },
  stage: { fontSize: 11, color: colors.accent, marginTop: 6, fontWeight: '600' },
});
