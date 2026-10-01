import React, { useEffect, useState, useMemo } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";

const MAP_H = 216;
const CELL = 26;

export function MapPreview() {
  const [width, setWidth] = useState(0);
  const [pulse] = useState(() => new Animated.Value(0));

  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.45],
  });
  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.08],
  });

  const cols = Math.ceil(width / CELL);
  const rows = Math.ceil(MAP_H / CELL);

  return (
    <View
      style={styles.map}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Svg width={width} height={MAP_H} style={StyleSheet.absoluteFill}>
          <Rect width={width} height={MAP_H} fill={c.map.bg} />
          {Array.from({ length: cols + 1 }).map((_, i) => (
            <Line
              key={`v${i}`}
              x1={i * CELL}
              y1={0}
              x2={i * CELL}
              y2={MAP_H}
              stroke={c.map.line}
              strokeWidth={1}
            />
          ))}
          {Array.from({ length: rows + 1 }).map((_, i) => (
            <Line
              key={`h${i}`}
              x1={0}
              y1={i * CELL}
              x2={width}
              y2={i * CELL}
              stroke={c.map.line}
              strokeWidth={1}
            />
          ))}
        </Svg>
      )}

      <View
        style={[styles.block, { left: 20, top: 34, width: 120, height: 64 }]}
      />
      <View
        style={[styles.block, { right: 26, bottom: 40, width: 92, height: 78 }]}
      />
      <View style={styles.road} />

      <View style={styles.geofence} />
      <Animated.View
        style={[styles.pulse, { opacity, transform: [{ scale }] }]}
      />
      <View style={styles.pin} />

      <View style={styles.mapBadge}>
        <Text style={styles.mapBadgeText}>radius 120 m · geofence OK</Text>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    map: { height: MAP_H, position: "relative", overflow: "hidden" },
    block: {
      position: "absolute",
      borderRadius: 8,
      backgroundColor: c.map.block,
      borderWidth: 1,
      borderColor: c.map.blockBorder,
    },
    road: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 128,
      height: 16,
      backgroundColor: c.map.block,
    },
    geofence: {
      position: "absolute",
      left: "50%",
      top: "50%",
      marginLeft: -75,
      marginTop: -75,
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: "rgba(36,144,239,0.14)",
      borderWidth: 1,
      borderColor: "rgba(36,144,239,0.4)",
    },
    pulse: {
      position: "absolute",
      left: "50%",
      top: "50%",
      marginLeft: -75,
      marginTop: -75,
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: "rgba(36,144,239,0.35)",
    },
    pin: {
      position: "absolute",
      left: "50%",
      top: "50%",
      marginLeft: -9,
      marginTop: -9,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: "#2490EF",
      borderWidth: 3,
      borderColor: "#fff",
    },
    mapBadge: {
      position: "absolute",
      left: 12,
      bottom: 12,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 9,
      backgroundColor: "rgba(15,23,32,0.85)",
    },
    mapBadgeText: { fontSize: 10, fontWeight: "600", color: c.accentLight },
  });
