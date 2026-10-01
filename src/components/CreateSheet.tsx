import React, { useEffect, useState, useMemo } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { LineIcon } from "@/components/LineIcon";
import { ICON } from "@/constants/icons";
import { BATAS_LEMBUR_JAM } from "@/constants/payroll";

type Item = {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  go: () => void;
} & ({ gradient: true } | { gradient?: false; bg: string; ink: string });

export function CreateSheet({
  visible,
  onClose,
  navigation,
}: {
  visible: boolean;
  onClose: () => void;
  navigation: any;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const insets = useSafeAreaInsets();
  const [anim] = useState(() => new Animated.Value(0));
  const [tinggi, setTinggi] = useState(460);

  useEffect(() => {
    if (!visible) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, anim]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [tinggi, 0],
  });

  // Semua tujuan lewat route bersarang: navigate ke nama tab dulu, lalu
  // { screen, params } untuk layar di dalam stack tab itu.
  const items: Item[] = [
    {
      key: "presensi",
      title: "Presensi (GPS + Face)",
      subtitle: "Clock in / clock out",
      icon: ICON.clock,
      gradient: true,
      go: () => navigation.navigate("Absensi", { screen: "Clock" }),
    },
    {
      key: "cuti",
      title: "Cuti / izin",
      subtitle: "Tahunan, sakit, melahirkan",
      icon: ICON.leave,
      bg: c.info.bg,
      ink: c.info.ink,
      go: () =>
        navigation.navigate("Cuti", {
          screen: "LeaveRequest",
          params: { kind: "cuti" },
        }),
    },
    {
      key: "lembur",
      title: "Lembur (overtime)",
      // Dibaca dari konstanta yang sama dengan layar Lembur, supaya angka
      // 18 tidak pernah beda antara menu ini dan kartu ringkasannya.
      subtitle: `Maksimal ${BATAS_LEMBUR_JAM} jam / bulan`,
      icon: ICON.overtime,
      bg: c.warn.bg,
      ink: c.warn.ink,
      go: () =>
        navigation.navigate("Cuti", {
          screen: "LeaveRequest",
          params: { kind: "lembur" },
        }),
    },
    {
      key: "dinas",
      title: "Dinas luar",
      subtitle: "Travel request & uang muka",
      icon: ICON.briefcase,
      bg: c.purple.bg,
      ink: c.purple.ink,
      go: () =>
        navigation.navigate("Cuti", {
          screen: "LeaveRequest",
          params: { kind: "dinas" },
        }),
    },
    {
      key: "self",
      title: "Self-assessment",
      subtitle: "Siklus H1 2026 · sampai 30 Sep",
      icon: ICON.appraisal,
      bg: c.purple.bg,
      ink: c.purple.ink,
      go: () => navigation.navigate("Beranda", { screen: "Appraisal" }),
    },
  ];

  const pilih = (item: Item) => {
    // Tutup dulu, baru navigasi — kalau dibalik, modal sempat terlihat
    // menumpuk di atas layar tujuan.
    onClose();
    item.go();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.backdrop, { opacity: anim }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        onLayout={(e) => setTinggi(e.nativeEvent.layout.height)}
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 42, transform: [{ translateY }] },
        ]}
      >
        <View style={styles.grabber} />
        <Text style={styles.title}>Buat pengajuan</Text>
        <Text style={styles.subtitle}>
          Semua pengajuan masuk ke workflow approval berjenjang
        </Text>

        <View style={{ gap: 9, marginTop: 16 }}>
          {items.map((item) => (
            <Pressable
              key={item.key}
              style={styles.row}
              onPress={() => pilih(item)}
            >
              {item.gradient ? (
                <LinearGradient
                  colors={[c.accent, c.accent2]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.icon}
                >
                  <LineIcon d={item.icon} color="#fff" size={18} />
                </LinearGradient>
              ) : (
                <View style={[styles.icon, { backgroundColor: item.bg }]}>
                  <LineIcon d={item.icon} color={item.ink} size={18} />
                </View>
              )}

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowSub}>{item.subtitle}</Text>
              </View>
            </Pressable>
          ))}
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
      backgroundColor: "rgba(15,23,32,0.55)",
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
      marginBottom: 16,
    },
    title: { fontSize: 15.5, fontWeight: "700", color: c.ink },
    subtitle: {
      fontSize: 11.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 4,
    },

    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 18,
      backgroundColor: c.bg,
    },
    icon: {
      width: 38,
      height: 38,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    rowTitle: { fontSize: 13, fontWeight: "700", color: c.ink },
    rowSub: {
      fontSize: 10.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 2,
    },
  });
