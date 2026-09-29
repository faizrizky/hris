import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/theme/colors";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { Appraisal, AppraisalGoal, AppraisalRater } from "@/services/types";
import { desimal } from "@/utils/currency";

const RING = 104;
const STROKE = 13;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export function AppraisalScreen({ navigation }: any) {
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Appraisal | null>(null);

  useEffect(() => {
    if (!employee) return;
    hrisApi.getAppraisal(employee.id).then(setData);
  }, [employee]);

  const head = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={18} color={colors.ink} />
      </Pressable>
      <Text style={styles.headerTitle}>Appraisal & KPI</Text>
    </View>
  );

  if (!data) {
    return (
      <View style={styles.container}>
        {head}
        <Text style={styles.state}>Memuat penilaian…</Text>
      </View>
    );
  }

  const tone = colors[data.ratingTone];

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
            stroke={colors.track}
            strokeWidth={STROKE}
          />
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            fill="none"
            stroke={colors.accent}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.hair,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },

  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 130 },

  state: {
    fontSize: 12.5,
    fontWeight: "500",
    color: colors.muted,
    textAlign: "center",
    marginTop: 40,
  },

  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  ringScore: {
    fontSize: 22,
    lineHeight: 23,
    fontWeight: "800",
    color: colors.ink,
  },
  ringMax: {
    fontSize: 9.5,
    fontWeight: "500",
    color: colors.muted,
    marginTop: 3,
  },

  cycle: { fontSize: 14, fontWeight: "700", color: colors.ink },
  method: {
    fontSize: 11.5,
    lineHeight: 17,
    fontWeight: "500",
    color: colors.muted,
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
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 22,
    padding: 16,
    marginTop: 12,
    shadowColor: "#0F1720",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  sheetTitle: { fontSize: 13.5, fontWeight: "700", color: colors.ink },

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
    color: colors.ink,
  },
  raterScore: { fontSize: 11.5, fontWeight: "600", color: colors.muted },

  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.track,
    marginTop: 7,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 4, backgroundColor: colors.accent },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
    marginTop: 20,
    marginBottom: 10,
    marginHorizontal: 2,
  },

  goalCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    color: colors.ink,
  },
  goalPct: { fontSize: 13, fontWeight: "700", color: colors.accent },
  goalNote: {
    fontSize: 10.5,
    fontWeight: "500",
    color: colors.muted,
    marginTop: 8,
  },
});
