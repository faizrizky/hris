// Animasi masuk halaman, meniru video referensi:
// 1. Pindah halaman tanpa geser: halaman lama langsung hilang, latar halaman
//    baru tampil kosong.
// 2. Kepala halaman muncul samar lebih dulu.
// 3. Kartu-kartu memudar masuk satu per satu sesuai urutan baca.
//
// Angka diukur frame per frame dari video (60 fps): layar kosong ±100 ms,
// kartu pertama mulai memudar setelahnya dan butuh ±600 ms dengan kurva
// "ease" CSS, kartu berikutnya menyusul tiap ±50 ms (2-4 frame), dan kepala
// halaman muncul cepat sedikit setelah kartu pertama mulai.

import React, {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  FlatList,
  FlatListProps,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { NavigationContext } from "@react-navigation/native";
import { useTheme } from "@/theme/ThemeContext";

const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const ITEM_MS = 500;
const RISE = 40; // jarak naik kartu (pt) sambil memudar
const FIRST_DELAY = 100;
const STEP = 90;
const MAX_STEPS = 12; // daftar panjang tidak menunggu terlalu lama
const SCREEN_DELAY_MS = 120; // kepala halaman
const SCREEN_FADE_MS = 200;
const BATCH_GAP_MS = 50; // item yang dipasang berdekatan dianggap satu gelombang

interface RevealCtx {
  epoch: number; // naik setiap halaman mendapat fokus, memutar ulang animasi
  next: () => number;
}

const RevealContext = createContext<RevealCtx | null>(null);

// Dipasang sekali per halaman lewat screenLayout di navigator.
export function RevealScope({ children }: { children: React.ReactNode }) {
  const c = useTheme();
  const navigation = useContext(NavigationContext);
  const [epoch, setEpoch] = useState(0);
  const [fade] = useState(() => new Animated.Value(0));
  const batch = useRef({ n: 0, t: 0 });

  useEffect(() => {
    const play = () => {
      setEpoch((e) => e + 1);
      fade.setValue(0);
      Animated.timing(fade, {
        toValue: 1,
        delay: SCREEN_DELAY_MS,
        duration: SCREEN_FADE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    };
    // LoginScreen dirender di luar navigator, jadi tidak punya navigation.
    if (!navigation) {
      play();
      return;
    }
    if (navigation.isFocused()) play();
    return navigation.addListener("focus", play);
  }, [navigation, fade]);

  const value = useMemo<RevealCtx>(
    () => ({
      epoch,
      next: () => {
        const now = Date.now();
        if (now - batch.current.t > BATCH_GAP_MS) batch.current.n = 0;
        batch.current.t = now;
        return batch.current.n++;
      },
    }),
    [epoch],
  );

  return (
    <RevealContext.Provider value={value}>
      {/* Latar tampil seketika; isinya yang memudar. */}
      <View style={[styles.fill, { backgroundColor: c.bg }]}>
        <Animated.View style={[styles.fill, { opacity: fade }]}>
          {children}
        </Animated.View>
      </View>
    </RevealContext.Provider>
  );
}

// Satu kartu/blok yang memudar masuk sesuai urutannya.
export function Reveal({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const ctx = useContext(RevealContext);
  const [index] = useState(() => ctx?.next() ?? 0);
  const [a] = useState(() => new Animated.Value(ctx ? 0 : 1));
  const epoch = ctx?.epoch;

  const [y] = useState(() => new Animated.Value(ctx ? 1 : 0));

  useEffect(() => {
    if (epoch === undefined) return;
    a.setValue(0);
    y.setValue(1);
    const delay = FIRST_DELAY + Math.min(index, MAX_STEPS) * STEP;
    const anim = Animated.parallel([
      Animated.timing(a, {
        toValue: 1,
        duration: ITEM_MS,
        delay,
        easing: EASE,
        useNativeDriver: true,
      }),
      // Kartu naik dari bawah posisinya, melambat di akhir.
      Animated.timing(y, {
        toValue: 0,
        duration: ITEM_MS,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [epoch, index, a, y]);

  const translateY = y.interpolate({
    inputRange: [0, 1],
    outputRange: [0, RISE],
  });

  return (
    <Animated.View style={[style, { opacity: a, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

// Properti tata letak yang harus pindah ke pembungkus supaya membungkus anak
// dengan <Reveal> tidak mengubah tampilan.
const LAYOUT_KEYS = [
  "flex",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "alignSelf",
  "zIndex",
] as const;

function bungkus(child: React.ReactNode): React.ReactNode {
  if (!React.isValidElement(child)) return child;
  const el = child as React.ReactElement<{
    style?: StyleProp<ViewStyle>;
    children?: React.ReactNode;
  }>;
  const flat = (StyleSheet.flatten(el.props.style) ?? {}) as ViewStyle;

  // Grid kartu (flexWrap): tiap kartu naik sendiri-sendiri, bukan satu baris
  // sekaligus. Anak berupa View/Pressable dibungkus di sini; komponen kartu
  // kustom (mis. StatCard) membungkus dirinya sendiri dengan <Reveal>.
  if (el.type === View && flat.flexWrap === "wrap") {
    return React.cloneElement(el, {
      children: React.Children.map(el.props.children, (c) =>
        React.isValidElement(c) && typeof c.type !== "function"
          ? bungkus(c)
          : c,
      ),
    });
  }

  const wrapper: ViewStyle = {};
  for (const k of LAYOUT_KEYS) {
    if (flat[k] !== undefined) (wrapper as any)[k] = flat[k];
  }
  // Lebar persen dihitung terhadap pembungkus, jadi dipindah ke pembungkus.
  let isi: React.ReactNode = el;
  if (typeof flat.width === "string" && flat.width.endsWith("%")) {
    wrapper.width = flat.width;
    isi = React.cloneElement(el, {
      style: [el.props.style, { width: "100%" }],
    });
  }
  return (
    <Reveal key={el.key ?? undefined} style={wrapper}>
      {isi}
    </Reveal>
  );
}

// Pengganti ScrollView: setiap anak langsung memudar masuk bergiliran.
export const RevealScrollView = forwardRef<ScrollView, ScrollViewProps>(
  function RevealScrollView({ children, ...props }, ref) {
    return (
      <ScrollView ref={ref} {...props}>
        {React.Children.map(children, bungkus)}
      </ScrollView>
    );
  },
);

type ListSlot = FlatListProps<unknown>["ListHeaderComponent"];

// Header/empty FlatList bisa berupa elemen atau komponen. Fragment dipecah
// supaya setiap kartu di dalamnya tetap bergiliran.
function bungkusSlot(slot: ListSlot): React.ReactElement | undefined {
  if (!slot) return undefined;
  if (React.isValidElement(slot)) {
    const el = slot as React.ReactElement<{ children?: React.ReactNode }>;
    if (el.type === React.Fragment) {
      return <>{React.Children.map(el.props.children, bungkus)}</>;
    }
    return <Reveal>{el}</Reveal>;
  }
  const Comp = slot as React.ComponentType;
  return (
    <Reveal>
      <Comp />
    </Reveal>
  );
}

// Pengganti FlatList: header, item, dan tampilan kosong memudar bergiliran.
export function RevealFlatList<T>({
  renderItem,
  ListHeaderComponent,
  ListEmptyComponent,
  ...props
}: FlatListProps<T>) {
  return (
    <FlatList
      {...props}
      ListHeaderComponent={bungkusSlot(ListHeaderComponent)}
      ListEmptyComponent={bungkusSlot(ListEmptyComponent)}
      renderItem={
        renderItem ? (info) => <Reveal>{renderItem(info)}</Reveal> : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
