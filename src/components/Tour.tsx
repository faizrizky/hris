// Tutorial sorot (spotlight): tiap langkah membuka halaman yang dijelaskan, lalu menyorot elemennya. Tampil otomatis
// sekali per perangkat terdaftar (tanda disimpan di HP dan di Registered Device); bisa diputar ulang per bagian dari
// Profil. Isi langkah ada di src/tour/steps.ts. Lapisan menahan semua sentuhan, jadi tidak ada yang terkirim.
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Animated,
  BackHandler,
  Easing,
  PixelRatio,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Spotlight } from "@/components/Spotlight";
import { scrollFocused, tourNodes } from "@/components/TourTarget";
import { useT } from "@/i18n";
import { navigationRef } from "@/navigation/navigationRef";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { useTenant } from "@/services/tenant";
import { Palette, primaryButtonStyle } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import {
  buildTour,
  type TourRoute,
  type TourSectionId,
  type TourStep,
} from "@/tour/steps";

const SEEN_KEY = "hris.tourSeen.v2";
const START_DELAY_MS = 900; // menunggu animasi masuk Beranda selesai
const PAGE_WAIT_MS = 1000; // halaman baru: tunggu isinya selesai memudar naik (Reveal), kalau tidak posisi meleset
const SCROLL_WAIT_MS = 380; // gulir beranimasi sebelum target diukur ulang
const RETRY_MS = 120;
const MAX_TRIES = 25; // sebagian halaman menunggu data server sebelum elemennya ada
const MOVE_MS = 300;
const PAD = 6;
const CARD_SPACE = 290; // tinggi yang disisakan untuk kartu

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

let activeTour: TourStep[] | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const setTour = (steps: TourStep[] | null) => {
  activeTour = steps;
  listeners.forEach((listener) => listener());
};

// Buka sebuah halaman dengan tumpukan bersih, supaya puluhan langkah tidak menumpuk puluhan layar.
const openRoute = ({ tab, screen, params }: TourRoute) => {
  if (!navigationRef.isReady()) return;
  const main = tab === "Beranda" ? "HomeMain" : "ProfileMain";
  const routes = screen
    ? [{ name: main }, { name: screen, params }]
    : [{ name: main }];
  navigationRef.reset({
    index: 0,
    routes: [{ name: tab, state: { index: routes.length - 1, routes } }],
  });
};

export const isTourSeen = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(SEEN_KEY)) === "1";
  } catch {
    return true; // penyimpanan tidak bisa dibaca: jangan mengulang tutorial setiap kali
  }
};

const finishTour = () => {
  AsyncStorage.setItem(SEEN_KEY, "1").catch(() => {});
  setTour(null);
  openRoute({ tab: "Beranda" }); // Beranda membaca tanda di atas sebelum memunculkan pengingat
  // Gagal kirim tidak apa-apa: useHome mengirim ulang tanda di HP saat aplikasi dibuka lagi.
  hrisApi.registerDevice(true).catch(() => {});
};

// section kosong = seluruh tutorial; selain itu hanya bagian yang dipilih.
export function useStartTour() {
  const { employee } = useSession();
  const { punyaFitur } = useTenant();
  return (section: TourSectionId | null) => {
    if (!employee || activeTour) return;
    setTour(buildTour({ section, role: employee.role, has: punyaFitur }));
  };
}

// Dipasang Beranda setelah datanya tampil, pada perangkat yang belum pernah melihat tutorial.
export function TourStarter() {
  const start = useStartTour();
  const latest = useRef(start);
  useEffect(() => {
    latest.current = start;
  });
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!(await isTourSeen())) latest.current(null);
    }, START_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  return null;
}

export function TourOverlay() {
  const steps = useSyncExternalStore(subscribe, () => activeTour);
  return steps ? <TourSteps steps={steps} /> : null;
}

const measureNode = (node: View) =>
  new Promise<Box | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), 200);
    node.measureInWindow((x, y, w, h) => {
      clearTimeout(timer);
      resolve({ x, y, w, h });
    });
  });

