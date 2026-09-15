import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, SemanticTone } from '@/theme/colors';

export function StatusBadge({ label, tone }: { label: string; tone: SemanticTone }) {
  const { bg, ink } = colors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: ink }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
