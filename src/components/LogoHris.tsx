import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Rect,
  Stop,
} from "react-native-svg";

// Logo HRIS: huruf H dengan sosok orang di antara dua tiangnya, di atas kotak
// bergradien biru. Sama dengan ikon aplikasi dan layar pembuka native.
export function LogoHris({
  size,
  warna1 = "#2490EF",
  warna2 = "#1B6FC9",
  tanda = "#FFFFFF",
  tanpaLatar = false,
}: {
  size: number;
  warna1?: string;
  warna2?: string;
  tanda?: string;
  tanpaLatar?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Defs>
        <LinearGradient id="latar" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={warna1} />
          <Stop offset="1" stopColor={warna2} />
        </LinearGradient>
      </Defs>
      {tanpaLatar ? null : (
        <Rect width={1024} height={1024} rx={230} fill="url(#latar)" />
      )}
      <Rect x={300} y={292} width={86} height={440} rx={43} fill={tanda} />
      <Rect x={638} y={292} width={86} height={440} rx={43} fill={tanda} />
      <Rect x={386} y={498} width={252} height={84} fill={tanda} />
      <Circle cx={512} cy={372} r={54} fill={tanda} />
    </Svg>
  );
}
