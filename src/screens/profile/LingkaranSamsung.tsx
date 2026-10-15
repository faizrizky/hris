import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import { CincinWajah } from "./CincinWajah";

export const TICKS = 60;

// Cincin garis ala Face ID tetap di luar lingkaran (garis putih menyala hijau mengikuti arah kepala).
// Di dalam lingkaran: lingkaran putih tipis sebagai panduan wajah dan kaca berbentuk bola di atas kamera,
// meniru layar pendaftaran wajah One UI (video referensi).
const PUTIH = "rgba(255,255,255,0.92)";

// Lingkaran pendaftaran: `anak` (pratinjau kamera) di dalam lingkaran, kaca bola di atasnya yang
// menggelinding terus selama layar terbuka dan menipis (tidak hilang) saat wajah terdeteksi.
export function LingkaranSamsung({
  D,
  terisi,
  selesai,
  adaWajah,
  anak,
}: {
  D: number; // diameter lingkaran kamera
  terisi: number[]; // indeks garis (0..TICKS-1) yang sudah tercapai
  selesai: boolean;
  adaWajah: boolean;
  anak: React.ReactNode;
}) {
  const kanvas = D + 80; // ruang untuk cincin garis di luar lingkaran
  const cx = kanvas / 2;
  const rDalam = (D / 2) * 0.82; // lingkaran putih tipis (panduan wajah)

  const [masuk] = useState(() => new Animated.Value(0));
  const [napas] = useState(() => new Animated.Value(0));
  const [pudar] = useState(() => new Animated.Value(1));
  // Kaca menggelinding terus-menerus selama layar ini terbuka (bukan hanya di awal): dari tepi kiri
  // melebar jadi bola penuh di tengah, lalu menyempit ke tepi kanan, dan mengulang.
  useEffect(() => {
    const putar = Animated.loop(
      Animated.timing(masuk, {
        toValue: 1,
        duration: 2800,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    );
    const bernapas = Animated.loop(
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
    putar.start();
    bernapas.start();
    return () => {
      putar.stop();
      bernapas.stop();
    };
  }, [masuk, napas]);
  useEffect(() => {
    Animated.timing(pudar, {
      // Animasi tetap tampak saat wajah ketemu, hanya lebih tipis supaya wajah terlihat jelas.
      toValue: adaWajah ? 0.38 : 1,
      duration: adaWajah ? 450 : 350,
      useNativeDriver: true,
    }).start();
  }, [adaWajah, pudar]);

  const scaleX = Animated.multiply(
    masuk.interpolate({
      inputRange: [0, 0.25, 0.5, 0.75, 1],
      outputRange: [0.08, 0.7, 1, 0.7, 0.08],
    }),
    napas.interpolate({ inputRange: [0, 1], outputRange: [1, 0.95] }),
  );
  const geser = masuk.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [-D * 0.44, -D * 0.2, 0, D * 0.2, D * 0.44],
  });

  return (
    <View style={{ width: kanvas, height: kanvas }}>
      <CincinWajah
        size={kanvas}
        rIn={D / 2 + 12}
        terisi={terisi}
        selesai={selesai}
        rFoto={D / 2 + 3}
      />
      <View
        style={{
          position: "absolute",
          left: (kanvas - D) / 2,
          top: (kanvas - D) / 2,
          width: D,
          height: D,
          borderRadius: D / 2,
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
                  borderRadius: D / 2,
                  borderWidth: 2,
                  borderColor: "rgba(235,240,255,0.55)",
                },
              ]}
            />
            <View
              style={{
                position: "absolute",
                top: D * 0.03,
                alignSelf: "center",
                width: D * 0.42,
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
          r={rDalam}
          stroke={PUTIH}
          strokeWidth={1.6}
          fill="none"
        />
      </Svg>
    </View>
  );
}
