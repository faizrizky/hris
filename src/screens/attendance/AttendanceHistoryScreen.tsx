import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { colors } from '@/theme/colors';
import { hrisApi } from '@/services/api';
import { useSession } from '@/services/session';
import { AttendanceRecord, AttendanceStatus } from '@/services/types';

const STATUS_TONE: Record<AttendanceStatus, 'ok' | 'warn' | 'info'> = {
  hadir: 'ok',
  telat: 'warn',
  izin: 'info',
};

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  hadir: 'Hadir',
  telat: 'Telat',
  izin: 'Izin',
};

export function AttendanceHistoryScreen() {
  const { employee } = useSession();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [filter, setFilter] = useState<'semua' | AttendanceStatus>('semua');

  useEffect(() => {
    if (!employee) return;
    hrisApi.getAttendanceHistory(employee.id).then(setRecords);
  }, [employee]);

  const filtered = records.filter((r) => filter === 'semua' || r.status === filter);

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {(['semua', 'hadir', 'telat', 'izin'] as const).map((f) => (
          <Text
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
          >
            {f === 'semua' ? 'Semua' : STATUS_LABEL[f]}
          </Text>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingTop: 8 }}
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.date}>{item.date}</Text>
              <Text style={styles.muted}>
                {item.checkIn ?? '—'} - {item.checkOut ?? '—'} · {item.durationLabel ?? '—'}
              </Text>
            </View>
            <StatusBadge label={STATUS_LABEL[item.status]} tone={STATUS_TONE[item.status]} />
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 16 },
  filterChip: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  filterChipActive: { backgroundColor: colors.accent, color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center' },
  date: { fontSize: 14, fontWeight: '600', color: colors.ink },
  muted: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
