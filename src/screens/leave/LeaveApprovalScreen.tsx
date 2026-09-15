import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/theme/colors';
import { hrisApi } from '@/services/api';
import { useSession } from '@/services/session';
import { LeaveRequest } from '@/services/types';

// Layar ini cuma di-mount untuk role mss/hr (lihat RootNavigator).
export function LeaveApprovalScreen() {
  const { employee } = useSession();
  const [items, setItems] = useState<LeaveRequest[]>([]);

  const load = useCallback(() => {
    if (!employee) return;
    hrisApi.getPendingApprovals(employee.id).then(setItems);
  }, [employee]);

  useFocusEffect(load);

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    await hrisApi.decideLeaveRequest(id, decision);
    load();
  };

  if (!employee) return null;

  return (
    <FlatList
      style={styles.container}
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 20 }}
      ListEmptyComponent={<Text style={styles.muted}>Tidak ada approval yang menunggu.</Text>}
      renderItem={({ item }) => (
        <Card>
          <Text style={styles.reqLabel}>{item.label}</Text>
          <Text style={styles.muted}>{item.reason}</Text>
          <Text style={styles.stage}>{item.stage} · Kuota {item.quota}</Text>
          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Tolak" variant="outline" onPress={() => decide(item.id, 'reject')} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Setujui" onPress={() => decide(item.id, 'approve')} />
            </View>
          </View>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  muted: { fontSize: 13, color: colors.muted },
  reqLabel: { fontSize: 14, fontWeight: '600', color: colors.ink, marginBottom: 4 },
  stage: { fontSize: 11, color: colors.accent, marginTop: 6, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
});
