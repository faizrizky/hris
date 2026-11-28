// Lapisan gelap berlubang bersudut bulat untuk tutorial. Semua gerak hanya translate, scale, dan opacity supaya
// berjalan di native driver: tidak ada gambar ulang per frame (SVG mask seukuran layar patah-patah di HP kelas bawah).
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

const R = 18;
const LINE = 2;
const DIM = "rgba(8,12,18,0.74)";
const RING = "#FFFFFF";

// Sudut kiri atas: bagian gelap di luar lengkungan, dan garis lengkungnya. Sudut lain hasil rotasi.
const CORNER_DIM = `M0 0H${R}A${R} ${R} 0 0 0 0 ${R}Z`;
const CORNER_ARC = `M${R} ${LINE / 2}A${R - LINE / 2} ${R - LINE / 2} 0 0 0 ${LINE / 2} ${R}`;

export interface HoleEdges {
  left: Animated.Value;
  top: Animated.Value;
  right: Animated.Value;
  bottom: Animated.Value;
  ring: Animated.Value; // 0 = tanpa lubang (sudut dan garis disembunyikan)
}

export function Spotlight({
  edges,
  width,
  height,
}: {
  edges: HoleEdges;
  width: number;
  height: number;
}) {
  const { left, top, right, bottom, ring } = edges;
  const centerX = Animated.multiply(Animated.add(left, right), 0.5);
  const centerY = Animated.multiply(Animated.add(top, bottom), 0.5);
  const holeW = Animated.subtract(right, left);
  const holeH = Animated.subtract(bottom, top);
  // Bidang seukuran layar yang diskalakan menjadi sepanjang sisi lubang (skala berpusat di tengah bidang).
  const middleY = Animated.subtract(centerY, height / 2);
  const middleX = Animated.subtract(centerX, width / 2);
  const lineScaleX = Animated.divide(Animated.subtract(holeW, R * 2), width);
  const lineScaleY = Animated.divide(Animated.subtract(holeH, R * 2), height);
  const full = { width, height };

  const corners = [
    { x: left, y: top, rotate: "0deg" },
    { x: Animated.subtract(right, R), y: top, rotate: "90deg" },
    {
      x: Animated.subtract(right, R),
      y: Animated.subtract(bottom, R),
      rotate: "180deg",
    },
    { x: left, y: Animated.subtract(bottom, R), rotate: "270deg" },
  ];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.dim,
          full,
          { transform: [{ translateY: Animated.subtract(top, height) }] },
        ]}
      />
      <Animated.View
        style={[styles.dim, full, { transform: [{ translateY: bottom }] }]}
      />
      <Animated.View
        style={[
          styles.dim,
          full,
          {
            transform: [
              { translateX: Animated.subtract(left, width) },
              { translateY: middleY },
              { scaleY: Animated.divide(holeH, height) },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.dim,
          full,
          {
            transform: [
              { translateX: right },
              { translateY: middleY },
              { scaleY: Animated.divide(holeH, height) },
            ],
          },
        ]}
      />
      {[top, Animated.subtract(bottom, LINE)].map((y, i) => (
        <Animated.View
          key={`h${i}`}
          style={[
            styles.line,
            { width, height: LINE, opacity: ring },
            {
              transform: [
                { translateX: middleX },
                { translateY: y },
                { scaleX: lineScaleX },
              ],
            },
          ]}
        />
      ))}
      {[left, Animated.subtract(right, LINE)].map((x, i) => (
        <Animated.View
          key={`v${i}`}
          style={[
            styles.line,
            { width: LINE, height, opacity: ring },
            {
              transform: [
                { translateX: x },
                { translateY: middleY },
                { scaleY: lineScaleY },
              ],
            },
          ]}
        />
      ))}
      {corners.map((corner) => (
        <Animated.View
          key={corner.rotate}
          style={[
            styles.corner,
            {
              opacity: ring,
              transform: [
                { translateX: corner.x },
                { translateY: corner.y },
                { rotate: corner.rotate },
              ],
            },
          ]}
        >
          <Svg width={R} height={R}>
            <Path d={CORNER_DIM} fill={DIM} />
            <Path d={CORNER_ARC} stroke={RING} strokeWidth={LINE} fill="none" />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { position: "absolute", left: 0, top: 0, backgroundColor: DIM },
  line: { position: "absolute", left: 0, top: 0, backgroundColor: RING },
  corner: { position: "absolute", left: 0, top: 0, width: R, height: R },
});
