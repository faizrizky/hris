import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import Svg, { Circle, G, Line } from "react-native-svg";

export const TICKS = 60;

// Warna mengikuti layar Face ID (selalu gelap), bukan tema aplikasi.
const WHITE = "rgba(255,255,255,0.82)";
const GREEN = "#3ADE5B";

const LineAnim = Animated.createAnimatedComponent(Line);
const GAnim = Animated.createAnimatedComponent(G);
const CircleAnim = Animated.createAnimatedComponent(Circle);
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

// Cincin garis ala Face ID. Garis putih pendek; saat kepala pernah mengarah ke
// sana, garis memanjang ke luar sambil berubah hijau. Saat `selesai`, garis
// memudar dan diganti satu lingkaran hijau yang tergambar mengelilingi foto.
export function FaceRing({
  size,
  rIn,
  len = 10,
  lenOn = 20,
  filledTicks,
  isFinished = false,
  photoRadius,
}: {
  size: number;
  rIn: number;
  len?: number;
  lenOn?: number;
  filledTicks: number[];
  isFinished?: boolean;
  photoRadius: number; // jari-jari foto, untuk lingkaran hijau akhir
}) {
  const [litTicks] = useState(() =>
    Array.from({ length: TICKS }, () => new Animated.Value(0)),
  );
  const [closeProgress] = useState(() => new Animated.Value(0));
  const litSet = useRef(new Set<number>());

  useEffect(() => {
    if (filledTicks.length === 0 && litSet.current.size > 0) {
      litSet.current.clear();
      litTicks.forEach((v) => v.setValue(0));
      return;
    }
    const baru = filledTicks.filter((i) => !litSet.current.has(i));
    baru.forEach((i, k) => {
      litSet.current.add(i);
      Animated.timing(litTicks[i]!, {
        toValue: 1,
        duration: 320,
        delay: k * 18,
        easing: EASE,
        useNativeDriver: false,
      }).start();
    });
  }, [filledTicks, litTicks]);

  useEffect(() => {
    Animated.timing(closeProgress, {
      toValue: isFinished ? 1 : 0,
      duration: isFinished ? 700 : 0,
      easing: EASE,
      useNativeDriver: false,
    }).start();
  }, [isFinished, closeProgress]);

  const cx = size / 2;
  const circumference = 2 * Math.PI * photoRadius;

  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <GAnim
        opacity={closeProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0],
        })}
      >
        {Array.from({ length: TICKS }, (_, i) => {
          const a = ((i * 360) / TICKS - 90) * (Math.PI / 180);
          const cos = Math.cos(a);
          const sin = Math.sin(a);
          const v = litTicks[i]!;
          return (
            <G key={i}>
              <Line
                x1={cx + rIn * cos}
                y1={cx + rIn * sin}
                x2={cx + (rIn + len) * cos}
                y2={cx + (rIn + len) * sin}
                stroke={WHITE}
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
                stroke={GREEN}
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
        r={photoRadius}
        stroke={GREEN}
        strokeWidth={4}
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={closeProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [circumference, 0],
        })}
        rotation={-90}
        origin={`${cx}, ${cx}`}
      />
    </Svg>
  );
}
