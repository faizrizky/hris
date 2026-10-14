import Svg, {
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { Palette } from "@/theme/colors";

export type VarianKepala = "benar" | "gelap" | "menoleh" | "kacamata";

// Ilustrasi kepala tanpa wajah (gaya onboarding) untuk panduan foto profil.
// benar: menghadap depan, terang. gelap: cahaya dari belakang (siluet).
// menoleh: kepala berpaling. kacamata: memakai kacamata gelap.
export function Kepala({
  varian,
  ukuran,
  c,
}: {
  varian: VarianKepala;
  ukuran: number;
  c: Palette;
}) {
  const gelap = varian === "gelap";
  const menoleh = varian === "menoleh";
  const id = (n: string) => `${n}-${varian}`;
  const kulit = gelap ? ["#6B7280", "#3F4652"] : ["#FBE3CD", "#EDB993"];
  const leher = gelap ? "#3A414C" : "#E2A781";
  const rambut = gelap ? ["#2B313A", "#161A20"] : ["#7A4B34", "#3B2418"];
  const baju = gelap ? ["#4B5361", "#2E343D"] : [c.accent, c.accent2];
  // Kepala yang menoleh: wajah menyempit dan bergeser, satu telinga tersembunyi.
  const kepala = menoleh
    ? "translate(66 0) scale(0.84 1) translate(-60 0)"
    : undefined;

  return (
    <Svg width={ukuran} height={(ukuran * 130) / 120} viewBox="0 0 120 130">
      <Defs>
        <RadialGradient id={id("kulit")} cx="45%" cy="40%" r="65%">
          <Stop offset="0" stopColor={kulit[0]} />
          <Stop offset="1" stopColor={kulit[1]} />
        </RadialGradient>
        <LinearGradient id={id("rambut")} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={rambut[0]} />
          <Stop offset="1" stopColor={rambut[1]} />
        </LinearGradient>
        <LinearGradient id={id("baju")} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={baju[0]} />
          <Stop offset="1" stopColor={baju[1]} />
        </LinearGradient>
      </Defs>

      {gelap ? (
        <Polygon
          points="60,4 68,30 94,14 82,40 112,40 88,58 114,74 84,78 98,104 72,90 60,118 48,90 22,104 36,78 6,74 32,58 8,40 38,40 26,14 52,30"
          fill="#FCD34D"
          opacity={0.9}
        />
      ) : null}

      <Path
        d="M12 130 C14 104 34 94 60 94 C86 94 106 104 108 130 Z"
        fill={`url(#${id("baju")})`}
      />
      <Path d="M49 78 L49 98 Q60 106 71 98 L71 78 Z" fill={leher} />

      <G transform={kepala}>
        {!menoleh ? (
          <Ellipse cx={86} cy={58} rx={5} ry={8} fill={kulit[1]} />
        ) : null}
        <Ellipse cx={34} cy={58} rx={5} ry={8} fill={kulit[1]} />
        <Path
          d="M60 22 C78 22 87 36 87 54 C87 74 75 88 60 88 C45 88 33 74 33 54 C33 36 42 22 60 22 Z"
          fill={`url(#${id("kulit")})`}
        />
        {menoleh ? <Path d="M86 50 Q94 57 86 64 Z" fill={kulit[1]} /> : null}
        <Path
          d="M31 56 C28 30 44 14 64 15 C82 16 93 30 90 52 C88 45 84 40 79 37 C71 44 55 44 43 35 C39 42 35 48 31 56 Z"
          fill={`url(#${id("rambut")})`}
        />
        {!gelap ? (
          <Path
            d="M50 20 C58 17 68 18 74 22 C66 21 58 22 50 26 Z"
            fill="#fff"
            opacity={0.18}
          />
        ) : null}
        {varian === "kacamata" ? (
          <>
            <Rect x={39} y={49} width={18} height={11} rx={5} fill="#1F2937" />
            <Rect x={63} y={49} width={18} height={11} rx={5} fill="#1F2937" />
            <Line
              x1={57}
              y1={53}
              x2={63}
              y2={53}
              stroke="#1F2937"
              strokeWidth={2}
            />
            <Rect
              x={42}
              y={51}
              width={6}
              height={2.5}
              rx={1.2}
              fill="#fff"
              opacity={0.35}
            />
            <Rect
              x={66}
              y={51}
              width={6}
              height={2.5}
              rx={1.2}
              fill="#fff"
              opacity={0.35}
            />
          </>
        ) : null}
      </G>
    </Svg>
  );
}
