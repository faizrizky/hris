import { useTabBarHidden } from "@/navigation/tabBarVisibility";
import { useEffect, useMemo, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { useSession } from "@/services/session";
import { useT } from "@/i18n";
import type { Kunci } from "@/i18n/id";
import { getFocusedRouteNameFromRoute } from "@react-navigation/native";

const RIGHT = ["Slip Gaji", "Profil"];

// Label di mockup beda dari nama route-nya.
const LABEL: Record<string, Kunci> = {
  Beranda: "tab.home",
  Absensi: "tab.absensi",
  AbsensiTim: "tab.absensiKry",
  Approval: "tab.approval",
  Notifikasi: "tab.notifikasi",
  "Slip Gaji": "tab.payroll",
  Profil: "tab.profil",
};

const IKON: Record<string, keyof typeof Ionicons.glyphMap> = {
  Beranda: "home-outline",
  Absensi: "finger-print-outline",
  AbsensiTim: "people-outline",
  Approval: "checkmark-done-outline",
  Notifikasi: "notifications-outline",
  "Slip Gaji": "wallet-outline",
  Profil: "person-outline",
};

const BAR_H = 62;
const BUBBLE = 52;
const RING = 6;
const RING_BOX = BUBBLE + RING * 2;
// Tinggi pusat gelembung di atas tepi atas bar, dan seberapa dalam ia turun
// ke dalam bar saat berpindah.
const NAIK = 4;
const TURUN = 30;
const DURASI = 440;

export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { employee } = useSession();
  const t = useT();
  const currentRoute = state.routes[state.index].name;
  const active = state.routes[state.index] as any;
  const nested = active.state;
  // Saat tab baru pertama kali dibuka lewat { screen }, state bersarangnya belum
  // ada; getFocusedRouteNameFromRoute membaca params.screen sebagai gantinya.
  const nestedRoute =
    nested?.routes?.[nested.index ?? 0]?.name ??
    getFocusedRouteNameFromRoute(active);
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const disembunyikan = useTabBarHidden();

  const urutan = [
    "Beranda",
    employee?.role === "mss"
      ? "Approval"
      : employee?.role === "hr"
        ? "AbsensiTim"
        : "Absensi",
    "Notifikasi",
    ...RIGHT,
  ];
  const idx = urutan.indexOf(currentRoute);

  const [lebar, setLebar] = useState(0);
  const slot = lebar / urutan.length;

  // Satu nilai `prog` untuk perpindahan: tiap pindah tab naik 1 (seg.n -> seg.n+1),
  // jadi tidak pernah di-reset dan tidak ada kedipan antar-render.
  const [seg, setSeg] = useState({ dari: idx, ke: idx, n: 0 });
  const [prog] = useState(() => new Animated.Value(1));
  const [dip] = useState(() => new Animated.Value(0));
  const [tampil] = useState(() => new Animated.Value(0));
  const sudahMasuk = useRef(false);

  useEffect(() => {
    if (lebar === 0) return;
    if (!sudahMasuk.current) {
      // Gelembung muncul (naik + memudar) di tab awal.
      sudahMasuk.current = true;
      Animated.timing(tampil, {
        toValue: idx >= 0 ? 1 : 0,
        duration: 420,
        delay: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    if (idx === seg.ke) return;
    if (idx < 0 || seg.ke < 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- segmen animasi harus bergeser bersamaan dengan memulai animasinya
      setSeg({ dari: idx, ke: idx, n: seg.n });
      prog.setValue(seg.n + 1);
      Animated.timing(tampil, {
        toValue: idx >= 0 ? 1 : 0,
        duration: 260,
        useNativeDriver: true,
      }).start();
      return;
    }
    const n = seg.n + 1;
    setSeg({ dari: seg.ke, ke: idx, n });
    dip.setValue(0);
    Animated.parallel([
      Animated.timing(prog, {
        toValue: n + 1,
        duration: DURASI,
        easing: Easing.bezier(0.45, 0, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(dip, {
          toValue: 1,
          duration: 190,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(dip, {
          toValue: 0,
          duration: 270,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [idx, lebar, seg, prog, dip, tampil]);

  const HIDE_ON = [
    "LeaveRequest",
    "AttendanceCorrection",
    "ProfileEdit",
    "ProfileUpload",
    "ProfilePassword",
    "DocumentReviewDetail",
    "ProfileChangeReviewDetail",
    "EmployeeDocumentDetail",
    "AppraisalFeedback",
    "FaceEnroll",
    "ProfilePhoto",
  ];
  if (disembunyikan || (nestedRoute && HIDE_ON.includes(nestedRoute)))
    return null;

  const go = (routeName: string) => {
    const route = state.routes.find((r) => r.name === routeName);
    if (!route) return;

    const isFocused = state.routes[state.index].key === route.key;
    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  const { dari, ke, n } = seg;
  const masuk = [n, n + 1];
  const pusat = (i: number) => i * slot + slot / 2;
  const geser = (i: number) => (i < 0 ? 0 : pusat(i) - RING_BOX / 2);
  const bubbleX = prog.interpolate({
    inputRange: masuk,
    outputRange: [geser(dari), geser(ke)],
    extrapolate: "clamp",
  });
  const bubbleY = Animated.add(
    dip.interpolate({ inputRange: [0, 1], outputRange: [0, TURUN] }),
    tampil.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }),
  );

  // Ikon di slot bar: ikon yang baru dipilih naik masuk ke gelembung (hilang
  // dari slot), ikon lama turun kembali ke slotnya.
  const ikonBar = (i: number) => {
    if (dari === ke) {
      return {
        opacity: i === ke ? 0 : 1,
        translateY: 0 as number | Animated.AnimatedInterpolation<number>,
      };
    }
    if (i === ke) {
      return {
        opacity: prog.interpolate({
          inputRange: [n, n + 0.3],
          outputRange: [1, 0],
          extrapolate: "clamp",
        }),
        translateY: prog.interpolate({
          inputRange: [n, n + 0.3],
          outputRange: [0, -14],
          extrapolate: "clamp",
        }),
      };
    }
    if (i === dari) {
      return {
        opacity: prog.interpolate({
          inputRange: [n + 0.3, n + 0.6],
          outputRange: [0, 1],
          extrapolate: "clamp",
        }),
        translateY: prog.interpolate({
          inputRange: [n + 0.3, n + 0.6],
          outputRange: [-14, 0],
          extrapolate: "clamp",
        }),
      };
    }
    return { opacity: 1, translateY: 0 };
  };

  // Ikon di dalam gelembung: kosong saat gelembung di titik terendah, lalu
  // ikon tujuan naik dari bawah masuk ke gelembung.
  const ikonGelembung = (i: number) => {
    if (dari === ke) return { opacity: i === ke ? 1 : 0, translateY: 0 };
    if (i === ke) {
      return {
        opacity: prog.interpolate({
          inputRange: [n + 0.5, n + 0.72],
          outputRange: [0, 1],
          extrapolate: "clamp",
        }),
        translateY: prog.interpolate({
          inputRange: [n + 0.5, n + 0.8],
          outputRange: [16, 0],
          extrapolate: "clamp",
        }),
      };
    }
    if (i === dari) {
      return {
        opacity: prog.interpolate({
          inputRange: [n, n + 0.3],
          outputRange: [1, 0],
          extrapolate: "clamp",
        }),
        translateY: prog.interpolate({
          inputRange: [n, n + 0.3],
          outputRange: [0, 16],
          extrapolate: "clamp",
        }),
      };
    }
    return { opacity: 0, translateY: 0 };
  };

  const renderTab = (routeName: string, i: number) => {
    const aktif = idx === i;
    const warna = aktif ? c.accent : c.mutedLabel;
    const b = ikonBar(i);
    return (
      <Pressable
        key={routeName}
        style={styles.tab}
        onPress={() => go(routeName)}
      >
        <Animated.View
          style={[
            styles.iconSlot,
            { opacity: b.opacity, transform: [{ translateY: b.translateY }] },
          ]}
        >
          <Ionicons name={IKON[routeName]!} size={22} color={c.mutedLabel} />
        </Animated.View>
        <Text
          style={[styles.tabLabel, { color: warna }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {t(LABEL[routeName]!)}
        </Text>
      </Pressable>
    );
  };

  const onLayout = (e: LayoutChangeEvent) =>
    setLebar(e.nativeEvent.layout.width);

  return (
    <View
      style={[styles.wrapper, { bottom: insets.bottom + 10 }]}
      pointerEvents="box-none"
    >
      {/* Isi layar di bawah tab bar memudar ke warna latar (kaca buram), jadi teks tidak terbaca
          menembus di sekitar bar. Melebar penuh sampai tepi layar dan bawah layar. */}
      <LinearGradient
        pointerEvents="none"
        colors={[`${c.bg}00`, `${c.bg}D9`, `${c.bg}F2`, c.bg]}
        locations={[0, 0.34, 0.6, 1]}
        style={{
          position: "absolute",
          left: -16,
          right: -16,
          top: -4,
          bottom: -(insets.bottom + 10),
        }}
      />
      <View style={styles.bar} onLayout={onLayout}>
        {urutan.map(renderTab)}

        {lebar > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ring,
              {
                opacity: tampil,
                transform: [{ translateX: bubbleX }, { translateY: bubbleY }],
              },
            ]}
          >
            <View style={styles.bubble}>
              {urutan.map((r, i) => {
                const g = ikonGelembung(i);
                return (
                  <Animated.View
                    key={r}
                    style={[
                      StyleSheet.absoluteFill,
                      styles.center,
                      {
                        opacity: g.opacity,
                        transform: [{ translateY: g.translateY }],
                      },
                    ]}
                  >
                    <Ionicons name={IKON[r]!} size={24} color="#FFFFFF" />
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    wrapper: { position: "absolute", left: 16, right: 16, paddingTop: 40 },

    bar: {
      height: BAR_H,
      flexDirection: "row",
      alignItems: "flex-end",
      backgroundColor: c.card,
      borderRadius: 28,
      paddingBottom: 9,
      shadowColor: "#0F1720",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.16,
      shadowRadius: 24,
      elevation: 12,
    },
    tab: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 4 },
    iconSlot: { height: 24, alignItems: "center", justifyContent: "center" },
    tabLabel: { fontSize: 10, fontWeight: "600" },
    // Cincin berwarna latar halaman: membentuk takik di tepi atas bar.
    ring: {
      position: "absolute",
      left: 0,
      top: -(RING_BOX / 2) - NAIK,
      width: RING_BOX,
      height: RING_BOX,
      borderRadius: RING_BOX / 2,
      backgroundColor: c.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    bubble: {
      width: BUBBLE,
      height: BUBBLE,
      borderRadius: BUBBLE / 2,
      backgroundColor: c.accent,
      overflow: "hidden",
      shadowColor: c.accent,
    },
    center: { alignItems: "center", justifyContent: "center" },
  });
