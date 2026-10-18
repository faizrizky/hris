import React, { useState, useMemo } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LineIcon } from "@/components/LineIcon";
import { PickerSheet } from "@/components/PickerSheet";
import { ICON } from "@/constants/icons";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { angka, rupiah } from "@/utils/currency";
import { useT, translate } from "@/i18n";
import { useConfirm } from "@/components/ConfirmDialog";
import { ProofFile, pickProof } from "@/utils/pickProof";

export const EXPENSE_CATEGORIES = [
  "Transportasi",
  "Hotel",
  "Konsumsi",
  "Parkir & Tol",
  "Lainnya",
] as const;

export const expenseCategory = (k: string) =>
  (EXPENSE_CATEGORIES as readonly string[]).includes(k)
    ? translate(`bi.${k}` as never)
    : k;

export const PER_DIEM_PER_DAY = 350000;

export interface Expense {
  id: string;
  category: string;
  description: string;
  nominal: string; // digit mentah, diformat saat ditampilkan
  proof: ProofFile | null;
}

export function totalExpense(items: Expense[], days: number) {
  const expenses = items.reduce((a, x) => a + (Number(x.nominal) || 0), 0);
  const perDiem = PER_DIEM_PER_DAY * Math.max(0, days);
  return { expenses, perDiem, total: expenses + perDiem };
}

