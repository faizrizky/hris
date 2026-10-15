import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import Svg, { Circle, G, Line } from "react-native-svg";

export const TICKS = 60;

// Warna mengikuti layar Face ID (selalu gelap), bukan tema aplikasi.
const PUTIH = "rgba(255,255,255,0.82)";
const HIJAU = "#3ADE5B";

const LineAnim = Animated.createAnimatedComponent(Line);
const GAnim = Animated.createAnimatedComponent(G);
const CircleAnim = Animated.createAnimatedComponent(Circle);
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

// Cincin garis ala Face ID. Garis putih pendek; saat kepala pernah mengarah ke
// sana, garis memanjang ke luar sambil berubah hijau. Saat `selesai`, garis
// memudar dan diganti satu lingkaran hijau yang tergambar mengelilingi foto.
export function CincinWajah({
  size,
  rIn,
  len = 10,
  lenOn = 20,
  terisi,
  selesai = false,
  rFoto,
}: {
  size: number;
  rIn: number;
  len?: number;
  lenOn?: number;
  terisi: number[];
  selesai?: boolean;
  rFoto: number; // jari-jari foto, untuk lingkaran hijau akhir
}) {
  const [nyala] = useState(() =>
    Array.from({ length: TICKS }, () => new Animated.Value(0)),
  );
  const [tutup] = useState(() => new Animated.Value(0));
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
        duration: 320,
        delay: k * 18,
        easing: EASE,
        useNativeDriver: false,
      }).start();
    });
  }, [terisi, nyala]);

  useEffect(() => {
    Animated.timing(tutup, {
      toValue: selesai ? 1 : 0,
      duration: selesai ? 700 : 0,
      easing: EASE,
      useNativeDriver: false,
    }).start();
  }, [selesai, tutup]);

  const cx = size / 2;
  const keliling = 2 * Math.PI * rFoto;

  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <GAnim
        opacity={tutup.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })}
      >
        {Array.from({ length: TICKS }, (_, i) => {
          const a = ((i * 360) / TICKS - 90) * (Math.PI / 180);
          const cos = Math.cos(a);
          const sin = Math.sin(a);
          const v = nyala[i]!;
          return (
            <G key={i}>
              <Line
                x1={cx + rIn * cos}
                y1={cx + rIn * sin}
                x2={cx + (rIn + len) * cos}
                y2={cx + (rIn + len) * sin}
                stroke={PUTIH}
                strokeWidth={2.4}
                strokeLinecap="round"
              />
              <LineAnim
                x1={cx + rIn * cos}
                y1={cx + rIn * sin}
                x2={v.interpolate({
                  inputRange: [0, 1],
                  outputRange: [
                    cx + (rIn + len) * cos,
                    cx + (rIn + lenOn) * cos,
                  ],
                })}
                y2={v.interpolate({
                  inputRange: [0, 1],
                  outputRange: [
                    cx + (rIn + len) * sin,
                    cx + (rIn + lenOn) * sin,
                  ],
                })}
                stroke={HIJAU}
                strokeWidth={3}
                strokeLinecap="round"
                strokeOpacity={v}
              />
            </G>
          );
        })}
      </GAnim>
      <CircleAnim
        cx={cx}
        cy={cx}
        r={rFoto}
        stroke={HIJAU}
        strokeWidth={4}
        fill="none"
        strokeDasharray={`${keliling} ${keliling}`}
        strokeDashoffset={tutup.interpolate({
          inputRange: [0, 1],
          outputRange: [keliling, 0],
        })}
        rotation={-90}
        origin={`${cx}, ${cx}`}
      />
    </Svg>
  );
}
