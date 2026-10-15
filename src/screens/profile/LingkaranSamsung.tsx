import { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Path,
  Stop,
} from "react-native-svg";
import { CincinWajah } from "./CincinWajah";

export const TICKS = 60;

// Cincin garis ala Face ID tetap di luar lingkaran (garis putih menyala hijau mengikuti arah kepala).
// Di dalam lingkaran (meniru layar pendaftaran wajah One UI di video referensi): lingkaran putih tipis sebagai
// panduan wajah dan sebuah "irisan bola kaca" (gore) yang terus menggelinding melintasi lingkaran: bola kaca
// berputar pada sumbu tegak, irisan di antara dua garis bujur terlihat sebagai sabit di tepi kiri, melebar,
// bergeser melewati tengah sebagai lensa, lalu menyempit jadi sabit di tepi kanan, dan mengulang.
const PUTIH = "rgba(255,255,255,0.92)";
const IRISAN_DERAJAT = 55; // lebar irisan (selisih garis bujur)
const LINTAS_MS = 1100; // satu lintasan kiri ke kanan
const JEDA_MS = 450;

const rad = (d: number) => (d * Math.PI) / 180;
const jepit = (d: number) => Math.max(-90, Math.min(90, d));

// Jalur irisan: batas kiri/kanan = proyeksi dua garis bujur pada bola berjari-jari R. Garis bujur di balik
// tepi bola (|sudut| > 90) menempel di tepi lingkaran, itulah yang membentuk sabit.
function jalurIrisan(R: number, a1: number): string {
  const a2 = a1 + IRISAN_DERAJAT;
  if (a2 <= -90 || a1 >= 90) return "";
  const N = 36;
  const kiri: string[] = [];
  const kanan: string[] = [];
  for (let i = 0; i <= N; i++) {
    const y = -R + (2 * R * i) / N;
    const g = Math.sqrt(Math.max(0, 1 - (y / R) * (y / R)));
    const x1 = R * Math.sin(rad(jepit(a1))) * g;
    const x2 = R * Math.sin(rad(jepit(a2))) * g;
    kiri.push(`${(R + x1).toFixed(1)} ${(R + y).toFixed(1)}`);
    kanan.push(`${(R + x2).toFixed(1)} ${(R + y).toFixed(1)}`);
  }
  return `M ${kiri.join(" L ")} L ${kanan.reverse().join(" L ")} Z`;
}

function KacaIrisan({ D, redup }: { D: number; redup: Animated.Value }) {
  const R = D / 2;
  const [a1, setA1] = useState(-90 - IRISAN_DERAJAT);
  useEffect(() => {
    let raf = 0;
    let mati = false;
    const t0 = Date.now();
    let terakhir = 0;
    const lingkar = () => {
      if (mati) return;
      const sekarang = Date.now();
      if (sekarang - terakhir >= 24) {
        terakhir = sekarang;
        const t = (sekarang - t0) % (LINTAS_MS + JEDA_MS);
        const f = Math.min(1, t / LINTAS_MS);
        const halus = 0.5 - 0.5 * Math.cos(Math.PI * f); // pelan di ujung, cepat di tengah
        setA1(-90 - IRISAN_DERAJAT + halus * (180 + IRISAN_DERAJAT));
      }
      raf = requestAnimationFrame(lingkar);
    };
    raf = requestAnimationFrame(lingkar);
    return () => {
      mati = true;
      cancelAnimationFrame(raf);
    };
  }, []);
  const d = jalurIrisan(R, a1);
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity: redup }]}
    >
      {/* Semburat ungu di bagian atas lingkaran, seperti di video. */}
      <LinearGradient
        colors={["rgba(160,148,230,0.38)", "rgba(160,148,230,0)"]}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: D * 0.4,
        }}
      />
      <Svg width={D} height={D}>
        <Defs>
          <SvgGradient id="irisan" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="rgb(196,210,228)" stopOpacity={0.78} />
            <Stop offset="1" stopColor="rgb(104,124,156)" stopOpacity={0.5} />
          </SvgGradient>
        </Defs>
        {d ? (
          <Path
            d={d}
            fill="url(#irisan)"
            stroke="rgba(228,236,255,0.6)"
            strokeWidth={1}
          />
        ) : null}
      </Svg>
    </Animated.View>
  );
}

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
  const [redup] = useState(() => new Animated.Value(1));
  useEffect(() => {
    // Animasi tetap berjalan saat wajah ketemu, hanya lebih tipis supaya wajah terlihat jelas.
    Animated.timing(redup, {
      toValue: adaWajah ? 0.5 : 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [adaWajah, redup]);

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
        <KacaIrisan D={D} redup={redup} />
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
