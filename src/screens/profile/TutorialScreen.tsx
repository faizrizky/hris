import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconBox } from "@/components/IconBox";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { useStartTour } from "@/components/Tour";
import { useT } from "@/i18n";
import { goBackAnimated } from "@/navigation/navigationBack";
import type { ScreenProps } from "@/navigation/types";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { TOUR_SECTIONS } from "@/tour/steps";

// Pilih bagian tutorial yang mau diputar, atau semuanya dari awal.
export function TutorialScreen({ navigation }: ScreenProps) {
  const t = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const start = useStartTour();
  const rows = [{ id: null, icon: "play-outline" as const }, ...TOUR_SECTIONS];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={styles.backBtn}
          accessibilityLabel={t("hs.back")}
          onPress={() => goBackAnimated(navigation)}
        >
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("tut.judul")}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>{t("tut.pengantar")}</Text>
        {rows.map((row) => {
          const key = row.id ?? "semua";
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              style={styles.row}
              onPress={() => start(row.id)}
            >
              <IconBox icon={row.icon} color={c.info.ink} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle}>{t(`tut.${key}.j`)}</Text>
                <Text style={styles.rowSub}>{t(`tut.${key}`)}</Text>
              </View>
              <Ionicons name="play-circle" size={24} color={c.accent} />
            </Pressable>
          );
        })}
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
    content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 170 },
    intro: { fontSize: 12.5, lineHeight: 19, color: c.muted, marginBottom: 14 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 15,
      marginBottom: 10,
    },
    rowTitle: { fontSize: 13, fontWeight: "700", color: c.ink },
    rowSub: { fontSize: 11.5, lineHeight: 17, color: c.muted, marginTop: 3 },
  });
