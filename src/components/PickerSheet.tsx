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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";

interface Props {
  visible: boolean;
  title: string;
  options: readonly string[];
  value?: string | null;
  onSelect: (v: string) => void;
  onClose: () => void;
}

export function PickerSheet({
  visible,
  title,
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
        <Text style={styles.title}>{title}</Text>

        {options.map((opt) => {
          const on = opt === value;
          return (
            <Pressable
              key={opt}
              style={styles.row}
              onPress={() => {
                onSelect(opt);
                onClose();
              }}
            >
              <Text style={[styles.rowText, on && styles.rowTextOn]}>
                {opt}
              </Text>
              {on && <Ionicons name="checkmark" size={18} color={c.accent} />}
            </Pressable>
          );
        })}
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
    title: {
      fontSize: 15.5,
      fontWeight: "700",
      color: c.ink,
      marginBottom: 6,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.hair,
    },
    rowText: { fontSize: 13.5, fontWeight: "500", color: c.ink },
    rowTextOn: { fontWeight: "700", color: c.accent },
  });
