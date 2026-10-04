import { useEffect, useState, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import Svg, { Circle, G } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { Appraisal, AppraisalGoal, AppraisalRater } from "@/services/types";
import { desimal } from "@/utils/currency";
import { Skeleton } from "@/components/Skeleton";

const RING = 104;
const STROKE = 13;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export function AppraisalScreen({ navigation }: any) {
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Appraisal | null>(null);
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  useEffect(() => {
    if (!employee) return;
    hrisApi.getAppraisal(employee.id).then(setData);
  }, [employee]);

  const head = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={18} color={c.ink} />
      </Pressable>
      <Text style={styles.headerTitle}>Appraisal & KPI</Text>
    </View>
  );

  if (!data) {
    return (
      <View style={styles.container}>
        {head}
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.heroCard}>
            <Skeleton width={RING} height={RING} radius={RING / 2} />
            <View style={{ flex: 1, minWidth: 0, gap: 9 }}>
              <Skeleton width="76%" height={13} radius={4} />
              <Skeleton width="58%" height={11} radius={4} />
              <Skeleton width={92} height={22} radius={999} />
            </View>
          </View>

          <View style={styles.sheet}>
            <Skeleton width="52%" height={12} radius={4} />
            <View style={{ gap: 15, marginTop: 16 }}>
              {[0, 1, 2].map((i) => (
                <View key={i}>
                  <View style={styles.raterHead}>
                    <Skeleton width="46%" height={11} radius={4} />
                    <Skeleton width={34} height={11} radius={4} />
                  </View>
                  <View style={styles.track} />
                </View>
              ))}
            </View>
          </View>

          <View style={{ gap: 10, marginTop: 12 }}>
            {[0, 1].map((i) => (
              <View key={i} style={styles.goalCard}>
                <Skeleton width="68%" height={12} radius={4} />
                <Skeleton
                  width="40%"
                  height={10}
                  radius={4}
                  style={{ marginTop: 8 }}
                />
                <View style={styles.track} />
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  const tone = c[data.ratingTone];

  return (
    <View style={styles.container}>
      {head}

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <ScoreRing score={data.score} max={data.maxScore} />

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.cycle}>{data.cycle}</Text>
            <Text style={styles.method}>{data.method}</Text>
            <View style={[styles.ratingBadge, { backgroundColor: tone.bg }]}>
              <Text style={[styles.ratingText, { color: tone.ink }]}>
                {data.rating}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Penilai (multi-rater)</Text>
          <View style={{ gap: 13, marginTop: 14 }}>
            {data.raters.map((r) => (
              <RaterRow key={r.name} rater={r} max={data.maxScore} />
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>KRA & Goal</Text>
        <View style={{ gap: 10 }}>
          {data.goals.map((g) => (
            <GoalCard key={g.name} goal={g} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function ScoreRing({ score, max }: { score: number; max: number }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  // Sudut cincin diturunkan dari skor, jadi tidak ada persen yang disimpan
  // terpisah dan bisa melenceng dari angka di tengahnya.
  const rasio = Math.min(1, Math.max(0, score / max));
  const isi = CIRC * rasio;

  return (
    <View style={styles.ring}>
      <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
        <G rotation={-90} origin={`${RING / 2}, ${RING / 2}`}>
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            fill="none"
            stroke={c.track}
            strokeWidth={STROKE}
          />
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            fill="none"
            stroke={c.accent}
            strokeWidth={STROKE}
            strokeDasharray={`${isi} ${CIRC - isi}`}
          />
        </G>
      </Svg>

      <View style={styles.ringHole}>
        <Text style={styles.ringScore}>{desimal(score)}</Text>
        <Text style={styles.ringMax}>dari {desimal(max)}</Text>
      </View>
    </View>
  );
}

function RaterRow({ rater, max }: { rater: AppraisalRater; max: number }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const pct = Math.min(100, (rater.score / max) * 100);

  return (
    <View>
      <View style={styles.raterHead}>
        <Text style={styles.raterName} numberOfLines={1}>
          {rater.name}
        </Text>
        <Text style={styles.raterScore}>
          {desimal(rater.score)} · bobot {rater.weight}%
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

function GoalCard({ goal }: { goal: AppraisalGoal }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.goalCard}>
      <View style={styles.goalHead}>
        <Text style={styles.goalName}>{goal.name}</Text>
        <Text style={styles.goalPct}>{goal.progress}%</Text>
      </View>
      <View style={[styles.track, { height: 6, marginTop: 10 }]}>
        <View
          style={[
            styles.fill,
            { width: `${Math.min(100, goal.progress)}%`, borderRadius: 3 },
          ]}
        />
      </View>
      <Text style={styles.goalNote}>{goal.note}</Text>
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

    heroCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 18,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 18,
      shadowColor: "#0F1720",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 3,
    },
    ring: {
      width: RING,
      height: RING,
      alignItems: "center",
      justifyContent: "center",
    },
    ringHole: {
      width: RING - STROKE * 2,
      height: RING - STROKE * 2,
      borderRadius: (RING - STROKE * 2) / 2,
      backgroundColor: c.card,
      alignItems: "center",
      justifyContent: "center",
    },
    ringScore: {
      fontSize: 22,
      lineHeight: 23,
      fontWeight: "800",
      color: c.ink,
    },
    ringMax: {
      fontSize: 9.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 3,
    },

    cycle: { fontSize: 14, fontWeight: "700", color: c.ink },
    method: {
      fontSize: 11.5,
      lineHeight: 17,
      fontWeight: "500",
      color: c.muted,
      marginTop: 5,
    },
    ratingBadge: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      marginTop: 9,
    },
    ratingText: { fontSize: 10.5, fontWeight: "700" },

    sheet: {
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
    sheetTitle: { fontSize: 13.5, fontWeight: "700", color: c.ink },

    raterHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      gap: 10,
    },
    raterName: {
      flex: 1,
      fontSize: 12.5,
      fontWeight: "600",
      color: c.ink,
    },
    raterScore: { fontSize: 11.5, fontWeight: "600", color: c.muted },

    track: {
      height: 8,
      borderRadius: 4,
      backgroundColor: c.track,
      marginTop: 7,
      overflow: "hidden",
    },
    fill: { height: "100%", borderRadius: 4, backgroundColor: c.accent },

    sectionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: c.ink,
      marginTop: 20,
      marginBottom: 10,
      marginHorizontal: 2,
    },

    goalCard: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 15,
    },
    goalHead: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    goalName: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "600",
      color: c.ink,
    },
    goalPct: { fontSize: 13, fontWeight: "700", color: c.accent },
    goalNote: {
      fontSize: 10.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 8,
    },
  });
