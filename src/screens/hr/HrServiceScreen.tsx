import { TourTarget } from "@/components/TourTarget";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DateSheet } from "@/components/DateSheet";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { Skeleton } from "@/components/Skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { ICON } from "@/constants/icons";
import { useHrService } from "@/hooks/useHrService";
import { useT } from "@/i18n";
import type { TranslationKey } from "@/i18n/id";
import { translateServerLabel } from "@/i18n/serverLabels";
import { goBackAnimated } from "@/navigation/navigationBack";
import { getRouteParams, type ScreenProps } from "@/navigation/types";
import type { HrItemStatus, HrService, HrServiceKind } from "@/services/types";
import { Palette, SemanticTone, primaryButtonStyle } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { formatShortDateWithYear } from "@/utils/date";

const STATUS_TONE: Record<HrItemStatus, SemanticTone> = {
  pending: "warn",
  approved: "ok",
  rejected: "bad",
  cancelled: "bad",
  open: "warn",
  investigated: "info",
  resolved: "ok",
  invalid: "bad",
  feedback_sent: "ok",
  awaiting_feedback: "warn",
  upcoming: "info",
  absent: "bad",
  done: "ok",
  todo: "warn",
};

// Satu layar untuk pengajuan sif, pencairan cuti, pengaduan, pelatihan, dan daftar tugas karyawan baru.
export function HrServiceScreen({ navigation, route }: ScreenProps) {
  const { kind } = getRouteParams<{ kind: HrServiceKind }>(route);
  // key: berpindah jenis layanan tidak boleh membawa isian atau data jenis sebelumnya.
  return <ServiceView key={kind} kind={kind} navigation={navigation} />;
}

