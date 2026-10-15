import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import Svg, { Line } from "react-native-svg";
import { Palette } from "@/theme/colors";

export type Arah = "atas" | "kanan" | "bawah" | "kiri";

export const TICKS = 48;
// Tiap arah memiliki 12 garis, berpusat di atas (0), kanan (12), bawah (24), kiri (36).
const PUSAT: Record<Arah, number> = { atas: 0, kanan: 12, bawah: 24, kiri: 36 };
const garisArah = (a: Arah) =>
  Array.from({ length: 12 }, (_, k) => (PUSAT[a] - 6 + k + TICKS) % TICKS);

const LineAnim = Animated.createAnimatedComponent(Line);
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

// Cincin garis bergaya Face ID. Garis abu-abu menyala hijau satu per satu saat
// sebuah arah tercapai; garis biru kecil menunjukkan arah kepala saat ini.
export function CincinWajah({
  size,
  rIn,
  rOut,
  selesai,
  kini,
  c,
}: {
  size: number;
  rIn: number;
  rOut: number;
  selesai: Arah[];
  kini: number | null; // indeks garis arah kepala saat ini, null bila belum menoleh
  c: Palette;
}) {
  const [nyala] = useState(() =>
    Array.from({ length: TICKS }, () => new Animated.Value(0)),
  );
  const sudah = useRef(new Set<Arah>());

  useEffect(() => {
    const baru = selesai.filter((a) => !sudah.current.has(a));
    baru.forEach((a) => {
      sudah.current.add(a);
      // Menyala berurutan dari tengah arah ke kedua sisinya.
      const jarak = (x: number) => {
        let d = (((x - PUSAT[a]) % TICKS) + TICKS) % TICKS;
        if (d > TICKS / 2) d -= TICKS;
        return Math.abs(d);
      };
      const urut = garisArah(a).sort((x, y) => jarak(x) - jarak(y));
      Animated.stagger(
        28,
        urut.map((i) =>
          Animated.timing(nyala[i]!, {
            toValue: 1,
            duration: 260,
            easing: EASE,
            useNativeDriver: false,
          }),
        ),
      ).start();
    });
    if (selesai.length === 0 && sudah.current.size > 0) {
      sudah.current.clear();
      nyala.forEach((v) => v.setValue(0));
    }
  }, [selesai, nyala]);

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
