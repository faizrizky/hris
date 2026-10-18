import { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient as SvgGradient,
  Path,
  Mask,
  Pattern,
  Rect,
  Stop,
} from "react-native-svg";
import { FaceRing } from "./CincinWajah";

export const TICKS = 60;

// Cincin garis ala Face ID tetap di luar lingkaran (garis putih menyala hijau mengikuti arah kepala).
// Di dalam lingkaran (meniru layar pendaftaran wajah One UI di video referensi): lingkaran putih tipis sebagai
// panduan wajah dan sebuah "irisan bola kaca" (gore) yang terus menggelinding melintasi lingkaran: bola kaca
// berputar pada sumbu tegak, irisan di antara dua garis bujur terlihat sebagai sabit di tepi kiri, melebar,
// bergeser melewati tengah sebagai lensa, lalu menyempit jadi sabit di tepi kanan, dan mengulang.
const WHITE = "rgba(255,255,255,0.92)";
const WEDGE_DEGREES = 55; // lebar irisan (selisih garis bujur)
const SWEEP_MS = 1100; // satu lintasan
const DIRECTION_ANGLE = [0, 90, 180, 270]; // lintasan bergantian: kiri-kanan, atas-bawah, kanan-kiri, bawah-atas
const PAUSE_MS = 450;

const rad = (d: number) => (d * Math.PI) / 180;
const clamp = (d: number) => Math.max(-90, Math.min(90, d));

// Jalur irisan: batas kiri/kanan = proyeksi dua garis bujur pada bola berjari-jari R. Garis bujur di balik
// tepi bola (|sudut| > 90) menempel di tepi lingkaran, itulah yang membentuk sabit.
function wedgePath(R: number, a1: number): string {
  const a2 = a1 + WEDGE_DEGREES;
  if (a2 <= -90 || a1 >= 90) return "";
  const N = 36;
  const kiri: string[] = [];
  const right: string[] = [];
  for (let i = 0; i <= N; i++) {
    const y = -R + (2 * R * i) / N;
    const g = Math.sqrt(Math.max(0, 1 - (y / R) * (y / R)));
    const x1 = R * Math.sin(rad(clamp(a1))) * g;
    const x2 = R * Math.sin(rad(clamp(a2))) * g;
    kiri.push(`${(R + x1).toFixed(1)} ${(R + y).toFixed(1)}`);
    right.push(`${(R + x2).toFixed(1)} ${(R + y).toFixed(1)}`);
  }
  return `M ${kiri.join(" L ")} L ${right.reverse().join(" L ")} Z`;
}

// Garis tepi tipis di sisi depan irisan (meridian pada a2): satu garis halus yang meruncing ke ujung.
function edgePath(R: number, a1: number): string {
  const a2 = a1 + WEDGE_DEGREES;
  if (a2 <= -90 || a1 >= 90) return "";
  const N = 36;
  const t: string[] = [];
  for (let i = 0; i <= N; i++) {
    const y = -R + (2 * R * i) / N;
    const g = Math.sqrt(Math.max(0, 1 - (y / R) * (y / R)));
    const x = R * Math.sin(rad(clamp(a2))) * g;
    t.push(`${(R + x).toFixed(1)} ${(R + y).toFixed(1)}`);
  }
  return `M ${t.join(" L ")}`;
}

