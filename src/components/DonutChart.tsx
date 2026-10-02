import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { useTheme } from "@/theme/ThemeContext";

interface Segment {
  value: number;
  color: string;
}

interface Props {
  segments: Segment[];
  size: number;
  stroke: number;
  /** Isi lubang di tengah. */
  children?: React.ReactNode;
}

export function DonutChart({ segments, size, stroke, children }: Props) {
  const c = useTheme();

  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const lubang = size - stroke * 2;

  // Dihitung dulu ke array, baru dibaca JSX — jangan menghitung sambil
  // menggambar. offset negatif karena strokeDashoffset bergerak berlawanan.
  const arcs = segments.map((seg, i) => {
    const len = (seg.value / total) * circ;
    const jalan = segments
      .slice(0, i)
      .reduce((sum, s) => sum + (s.value / total) * circ, 0);
    return { color: seg.color, len, offset: -jalan };
  });

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          {arcs.map((a, i) => (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={a.color}
              strokeWidth={stroke}
              strokeDasharray={`${a.len} ${circ - a.len}`}
              strokeDashoffset={a.offset}
            />
          ))}
        </G>
      </Svg>

      <View
        style={[
          styles.hole,
          {
            width: lubang,
            height: lubang,
            borderRadius: lubang / 2,
            backgroundColor: c.card,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

// Tanpa warna, jadi boleh tetap di level modul.
const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  hole: { alignItems: "center", justifyContent: "center" },
});
