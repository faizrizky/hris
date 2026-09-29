import React, { useEffect, useRef, useMemo } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { G, Rect } from "react-native-svg";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";

const W = 186;
const H = 232;
const R = 94;

const VF_A = "#E8EEF6"; // dasar
const VF_B = "#DEE8F3"; // garis diagonal

// Cukup panjang & banyak untuk menutupi area setelah dirotasi 45°.
const BANDS = Array.from({ length: 32 }, (_, i) => -200 + i * 16);

export function FaceViewfinder() {
  const scan = useRef(new Animated.Value(0)).current;
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scan, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scan, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scan]);

  const translateY = scan.interpolate({
    inputRange: [0, 1],
    outputRange: [-58, 58],
  });

  return (
    <View style={styles.frame}>
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Rect width={W} height={H} fill={VF_A} />
        <G rotation={45} origin={`${W / 2}, ${H / 2}`}>
          {BANDS.map((y) => (
            <Rect key={y} x={-160} y={y} width={520} height={8} fill={VF_B} />
          ))}
        </G>
      </Svg>

      <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]}>
        <LinearGradient
          colors={["transparent", c.accent, "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={styles.center}>
        <Text style={styles.label}>camera{"\n"}viewfinder</Text>
      </View>

      <View style={styles.dashedBorder} pointerEvents="none" />
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    frame: {
      marginTop: 16,
      width: W,
      height: H,
      borderRadius: R,
      overflow: "hidden",
    },
    scanLine: {
      position: "absolute",
      left: 0,
      right: 0,
      top: "50%",
      marginTop: -1,
      height: 2,
    },
    center: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 22,
    },
    label: {
      fontSize: 10,
      fontWeight: "600",
      color: c.muted,
      textAlign: "center",
    },
    dashedBorder: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: R,
      borderWidth: 2,
      borderStyle: "dashed",
      borderColor: "rgba(36,144,239,0.5)",
    },
  });
