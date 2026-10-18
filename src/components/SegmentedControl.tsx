import React, { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";

// Tab bersegmen dengan indikator yang bergeser halus ke pilihan aktif.
export function SegmentedControl<K extends string>({
  items,
  value,
  onChange,
  style,
}: {
  items: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [w, setW] = useState(0);
  const idx = Math.max(
    0,
    items.findIndex((x) => x.key === value),
  );
  const [slide] = useState(() => new Animated.Value(idx));

  useEffect(() => {
    Animated.timing(slide, {
      toValue: idx,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [idx, slide]);

  const n = items.length;
  const trackWidth = (w - 8 - 4 * (n - 1)) / n;

  return (
    <View
      style={[styles.segment, style]}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      {w > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              width: trackWidth,
              transform: [
                {
                  translateX: slide.interpolate({
                    inputRange: items.map((_, i) => i),
                    outputRange: items.map((_, i) => i * (trackWidth + 4)),
                  }),
                },
              ],
            },
          ]}
        />
      )}
      {items.map((it) => {
        const isOn = it.key === value;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(it.key)}
            style={styles.btn}
          >
            <Text style={[styles.text, isOn && styles.textOn]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    segment: {
      flexDirection: "row",
      gap: 4,
      padding: 4,
      borderRadius: 14,
      backgroundColor: c.chip,
    },
    indicator: {
      position: "absolute",
      top: 4,
      bottom: 4,
      left: 4,
      borderRadius: 11,
      backgroundColor: c.card,
      shadowColor: "#0F1720",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.14,
      shadowRadius: 4,
      elevation: 2,
    },
    btn: {
      flex: 1,
      paddingVertical: 9,
      paddingHorizontal: 6,
      borderRadius: 11,
      alignItems: "center",
    },
    text: { fontSize: 12, fontWeight: "700", color: c.muted },
    textOn: { color: c.accent },
  });
