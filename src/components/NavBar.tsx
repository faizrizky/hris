import React, { useMemo } from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { GlassPill } from "./GlassPill";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";

interface Props {
  title: string;
  onBack?: () => void;
  trailingIcon?: keyof typeof Ionicons.glyphMap;
  onTrailingPress?: () => void;
}

export function NavBar({
  title,
  onBack,
  trailingIcon,
  onTrailingPress,
}: Props) {
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable onPress={onBack}>
            <GlassPill>
              <Ionicons name="chevron-back" size={20} color={c.ink} />
            </GlassPill>
          </Pressable>
        ) : (
          <View style={styles.pillPlaceholder} />
        )}
        {trailingIcon ? (
          <Pressable onPress={onTrailingPress}>
            <GlassPill>
              <Ionicons name={trailingIcon} size={20} color={c.ink} />
            </GlassPill>
          </Pressable>
        ) : (
          <View style={styles.pillPlaceholder} />
        )}
      </View>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 20,
      paddingBottom: 12,
      backgroundColor: c.bg,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    pillPlaceholder: { width: 44, height: 44 },
    title: {
      fontSize: 32,
      fontWeight: "700",
      color: c.ink,
      marginTop: 12,
    },
  });
