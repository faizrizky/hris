import { hrisApi } from "@/services/api";
import { setUnreadCount, useUnreadCount } from "@/navigation/notifBadge";
import { markBackNavigation } from "@/navigation/navigationBack";
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

const TONE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
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
const BUBBLE_DIP = 30;
const SWITCH_DURATION_MS = 440;

export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { employee } = useSession();
  const t = useT();
  const currentRoute = state.routes[state.index].name;
  const active = state.routes[state.index];
  const nested = active.state;
  // Saat tab baru pertama kali dibuka lewat { screen }, state bersarangnya belum
  // ada; getFocusedRouteNameFromRoute membaca params.screen sebagai gantinya.
  const nestedRoute =
    nested?.routes?.[nested.index ?? 0]?.name ??
    getFocusedRouteNameFromRoute(active);
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const isHidden = useTabBarHidden();
  const unreadCount = useUnreadCount();
  const employeeId = employee?.id;

  // Muat jumlah belum dibaca saat bar tampil dan tiap pindah tab.
  useEffect(() => {
    if (!employeeId) return;
    hrisApi
      .getNotificationInbox(employeeId)
      .then((n) => setUnreadCount(n.filter((x) => !x.read).length))
      .catch(() => {});
  }, [employeeId, state.index]);

  const order = [
    "Beranda",
    employee?.role === "mss"
      ? "Approval"
      : employee?.role === "hr"
        ? "AbsensiTim"
        : "Absensi",
    "Notifikasi",
    ...RIGHT,
  ];
  const idx = order.indexOf(currentRoute);

  const [barWidth, setBarWidth] = useState(0);
  const slot = barWidth / order.length;

  // Tiap tab punya nilai keaktifannya sendiri (0..1) dan gelembung punya posisi
  // kontinu. Semuanya selalu menuju keadaan akhir dari posisi terakhirnya, jadi
  // pindah tab beruntun dengan cepat tidak meninggalkan ikon setengah jalan.
  const [activeValues] = useState(() =>
    order.map((_, i) => new Animated.Value(i === idx ? 1 : 0)),
  );
  const [bubblePosition] = useState(() => new Animated.Value(Math.max(idx, 0)));
  const [dip] = useState(() => new Animated.Value(0));
  const [appear] = useState(() => new Animated.Value(0));
  const hasEntered = useRef(false);

  useEffect(() => {
    if (barWidth === 0) return;
    if (!hasEntered.current) {
      // Gelembung muncul (naik + memudar) di tab awal.
      hasEntered.current = true;
      Animated.timing(appear, {
        toValue: idx >= 0 ? 1 : 0,
        duration: 420,
        delay: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(appear, {
      toValue: idx >= 0 ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
    const ease = Easing.bezier(0.45, 0, 0.2, 1);
    activeValues.forEach((v, i) =>
      Animated.timing(v, {
        toValue: i === idx ? 1 : 0,
        duration: SWITCH_DURATION_MS,
        easing: ease,
        useNativeDriver: true,
      }).start(),
    );
    if (idx < 0) return;
    Animated.timing(bubblePosition, {
      toValue: idx,
      duration: SWITCH_DURATION_MS,
      easing: ease,
      useNativeDriver: true,
    }).start();
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
    ]).start();
  }, [idx, barWidth, activeValues, bubblePosition, dip, appear]);

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
  if (isHidden || (nestedRoute && HIDE_ON.includes(nestedRoute))) return null;

  const go = (routeName: string) => {
    const route = state.routes.find((r) => r.name === routeName);
    if (!route) return;

    const isFocused = state.routes[state.index].key === route.key;
    // Menekan tab yang sedang aktif saat ada halaman bertumpuk di atasnya
    // mengembalikan ke akar tab; tandai agar akar itu memutar animasi masuknya.
    if (isFocused && (nested?.index ?? 0) > 0) markBackNavigation();
    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  const centerOf = (i: number) => i * slot + slot / 2 - RING_BOX / 2;
  const bubbleX = bubblePosition.interpolate({
    inputRange: order.map((_, i) => i),
    outputRange: order.map((_, i) => centerOf(i)),
    extrapolate: "clamp",
  });
  const bubbleY = Animated.add(
    dip.interpolate({ inputRange: [0, 1], outputRange: [0, BUBBLE_DIP] }),
    appear.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }),
  );

  // Ikon di slot bar: saat tab menjadi aktif ikonnya naik masuk ke gelembung
  // (hilang dari slot); saat tidak aktif lagi ia turun kembali ke slotnya.
  const barIconStyle = (i: number) => ({
    opacity: activeValues[i]!.interpolate({
      inputRange: [0, 0.2, 0.5, 1],
      outputRange: [1, 1, 0, 0],
    }),
    translateY: activeValues[i]!.interpolate({
      inputRange: [0, 0.2, 0.5, 1],
      outputRange: [0, 0, -14, -14],
    }),
  });

  // Ikon di dalam gelembung: kosong saat gelembung di titik terendah (tab lama
  // dan baru sama-sama sekitar 0,5), lalu ikon tujuan naik dari bawah.
  const bubbleIconStyle = (i: number) => ({
    opacity: activeValues[i]!.interpolate({
      inputRange: [0, 0.5, 0.75, 1],
      outputRange: [0, 0, 1, 1],
    }),
    translateY: activeValues[i]!.interpolate({
      inputRange: [0, 0.5, 0.85, 1],
      outputRange: [16, 16, 0, 0],
    }),
  });

  const renderTab = (routeName: string, i: number) => {
    const isActive = idx === i;
    const labelColor = isActive ? c.accent : c.mutedLabel;
    const b = barIconStyle(i);
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
          <Ionicons
            name={TONE_ICONS[routeName]!}
            size={22}
            color={c.mutedLabel}
          />
          {routeName === "Notifikasi" && unreadCount > 0 && (
            <View style={styles.dot} />
          )}
        </Animated.View>
        <Text
          style={[styles.tabLabel, { color: labelColor }]}
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
    setBarWidth(e.nativeEvent.layout.width);

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
        {order.map(renderTab)}

        {barWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ring,
              {
                opacity: appear,
                transform: [{ translateX: bubbleX }, { translateY: bubbleY }],
              },
            ]}
          >
            <View style={styles.bubble}>
              {order.map((r, i) => {
                const g = bubbleIconStyle(i);
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
                    <Ionicons name={TONE_ICONS[r]!} size={24} color="#FFFFFF" />
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
    tab: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 1 },
    iconSlot: { height: 22, alignItems: "center", justifyContent: "center" },
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
    dot: {
      position: "absolute",
      top: 0,
      right: -1,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#F97316",
      borderWidth: 1.5,
      borderColor: c.card,
    },
    center: { alignItems: "center", justifyContent: "center" },
  });
