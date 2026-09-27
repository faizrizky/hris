import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import { toISODate, fromISODate, labelBulan } from "@/utils/date";

const HARI_PENDEK = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

type Cell = { iso: string; day: number } | null;

export interface FooterItem {
  label: string;
  value: string;
  accent?: boolean;
}

interface Props {
  mode: "single" | "range";
  title: string;
  hint: string;
  start: string | null;
  end: string | null;
  onChange: (start: string | null, end: string | null) => void;
  footer: FooterItem[];
  allow?: "future" | "past";
}

export function DatePickerCard({
  mode,
  title,
  hint,
  start,
  end,
  onChange,
  footer,
  allow = "future",
}: Props) {
  const [cursor, setCursor] = useState(() =>
    start ? fromISODate(start) : new Date(),
  );

  const today = toISODate(new Date());

  // Senin sebagai kolom pertama: getDay() 0=Minggu, jadi digeser.
  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const lead = (firstOfMonth.getDay() + 6) % 7;
  const total = new Date(
    cursor.getFullYear(),
    cursor.getMonth() + 1,
    0,
  ).getDate();

  const cells: Cell[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= total; d++) {
    cells.push({
      iso: toISODate(new Date(cursor.getFullYear(), cursor.getMonth(), d)),
      day: d,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const pick = (iso: string) => {
    if (mode === "single") return onChange(iso, iso);
    if (!start || (start && end)) return onChange(iso, null);
    if (iso >= start) return onChange(start, iso);
    return onChange(iso, null);
  };

  const shiftMonth = (delta: number) =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.hint}>{hint}</Text>
        </View>
        <View style={styles.monthNav}>
          <Pressable onPress={() => shiftMonth(-1)} hitSlop={8}>
            <Ionicons name="chevron-back" size={15} color={colors.muted} />
          </Pressable>
          <Text style={styles.monthLabel}>{labelBulan(cursor)}</Text>
          <Pressable onPress={() => shiftMonth(1)} hitSlop={8}>
            <Ionicons name="chevron-forward" size={15} color={colors.muted} />
          </Pressable>
        </View>
      </View>

      <View style={styles.weekRow}>
        {HARI_PENDEK.map((h) => (
          <Text key={h} style={styles.weekLabel}>
            {h}
          </Text>
        ))}
      </View>

      {rows.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((cell, j) => {
            if (!cell) return <View key={j} style={styles.cell} />;

            const mati = allow === "past" ? cell.iso > today : cell.iso < today;
            const edge = cell.iso === start || cell.iso === end;
            const inRange =
              !!start && !!end && cell.iso > start && cell.iso < end;
            const weekend = [0, 6].includes(fromISODate(cell.iso).getDay());

            return (
              <Pressable
                key={j}
                disabled={mati}
                onPress={() => pick(cell.iso)}
                style={[
                  styles.cell,
                  edge && styles.cellEdge,
                  !edge && inRange && styles.cellInRange,
                ]}
              >
                <Text
                  style={[
                    styles.cellText,
                    edge && styles.cellTextEdge,
                    !edge && inRange && styles.cellTextInRange,
                    !edge && !inRange && mati && styles.cellTextPast,
                    !edge &&
                      !inRange &&
                      !mati &&
                      weekend &&
                      styles.cellTextWeekend,
                  ]}
                >
                  {cell.day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={styles.footer}>
        {footer.map((f) => (
          <View key={f.label} style={{ flex: 1 }}>
            <Text style={styles.footerLabel}>{f.label}</Text>
            <Text style={[styles.footerValue, f.accent && styles.footerAccent]}>
              {f.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
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
  head: { flexDirection: "row", alignItems: "center" },
  title: { fontSize: 13.5, fontWeight: "700", color: colors.ink },
  hint: {
    fontSize: 10.5,
    fontWeight: "500",
    color: colors.muted,
    marginTop: 3,
  },
  monthNav: { flexDirection: "row", alignItems: "center", gap: 10 },
  monthLabel: { fontSize: 12, fontWeight: "700", color: colors.ink },

  weekRow: { flexDirection: "row", gap: 4, marginTop: 14 },
  weekLabel: {
    flex: 1,
    fontSize: 10,
    fontWeight: "600",
    color: colors.muted,
    textAlign: "center",
    paddingBottom: 4,
  },

  row: { flexDirection: "row", gap: 4, marginBottom: 4 },
  cell: {
    flex: 1,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  cellEdge: { backgroundColor: colors.accent },
  cellInRange: { backgroundColor: colors.info.bg },
  cellText: { fontSize: 12.5, fontWeight: "600", color: colors.ink },
  cellTextEdge: { color: "#fff", fontWeight: "800" },
  cellTextInRange: { color: colors.info.ink },
  cellTextPast: { color: colors.mutedLabel },
  cellTextWeekend: { color: colors.muted },

  footer: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.hair,
  },
  footerLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.mutedLabel,
  },
  footerValue: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.ink,
    marginTop: 5,
  },
  footerAccent: { color: colors.accent },
});
