import React, { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { DatePickerCard } from "@/components/DatePickerCard";

interface Props {
  visible: boolean;
  title: string;
  hint: string;
  /** Tanggal terpilih dalam format ISO ("2027-09-30"), null kalau kosong. */
  value: string | null;
  onPick: (iso: string) => void;
  /** Kalau diisi, tombol "Hapus tanggal" muncul — untuk field opsional. */
  onClear?: () => void;
  onClose: () => void;
  allow?: "future" | "past";
}

export function DateSheet({
  visible,
  title,
  hint,
  value,
  onPick,
  onClear,
  onClose,
  allow = "future",
}: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const insets = useSafeAreaInsets();

  const [anim] = useState(() => new Animated.Value(0));
  const [tinggi, setTinggi] = useState(520);

  useEffect(() => {
    if (!visible) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, anim]);

  // Sengaja dilepas saat tertutup: DatePickerCard menghitung kursor bulan
  // sekali saja saat mount, jadi dengan remount kalender selalu terbuka
  // di bulan tanggal yang sedang dipilih.
  if (!visible) return null;

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [tinggi, 0],
  });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: anim }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        onLayout={(e) => setTinggi(e.nativeEvent.layout.height)}
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 20, transform: [{ translateY }] },
        ]}
      >
        <View style={styles.grabber} />

        <DatePickerCard
          flat
          mode="single"
          title={title}
          hint={hint}
          start={value}
          end={value}
          allow={allow}
          footer={[]}
          onChange={(s) => {
            if (!s) return;
            onPick(s);
            onClose();
          }}
        />

        <View style={styles.actions}>
          {onClear ? (
            <Pressable
              style={styles.ghost}
              onPress={() => {
                onClear();
                onClose();
              }}
            >
              <Text style={styles.ghostText}>Hapus tanggal</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.ghost} onPress={onClose}>
            <Text style={styles.ghostText}>Tutup</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    backdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(15,23,32,0.45)",
    },
    sheet: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    grabber: {
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.track,
      alignSelf: "center",
      marginBottom: 14,
    },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 6,
      marginTop: 10,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: c.hair,
    },
    ghost: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11 },
    ghostText: { fontSize: 12.5, fontWeight: "700", color: c.accent },
  });