function WedgeGlass({
  D,
  innerRadius,
  dim,
}: {
  D: number;
  innerRadius: number;
  dim: Animated.Value;
}) {
  // Kaca hidup di dalam lingkaran putih tipis (panduan wajah), bukan di seluruh lingkaran kamera.
  const R = innerRadius;
  const [a1, setA1] = useState(-90 - WEDGE_DEGREES);
  const [sweep, setSweep] = useState(0);
  useEffect(() => {
    let frameHandle = 0;
    let isDisabled = false;
    const t0 = Date.now();
    let lastLocation = 0;
    const ringRadius = () => {
      if (isDisabled) return;
      const nowMs = Date.now();
      if (nowMs - lastLocation >= 24) {
        lastLocation = nowMs;
        const cycle = SWEEP_MS + PAUSE_MS;
        const t = (nowMs - t0) % cycle;
        setSweep(Math.floor((nowMs - t0) / cycle) % DIRECTION_ANGLE.length);
        const f = Math.min(1, t / SWEEP_MS);
        const smooth = 0.5 - 0.5 * Math.cos(Math.PI * f); // pelan di ujung, cepat di tengah
        setA1(-90 - WEDGE_DEGREES + smooth * (180 + WEDGE_DEGREES));
      }
      frameHandle = requestAnimationFrame(ringRadius);
    };
    frameHandle = requestAnimationFrame(ringRadius);
    return () => {
      isDisabled = true;
      cancelAnimationFrame(frameHandle);
    };
  }, []);
  const d = wedgePath(R, a1);
  const edge = edgePath(R, a1);
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity: dim }]}
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
          <Pattern
            id="titik"
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
          >
            <Circle cx="2.5" cy="2.5" r="1.1" fill="rgba(255,255,255,0.28)" />
          </Pattern>
          <SvgGradient id="pudar" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#fff" stopOpacity={0} />
            <Stop offset="0.28" stopColor="#fff" stopOpacity={0.55} />
            <Stop offset="0.5" stopColor="#fff" stopOpacity={1} />
            <Stop offset="0.72" stopColor="#fff" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0} />
          </SvgGradient>
          <Mask
            id="ujung"
            x="0"
            y="0"
            width={2 * R}
            height={2 * R}
            maskUnits="userSpaceOnUse"
          >
            <Rect x="0" y="0" width={2 * R} height={2 * R} fill="url(#pudar)" />
          </Mask>
          <SvgGradient id="irisan" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="rgb(150,170,200)" stopOpacity={0.06} />
            <Stop offset="0.6" stopColor="rgb(176,194,220)" stopOpacity={0.4} />
            <Stop offset="1" stopColor="rgb(214,226,244)" stopOpacity={0.62} />
          </SvgGradient>
        </Defs>
        {d ? (
          <G
            transform={`translate(${D / 2 - R} ${D / 2 - R}) rotate(${DIRECTION_ANGLE[sweep]} ${R} ${R})`}
          >
            <G mask="url(#ujung)">
              <Path d={d} fill="url(#irisan)" />
              <Path
                d={edge}
                fill="none"
                stroke="rgba(240,245,255,0.9)"
                strokeWidth={1.2}
                strokeLinecap="round"
              />
              <Path d={d} fill="url(#titik)" />
            </G>
          </G>
        ) : null}
      </Svg>
    </Animated.View>
  );
}

export function SamsungRing({
  D,
  filledTicks,
  isFinished,
  hasFace,
  children,
}: {
  D: number; // diameter lingkaran kamera
  filledTicks: number[]; // indeks garis (0..TICKS-1) yang sudah tercapai
  isFinished: boolean;
  hasFace: boolean;
  children: React.ReactNode;
}) {
  const canvas = D + 80; // ruang untuk cincin garis di luar lingkaran
  const cx = canvas / 2;
  const rDalam = (D / 2) * 0.82; // lingkaran putih tipis (panduan wajah)
  const [dimColor] = useState(() => new Animated.Value(1));
  useEffect(() => {
    // Animasi tetap berjalan saat wajah ketemu, hanya lebih tipis supaya wajah terlihat jelas.
    Animated.timing(dimColor, {
      toValue: hasFace ? 0.5 : 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [hasFace, dimColor]);

  return (
    <View style={{ width: canvas, height: canvas }}>
      <FaceRing
        size={canvas}
        rIn={D / 2 + 12}
        filledTicks={filledTicks}
        isFinished={isFinished}
        photoRadius={D / 2 + 3}
      />
      <View
        style={{
          position: "absolute",
          left: (canvas - D) / 2,
          top: (canvas - D) / 2,
          width: D,
          height: D,
          borderRadius: D / 2,
          overflow: "hidden",
          backgroundColor: "#000",
        }}
      >
        {children}
        <WedgeGlass D={D} innerRadius={rDalam} dim={dimColor} />
      </View>

      <Svg
        width={canvas}
        height={canvas}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Circle
          cx={cx}
          cy={cx}
          r={rDalam}
          stroke={WHITE}
          strokeWidth={1.6}
          fill="none"
        />
      </Svg>
    </View>
  );
}
