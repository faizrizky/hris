import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/theme/colors';
import { hrisApi } from '@/services/api';
import { useSession } from '@/services/session';
import { LeaveType } from '@/services/types';

const TYPE_OPTIONS: { value: LeaveType; label: string }[] = [
  { value: 'cuti', label: 'Cuti' },
  { value: 'lembur', label: 'Lembur' },
  { value: 'dinas_luar', label: 'Dinas Luar' },
  { value: 'sakit', label: 'Sakit' },
];

export function LeaveRequestScreen({ navigation }: any) {
  const { employee } = useSession();
  const [type, setType] = useState<LeaveType>('cuti');
  const [detail, setDetail] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!employee || !detail || !reason) return;
    setLoading(true);
    try {
      await hrisApi.submitLeaveRequest({
        employeeId: employee.id,
        type,
        label: detail,
        reason,
      });
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.fieldLabel}>Jenis pengajuan</Text>
      <View style={styles.typeRow}>
        {TYPE_OPTIONS.map((opt) => (
          <Text
            key={opt.value}
            onPress={() => setType(opt.value)}
            style={[styles.typeChip, type === opt.value && styles.typeChipActive]}
          >
            {opt.label}
          </Text>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Detail (mis. "Cuti tahunan · 3 hari")</Text>
      <TextInput style={styles.input} value={detail} onChangeText={setDetail} placeholder="Detail singkat" />

      <Text style={styles.fieldLabel}>Alasan</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={reason}
        onChangeText={setReason}
        placeholder="Alasan pengajuan"
        multiline
      />

      <PrimaryButton label="Kirim Pengajuan" onPress={handleSubmit} loading={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  fieldLabel: { fontSize: 13, color: colors.muted, marginBottom: 8, marginTop: 16 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  typeChipActive: { backgroundColor: colors.accent, color: '#fff' },
  input: {
    borderWidth: 1,
    borderColor: colors.hair,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
  },
  textarea: { height: 90, textAlignVertical: 'top' },
});
