import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { Staff, StaffDirectory } from "@/services/types";
import { Skeleton } from "@/components/Skeleton";

const SEMUA = "Semua";

export function StaffListScreen({ navigation }: any) {
  const { employee } = useSession();
  const insets = useSafeAreaInsets();

  const [dir, setDir] = useState<StaffDirectory | null>(null);
  const [dept, setDept] = useState(SEMUA);
  const [cari, setCari] = useState("");
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  useEffect(() => {
    if (!employee) return;
    hrisApi.getStaffDirectory(employee.id).then(setDir);
  }, [employee]);

  const items = useMemo(() => dir?.items ?? [], [dir]);

  const loading = dir === null;

  // Chip departemen diturunkan dari datanya, bukan daftar tetap: departemen
  // baru di data langsung muncul sebagai chip tanpa mengubah kode ini.
  const chips = useMemo(() => {
    const nama: string[] = [];
    for (const s of items)
      if (!nama.includes(s.department)) nama.push(s.department);
    return [SEMUA, ...nama];
  }, [items]);

  const hitungDept = (d: string) =>
    d === SEMUA ? items.length : items.filter((s) => s.department === d).length;

  const q = cari.trim().toLowerCase();
  const tersaring = items.filter((s) => {
    const cocokDept = dept === SEMUA || s.department === dept;
    const cocokCari =
      q === "" ||
      s.fullName.toLowerCase().includes(q) ||
      s.jobTitle.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q);
    return cocokDept && cocokCari;
  });

  const scope =
    employee?.role === "hr"
      ? `${items.length} dari ${dir?.totalActive ?? 0} karyawan aktif`
      : `Bawahan langsung · ${items.length} orang`;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.headerTitle}>Karyawan</Text>
            {loading ? (
              <Skeleton
                width={150}
                height={11}
                radius={4}
                style={{ marginTop: 5 }}
              />
            ) : (
              <Text style={styles.headerSub}>{scope}</Text>
            )}
          </View>
        </View>
        <Pressable
          style={styles.headerAction}
          onPress={() => navigation.navigate("StaffAttendance")}
        >
          <Ionicons name="calendar-outline" size={17} color={c.ink} />
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={15} color={c.mutedLabel} />
        <TextInput
          style={styles.searchInput}
          value={cari}
          onChangeText={setCari}
          placeholder="Cari nama, jabatan, atau NIK"
          placeholderTextColor={c.mutedLabel}
          autoCorrect={false}
        />
        {cari.length > 0 && (
          <Pressable onPress={() => setCari("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={c.mutedLabel} />
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 0, marginBottom: 12 }}
        contentContainerStyle={styles.chipRow}
      >
        {loading
          ? [92, 110, 74].map((w, i) => (
              <Skeleton key={i} width={w} height={31} radius={999} />
            ))
          : chips.map((c) => {
              const on = dept === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setDept(c)}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>
                    {c} ({hitungDept(c)})
                  </Text>
                </Pressable>
              );
            })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.list}>
        {loading ? (
          <View style={{ gap: 9 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <StaffRowSkeleton key={i} />
            ))}
          </View>
        ) : tersaring.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Tidak ada yang cocok</Text>
            <Text style={styles.emptyText}>
              {q
                ? `Tidak ada karyawan dengan kata "${cari.trim()}".`
                : "Belum ada karyawan di lingkup ini."}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 9 }}>
            {tersaring.map((s) => (
              <StaffRow
                key={s.id}
                staff={s}
                onPress={() =>
                  navigation.navigate("StaffDetail", { staffId: s.id })
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StaffRow({ staff, onPress }: { staff: Staff; onPress: () => void }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const tetap = staff.status === "Tetap";
  const tone = tetap ? c.ok : c.info;

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{staff.initials}</Text>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.name} numberOfLines={1}>
          {staff.fullName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {staff.jobTitle} · {staff.department}
        </Text>
      </View>

      <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
        <Text style={[styles.statusText, { color: tone.ink }]}>
          {staff.status}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={c.mutedLabel} />
    </Pressable>
  );
}

function StaffRowSkeleton() {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.row}>
      <Skeleton width={44} height={44} radius={22} />
      <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
        <Skeleton width="62%" height={12} radius={4} />
        <Skeleton width="84%" height={10} radius={4} />
      </View>
      <Skeleton width={52} height={20} radius={8} />
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
      paddingBottom: 14,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: c.chip,
      alignItems: "center",
      justifyContent: "center",
    },
    headerAction: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: c.chip,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { fontSize: 15, fontWeight: "700", color: c.ink },
    headerSub: {
      fontSize: 11,
      fontWeight: "500",
      color: c.muted,
      marginTop: 2,
    },

    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginHorizontal: 18,
      marginBottom: 12,
      borderRadius: 14,
      backgroundColor: c.chip,
      borderWidth: 1,
      borderColor: c.panelBorder,
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    searchInput: {
      flex: 1,
      fontSize: 12.5,
      fontWeight: "500",
      color: c.ink,
      padding: 0,
    },

    chipRow: {
      paddingHorizontal: 18,
      gap: 7,
      alignItems: "center",
    },
    chip: {
      paddingHorizontal: 13,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.panelBorder,
    },
    chipOn: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { fontSize: 11.5, fontWeight: "600", color: c.muted },
    chipTextOn: { color: "#fff" },

    list: { paddingHorizontal: 18, paddingBottom: 130 },

    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: 18,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.panelBorder,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.info.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { fontSize: 13.5, fontWeight: "700", color: c.info.ink },
    name: { fontSize: 13.5, fontWeight: "700", color: c.ink },
    meta: {
      fontSize: 11,
      fontWeight: "500",
      color: c.muted,
      marginTop: 3,
    },
    statusBadge: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 8,
    },
    statusText: { fontSize: 10, fontWeight: "700" },

    emptyCard: {
      alignItems: "center",
      borderRadius: 22,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.panelBorder,
      paddingVertical: 32,
      paddingHorizontal: 24,
    },
    emptyTitle: { fontSize: 13.5, fontWeight: "700", color: c.ink },
    emptyText: {
      fontSize: 11.5,
      fontWeight: "500",
      color: c.muted,
      lineHeight: 17,
      textAlign: "center",
      marginTop: 6,
    },
  });