// Node pertama yang benar-benar tampil (layar tersembunyi melapor ukuran nol).
const measureTarget = async (id: string, width: number) => {
  for (const node of tourNodes(id)) {
    const box = await measureNode(node);
    if (box && box.w > 0 && box.h > 0 && box.x > -10 && box.x < width) {
      return box;
    }
  }
  return null;
};

function TourSteps({ steps }: { steps: TourStep[] }) {
  const t = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const rootRef = useRef<View>(null);
  const [index, setIndex] = useState(0);
  // Langkah yang sedang tampil di kartu; berganti hanya saat kartu tak terlihat supaya teks tidak meloncat.
  const [shown, setShown] = useState<{ index: number; hole: Box | null }>({
    index: 0,
    hole: null,
  });
  const [anim] = useState(() => ({
    left: new Animated.Value(width / 2),
    top: new Animated.Value(height / 2),
    right: new Animated.Value(width / 2),
    bottom: new Animated.Value(height / 2),
    ring: new Animated.Value(0),
    card: new Animated.Value(0),
  }));
  const openedRoute = useRef("");
  const total = steps.length;
  const step = steps[shown.index]!;
  const isLast = shown.index === total - 1;

  useEffect(() => {
    let isCancelled = false;
    const { target, route, isFixed } = steps[index]!;
    const wait = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));
    const glide = (value: Animated.Value, toValue: number) =>
      Animated.timing(value, {
        toValue,
        duration: MOVE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
    const moveHole = (hole: Box | null) => {
      const to = hole ?? { x: width / 2, y: height / 2, w: 0, h: 0 };
      const snap = PixelRatio.roundToNearestPixel; // tepi pecahan memunculkan garis rambut antar bidang
      return [
        glide(anim.left, snap(to.x)),
        glide(anim.top, snap(to.y)),
        glide(anim.right, snap(to.x + to.w)),
        glide(anim.bottom, snap(to.y + to.h)),
        glide(anim.ring, hole ? 1 : 0),
      ];
    };
    // Cari elemen sampai ada dan posisinya diam (data halaman masih bisa menggesernya).
    const locate = async () => {
      if (!target || !rootRef.current) return null;
      const root = await measureNode(rootRef.current);
      let previous: Box | null = null;
      let canScroll = !isFixed;
      for (let i = 0; i < MAX_TRIES && !isCancelled; i++) {
        const box: Box | null = await measureTarget(target, width);
        const isStill = !!box && !!previous && Math.abs(box.y - previous.y) < 1;
        previous = box;
        if (!box || !isStill) {
          await wait(RETRY_MS);
          continue;
        }
        const top = box.y - (root?.y ?? 0);
        const isHidden =
          top < insets.top + 60 ||
          (top + box.h > height - CARD_SPACE && top > insets.top + 170);
        if (canScroll && isHidden && scrollFocused(top - insets.top - 150)) {
          canScroll = false;
          previous = null;
          await wait(SCROLL_WAIT_MS);
          continue;
        }
        return { x: box.x - (root?.x ?? 0), y: top, w: box.w, h: box.h };
      }
      return null;
    };
    const run = async () => {
      // Kartu memudar dulu, baru halaman dan sorotan berpindah.
      await new Promise<void>((resolve) =>
        Animated.timing(anim.card, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }).start(() => resolve()),
      );
      if (isCancelled) return;
      const key = route ? JSON.stringify(route) : openedRoute.current;
      if (route && key !== openedRoute.current) {
        openedRoute.current = key;
        Animated.parallel(moveHole(null)).start();
        openRoute(route);
        await wait(PAGE_WAIT_MS);
      }
      const box = await locate();
      if (isCancelled) return;
      let hole = box && {
        x: box.x - PAD,
        y: box.y - PAD,
        w: box.w + PAD * 2,
        h: box.h + PAD * 2,
      };
      // Elemen tinggi dipotong supaya kartu penjelasan tetap muat di bawahnya.
      if (
        hole &&
        hole.y < CARD_SPACE &&
        hole.y + hole.h > height - CARD_SPACE
      ) {
        hole = { ...hole, h: Math.max(60, height - CARD_SPACE - hole.y) };
      }
      setShown({ index, hole });
      Animated.parallel([
        ...moveHole(hole),
        Animated.timing(anim.card, {
          toValue: 1,
          duration: 260,
          delay: MOVE_MS - 120,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    };
    void run();
    return () => {
      isCancelled = true;
    };
  }, [index, steps, width, height, insets.top, anim]);

  useEffect(() => {
    // Tombol kembali Android melewati tutorial, bukan memindahkan halaman di belakangnya.
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      finishTour();
      return true;
    });
    return () => sub.remove();
  }, []);

  const hole = shown.hole;
  // Kartu diletakkan di sisi yang ruangnya lebih lega.
  const isCardBelow = !!hole && height - (hole.y + hole.h) > hole.y;
  const cardPosition = !hole
    ? step.route
      ? { bottom: insets.bottom + 24 }
      : { top: height * 0.3 }
    : isCardBelow
      ? { top: hole.y + hole.h + 16 }
      : { bottom: height - hole.y + 16 };
  const isBusy = shown.index !== index; // tombol diabaikan selama perpindahan

  return (
    <View ref={rootRef} collapsable={false} style={StyleSheet.absoluteFill}>
      {/* Menahan semua sentuhan ke layar di belakang. */}
      <Pressable style={StyleSheet.absoluteFill} accessible={false} />
      <Spotlight edges={anim} width={width} height={height} />
      <Animated.View
        renderToHardwareTextureAndroid
        style={[
          styles.card,
          cardPosition,
          {
            opacity: anim.card,
            transform: [
              {
                translateY: anim.card.interpolate({
                  inputRange: [0, 1],
                  outputRange: [isCardBelow || !hole ? 10 : -10, 0],
                }),
              },
            ],
          },
        ]}
        accessibilityViewIsModal
        accessibilityLiveRegion="polite"
      >
        <View style={styles.headRow}>
          <Text style={styles.count}>
            {t("tour.count", { n: shown.index + 1, total })}
          </Text>
          {isLast ? null : (
            <Pressable
              accessibilityRole="button"
              onPress={finishTour}
              hitSlop={12}
            >
              <Text style={styles.skip}>{t("tour.skip")}</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${((shown.index + 1) / total) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.title}>{t(step.title)}</Text>
        <Text style={styles.text}>{t(step.text)}</Text>
        <View style={styles.actions}>
          {shown.index > 0 && !isLast ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("tour.back")}
              style={styles.back}
              disabled={isBusy}
              onPress={() => setIndex(shown.index - 1)}
            >
              <Ionicons name="chevron-back" size={18} color={c.ink} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={isBusy}
            style={({ pressed }) => [styles.next, pressed && { opacity: 0.85 }]}
            onPress={() => (isLast ? finishTour() : setIndex(shown.index + 1))}
          >
            <Text style={styles.nextText}>
              {t(
                isLast
                  ? "tour.finish"
                  : shown.index === 0
                    ? "tour.start"
                    : "tour.next",
              )}
            </Text>
            <Ionicons
              name={isLast ? "checkmark" : "arrow-forward"}
              size={16}
              color="#FFFFFF"
            />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      position: "absolute",
      left: 16,
      right: 16,
      backgroundColor: c.card,
      borderRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 18,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 24,
      elevation: 12,
    },
    headRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    count: { fontSize: 12, fontWeight: "700", color: c.accent },
    skip: { fontSize: 13, fontWeight: "600", color: c.muted },
    track: {
      height: 4,
      borderRadius: 2,
      backgroundColor: c.chip,
      marginTop: 10,
      overflow: "hidden",
    },
    fill: { height: 4, borderRadius: 2, backgroundColor: c.accent },
    title: { fontSize: 18, fontWeight: "800", color: c.ink, marginTop: 14 },
    text: { fontSize: 14, lineHeight: 21, color: c.muted, marginTop: 6 },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: 10,
      marginTop: 18,
    },
    back: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: c.chip,
      alignItems: "center",
      justifyContent: "center",
    },
    next: {
      ...primaryButtonStyle(c),
      backgroundColor: c.accent,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      height: 46,
      borderRadius: 23,
      paddingHorizontal: 22,
    },
    nextText: { fontSize: 14.5, fontWeight: "700", color: "#FFFFFF" },
  });
