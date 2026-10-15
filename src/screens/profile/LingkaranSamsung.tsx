import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path } from "react-native-svg";

export const TICKS = 60;

// Warna meniru layar pendaftaran wajah One UI (video referensi): cincin luar abu-abu keunguan tebal,
// lingkaran putih tipis di dalamnya sebagai panduan wajah, kemajuan berupa busur hijau di cincin luar.
const CINCIN = "#8C8AB8";
const PUTIH = "rgba(255,255,255,0.92)";
const HIJAU = "#3DDC6E";

const PathAnim = Animated.createAnimatedComponent(Path);
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

function busur(cx: number, r: number, deg0: number, deg1: number) {
  const rad = (d: number) => ((d - 90) * Math.PI) / 180;
  const x0 = cx + r * Math.cos(rad(deg0));
  const y0 = cx + r * Math.sin(rad(deg0));
  const x1 = cx + r * Math.cos(rad(deg1));
  const y1 = cx + r * Math.sin(rad(deg1));
  return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
}

// Lingkaran pendaftaran gaya Samsung. `anak` (pratinjau kamera) ditaruh di dalam cincin, dengan
// kaca berbentuk bola di atasnya: berputar masuk saat dibuka, tetap tampak selama wajah belum
// terdeteksi, lalu memudar saat wajah ketemu.
export function LingkaranSamsung({
  D,
  terisi,
  adaWajah,
  anak,
}: {
  D: number; // diameter luar cincin
  terisi: number[]; // indeks busur (0..TICKS-1) yang sudah tercapai
  adaWajah: boolean;
  anak: React.ReactNode;
}) {
  const lebarCincin = 6;
  const kanvas = D + 12;
  const cx = kanvas / 2;
  const rLuar = D / 2 - lebarCincin / 2;
  const rDalam = D / 2 - lebarCincin - 8;
  const dKamera = (rDalam + 10) * 2; // pratinjau mengisi sampai tepi cincin dalam

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
    terisi
      .filter((i) => !sudah.current.has(i))
      .forEach((i, k) => {
        sudah.current.add(i);
        Animated.timing(nyala[i]!, {
          toValue: 1,
          duration: 300,
          delay: k * 16,
          easing: EASE,
          useNativeDriver: false,
        }).start();
      });
  }, [terisi, nyala]);

  // Kaca bola: masuk dengan menggelinding (lebar mengembang sambil bergeser), lalu "bernapas" pelan.
  const [masuk] = useState(() => new Animated.Value(0));
  const [napas] = useState(() => new Animated.Value(0));
  const [pudar] = useState(() => new Animated.Value(1));
  useEffect(() => {
    Animated.timing(masuk, {
      toValue: 1,
      duration: 1500,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(napas, {
          toValue: 1,
          duration: 1700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(napas, {
          toValue: 0,
          duration: 1700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [masuk, napas]);
  useEffect(() => {
    Animated.timing(pudar, {
      toValue: adaWajah ? 0 : 1,
      duration: adaWajah ? 450 : 350,
      useNativeDriver: true,
    }).start();
  }, [adaWajah, pudar]);

  const scaleX = Animated.multiply(
    masuk.interpolate({
      inputRange: [0, 0.35, 0.6, 1],
      outputRange: [0.08, 0.7, 0.28, 1],
    }),
    napas.interpolate({ inputRange: [0, 1], outputRange: [1, 0.95] }),
  );
  const geser = masuk.interpolate({
    inputRange: [0, 0.35, 0.6, 1],
    outputRange: [-dKamera * 0.42, -dKamera * 0.18, dKamera * 0.2, 0],
  });

  return (
    <View style={{ width: kanvas, height: kanvas }}>
      <View
        style={{
          position: "absolute",
          left: (kanvas - dKamera) / 2,
          top: (kanvas - dKamera) / 2,
          width: dKamera,
          height: dKamera,
          borderRadius: dKamera / 2,
          overflow: "hidden",
          backgroundColor: "#000",
        }}
      >
        {anak}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { opacity: pudar }]}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ translateX: geser }, { scaleX }] },
            ]}
          >
            <LinearGradient
              colors={[
                "rgba(214,226,240,0.66)",
                "rgba(150,170,196,0.34)",
                "rgba(70,86,112,0.22)",
              ]}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: dKamera / 2,
                  borderWidth: 2,
                  borderColor: "rgba(235,240,255,0.55)",
                },
              ]}
            />
            <View
              style={{
                position: "absolute",
                top: dKamera * 0.03,
                alignSelf: "center",
                width: dKamera * 0.42,
                height: 6,
                borderRadius: 3,
                backgroundColor: "rgba(255,255,255,0.55)",
              }}
            />
          </Animated.View>
        </Animated.View>
      </View>

      <Svg
        width={kanvas}
        height={kanvas}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Circle
          cx={cx}
          cy={cx}
          r={rLuar}
          stroke={CINCIN}
          strokeWidth={lebarCincin}
          fill="none"
        />
        {Array.from({ length: TICKS }, (_, i) => {
          const a0 = (i * 360) / TICKS - 3;
          const a1 = ((i + 1) * 360) / TICKS + 0.5;
          return (
            <PathAnim
              key={i}
              d={busur(cx, rLuar, a0, a1)}
              stroke={HIJAU}
              strokeWidth={lebarCincin + 1}
              strokeLinecap="butt"
              fill="none"
              strokeOpacity={nyala[i]}
            />
          );
        })}
        <Circle
          cx={cx}
          cy={cx}
          r={rDalam}
          stroke={PUTIH}
          strokeWidth={1.6}
          fill="none"
        />
      </Svg>
    </View>
  );
}
