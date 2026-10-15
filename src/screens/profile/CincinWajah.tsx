import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import Svg, { Line } from "react-native-svg";
import { Palette } from "@/theme/colors";

export const TICKS = 48;

const LineAnim = Animated.createAnimatedComponent(Line);
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

// Cincin garis bergaya Face ID. Setiap garis menyala hijau (beranimasi) saat
// kepala pernah mengarah ke sana; garis biru menunjukkan arah kepala saat ini.
export function CincinWajah({
  size,
  rIn,
  rOut,
  terisi,
  kini,
  c,
}: {
  size: number;
  rIn: number;
  rOut: number;
  terisi: number[]; // indeks garis yang sudah tercapai
  kini: number | null; // indeks garis arah kepala saat ini, null bila belum menoleh
  c: Palette;
}) {
  const [nyala] = useState(() =>
    Array.from({ length: TICKS }, () => new Animated.Value(0)),
  );
  const sudah = useRef(new Set<number>());

  useEffect(() => {
    if (terisi.length === 0 && sudah.current.size > 0) {
      sudah.current.clear();
      nyala.forEach((v) => v.setValue(0));
      return;
    }
    const baru = terisi.filter((i) => !sudah.current.has(i));
    baru.forEach((i, k) => {
      sudah.current.add(i);
      Animated.timing(nyala[i]!, {
        toValue: 1,
        duration: 260,
        delay: k * 22,
        easing: EASE,
        useNativeDriver: false,
      }).start();
    });
  }, [terisi, nyala]);

  const cx = size / 2;
  const dekat = (i: number) =>
    kini !== null &&
    Math.min(Math.abs(i - kini), TICKS - Math.abs(i - kini)) <= 2;

  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      {Array.from({ length: TICKS }, (_, i) => {
        const a = ((i * 360) / TICKS - 90) * (Math.PI / 180);
        const p = {
          x1: cx + rIn * Math.cos(a),
          y1: cx + rIn * Math.sin(a),
          x2: cx + rOut * Math.cos(a),
          y2: cx + rOut * Math.sin(a),
        };
        return (
          <Line
            key={`b${i}`}
            {...p}
            stroke={dekat(i) ? c.accent : c.track}
            strokeWidth={dekat(i) ? 4 : 3}
            strokeLinecap="round"
          />
        );
      })}
      {Array.from({ length: TICKS }, (_, i) => {
        const a = ((i * 360) / TICKS - 90) * (Math.PI / 180);
        return (
          <LineAnim
            key={`g${i}`}
            x1={cx + rIn * Math.cos(a)}
            y1={cx + rIn * Math.sin(a)}
            x2={cx + (rOut + 4) * Math.cos(a)}
            y2={cx + (rOut + 4) * Math.sin(a)}
            stroke={c.ok.ink}
            strokeWidth={4}
            strokeLinecap="round"
            strokeOpacity={nyala[i]}
          />
        );
      })}
    </Svg>
  );
}
