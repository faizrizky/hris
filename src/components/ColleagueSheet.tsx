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
import { Ionicons } from "@expo/vector-icons";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { Colleague } from "@/services/types";

interface Props {
  visible: boolean;
  options: Colleague[];
  value?: Colleague | null;
  onSelect: (v: Colleague) => void;
  onClose: () => void;
}

export function ColleagueSheet({
  visible,
  options,
  value,
  onSelect,
  onClose,
}: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const insets = useSafeAreaInsets();

  const [anim] = useState(() => new Animated.Value(0));
  const [tinggi, setTinggi] = useState(400);

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

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [tinggi, 0],
  });

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
          { paddingBottom: insets.bottom + 20, transform: [{ translateY }] },
        ]}
      >
        <View style={styles.grabber} />
        <Text style={styles.title}>Delegasi tugas</Text>
        <Text style={styles.hint}>Rekan satu departemen denganmu</Text>

        {options.length === 0 ? (
          <Text style={styles.empty}>
            Belum ada rekan satu departemen yang bisa dipilih. Hubungi HR kalau
            tugasmu perlu didelegasikan ke departemen lain.
          </Text>
        ) : (
          options.map((o) => {
            const on = o.id === value?.id;
            return (
              <Pressable
                key={o.id}
                style={styles.row}
                onPress={() => {
                  onSelect(o);
                  onClose();
                }}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{o.initials}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.name, on && styles.nameOn]}>
                    {o.fullName}
                  </Text>
                  <Text style={styles.job}>{o.jobTitle}</Text>
                </View>
                {on && <Ionicons name="checkmark" size={18} color={c.accent} />}
              </Pressable>
            );
          })
        )}
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
      marginBottom: 16,
    },
    title: { fontSize: 15.5, fontWeight: "700", color: c.ink },
    hint: {
      fontSize: 11,
      fontWeight: "500",
      color: c.muted,
      marginTop: 4,
      marginBottom: 4,
    },
    empty: {
      fontSize: 12.5,
      lineHeight: 19,
      fontWeight: "500",
      color: c.muted,
      paddingVertical: 18,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.hair,
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 13,
      backgroundColor: c.info.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { fontSize: 12.5, fontWeight: "800", color: c.info.ink },
    name: { fontSize: 13.5, fontWeight: "600", color: c.ink },
    nameOn: { fontWeight: "800", color: c.accent },
    job: { fontSize: 11, fontWeight: "500", color: c.muted, marginTop: 2 },
  });
