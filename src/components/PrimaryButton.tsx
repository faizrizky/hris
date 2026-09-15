import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '@/theme/colors';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'danger' | 'outline';
}

export function PrimaryButton({ label, onPress, loading, variant = 'primary' }: Props) {
  const bg = variant === 'primary' ? colors.accent : variant === 'danger' ? colors.bad.ink : 'transparent';
  const textColor = variant === 'outline' ? colors.accent : '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={[
        styles.button,
        { backgroundColor: bg, borderWidth: variant === 'outline' ? 1 : 0, borderColor: colors.accent },
      ]}
    >
      {loading ? <ActivityIndicator color={textColor} /> : <Text style={[styles.label, { color: textColor }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
});
