import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { colors } from "@/theme/colors";

const ACTIVE = colors.accent;
const INACTIVE = "rgba(255,255,255,0.45)";

// Harus sama persis dengan `name` di Tab.Screen.
const LEFT = ["Beranda", "Absensi"];
const RIGHT = ["Slip Gaji", "Profil"];

// Label di mockup beda dari nama route-nya.
const LABEL: Record<string, string> = {
  Beranda: "Home",
  Absensi: "Absensi",
  "Slip Gaji": "Payroll",
  Profil: "Profil",
};

function TabIcon({ route, color }: { route: string; color: string }) {
  if (route === "Beranda") {
    return (
      <View style={styles.gridIcon}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.gridDot, { backgroundColor: color }]} />
        ))}
      </View>
    );
  }
  if (route === "Absensi") {
    return <View style={[styles.squareIcon, { borderColor: color }]} />;
  }
  if (route === "Slip Gaji") {
    return <Text style={[styles.rpIcon, { color }]}>Rp</Text>;
  }
  return <View style={[styles.circleIcon, { borderColor: color }]} />;
}

export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const currentRoute = state.routes[state.index].name;

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

  const renderTab = (routeName: string) => {
    const color = currentRoute === routeName ? ACTIVE : INACTIVE;
    return (
      <Pressable
        key={routeName}
        style={styles.tab}
        onPress={() => go(routeName)}
      >
        <View style={styles.iconSlot}>
          <TabIcon route={routeName} color={color} />
        </View>
        <Text style={[styles.tabLabel, { color }]}>{LABEL[routeName]}</Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[styles.wrapper, { bottom: insets.bottom + 10 }]}
      pointerEvents="box-none"
    >
      <View style={styles.fabWrap} pointerEvents="box-none">
        <Pressable style={styles.fabShadow} onPress={() => go("Cuti")}>
          <LinearGradient
            colors={[colors.accent, colors.accent2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fab}
          >
            <View style={styles.plusH} />
            <View style={styles.plusV} />
          </LinearGradient>
        </Pressable>
      </View>

      <View style={styles.bar}>
        {LEFT.map(renderTab)}
        <View style={styles.fabGap} />
        {RIGHT.map(renderTab)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "absolute", left: 16, right: 16, paddingTop: 26 },

  bar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15,23,32,0.92)",
    borderRadius: 26,
    paddingVertical: 11,
    paddingHorizontal: 14,
    shadowColor: "#0F1720",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.35,
    shadowRadius: 34,
    elevation: 12,
  },
  tab: { flex: 1, alignItems: "center", gap: 5 },
  iconSlot: { height: 15, alignItems: "center", justifyContent: "center" },
  tabLabel: { fontSize: 9.5, fontWeight: "600" },
  fabGap: { width: 58 },

  gridIcon: { width: 14.5, flexDirection: "row", flexWrap: "wrap", gap: 2.5 },
  gridDot: { width: 6, height: 6, borderRadius: 2 },
  squareIcon: { width: 14, height: 14, borderRadius: 5, borderWidth: 2 },
  circleIcon: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  rpIcon: { fontSize: 12, lineHeight: 13, fontWeight: "800" },

  fabWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 2,
  },
  fabShadow: {
    borderRadius: 22,
    shadowColor: colors.accent2,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 26,
    elevation: 10,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  plusH: {
    position: "absolute",
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#fff",
  },
  plusV: {
    position: "absolute",
    width: 3,
    height: 20,
    borderRadius: 2,
    backgroundColor: "#fff",
  },
});
