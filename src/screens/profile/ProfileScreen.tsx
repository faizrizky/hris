import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/theme/colors';
import { useSession } from '@/services/session';

export function ProfileScreen() {
  const { employee, setEmployee } = useSession();
  if (!employee) return null;

  return (
    <View style={styles.container}>
      <Card style={styles.avatarCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{employee.avatarInitials}</Text>
        </View>
        <Text style={styles.name}>{employee.fullName}</Text>
        <Text style={styles.role}>{employee.jobTitle} · {employee.department}</Text>
      </Card>

      <Card>
        <Row label="NIK" value={employee.nik} />
        <Row label="Role" value={employee.role.toUpperCase()} />
      </Card>

      <PrimaryButton label="Keluar" variant="outline" onPress={() => setEmployee(null)} />
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  avatarCard: { alignItems: 'center', paddingVertical: 24 },
  avatar: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.info.bg,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: colors.info.ink },
  name: { fontSize: 17, fontWeight: '700', color: colors.ink },
  role: { fontSize: 13, color: colors.muted, marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rowLabel: { fontSize: 13, color: colors.muted },
  rowValue: { fontSize: 13, fontWeight: '600', color: colors.ink },
});
