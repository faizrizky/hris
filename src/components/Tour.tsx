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
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "@/i18n";
import type { TranslationKey } from "@/i18n/id";
import { hrisApi } from "@/services/api";
import { Palette, primaryButtonStyle } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";

const SEEN_KEY = "hris.tourSeen.v2"; // v2: ditampilkan sekali lagi ke semua pengguna
const START_DELAY_MS = 900; // menunggu animasi masuk Beranda selesai
const SCROLL_WAIT_MS = 120;
const DIM = "rgba(8,12,18,0.72)";
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

interface Rect {
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
      if (activeTour || (await isTourSeen())) return;
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
  const { height } = useWindowDimensions();
  const rootRef = useRef<View>(null);
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<{ index: number; rect: Rect | null }>({
    index: -1,
    rect: null,
  });
  const step = tour.steps[index]!;
  const isLast = index === tour.steps.length - 1;

  useEffect(() => {
    let isCancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const measure = (canScroll: boolean) => {
      const node = step.target ? targets.get(step.target) : undefined;
      if (!node || !rootRef.current) {
        setSpot({ index, rect: null });
        return;
      }
      rootRef.current.measureInWindow((rootX, rootY) => {
        node.measureInWindow((x, y, w, h) => {
          if (isCancelled) return;
          const top = y - rootY;
          const isOffscreen =
            top < insets.top + 90 || top + h > height - TAB_BAR_SPACE;
          // Tab bar selalu terlihat; hanya isi Beranda yang perlu digulir.
          if (canScroll && isOffscreen && !step.target!.startsWith("tab:")) {
            tour.onScroll(top - height * 0.35);
            timer = setTimeout(() => measure(false), SCROLL_WAIT_MS);
            return;
          }
          setSpot({ index, rect: { x: x - rootX, y: top, w, h } });
        });
      });
    };
    timer = setTimeout(() => measure(true), 0);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [index, step, tour, height, insets.top]);

  useEffect(() => {
    // Tombol kembali Android melewati tutorial, bukan memindahkan halaman di belakangnya.
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      finishTour();
      return true;
    });
    return () => sub.remove();
  }, []);

  const rect = spot.index === index ? spot.rect : null;
  const hole = rect && {
    x: rect.x - PAD,
    y: rect.y - PAD,
    w: rect.w + PAD * 2,
    h: rect.h + PAD * 2,
  };
  const isCardBelow = !!hole && hole.y + hole.h / 2 < height / 2;
  const cardPosition = !hole
    ? { top: height * 0.3 }
    : isCardBelow
      ? { top: hole.y + hole.h + 14 }
      : { bottom: height - hole.y + 14 };

  return (
    <View ref={rootRef} collapsable={false} style={StyleSheet.absoluteFill}>
      {/* Menahan semua sentuhan ke layar di belakang. */}
      <Pressable style={StyleSheet.absoluteFill} accessible={false} />
      {hole ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View
            style={[
              styles.dim,
              { top: 0, left: 0, right: 0, height: Math.max(0, hole.y) },
            ]}
          />
          <View
            style={[
              styles.dim,
              { top: hole.y + hole.h, left: 0, right: 0, bottom: 0 },
            ]}
          />
          <View
            style={[
              styles.dim,
              {
                top: hole.y,
                left: 0,
                width: Math.max(0, hole.x),
                height: hole.h,
              },
            ]}
          />
          <View
            style={[
              styles.dim,
              { top: hole.y, left: hole.x + hole.w, right: 0, height: hole.h },
            ]}
          />
          <View
            style={[
              styles.ring,
              { top: hole.y, left: hole.x, width: hole.w, height: hole.h },
            ]}
          />
        </View>
      ) : (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.dim]}
        />
      )}
      <View
        style={[styles.card, cardPosition]}
        accessibilityViewIsModal
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.count}>
          {t("tour.count", { n: index + 1, total: tour.steps.length })}
        </Text>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.text}>{t(step.text)}</Text>
        <View style={styles.actions}>
          {isLast ? (
            <View />
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={finishTour}
              hitSlop={10}
            >
              <Text style={styles.skip}>{t("tour.skip")}</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            style={styles.next}
            onPress={() => (isLast ? finishTour() : setIndex(index + 1))}
          >
            <Text style={styles.nextText}>
              {t(
                isLast
                  ? "tour.finish"
                  : index === 0
                    ? "tour.start"
                    : "tour.next",
              )}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    dim: { position: "absolute", backgroundColor: DIM },
    ring: {
      position: "absolute",
      borderRadius: 16,
      borderWidth: 2,
      borderColor: "#FFFFFF",
    },
    card: {
      position: "absolute",
      left: 18,
      right: 18,
      backgroundColor: c.card,
      borderRadius: 22,
      padding: 18,
    },
    count: { fontSize: 11, fontWeight: "700", color: c.muted },
    title: { fontSize: 17, fontWeight: "800", color: c.ink, marginTop: 6 },
    text: { fontSize: 13.5, lineHeight: 20, color: c.muted, marginTop: 6 },
    actions: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 16,
    },
    skip: { fontSize: 13, fontWeight: "700", color: c.muted },
    next: {
      ...primaryButtonStyle(c),
      borderRadius: 14,
      paddingVertical: 11,
      paddingHorizontal: 22,
    },
    nextText: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
  });
