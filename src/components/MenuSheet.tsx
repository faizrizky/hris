import { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { useT } from "@/i18n";

export interface ItemMenu {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  ink: string;
  onPress: () => void;
}

// Lembar "Semua Menu": naik dari bawah dengan latar memudar (animasi sama dengan lembar tombol + yang dulu),
// tidak sampai ke atas layar; berisi seluruh menu milik akun ini dalam grid empat kolom.
export function MenuSheet({
  visible,
  onClose,
  items,
}: {
  visible: boolean;
  onClose: () => void;
  items: ItemMenu[];
}) {
  const c = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [anim] = useState(() => new Animated.Value(0));

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

  const tinggiSheet = Math.min(height * 0.68, 560);
  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [tinggiSheet + 40, 0],
  });

  // Lembar turun dan latar memudar dulu, baru modal ditutup; navigasi sesudahnya supaya
  // lembar tidak terlihat menumpuk di atas layar tujuan.
  const tutup = (lalu?: () => void) => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      onClose();
      lalu?.();
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => tutup()}
    >
      <Animated.View style={[styles.backdrop, { opacity: anim }]}>
        <Pressable style={{ flex: 1 }} onPress={() => tutup()} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            height: tinggiSheet,
            paddingBottom: insets.bottom + 12,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.grabber} />
        <Text style={styles.judul}>{t("mn.judul")}</Text>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.grid}
        >
          {items.map((it) => (
            <Pressable
              key={it.key}
              style={styles.cell}
              onPress={() => tutup(it.onPress)}
            >
              <View style={[styles.ikon, { backgroundColor: it.bg }]}>
                <Ionicons name={it.icon} size={28} color={it.ink} />
              </View>
              <Text style={styles.label} numberOfLines={2}>
                {it.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
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
      paddingHorizontal: 18,
      paddingTop: 10,
    },
    grabber: {
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.track,
      alignSelf: "center",
      marginBottom: 14,
    },
    judul: {
      fontSize: 18,
      fontWeight: "800",
      color: c.ink,
      marginBottom: 12,
      paddingHorizontal: 2,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      rowGap: 18,
      paddingBottom: 12,
    },
    cell: { width: "25%", alignItems: "center", paddingHorizontal: 4, gap: 8 },
    ikon: {
      width: 58,
      height: 58,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
    },
    label: {
      fontSize: 11.5,
      lineHeight: 15,
      fontWeight: "600",
      color: c.ink,
      textAlign: "center",
    },
  });
