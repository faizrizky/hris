import React, { useEffect, useState, useMemo } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import {
  CutiTypeCard,
  CutiDetailCard,
  JenisCuti,
  namaCuti,
} from "./CutiFormCards";
import { ApprovalFlowCard, FormDoneView, ApprovalStep } from "./FormFlowCards";
import {
  LemburJamCard,
  LemburUraianCard,
  LemburBuktiCard,
  BuktiFile,
} from "./LemburFormCards";
import {
  DinasTujuanCard,
  DinasDetailCard,
  Transportasi,
} from "./DinasFormCards";

import { DinasBiayaCard, Biaya, totalBiaya } from "./DinasBiayaCard";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { LeaveBalance, Colleague, LeaveApprover } from "@/services/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { DatePickerCard, FooterItem } from "@/components/DatePickerCard";
import {
  tanggalPendek,
  hitungHari,
  hitungHariKerja,
  fromISODate,
  jamMenit,
  durasiJam,
} from "@/utils/date";
import { rupiah } from "@/utils/currency";
import { LinearGradient } from "expo-linear-gradient";
import { describeError } from "@/services/api/http";
import { useT } from "@/i18n";
import { useConfirm } from "@/components/ConfirmDialog";
import { pilihBukti } from "@/utils/pilihBukti";
import { kembali, keBeranda } from "@/navigation/kembali";

const SEGMENTS = [
  { key: "cuti", label: "lr.cuti" },
  { key: "lembur", label: "lr.lembur" },
  { key: "dinas", label: "lr.dinas" },
] as const;

export type FormKind = (typeof SEGMENTS)[number]["key"];

const FORM_META = {
  cuti: { title: "lr.judulCuti", subtitle: "Leave Application" },
  lembur: { title: "lr.judulLembur", subtitle: "Overtime Request" },
  dinas: { title: "lr.judulDinas", subtitle: "Travel Request" },
} as const;

// Nama dokumen ERPNext tempat pengajuan tersimpan.
const DOC_NAMA: Record<FormKind, string> = {
  cuti: "Leave Application",
  lembur: "Overtime Request",
  dinas: "Travel Request",
};

// Setiap kali dibuka dari menu (+), daftar cuti, atau layar lembur, form dimulai
// bersih: `n` di params berbeda tiap navigasi, jadi state lama tidak terbawa.
export function LeaveRequestScreen({ navigation, route }: any) {
  return (
    <LeaveRequestForm
      key={`${route?.params?.kind ?? "cuti"}-${route?.params?.n ?? 0}`}
      navigation={navigation}
      route={route}
    />
  );
}

