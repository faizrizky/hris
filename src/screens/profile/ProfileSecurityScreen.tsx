import { useCallback, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConfirm } from "@/components/ConfirmDialog";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { SecurityInfo, SecurityToggleKey } from "@/services/types";
import { RadialGlow } from "@/components/RadialGlow";
import { LineIcon } from "@/components/LineIcon";
import { ICON } from "@/constants/icons";
import { Skeleton } from "@/components/Skeleton";
import { desimal } from "@/utils/currency";
import { tanggalPendekTahun } from "@/utils/date";

export function ProfileSecurityScreen({ navigation }: any) {
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const confirm = useConfirm();
  const keluarLainRef = useRef<View>(null);

  const [info, setInfo] = useState<SecurityInfo | null>(null);

  const muat = useCallback(() => {
    if (!employee) return;
    hrisApi.getSecurityInfo(employee.id).then(setInfo);
  }, [employee]);

  useFocusEffect(muat);

  const ubahToggle = (key: SecurityToggleKey, enabled: boolean) => {
    if (!employee) return;
    hrisApi.setSecurityToggle(employee.id, key, enabled).then(setInfo);
  };

  const keluarkanLain = async () => {
    if (!employee || !info) return;
    const lain = info.devices.filter((d) => !d.current);
    const ya = await confirm({
      title: "Keluar dari perangkat lain?",
      message: `${lain.map((d) => d.name).join(", ")} akan diminta login ulang. Perangkat ini tetap masuk.`,
      tone: "bad",
      confirmText: "Ya, keluarkan",
      cancelText: "Batal",
      from: keluarLainRef,
      fromColor: c.bad.bg,
      fromTextColor: c.bad.ink,
      fromLabel: "Keluar dari perangkat lain",
      fromRadius: 22,
    });
    if (ya) hrisApi.logoutOtherDevices(employee.id).then(setInfo);
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={18} color={c.ink} />
      </Pressable>
      <Text style={styles.headerTitle}>Keamanan & Face ID</Text>
    </View>
  );

  if (!info) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.content}>
          <Skeleton width="100%" height={160} radius={22} />
          <Skeleton
            width="100%"
            height={220}
            radius={22}
            style={{ marginTop: 12 }}
          />
        </View>
      </View>
    );
  }

  const adaLain = info.devices.some((d) => !d.current);

  return (
    <View style={styles.container}>
      {header}

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.faceCard}>
          <RadialGlow size={200} color={c.glowHeader} top={-60} right={-40} />

          <View style={styles.faceTop}>
            <LinearGradient
              colors={[c.accent, c.accent2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.faceIcon}
            >
              <LineIcon d={ICON.faceId} color="#fff" size={28} />
            </LinearGradient>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.faceTitle}>Face Recognition aktif</Text>
              <Text style={styles.faceSub}>
                Terdaftar {tanggalPendekTahun(info.faceEnrolledAt)} · diperbarui{" "}
                {tanggalPendekTahun(info.faceUpdatedAt)}
              </Text>
            </View>
          </View>

          <View style={styles.facePills}>
            <View
              style={[
                styles.pill,
                { backgroundColor: "rgba(74,222,128,0.14)" },
              ]}
            >
              <Text style={[styles.pillText, { color: "#4ADE80" }]}>
                Liveness {info.livenessOk ? "✓" : "✗"}
              </Text>
            </View>
            <View
              style={[
                styles.pill,
                { backgroundColor: "rgba(36,144,239,0.16)" },
              ]}
            >
              <Text style={[styles.pillText, { color: c.accentLight }]}>
                Match {desimal(info.matchScore)}%
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.listCard}>
          {info.toggles.map((t) => (
            <View key={t.key} style={styles.listRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle}>{t.title}</Text>
                <Text style={styles.rowSub}>{t.subtitle}</Text>
              </View>
              <Switch
                value={t.enabled}
                onValueChange={(v) => ubahToggle(t.key, v)}
                trackColor={{ false: c.track, true: c.accent }}
                thumbColor="#fff"
              />
            </View>
          ))}

          <Pressable
            style={[styles.listRow, styles.lastRow]}
            onPress={() => navigation.navigate("ProfilePassword")}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowTitle}>Ubah password</Text>
              <Text style={styles.rowSub}>
                {info.passwordChangedDaysAgo === 0
                  ? "Baru saja diubah"
                  : `Terakhir diubah ${info.passwordChangedDaysAgo} hari lalu`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.mutedLabel} />
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Perangkat aktif</Text>
          <View style={{ gap: 13, marginTop: 14 }}>
            {info.devices.map((d) => (
              <View key={d.id} style={styles.devRow}>
                <View style={styles.devIcon}>
                  <LineIcon
                    d={d.kind === "mobile" ? ICON.mobile : ICON.desktop}
                    color={c.info.ink}
                    size={17}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.devName}>{d.name}</Text>
                  <Text style={styles.devMeta}>{d.meta}</Text>
                </View>
                <View
                  style={[
                    styles.devTag,
                    { backgroundColor: d.current ? c.ok.bg : c.info.bg },
                  ]}
                >
                  <Text
                    style={[
                      styles.devTagText,
                      { color: d.current ? c.ok.ink : c.info.ink },
                    ]}
                  >
                    {d.current ? "Perangkat ini" : "Web"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {adaLain ? (
          <Pressable
            ref={keluarLainRef}
            style={styles.dangerBtn}
            onPress={keluarkanLain}
          >
            <Text style={styles.dangerText}>Keluar dari perangkat lain</Text>
          </Pressable>
        ) : (
          <View style={styles.okBanner}>
            <Text style={styles.okText}>Semua perangkat lain sudah keluar</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },

    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 20,
      paddingBottom: 16,
      backgroundColor: c.card,
      borderBottomWidth: 1,
      borderBottomColor: c.hair,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: c.chip,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { fontSize: 15, fontWeight: "700", color: c.ink },

    content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 130 },

    faceCard: {
      backgroundColor: c.statBg,
      borderRadius: 22,
      padding: 18,
      overflow: "hidden",
    },
    faceTop: { flexDirection: "row", alignItems: "center", gap: 14 },
    faceIcon: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    faceTitle: { fontSize: 14.5, fontWeight: "700", color: "#fff" },
    faceSub: {
      fontSize: 11,
      lineHeight: 17,
      fontWeight: "500",
      color: c.onDark.muted,
      marginTop: 3,
    },
    facePills: { flexDirection: "row", gap: 8, marginTop: 14 },
    pill: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999 },
    pillText: { fontSize: 10.5, fontWeight: "600" },

    listCard: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      marginTop: 12,
      overflow: "hidden",
    },
    listRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 15,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.hair,
    },
    lastRow: { borderBottomWidth: 0 },
    rowTitle: { fontSize: 13, fontWeight: "600", color: c.ink },
    rowSub: {
      fontSize: 10.5,
      lineHeight: 15,
      fontWeight: "500",
      color: c.muted,
      marginTop: 3,
    },

    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 16,
      marginTop: 12,
      shadowColor: "#0F1720",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 3,
    },
    cardTitle: { fontSize: 13.5, fontWeight: "700", color: c.ink },

    devRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    devIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: c.info.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    devName: { fontSize: 12.5, fontWeight: "600", color: c.ink },
    devMeta: {
      fontSize: 10.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 3,
    },
    devTag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
    devTagText: { fontSize: 10, fontWeight: "700" },

    dangerBtn: {
      marginTop: 12,
      paddingVertical: 14,
      borderRadius: 22,
      backgroundColor: c.bad.bg,
      alignItems: "center",
    },
    dangerText: { fontSize: 13, fontWeight: "700", color: c.bad.ink },

    okBanner: {
      marginTop: 12,
      paddingVertical: 13,
      borderRadius: 22,
      backgroundColor: c.ok.bg,
      alignItems: "center",
    },
    okText: { fontSize: 12, fontWeight: "700", color: c.ok.ink },
  });
