// Isi tutorial. Urutan bagian: lengkapi profil → absensi → pengajuan → informasi lain → keamanan.
// Kunci teks tiap langkah: "tur.<key>.j" (judul) dan "tur.<key>" (isi).
import type { TranslationKey } from "@/i18n/id";
import { tabOrder } from "@/navigation/tabOrder";
import type { Fitur } from "@/services/tenant";
import type { Role } from "@/services/types";

export const TOUR_SECTIONS = [
  { id: "profil", icon: "person-outline" },
  { id: "absen", icon: "finger-print-outline" },
  { id: "pengajuan", icon: "document-text-outline" },
  { id: "lainnya", icon: "grid-outline" },
  { id: "keamanan", icon: "shield-checkmark-outline" },
] as const;

export type TourSectionId = (typeof TOUR_SECTIONS)[number]["id"];

export interface TourRoute {
  tab: "Beranda" | "Profil";
  screen?: string; // kosong = halaman utama tab
  params?: object;
}

export interface TourStep {
  target: string | null; // null tanpa route = kartu di tengah; null dengan route = kartu di bawah halaman itu
  route: TourRoute | null;
  title: TranslationKey;
  text: TranslationKey;
  isFixed?: boolean; // elemen diam (header, bar bawah): jangan digulir
}

const step = (
  key: string,
  route: TourRoute | null,
  target: string | null = null,
  isFixed = false,
): TourStep => ({
  target,
  route,
  isFixed,
  title: `tur.${key}.j` as TranslationKey,
  text: `tur.${key}` as TranslationKey,
});

const home = (screen?: string, params?: object): TourRoute => ({
  tab: "Beranda",
  screen,
  params,
});
const profile = (screen?: string): TourRoute => ({ tab: "Profil", screen });

export function buildTour({
  section,
  role,
  has,
}: {
  section: TourSectionId | null; // null = seluruh tutorial
  role: Role;
  has: (fitur: Fitur) => boolean;
}): TourStep[] {
  const when = (isOn: boolean, ...steps: TourStep[]) => (isOn ? steps : []);
  const form = (kind: string) => home("LeaveRequest", { kind });
  const service = (kind: string) => home("HrService", { kind });

  const sections: Record<TourSectionId, TourStep[]> = {
    profil: [
      step("p.data", profile(), "p.data"),
      step("p.foto", profile("ProfileData"), "p.fotoCard"),
      step("p.kontak", profile("ProfileEdit"), "p.kontak"),
      step("p.darurat", profile("ProfileEdit"), "p.darurat"),
      ...when(
        has("dokumen"),
        step("p.ktp", profile("ProfileDocs"), "p.unggah", true),
      ),
      step("p.wajah", profile("ProfileSecurity"), "k.wajah"),
      step("p.wajahMulai", profile("FaceEnroll"), "p.wajahMulai", true),
      step("p.perangkat", profile("ProfileSecurity"), "k.perangkat"),
    ],
    absen: [
      step("a.beranda", home(), "clock"),
      step("a.tahap", home("Clock"), "a.tahap", true),
      step("a.lokasi", home("Clock"), "a.lokasi"),
      step("a.wajah", home("Clock")),
      step("a.tombol", home("Clock"), "a.tombol"),
      step("a.lainnya", home("Clock"), "a.lainnya"),
      step("a.riwayat", home("History")),
      step("a.korTgl", home("AttendanceCorrection"), "kor.tgl"),
      step("a.korJam", home("AttendanceCorrection"), "kor.jam"),
      step("a.korAlasan", home("AttendanceCorrection"), "kor.alasan"),
      step("a.korBukti", home("AttendanceCorrection"), "kor.bukti"),
      step("a.korKirim", home("AttendanceCorrection"), "kor.kirim", true),
    ],
    pengajuan: [
      step("r.jenisForm", form("cuti"), "f.segmen", true),
      step("r.cutiJenis", form("cuti"), "f.jenisCuti"),
      step("r.cutiTgl", form("cuti"), "f.tanggal"),
      step("r.cutiDetail", form("cuti"), "f.detail"),
      step("r.cutiAlur", form("cuti"), "f.alur"),
      step("r.cutiKirim", form("cuti"), "f.kirim", true),
      step("r.cutiDaftar", home("LeaveList")),
      ...when(
        has("lembur"),
        step("r.lemburTgl", form("lembur"), "f.tanggal"),
        step("r.lemburJam", form("lembur"), "f.jam"),
        step("r.lemburTugas", form("lembur"), "f.tugas"),
        step("r.lemburBukti", form("lembur"), "f.bukti"),
        step("r.lemburKirim", form("lembur"), "f.kirim", true),
        step("r.lemburDaftar", home("Overtime")),
      ),
      ...when(
        has("dinas_wfh"),
        step("r.wfhTgl", form("wfh"), "f.tanggal"),
        step("r.wfhDetail", form("wfh"), "f.wfh"),
        step("r.wfhKirim", form("wfh"), "f.kirim", true),
      ),
      ...when(
        has("absensi"),
        step("r.sif", service("shift_request"), "h.form"),
      ),
      ...when(
        has("cuti"),
        step("r.cair", service("leave_encashment"), "h.form"),
      ),
      step("r.aduan", service("grievance"), "h.form"),
    ],
    lainnya: [
      step("i.ringkasan", home(), "stats"),
      step("i.onboarding", service("onboarding")),
      step("i.pelatihan", service("training")),
      step("i.slip", home("PayslipList")),
      ...when(has("pajak_bpjs"), step("i.pajak", home("TaxDetail"))),
      ...when(has("penilaian_kinerja"), step("i.kinerja", home("Appraisal"))),
      step("i.notifikasi", home("Notifications")),
      ...when(
        role !== "ess",
        step("i.approval", home("Approval")),
        step("i.karyawan", home("StaffList")),
      ),
      ...when(
        role === "hr",
        ...when(has("dokumen"), step("i.verifDokumen", home("DocumentReview"))),
        step("i.verifProfil", home("ProfileChangeReview")),
        step("i.verifWajah", home("FaceReview")),
      ),
      ...tabOrder(role).map((route): TourStep => ({
        target: `tab:${route}`,
        route: home(),
        isFixed: true,
        title: `tour.tabTitle.${route}` as TranslationKey,
        text: `tour.tab.${route}` as TranslationKey,
      })),
    ],
    keamanan: [
      step("k.wajah", profile("ProfileSecurity"), "k.wajah"),
      step("k.biometrik", profile("ProfileSecurity"), "k.biometrik"),
      step("k.sandi", profile("ProfileSecurity"), "k.sandi"),
      step("k.perangkat", profile("ProfileSecurity"), "k.perangkat"),
      step("k.pengaturan", profile(), "k.pengaturan"),
    ],
  };

  const done: TourStep = {
    target: null,
    route: null,
    title: "tour.doneTitle",
    text: "tour.done",
  };
  if (section) return [...sections[section], done];
  const welcome: TourStep = {
    target: null,
    route: null,
    title: "tour.welcomeTitle",
    text: "tour.welcome",
  };
  return [welcome, ...TOUR_SECTIONS.flatMap((s) => sections[s.id]), done];
}