function ServiceView({
  kind,
  navigation,
}: {
  kind: HrServiceKind;
  navigation: ScreenProps["navigation"];
}) {
  const t = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { service, values, setValue, submit, isSending, errorMessage } =
    useHrService(kind);
  const data = service.data;
  const doneCount = data?.items.filter((i) => i.status === "done").length ?? 0;

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
        <Text style={styles.headerTitle}>{t(`hs.title.${kind}`)}</Text>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {!data ? (
            service.error ? (
              <ErrorState message={service.error} onRetry={service.retry} />
            ) : (
              <Skeleton width="100%" height={180} radius={22} />
            )
          ) : null}
          {data?.notice ? (
            <View style={styles.card}>
              <Text style={styles.muted}>{t(`hs.notice.${data.notice}`)}</Text>
            </View>
          ) : null}
          {data && data.fields.length > 0 ? (
            <TourTarget id="h.form">
              <View style={styles.card}>
                {data.fields.map((field) => (
                  <Field
                    key={field.key}
                    field={field}
                    value={values[field.key] ?? ""}
                    onChange={(value) => setValue(field.key, value)}
                  />
                ))}
                {errorMessage ? (
                  <Text style={styles.error}>{errorMessage}</Text>
                ) : null}
                <Pressable
                  style={styles.submit}
                  disabled={isSending}
                  onPress={submit}
                >
                  <Text style={styles.submitText}>
                    {isSending ? t("umum.memproses") : t("hs.submit")}
                  </Text>
                </Pressable>
              </View>
            </TourTarget>
          ) : null}
          {data && data.items.length > 0 ? (
            <Text style={styles.section}>
              {kind === "onboarding"
                ? t("hs.progress", { n: doneCount, total: data.items.length })
                : t("hs.history")}
            </Text>
          ) : null}
          {data?.items.map((item) => (
            <View key={item.id} style={styles.row}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle}>
                  {translateServerLabel(
                    kind === "leave_encashment" ? "leaveType" : "shift",
                    item.title,
                  )}
                </Text>
                {item.from ? (
                  <Text style={styles.muted}>
                    {formatShortDateWithYear(item.from)}
                    {item.to && item.to !== item.from
                      ? ` – ${formatShortDateWithYear(item.to)}`
                      : ""}
                  </Text>
                ) : null}
                {item.detail ? (
                  <Text style={styles.muted} numberOfLines={3}>
                    {kind === "leave_encashment"
                      ? t("hs.days", { n: item.detail })
                      : item.detail}
                  </Text>
                ) : null}
              </View>
              <StatusBadge
                label={t(`hs.status.${item.status}`)}
                tone={STATUS_TONE[item.status]}
                variant="compact"
              />
            </View>
          ))}
          {data && data.items.length === 0 && data.fields.length === 0 ? (
            <EmptyState
              icon={ICON.document}
              height={260}
              title={t("hs.emptyTitle")}
              text={t(`hs.empty.${kind}`)}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: HrService["fields"][number];
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [isPickingDate, setIsPickingDate] = useState(false);
  const label = t(`hs.field.${field.key}` as TranslationKey);

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>
        {label}
        {field.isRequired ? "" : ` ${t("hs.optional")}`}
      </Text>
      {field.type === "choice" ? (
        <View style={styles.chips}>
          {field.choices.map((choice) => {
            const isSelected = choice.value === value;
            return (
              <Pressable
                key={choice.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                style={[styles.chip, isSelected && styles.chipOn]}
                onPress={() => onChange(choice.value)}
              >
                <Text
                  style={[styles.chipText, isSelected && styles.chipTextOn]}
                >
                  {translateServerLabel(
                    field.key === "leave_type" ? "leaveType" : "shift",
                    choice.label,
                  )}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : field.type === "date" ? (
        <>
          <Pressable
            style={styles.input}
            accessibilityLabel={label}
            onPress={() => setIsPickingDate(true)}
          >
            <Text style={value ? styles.inputText : styles.muted}>
              {value ? formatShortDateWithYear(value) : t("hs.pickDate")}
            </Text>
          </Pressable>
          <DateSheet
            visible={isPickingDate}
            title={label}
            hint=""
            value={value || null}
            onPick={(iso) => {
              onChange(iso);
              setIsPickingDate(false);
            }}
            onClear={field.isRequired ? undefined : () => onChange("")}
            onClose={() => setIsPickingDate(false)}
          />
        </>
      ) : (
        <TextInput
          style={[
            styles.input,
            styles.inputText,
            field.type === "multiline" && styles.textarea,
          ]}
          accessibilityLabel={label}
          value={value}
          onChangeText={onChange}
          multiline={field.type === "multiline"}
          keyboardType={field.type === "number" ? "decimal-pad" : "default"}
          placeholderTextColor={c.mutedLabel}
        />
      )}
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
    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 16,
      marginBottom: 12,
    },
    label: { fontSize: 12.5, fontWeight: "700", color: c.ink, marginBottom: 8 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: c.chip,
    },
    chipOn: { backgroundColor: c.accent },
    chipText: { fontSize: 12, fontWeight: "600", color: c.ink },
    chipTextOn: { color: "#FFFFFF" },
    input: {
      borderWidth: 1,
      borderColor: c.fieldBorder,
      borderRadius: 14,
      minHeight: 48,
      paddingHorizontal: 14,
      paddingVertical: 12,
      justifyContent: "center",
    },
    inputText: { fontSize: 14, color: c.ink },
    textarea: { minHeight: 100, textAlignVertical: "top" },
    error: {
      fontSize: 12,
      fontWeight: "600",
      color: c.bad.ink,
      marginBottom: 10,
    },
    submit: {
      ...primaryButtonStyle(c),
      backgroundColor: c.accent,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
    },
    submitText: { fontSize: 13.5, fontWeight: "700", color: "#FFFFFF" },
    section: {
      fontSize: 14,
      fontWeight: "700",
      color: c.ink,
      marginTop: 8,
      marginBottom: 10,
    },
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
    rowTitle: { fontSize: 13, fontWeight: "600", color: c.ink },
    muted: { fontSize: 11.5, lineHeight: 17, color: c.muted, marginTop: 3 },
  });