function LeaveRequestForm({ navigation, route }: any) {
  const t = useT();
  const confirm = useConfirm();
  const { employee } = useSession();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [jenisCuti, setJenisCuti] = useState<JenisCuti>("Tahunan");
  const [alasan, setAlasan] = useState("");
  const [rekan, setRekan] = useState<Colleague[]>([]);
  const [delegasi, setDelegasi] = useState<Colleague | null>(null);
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<FormKind>(route?.params?.kind ?? "cuti");
  const [segW, setSegW] = useState(0);
  const [geser] = useState(
    () => new Animated.Value(SEGMENTS.findIndex((x) => x.key === kind)),
  );
  const [muncul] = useState(() => new Animated.Value(1));
  const [otEndRaw, setOtEndRaw] = useState(0);
  const [uraian, setUraian] = useState("");
  const [otFiles, setOtFiles] = useState<BuktiFile[]>([]);
  const [dest, setDest] = useState("");
  const [transport, setTransport] = useState<Transportasi | null>(null);
  const [keperluan, setKeperluan] = useState("");
  const [biaya, setBiaya] = useState<Biaya[]>([]);
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [approver, setApprover] = useState<LeaveApprover | null | undefined>(
    undefined,
  );

  const meta = FORM_META[kind];

  const isSingle = kind === "lembur";

  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [otDate, setOtDate] = useState<string | null>(null);

  const start = isSingle ? otDate : rangeStart;
  const end = isSingle ? otDate : rangeEnd;
  const range = start && end;

  const otHoliday = !!otDate && [0, 6].includes(fromISODate(otDate).getDay());
  const otStart = otHoliday ? 8 * 60 : 17 * 60;
  const otMax = otHoliday ? 8 * 60 : 4 * 60;
  const otEnd = Math.min(Math.max(otEndRaw, otStart + 60), otStart + otMax);
  const otJam = (otEnd - otStart) / 60;

  const hariPerjalanan = start && end ? hitungHari(start, end) : 0;
  const totalDinas = totalBiaya(biaya, hariPerjalanan);

  const [done, setDone] = useState<string | null>(null); // id pengajuan
  const [sending, setSending] = useState(false);

  const [galat, setGalat] = useState<string | null>(null);

  // Ganti jenis pengajuan: indikator bergeser, isi form memudar masuk, dan
  // hasil kiriman sebelumnya tidak ikut ke jenis lain.
  const gantiKind = (k: FormKind) => {
    if (k === kind) return;
    setKind(k);
    setDone(null);
    setGalat(null);
    Animated.timing(geser, {
      toValue: SEGMENTS.findIndex((x) => x.key === k),
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    muncul.setValue(0);
    Animated.timing(muncul, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    if (!employee) return;
    // Kegagalan memuat ditampilkan di ringkasan bawah (galat), bukan dibiarkan
    // sebagai penolakan promise yang tak tertangkap.
    const tangkap = (e: unknown) => setGalat(describeError(e));
    hrisApi.getLeaveBalances(employee.id).then(setBalances).catch(tangkap);
    hrisApi.getColleagues(employee.id).then(setRekan).catch(tangkap);
    hrisApi.getLeaveApprover(employee.id).then(setApprover).catch(tangkap);
  }, [employee]);

  const saldo = balances.find((b) => b.type === "cuti")?.remaining ?? 0;
  const hariKerja = start && end ? hitungHariKerja(start, end) : 0;

  const buktiBiayaKurang = biaya.filter(
    (x) => Number(x.nominal) > 0 && !x.bukti,
  ).length;

  const blockMsg = !start
    ? t("lr.blokTgl")
    : kind === "cuti" && !alasan.trim()
      ? t("lr.blokAlasan")
      : kind === "cuti" && approver === null
        ? t("lr.blokApprover")
        : kind === "lembur" && !uraian.trim()
          ? t("lr.blokUraian")
          : kind === "lembur" && otFiles.length === 0
            ? t("lr.blokBukti")
            : kind === "dinas" && !dest.trim()
              ? t("lr.blokKota")
              : kind === "dinas" && !transport
                ? t("lr.blokTransport")
                : kind === "dinas" && buktiBiayaKurang
                  ? t("lr.blokBiaya", { n: buktiBiayaKurang })
                  : "";

  const bisaKirim = !blockMsg && !sending;

  const tambahBukti = async () => {
    const r = await pilihBukti();
    if (!r) return;
    if ("terlaluBesar" in r) {
      setGalat(t("up.besarPesan", { ukuran: r.terlaluBesar }));
      return;
    }
    setGalat(null);
    setOtFiles((prev) => [...prev, r.berkas]);
  };

  const handleSubmit = async () => {
    if (!bisaKirim || !employee) return;
    setSending(true);
    setGalat(null);
    try {
      const created = await hrisApi.submitLeaveRequest({
        fromDate: start!,
        toDate: end!,
        employeeId: employee.id,
        type:
          kind === "lembur"
            ? "lembur"
            : kind === "dinas"
              ? "dinas_luar"
              : jenisCuti === "Sakit"
                ? "sakit"
                : "cuti",
        label:
          kind === "cuti"
            ? t("lr.labelCuti", { jenis: namaCuti(jenisCuti), n: hariKerja })
            : kind === "lembur"
              ? t("lr.labelLembur", {
                  durasi: durasiJam(otJam),
                  tgl: tanggalPendek(start!),
                })
              : t("lr.labelDinas", { n: hariPerjalanan }),
        reason:
          kind === "cuti"
            ? alasan.trim()
            : kind === "lembur"
              ? uraian.trim()
              : `${dest.trim()} · ${keperluan.trim()}`,
        delegateName:
          kind === "cuti" && delegasi ? delegasi.fullName : undefined,
        delegateId: kind === "cuti" && delegasi ? delegasi.id : undefined,
        overtimeEnd: kind === "lembur" ? jamMenit(otEnd) : undefined,
        attachments:
          kind === "lembur"
            ? otFiles.flatMap((f) =>
                f.uri
                  ? [{ uri: f.uri, name: f.name, mimeType: f.mimeType ?? "" }]
                  : [],
              )
            : undefined,
        travel:
          kind === "dinas" && transport
            ? {
                destination: dest.trim(),
                transport,
                purpose: keperluan.trim() || dest.trim(),
                costs: biaya.map((x) => ({
                  category: x.kategori,
                  description: x.keterangan,
                  amount: Number(x.nominal) || 0,
                  proof: x.bukti
                    ? {
                        uri: x.bukti.uri,
                        name: x.bukti.name,
                        mimeType: x.bukti.mimeType,
                      }
                    : undefined,
                })),
              }
            : undefined,
      });
      setDone(created.id);
      if (created.buktiGagal) {
        void confirm({
          title: t("lr.buktiGagalJudul"),
          message: t("lr.buktiGagalPesan", { n: created.buktiGagal }),
          tone: "warn",
          confirmText: t("umum.mengerti"),
          cancelText: null,
        });
      }
    } catch (e) {
      setGalat(describeError(e));
    } finally {
      setSending(false);
    }
  };

  const buatDoneRows = () => {
    if (!start || !end) return [];

    if (kind === "cuti") {
      return [
        { k: t("lr.rowJenis"), v: namaCuti(jenisCuti) },
        {
          k: t("lr.rowTanggal"),
          v: `${tanggalPendek(start)} – ${tanggalPendek(end)}`,
        },
        { k: t("lr.rowDurasi"), v: t("lr.nHariKerja", { n: hariKerja }) },
        { k: t("lr.rowDelegasi"), v: delegasi?.fullName ?? "—" },
      ];
    }

    if (kind === "lembur") {
      return [
        { k: t("lr.rowTanggal"), v: tanggalPendek(start) },
        { k: t("lr.rowJam"), v: `${jamMenit(otStart)} – ${jamMenit(otEnd)}` },
        { k: t("lr.rowBukti"), v: t("lr.nFile", { n: otFiles.length }) },
      ];
    }

    return [
      { k: t("lr.rowTujuan"), v: dest },
      {
        k: t("lr.rowTanggal"),
        v: `${tanggalPendek(start)} – ${tanggalPendek(end)}`,
      },
      { k: t("lr.rowTotalBiaya"), v: rupiah(totalDinas.total) },
      {
        k: t("lr.rowBukti"),
        v: t("lr.nFile", { n: biaya.filter((x) => x.bukti).length }),
      },
    ];
  };

  const handleDateChange = (s: string | null, e: string | null) => {
    if (isSingle) {
      setOtDate(s);
    } else {
      setRangeStart(s);
      setRangeEnd(e);
    }
  };

  const calTitle =
    kind === "dinas"
      ? t("lr.tglPerjalanan")
      : kind === "lembur"
        ? t("lr.tglLembur")
        : t("lr.tglCuti");

  const calHint = isSingle ? t("lr.hintSatu") : t("lr.hintRentang");

  const footer: FooterItem[] = isSingle
    ? [
        {
          label: t("lr.tanggal"),
          value: start ? tanggalPendek(start) : t("lr.pilih"),
        },
        {
          label: t("lr.jenisHari"),
          value: start
            ? [0, 6].includes(fromISODate(start).getDay())
              ? t("lr.hariLibur")
              : t("lr.hariKerja")
            : "—",
        },
        {
          label: t("lr.durasi"),
          value: otDate ? durasiJam(otJam) : "—",
          accent: true,
        },
      ]
    : [
        {
          label: t("lr.mulai"),
          value: start ? tanggalPendek(start) : t("lr.pilih"),
        },
        {
          label: t("lr.selesai"),
          value: end ? tanggalPendek(end) : t("lr.pilih"),
        },
        {
          label: t("lr.durasi"),
          value: range
            ? kind === "dinas"
              ? t("lr.nHari", { n: hitungHari(start!, end!) })
              : t("lr.nHariKerja", { n: hitungHariKerja(start!, end!) })
            : "—",
          accent: true,
        },
      ];

  const langkahApproval: ApprovalStep[] = approver
    ? [
        {
          ini: approver.initials,
          name: approver.fullName,
          role: t("lr.atasan"),
        },
      ]
    : []; // masih memuat, atau tidak ada approver

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => kembali(navigation)}>
            <Ionicons name="chevron-back" size={18} color={c.ink} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.headerTitle}>{t(meta.title)}</Text>
            <Text style={styles.headerSub}>{meta.subtitle}</Text>
          </View>
        </View>

        <View
          style={styles.segment}
          onLayout={(e) => setSegW(e.nativeEvent.layout.width)}
        >
          {segW > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.segIndicator,
                {
                  width: (segW - 16) / 3,
                  transform: [
                    {
                      translateX: geser.interpolate({
                        inputRange: [0, 1, 2],
                        outputRange: [
                          0,
                          (segW - 16) / 3 + 4,
                          ((segW - 16) / 3 + 4) * 2,
                        ],
                      }),
                    },
                  ],
                },
              ]}
            />
          )}
          {SEGMENTS.map((s) => {
            const on = kind === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => gantiKind(s.key)}
                style={styles.segBtn}
              >
                <Text style={[styles.segText, on && styles.segTextOn]}>
                  {t(s.label)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={{
              opacity: muncul,
              transform: [
                {
                  translateY: muncul.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            }}
          >
            {done ? (
              <FormDoneView
                title={t(
                  kind === "cuti"
                    ? "lr.terkirimCuti"
                    : kind === "lembur"
                      ? "lr.terkirimLembur"
                      : "lr.terkirimDinas",
                )}
                waitingOn={langkahApproval[0]?.name ?? t("lr.approver")}
                rows={buatDoneRows()}
                doc={`${DOC_NAMA[kind]} · ${done}`}
                onLihat={() => kembali(navigation)}
                onHome={() => keBeranda(navigation)}
              />
            ) : (
              <>
                {kind === "cuti" && (
                  <CutiTypeCard
                    jenis={jenisCuti}
                    onPick={setJenisCuti}
                    saldo={saldo}
                    hariKerja={hariKerja}
                  />
                )}
                {kind === "dinas" && (
                  <DinasTujuanCard dest={dest} onChange={setDest} />
                )}

                <DatePickerCard
                  key={kind}
                  // Lembur diajukan setelah dikerjakan: hanya hari ini dan sebelumnya.
                  allow={kind === "lembur" ? "past" : "future"}
                  mode={isSingle ? "single" : "range"}
                  title={calTitle}
                  hint={calHint}
                  start={start}
                  end={end}
                  onChange={handleDateChange}
                  footer={footer}
                />

                {kind === "cuti" && (
                  <CutiDetailCard
                    jenis={jenisCuti}
                    alasan={alasan}
                    onChangeAlasan={setAlasan}
                    rekan={rekan}
                    delegasi={delegasi}
                    onPickDelegasi={setDelegasi}
                  />
                )}

                {kind === "lembur" && (
                  <>
                    <LemburJamCard
                      holiday={otHoliday}
                      startLabel={jamMenit(otStart)}
                      endLabel={jamMenit(otEnd)}
                      rule={
                        otHoliday ? t("lr.aturanLibur") : t("lr.aturanKerja")
                      }
                      onMinus={() => setOtEndRaw(otEnd - 30)}
                      onPlus={() => setOtEndRaw(otEnd + 30)}
                    />
                    <LemburUraianCard uraian={uraian} onChange={setUraian} />
                    <LemburBuktiCard
                      files={otFiles}
                      onAdd={tambahBukti}
                      onRemove={(i) =>
                        setOtFiles((prev) => prev.filter((_, idx) => idx !== i))
                      }
                    />
                  </>
                )}

                {kind === "dinas" && (
                  <DinasDetailCard
                    transport={transport}
                    onPickTransport={setTransport}
                    keperluan={keperluan}
                    onChangeKeperluan={setKeperluan}
                  />
                )}

                {kind === "dinas" && (
                  <DinasBiayaCard
                    items={biaya}
                    hari={hariPerjalanan}
                    onAdd={() =>
                      setBiaya((prev) => [
                        ...prev,
                        {
                          id: `b${Date.now()}`,
                          kategori: "Transportasi",
                          keterangan: "",
                          nominal: "",
                          bukti: null,
                        },
                      ])
                    }
                    onRemove={(id) =>
                      setBiaya((prev) => prev.filter((x) => x.id !== id))
                    }
                    onChange={(id, patch) =>
                      setBiaya((prev) =>
                        prev.map((x) => (x.id === id ? { ...x, ...patch } : x)),
                      )
                    }
                  />
                )}
                <ApprovalFlowCard steps={langkahApproval} />
              </>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
      {!done && (
        <View style={[styles.actionBar, { paddingBottom: insets.bottom + 14 }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={[
                styles.sumSub,
                blockMsg || galat ? { color: c.bad.ink } : null,
              ]}
            >
              {blockMsg || galat || t("lr.siap")}
            </Text>
            <Text style={styles.sumTop}>
              {kind === "cuti" && hariKerja > 0
                ? t("lr.nHariKerja", { n: hariKerja })
                : kind === "lembur" && otDate
                  ? durasiJam(otJam)
                  : kind === "dinas" && start && end
                    ? rupiah(totalDinas.total)
                    : "—"}
            </Text>
          </View>
          <Pressable onPress={handleSubmit} disabled={!bisaKirim}>
            <LinearGradient
              colors={bisaKirim ? [c.accent, c.accent2] : [c.track, c.track]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.submitBtn}
            >
              <Text
                style={[
                  styles.submitText,
                  bisaKirim ? { color: "#fff" } : null,
                ]}
              >
                {sending ? t("lr.mengirim") : t("lr.kirim")}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}
    </View>
  );
}
const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },

    header: {
      paddingHorizontal: 20,
      paddingBottom: 14,
      backgroundColor: c.card,
      borderBottomWidth: 1,
      borderBottomColor: c.hair,
    },
    headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: c.chip,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { fontSize: 15, fontWeight: "700", color: c.ink },
    headerSub: {
      fontSize: 10.5,
      fontWeight: "600",
      color: c.muted,
      marginTop: 3,
    },

    segment: {
      flexDirection: "row",
      gap: 4,
      padding: 4,
      borderRadius: 14,
      backgroundColor: c.chip,
      marginTop: 14,
    },
    segBtn: {
      flex: 1,
      paddingVertical: 9,
      paddingHorizontal: 6,
      borderRadius: 11,
      alignItems: "center",
    },
    segIndicator: {
      position: "absolute",
      top: 4,
      bottom: 4,
      left: 4,
      borderRadius: 11,
      backgroundColor: c.card,
      shadowColor: "#0F1720",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.14,
      shadowRadius: 4,
      elevation: 2,
    },
    segText: { fontSize: 12, fontWeight: "700", color: c.muted },
    segTextOn: { color: c.ink },

    content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24 },
    placeholder: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 16,
    },
    placeholderText: { fontSize: 12.5, color: c.muted },

    actionBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: c.card,
      borderTopWidth: 1,
      borderTopColor: c.hair,
      paddingHorizontal: 18,
      paddingTop: 12,
    },
    sumSub: { fontSize: 10.5, fontWeight: "600", color: c.muted },
    sumTop: { fontSize: 16, fontWeight: "800", color: c.ink, marginTop: 3 },
    submitBtn: {
      paddingHorizontal: 22,
      paddingVertical: 14,
      borderRadius: 16,
    },
    submitText: { fontSize: 13.5, fontWeight: "700", color: c.mutedLabel },
  });
