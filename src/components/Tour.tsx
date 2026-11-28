// Tutorial sorot (spotlight), sekali per perangkat terdaftar: tanda "sudah dilihat" disimpan di HP dan di server
// (Registered Device), jadi tidak muncul lagi setelah pasang ulang. Elemen yang dijelaskan mendaftarkan diri lewat `ref={tourTarget(id)}`; lapisan gelap diberi lubang di posisi elemen itu.
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
import { useT } from "@/i18n";
import type { TranslationKey } from "@/i18n/id";
import { hrisApi } from "@/services/api";
import { Palette, primaryButtonStyle } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";

const SEEN_KEY = "hris.tourSeen.v2"; // v2: ditampilkan sekali lagi ke semua pengguna
const START_DELAY_MS = 900; // menunggu animasi masuk Beranda selesai
const SCROLL_WAIT_MS = 380; // gulir beranimasi sebelum target diukur ulang
const MOVE_MS = 300;
const PAD = 6;
const TAB_BAR_SPACE = 130;

interface Step {
  target: string | null; // null = kartu di tengah (sambutan / penutup)
  title: string;
  text: TranslationKey;
}

interface Tour {
  steps: Step[];
  onScroll: (dy: number) => void;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const targets = new Map<string, View>();
const callbacks = new Map<string, (node: View | null) => void>();

export function tourTarget(id: string) {
  let callback = callbacks.get(id);
  if (!callback) {
    callback = (node) => {
      if (node) targets.set(id, node);
      else targets.delete(id);
    };
    callbacks.set(id, callback);
  }
  return callback;
}

let activeTour: Tour | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const setTour = (tour: Tour | null) => {
  activeTour = tour;
  listeners.forEach((listener) => listener());
};

// Putar ulang dari Profil: penghitung me-mount ulang TourStarter, tanda sekali-pakai melewati cek "sudah dilihat".
let replayCount = 0;
let isReplayPending = false;
const replayListeners = new Set<() => void>();
export function requestTourReplay() {
  replayCount += 1;
  isReplayPending = true;
  replayListeners.forEach((listener) => listener());
}
export function useTourReplay() {
  return useSyncExternalStore(
    (listener) => {
      replayListeners.add(listener);
      return () => {
        replayListeners.delete(listener);
      };
    },
    () => replayCount,
  );
}

export const isTourSeen = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(SEEN_KEY)) === "1";
  } catch {
    return true; // penyimpanan tidak bisa dibaca: jangan mengulang tutorial setiap kali
  }
};

const finishTour = () => {
  setTour(null);
  AsyncStorage.setItem(SEEN_KEY, "1").catch(() => {});
  // Gagal kirim tidak apa-apa: useHome mengirim ulang tanda di HP saat aplikasi dibuka lagi.
  hrisApi.registerDevice(true).catch(() => {});
};

// Dipasang Beranda setelah datanya tampil; menyusun langkah dari menu yang benar-benar dimiliki akun ini.
export function TourStarter({
  menuKeys,
  tabs,
  onScroll,
}: {
  menuKeys: { key: string; label: string }[];
  tabs: string[];
  onScroll: (dy: number) => void;
}) {
  const t = useT();
  const latest = useRef({ menuKeys, tabs, onScroll, t });
  useEffect(() => {
    latest.current = { menuKeys, tabs, onScroll, t };
  });
  useEffect(() => {
    const timer = setTimeout(async () => {
      const isReplay = isReplayPending;
      isReplayPending = false;
      if (activeTour || (!isReplay && (await isTourSeen()))) return;
      const { menuKeys: menu, tabs: bar, t: tr } = latest.current;
      setTour({
        onScroll: latest.current.onScroll,
        steps: [
          {
            target: null,
            title: tr("tour.welcomeTitle"),
            text: "tour.welcome",
          },
          { target: "clock", title: tr("tour.clockTitle"), text: "tour.clock" },
          { target: "stats", title: tr("tour.statsTitle"), text: "tour.stats" },
          ...menu.map((item) => ({
            target: `menu:${item.key}`,
            title: item.label,
            text: `tour.menu.${item.key}` as TranslationKey,
          })),
          ...bar.map((route) => ({
            target: `tab:${route}`,
            title: tr(`tour.tabTitle.${route}` as TranslationKey),
            text: `tour.tab.${route}` as TranslationKey,
          })),
          { target: null, title: tr("tour.doneTitle"), text: "tour.done" },
        ],
      });
    }, START_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  return null;
}

export function TourOverlay() {
  const tour = useSyncExternalStore(subscribe, () => activeTour);
  return tour ? <TourSteps tour={tour} /> : null;
}

function TourSteps({ tour }: { tour: Tour }) {
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
  const total = tour.steps.length;
  const step = tour.steps[shown.index]!;
  const isLast = shown.index === total - 1;

  useEffect(() => {
    let isCancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const target = tour.steps[index]!.target;
    const reveal = (rect: Box | null) => {
      if (isCancelled) return;
      const hole = rect && {
        x: rect.x - PAD,
        y: rect.y - PAD,
        w: rect.w + PAD * 2,
        h: rect.h + PAD * 2,
      };
      setShown({ index, hole });
      const to = hole ?? { x: width / 2, y: height / 2, w: 0, h: 0 };
      const snap = PixelRatio.roundToNearestPixel; // tepi pecahan memunculkan garis rambut antar bidang
      const glide = (value: Animated.Value, toValue: number) =>
        Animated.timing(value, {
          toValue,
          duration: MOVE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        });
      Animated.parallel([
        glide(anim.left, snap(to.x)),
        glide(anim.top, snap(to.y)),
        glide(anim.right, snap(to.x + to.w)),
        glide(anim.bottom, snap(to.y + to.h)),
        glide(anim.ring, hole ? 1 : 0),
        Animated.timing(anim.card, {
          toValue: 1,
          duration: 260,
          delay: MOVE_MS - 120,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    };
    const measure = (canScroll: boolean) => {
      const node = target ? targets.get(target) : undefined;
      if (!node || !rootRef.current) return reveal(null);
      rootRef.current.measureInWindow((rootX, rootY) => {
        node.measureInWindow((x, y, w, h) => {
          if (isCancelled) return;
          const top = y - rootY;
          const isOffscreen =
            top < insets.top + 90 || top + h > height - TAB_BAR_SPACE;
          // Tab bar selalu terlihat; hanya isi Beranda yang perlu digulir.
          if (canScroll && isOffscreen && !target!.startsWith("tab:")) {
            tour.onScroll(top - height * 0.32);
            timer = setTimeout(() => measure(false), SCROLL_WAIT_MS);
            return;
          }
          reveal({ x: x - rootX, y: top, w, h });
        });
      });
    };
    // Kartu memudar dulu, baru sorotan berpindah.
    Animated.timing(anim.card, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(() => {
      timer = setTimeout(() => measure(true), 0);
    });
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [index, tour, width, height, insets.top, anim]);

  useEffect(() => {
    // Tombol kembali Android melewati tutorial, bukan memindahkan halaman di belakangnya.
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      finishTour();
      return true;
    });
    return () => sub.remove();
  }, []);

  const hole = shown.hole;
  const isCardBelow = !!hole && hole.y + hole.h / 2 < height / 2;
  const cardPosition = !hole
    ? { top: height * 0.3 }
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
        <Text style={styles.title}>{step.title}</Text>
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
            style={({ pressed }) => [
              styles.next,
              pressed && { opacity: 0.85 },
            ]}
            onPress={() =>
              isLast ? finishTour() : setIndex(shown.index + 1)
            }
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
