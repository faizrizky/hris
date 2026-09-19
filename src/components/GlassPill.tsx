import React from "react";
import { StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";

interface Props {
  children: React.ReactNode;
  dark?: boolean;
}

export function GlassPill({ children, dark = false }: Props) {
  return (
    <View
      style={[styles.wrapper, dark ? styles.shadowDark : styles.shadowLight]}
    >
      <BlurView
        intensity={40}
        tint={dark ? "dark" : "light"}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.pill,
          { borderColor: dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.06)" },
        ]}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 44,
    minWidth: 44,
    borderRadius: 9999,
    overflow: "hidden",
  },
  pill: {
    borderRadius: 9999,
    borderWidth: 0.5,
  },
  shadowLight: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  shadowDark: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
});