export function DinasBiayaCard({
  items,
  days,
  onAdd,
  onRemove,
  onChange,
}: {
  items: Expense[];
  days: number;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onChange: (id: string, patch: Partial<Expense>) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const confirm = useConfirm();
  const pick = async (id: string) => {
    const r = await pickProof();
    if (!r) return;
    if ("tooLargeSizeLabel" in r) {
      void confirm({
        title: t("bi.besarJudul"),
        message: t("bi.besarPesan", { ukuran: r.tooLargeSizeLabel }),
        tone: "warn",
        confirmText: t("umum.mengerti"),
        cancelText: null,
      });
      return;
    }
    onChange(id, { proof: r.file });
  };
  const { expenses, perDiem, total } = totalExpense(items, days);
  const c = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={[styles.card, { marginTop: 12 }]}>
      <View style={styles.headRow}>
        <Text style={styles.cardTitle}>{t("bi.rincian")}</Text>
        <Pressable style={styles.addBtn} onPress={onAdd}>
          <Text style={styles.addBtnText}>{t("bi.tambah")}</Text>
        </Pressable>
      </View>
      <Text style={styles.desc}>{t("bi.desc")}</Text>

      <View style={{ gap: 10, marginTop: 12 }}>
        {items.map((x) => {
          const nominal = Number(x.nominal) || 0;
          const isProofMandatory = nominal > 0 && !x.proof;

          return (
            <View key={x.id} style={styles.item}>
              <View style={styles.itemHead}>
                <Pressable
                  style={styles.catPill}
                  onPress={() => setEditingId(x.id)}
                >
                  <Text style={styles.catText}>
                    {expenseCategory(x.category)}
                  </Text>
                  <Ionicons name="chevron-down" size={12} color={c.info.ink} />
                </Pressable>
                <View style={{ flex: 1 }} />
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => onRemove(x.id)}
                >
                  <LineIcon d={ICON.close} color={c.muted} size={13} />
                </Pressable>
              </View>

              <TextInput
                style={styles.noteInput}
                value={x.description}
                onChangeText={(v) => onChange(x.id, { description: v })}
                placeholder={t("bi.ket")}
                placeholderTextColor={c.mutedLabel}
              />

              <View style={styles.amountRow}>
                <Text style={styles.rp}>Rp</Text>
                <TextInput
                  style={styles.amountInput}
                  value={x.nominal ? angka(nominal) : ""}
                  onChangeText={(v) =>
                    onChange(x.id, { nominal: v.replace(/\D/g, "") })
                  }
                  placeholder="0"
                  placeholderTextColor={c.mutedLabel}
                  keyboardType="number-pad"
                />
              </View>

              {x.proof ? (
                <View style={styles.proofOk}>
                  <LineIcon d={ICON.fileCheck} color={c.ok.ink} size={15} />
                  <Text style={styles.proofName}>{x.proof.name}</Text>
                  <Pressable onPress={() => onChange(x.id, { proof: null })}>
                    <Text style={styles.proofRemove}>{t("bi.hapus")}</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => pick(x.id)}
                  style={[
                    styles.proofAdd,
                    {
                      borderColor: isProofMandatory ? c.bad.ink : c.fieldBorder,
                    },
                  ]}
                >
                  <LineIcon
                    d={ICON.upload}
                    color={isProofMandatory ? c.bad.ink : c.muted}
                    size={15}
                  />
                  <Text
                    style={[
                      styles.proofAddText,
                      { color: isProofMandatory ? c.bad.ink : c.muted },
                    ]}
                  >
                    {t("bi.unggahWajib")}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.totals}>
        <TotalRow label={t("bi.totalDiajukan")} value={rupiah(expenses)} />
        <TotalRow
          label={t("bi.uangHarian", {
            n: Math.max(0, days),
            tarif: rupiah(PER_DIEM_PER_DAY),
          })}
          value={rupiah(perDiem)}
        />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t("bi.total")}</Text>
          <Text style={styles.totalValue}>{rupiah(total)}</Text>
        </View>
      </View>

      <PickerSheet
        visible={editingId !== null}
        title={t("bi.kategori")}
        options={EXPENSE_CATEGORIES}
        labelOf={expenseCategory}
        value={items.find((x) => x.id === editingId)?.category}
        onSelect={(v) => editingId && onChange(editingId, { category: v })}
        onClose={() => setEditingId(null)}
      />
    </View>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.totalRow}>
      <Text style={styles.subLabel}>{label}</Text>
      <Text style={styles.subValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 16,
      shadowColor: "#0F1720",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 3,
    },
    headRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    cardTitle: { fontSize: 13.5, fontWeight: "700", color: c.ink },
    addBtn: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: c.info.bg,
    },
    addBtnText: { fontSize: 11.5, fontWeight: "700", color: c.info.ink },
    desc: {
      fontSize: 10.5,
      lineHeight: 16,
      fontWeight: "500",
      color: c.muted,
      marginTop: 4,
    },

    item: {
      borderWidth: 1,
      borderColor: c.fieldBorder,
      borderRadius: 16,
      padding: 12,
    },
    itemHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    catPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 9,
      backgroundColor: c.info.bg,
    },
    catText: { fontSize: 11.5, fontWeight: "700", color: c.info.ink },
    removeBtn: {
      width: 28,
      height: 28,
      borderRadius: 9,
      backgroundColor: c.chip,
      alignItems: "center",
      justifyContent: "center",
    },

    noteInput: {
      marginTop: 8,
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderBottomColor: c.hair,
      fontSize: 13,
      fontWeight: "500",
      color: c.ink,
    },
    amountRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: c.hair,
    },
    rp: { fontSize: 13, fontWeight: "600", color: c.muted },
    amountInput: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 9,
      fontSize: 15,
      fontWeight: "700",
      color: c.ink,
    },

    proofOk: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      marginTop: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: c.ok.bg,
    },
    proofName: {
      flex: 1,
      fontSize: 11.5,
      fontWeight: "600",
      color: c.ok.ink,
    },
    proofRemove: {
      fontSize: 11,
      fontWeight: "600",
      color: c.ok.ink,
      textDecorationLine: "underline",
    },
    proofAdd: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 10,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1.5,
      borderStyle: "dashed",
    },
    proofAddText: { fontSize: 12, fontWeight: "600" },

    totals: {
      gap: 10,
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: c.hair,
    },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
    },
    subLabel: {
      flex: 1,
      fontSize: 12.5,
      fontWeight: "500",
      color: c.muted,
    },
    subValue: { fontSize: 12.5, fontWeight: "600", color: c.ink },
    totalLabel: { fontSize: 12.5, fontWeight: "700", color: c.ink },
    totalValue: { fontSize: 13, fontWeight: "700", color: c.accent },
  });
