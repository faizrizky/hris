import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/theme/colors';
import { hrisApi } from '@/services/api';
import { useSession } from '@/services/session';

export function LoginScreen() {
  const { setEmployee } = useSession();
  const [email, setEmail] = useState('ess@falah.co');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const employee = await hrisApi.login(email, password);
      setEmployee(employee);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>HRIS Mobile</Text>
      <Text style={styles.subtitle}>Masuk untuk lanjut (mode mocking)</Text>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="ess@falah.co / mss@falah.co / hr@falah.co"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="bebas — belum terhubung ke ERPNext"
        />
      </View>

      <PrimaryButton label="Masuk" onPress={handleLogin} loading={loading} />

      <Text style={styles.hint}>
        Tip: ganti prefix email (ess / mss / hr) buat coba tampilan tiap role.
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: 28 },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, color: colors.muted, marginBottom: 6 },
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
  hint: { marginTop: 16, fontSize: 12, color: colors.muted, textAlign: 'center' },
});
