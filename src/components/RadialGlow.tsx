import React from "react";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

// Efek "cahaya" radial dari mockup (radial-gradient warna -> transparan).
// React Native nggak punya radial-gradient bawaan kayak CSS, jadi kita gambar
// pakai SVG: lingkaran yang warnanya pudar dari pusat (opacity 1) ke tepi (opacity 0).
interface Props {
  size: number;
  color: string; // format rgba(...), alpha di sini jadi alpha maksimum di pusat
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
}

export function RadialGlow({ size, color, top, left, right, bottom }: Props) {
  const id = `glow-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <Svg
      width={size}
      height={size}
      style={{ position: "absolute", top, left, right, bottom }}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={1} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  );
}
