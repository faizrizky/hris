// Implementasi HrisApi yang bicara ke ERPNext asli.
// Bertahap: yang sudah asli login, getCurrentEmployee, logout, saldo cuti,
// daftar cuti sendiri, dan daftar rekan untuk delegasi. Sisanya masih mockApi
// sampai dimigrasikan satu per satu.

import { mockApi } from "../mock/mockApi";
import {
  Colleague,
  Employee,
  HrisApi,
  LeaveBalance,
  LeaveDecision,
  LeaveRequest,
  LeaveType,
  OvertimeRecord,
  Role,
  LeaveApprover,
  FeedItem,
  Staff,
  StaffDirectory,
  EmploymentSlice,
  ClockState,
  AttendanceRecord,
  AttendanceStatus,
  AttendanceCorrectionRequest,
  Payslip,
  TaxSummary,
  PersonalProfile,
  EditableProfile,
  SecurityInfo,
  SecurityToggleKey,
  ActiveDevice,
  AppNotification,
  NotifCategory,
} from "../types";
import {
  fromISODate,
  namaBulan,
  tanggalPendek,
  tanggalPendekTahun,
  toISODate,
} from "../../utils/date";
import { ApiError, get, post, put } from "./http";
import {
  kembalikan,
  terjemahkan,
  terjemahkanNotifikasi,
} from "@/i18n/serverLabels";
import { tt } from "@/i18n";
import type { Kunci } from "@/i18n/id";

interface EmployeeRow {
  name: string;
  employee_name: string;
  employee_number: string | null;
  designation: string | null;
  department: string | null;
  date_of_joining: string | null;
}

const EMPLOYEE_FIELDS = [
  "name",
  "employee_name",
  "employee_number",
  "designation",
  "department",
  "date_of_joining",
];

function inisial(nama: string): string {
  return nama
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((kata) => kata[0]!.toUpperCase())
    .join("");
}

// ERPNext menambahkan sufiks company: "Keuangan - FT" -> "Keuangan".
function tanpaSufiks(departemen: string | null): string {
  return departemen
    ? terjemahkan("department", departemen.replace(/ - [^-]+$/, ""))
    : "—";
}

// Doc User dan Has Role tidak bisa dibaca role Employee, jadi role diambil
// dari endpoint server yang mengembalikan role pemanggil sendiri.
async function ambilRole(): Promise<Role> {
  let roles: string[];
  try {
    const res = await get<{ message: string[] }>(
      "/api/method/hris_get_my_roles",
    );
    roles = res.message;
  } catch (e) {
    // Sesi mati tetap dilaporkan apa adanya; selain itu diberi nama sendiri
    // supaya tidak tampil sebagai "login gagal".
    if (e instanceof ApiError && e.excType === "SessionExpired") throw e;
    throw new ApiError(
      tt("err.peran"),
      e instanceof ApiError ? e.status : 0,
      "RoleFetchFailed",
    );
  }
  if (roles.includes("HR Manager") || roles.includes("HR User")) return "hr";
  if (roles.includes("Leave Approver")) return "mss";
  return "ess";
}

async function ambilKaryawanSaatIni() {
  const { message: email } = await get<{ message: string }>(
    "/api/method/frappe.auth.get_logged_user",
  );

  const res = await get<{ data: EmployeeRow[] }>("/api/resource/Employee", {
    filters: [["user_id", "=", email]],
    fields: EMPLOYEE_FIELDS,
    limit_page_length: 1,
  });

  const row = res.data[0];
  if (!row) {
    // Contoh: Administrator tidak punya Employee.
    throw new ApiError(tt("err.tanpaKaryawan"), 200, "NoEmployeeLinked");
  }

  return {
    id: row.name,
    nik: row.employee_number ?? "—",
    fullName: row.employee_name,
    role: await ambilRole(),
    jobTitle: row.designation
      ? terjemahkan("designation", row.designation)
      : "—",
    department: tanpaSufiks(row.department),
    avatarInitials: inisial(row.employee_name),
    joinDate: row.date_of_joining ?? "",
    kpiScore: 0, // TODO: ambil dari Appraisal saat slice Appraisal dikerjakan
  };
}

// ---------------------------------------------------------------------------
// Cuti
// ---------------------------------------------------------------------------

interface LeaveDetailsRes {
  message: {
    leave_allocation: Record<
      string,
      { total_leaves: number; remaining_leaves: number }
    >;
  };
}

// Hanya jenis cuti yang dikenal aplikasi. Jenis lain di ERPNext diabaikan dulu.
const JENIS_SALDO: Record<string, { type: LeaveType; label: string }> = {
  "Annual Leave": { type: "cuti", label: "Annual Leave" },
  "Sick Leave": { type: "sakit", label: "Sick Leave" },
};

const NAMA_JENIS: Partial<Record<LeaveType, string>> = {
  cuti: "Annual Leave",
  sakit: "Sick Leave",
};

async function ambilSaldo(employeeId: string): Promise<LeaveBalance[]> {
  // Leave Allocation tidak bisa dibaca role Employee, jadi saldo lewat
  // endpoint hrms ini.
  const res = await get<LeaveDetailsRes>(
    "/api/method/hrms.hr.doctype.leave_application.leave_application.get_leave_details",
    { employee: employeeId, date: toISODate(new Date()) },
  );

  const hasil: LeaveBalance[] = [];
  for (const [nama, v] of Object.entries(res.message.leave_allocation)) {
    const jenis = JENIS_SALDO[nama];
    if (!jenis) continue;
    hasil.push({
      ...jenis,
      label: terjemahkan("leaveType", nama),
      remaining: v.remaining_leaves,
      total: v.total_leaves,
      unit: "hari",
    });
  }
  return hasil;
}

interface LeaveRow {
  name: string;
  employee: string;
  employee_name: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  total_leave_days: number;
  status: string;
  leave_approver: string;
  leave_approver_name: string | null;
  description: string | null;
  posting_date: string;
  custom_designation: string | null;
  custom_delegate_name: string | null;
}

const LEAVE_FIELDS = [
  "name",
  "employee",
  "employee_name",
  "leave_type",
  "from_date",
  "to_date",
  "total_leave_days",
  "status",
  "leave_approver",
  "leave_approver_name",
  "description",
  "posting_date",
  "custom_designation",
  "custom_delegate_name",
];

// ERPNext hanya punya satu tahap persetujuan; "Tahap 1 dari 2" di mock
// tidak punya padanan.
const STATUS_CUTI: Record<
  string,
  { decision: LeaveDecision; stage: () => string }
> = {
  Open: { decision: null, stage: () => tt("api.menungguPersetujuan") },
  Approved: { decision: "approve", stage: () => tt("st.disetujui") },
  Rejected: { decision: "reject", stage: () => tt("st.ditolak") },
};

function periodeCuti(dari: string, sampai: string): string {
  return dari === sampai
    ? tanggalPendekTahun(dari)
    : `${tanggalPendek(dari)} – ${tanggalPendekTahun(sampai)}`;
}

function bentukPengajuan(row: LeaveRow): LeaveRequest {
  const status = STATUS_CUTI[row.status] ?? STATUS_CUTI.Open;
  const pemberiSetuju = row.leave_approver_name ?? row.leave_approver;
  const periode = periodeCuti(row.from_date, row.to_date);
  return {
    id: row.name,
    employeeId: row.employee,
    employeeName: row.employee_name,
    employeeInitials: inisial(row.employee_name),
    employeeJobTitle: row.custom_designation
      ? terjemahkan("designation", row.custom_designation)
      : "",
    type: row.leave_type === "Sick Leave" ? "sakit" : "cuti",
    label: `${terjemahkan("leaveType", row.leave_type)} · ${tt("lr.nHari", { n: row.total_leave_days })}`,
    reason: row.description ? `${periode} · ${row.description}` : periode,
    delegateName: row.custom_delegate_name,
    stage: status.stage(),
    quota: "—",
    approverName: pemberiSetuju,
    approverInitials: inisial(pemberiSetuju),
    decision: status.decision,
    createdAt: row.posting_date,
  };
}

// ---- Lembur dan Dinas Luar (endpoint Server Script) ----

interface LemburRow {
  name: string;
  employee?: string;
  employee_name?: string;
  designation?: string | null;
  date: string;
  start_minute: number;
  end_minute: number;
  hours: number;
  note: string;
  status: "pending" | "approved" | "rejected";
}

interface DinasRow {
  name: string;
  employee?: string;
  employee_name?: string;
  designation?: string | null;
  destination: string;
  from_date: string;
  to_date: string;
  transport: string;
  purpose: string;
  total_cost?: number;
  status: "pending" | "approved" | "rejected";
}

const STATUS_SERVER: Record<
  string,
  { decision: LeaveRequest["decision"]; stage: () => string }
> = {
  pending: { decision: null, stage: () => tt("api.menungguAtasan") },
  approved: { decision: "approve", stage: () => tt("st.disetujui") },
  rejected: { decision: "reject", stage: () => tt("st.ditolak") },
};

const ID_LEMBUR = /^OT-/;
const ID_DINAS = /^HR-TRQ-/;

const jamMenitServer = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function bentukLembur(r: LemburRow, saya?: string): LeaveRequest {
  const st = STATUS_SERVER[r.status] ?? STATUS_SERVER.pending;
  const nama = r.employee_name ?? saya ?? "—";
  return {
    id: r.name,
    employeeId: r.employee ?? "",
    employeeName: nama,
    employeeInitials: inisial(nama),
    employeeJobTitle: r.designation
      ? terjemahkan("designation", r.designation)
      : "",
    type: "lembur",
    label: tt("api.lemburLabel", { jam: r.hours, tgl: tanggalPendek(r.date) }),
    reason: `${jamMenitServer(r.start_minute)}–${jamMenitServer(r.end_minute)} · ${r.note}`,
    delegateName: null,
    stage: st.stage(),
    quota: "—",
    approverName: "",
    approverInitials: "",
    decision: st.decision,
    createdAt: r.date,
  };
}

function bentukDinas(r: DinasRow, saya?: string): LeaveRequest {
  const st = STATUS_SERVER[r.status] ?? STATUS_SERVER.pending;
  const nama = r.employee_name ?? saya ?? "—";
  return {
    id: r.name,
    employeeId: r.employee ?? "",
    employeeName: nama,
    employeeInitials: inisial(nama),
    employeeJobTitle: r.designation
      ? terjemahkan("designation", r.designation)
      : "",
    type: "dinas_luar",
    label: tt("api.dinasLabel", { kota: r.destination }),
    reason: `${periodeCuti(r.from_date, r.to_date)} · ${r.purpose}`,
    delegateName: null,
    stage: st.stage(),
    quota: "—",
    approverName: "",
    approverInitials: "",
    decision: st.decision,
    createdAt: r.from_date,
  };
}

const TRANSPORT_SERVER: Record<string, string> = {
  Pesawat: "Flight",
  Kereta: "Train",
  "Mobil kantor": "Car",
  Lainnya: "Bus",
};

const BIAYA_SERVER: Record<string, string> = {
  Transportasi: "Travel",
  Hotel: "Others",
  Konsumsi: "Food",
  "Parkir & Tol": "Travel",
  Lainnya: "Others",
};

// Pemisah format "kategori|keterangan|nominal;..." tidak boleh ada di isi.
const bersih = (t: string) => t.replace(/[|;]/g, " ").trim();

async function ambilLembur(tim: boolean): Promise<LeaveRequest[]> {
  const res = await get<{ message: LemburRow[] }>(
    "/api/method/hris_get_overtimes",
    tim ? { scope: "team" } : undefined,
  );
  return res.message.map((r) => bentukLembur(r));
}

async function ambilDinas(tim: boolean): Promise<LeaveRequest[]> {
  const res = await get<{ message: DinasRow[] }>(
    "/api/method/hris_get_travel_requests",
    tim ? { scope: "team" } : undefined,
  );
  return res.message.map((r) => bentukDinas(r));
}

const urutBaru = (a: LeaveRequest, b: LeaveRequest) =>
  b.createdAt.localeCompare(a.createdAt);

async function ambilMenunggu(): Promise<LeaveRequest[]> {
  const { message: email } = await get<{ message: string }>(
    "/api/method/frappe.auth.get_logged_user",
  );
  const res = await get<{ data: LeaveRow[] }>(
    `/api/resource/${encodeURIComponent("Leave Application")}`,
    {
      filters: [
        ["leave_approver", "=", email],
        ["status", "=", "Open"],
        ["docstatus", "=", 0],
      ],
      fields: LEAVE_FIELDS,
      order_by: "creation desc",
      limit_page_length: 50,
    },
  );
  return res.data.map(bentukPengajuan);
}

async function ambilMilikSendiri(employeeId: string): Promise<LeaveRequest[]> {
  const res = await get<{ data: LeaveRow[] }>(
    `/api/resource/${encodeURIComponent("Leave Application")}`,
    {
      filters: [
        ["employee", "=", employeeId],
        ["status", "!=", "Cancelled"],
      ],
      fields: LEAVE_FIELDS,
      order_by: "creation desc",
      limit_page_length: 3,
    },
  );
  return res.data.map(bentukPengajuan);
}

const BADGE_KEPUTUSAN: Record<
  string,
  { label: Kunci; tone: FeedItem["tone"] }
> = {
  approve: { label: "st.disetujui", tone: "ok" },
  reject: { label: "st.ditolak", tone: "bad" },
  menunggu: { label: "st.menunggu", tone: "warn" },
};

function keFeed(r: LeaveRequest, untukApprover: boolean): FeedItem {
  const badge = BADGE_KEPUTUSAN[r.decision ?? "menunggu"]!;
  return {
    id: r.id,
    // Approver melihat siapa pemohonnya; pemohon melihat inisialnya sendiri.
    initials: untukApprover ? r.employeeInitials : r.approverInitials,
    title: untukApprover ? `${r.employeeName} · ${r.label}` : r.label,
    subtitle: r.reason,
    badge: tt(badge.label),
    tone: badge.tone,
    createdAt: r.createdAt,
  };
}

interface StaffRow {
  name: string;
  employee_name: string;
  designation: string | null;
  department: string | null;
  employee_number: string | null;
  employment_type: string | null;
  contract_end_date: string | null;
  date_of_joining: string | null;
  reports_to_name: string | null;
  shift: string | null;
  company_email: string | null;
  cell_number: string | null;
  leave_left: number | null;
  attendance_rate: number | null;
  today: {
    state: "attend" | "late" | "leave" | null;
    check_in: string | null;
    check_out: string | null;
    label: string;
  };
}

function teksKepegawaian(r: StaffRow): string {
  if (r.employment_type !== "Contract") return tt("api.permanen");
  if (!r.contract_end_date) return tt("api.kontrak");
  const [tahun] = r.contract_end_date.split("-").map(Number);
  return tt("api.kontrakSd", {
    bulan: namaBulan(fromISODate(r.contract_end_date)),
    tahun: tahun!,
  });
}

function bentukStaff(r: StaffRow): Staff {
  return {
    id: r.name,
    initials: inisial(r.employee_name),
    fullName: r.employee_name,
    jobTitle: r.designation ? terjemahkan("designation", r.designation) : "—",
    department: tanpaSufiks(r.department),
    code: r.employee_number ?? r.name,
    status: r.employment_type === "Contract" ? "Kontrak" : "Tetap",
    employment: teksKepegawaian(r),
    joinDate: r.date_of_joining ?? "",
    manager: r.reports_to_name ?? "—",
    shift: r.shift ? terjemahkan("shift", r.shift) : "—",
    email: r.company_email ?? "—",
    phone: r.cell_number ?? "—",
    leaveLeft: r.leave_left ?? 0,
    attendanceRate: r.attendance_rate ?? 0,
    kpiScore: 0, // tetap: menunggu slice Appraisal
    today: {
      state: r.today.state ?? "belum",
      checkIn: r.today.check_in,
      checkOut: r.today.check_out,
      label: terjemahkan("attendanceLabel", r.today.label),
    },
  };
}

// ---------------------------------------------------------------------------
// Profil dan keamanan
// ---------------------------------------------------------------------------

interface KontakRow {
  name: string | null;
  relation: string | null;
  phone: string | null;
}

interface ProfileRow {
  employee_name: string;
  date_of_birth: string | null;
  place_of_birth: string | null;
  gender: string | null;
  marital_status: string | null;
  religion: string | null;
  company_email: string | null;
  personal_email: string | null;
  cell_number: string | null;
  current_address: string | null;
  permanent_address: string | null;
  emergency: KontakRow;
  em2: KontakRow;
}

const JENIS_KELAMIN: Record<string, Kunci> = {
  Male: "api.lakiLaki",
  Female: "api.perempuan",
};

const STATUS_NIKAH: Record<string, Kunci> = {
  Single: "api.belumMenikah",
  Married: "api.menikah",
  Divorced: "api.ceraiHidup",
  Widowed: "api.ceraiMati",
};

function bentukProfil(r: ProfileRow): PersonalProfile {
  return {
    fullName: r.employee_name,
    // NIK, NPWP, dan PTKP tidak punya sumber di ERPNext, jadi tidak dikarang.
    nikMasked: "—",
    birthPlace: r.place_of_birth ?? "—",
    birthDate: r.date_of_birth ?? "",
    gender: JENIS_KELAMIN[r.gender ?? ""]
      ? tt(JENIS_KELAMIN[r.gender ?? ""]!)
      : (r.gender ?? "—"),
    maritalStatus: STATUS_NIKAH[r.marital_status ?? ""]
      ? tt(STATUS_NIKAH[r.marital_status ?? ""]!)
      : (r.marital_status ?? "—"),
    religion: r.religion ?? "—",
    npwpMasked: "—",
    workEmail: r.company_email ?? "—",
    ktpAddress: r.permanent_address ?? "—",
    ptkpStatus: "—",
    family: [], // belum ada sumbernya
    primaryEmergency: {
      name: r.emergency.name ?? "—",
      relation: r.emergency.relation
        ? terjemahkan("relation", r.emergency.relation)
        : "—",
      phone: r.emergency.phone ?? "—",
    },
    editable: {
      phone: r.cell_number ?? "",
      personalEmail: r.personal_email ?? "",
      address: r.current_address ?? "",
      em2Name: r.em2.name ?? "",
      em2Relation: r.em2.relation
        ? terjemahkan("relation", r.em2.relation)
        : "",
      em2Phone: r.em2.phone ?? "",
    },
  };
}

interface SesiRow {
  id: string;
  ip: string | null;
  last_updated: string | null;
  user_agent: string | null;
  current: boolean;
}

function bentukPerangkat(s: SesiRow): ActiveDevice {
  const ua = s.user_agent ?? "";
  const mobile = /expo|cfnetwork|okhttp|android|iphone|dalvik/i.test(ua);
  const waktu = s.last_updated ? s.last_updated.slice(0, 16) : "";
  return {
    id: s.id,
    name: mobile
      ? tt("api.appHris")
      : ua
        ? tt("api.browser")
        : tt("api.perangkat"),
    meta: [s.ip ?? "—", waktu].filter(Boolean).join(" · "),
    kind: mobile ? "mobile" : "web",
    current: s.current,
  };
}

async function ambilPerangkat(): Promise<ActiveDevice[]> {
  const res = await get<{ message: SesiRow[] }>(
    "/api/method/hris_get_active_sessions",
  );
  return res.message.map(bentukPerangkat);
}

// Daftar perangkat asli; verifikasi wajah dan toggle masih dari mock sampai
// fase ML Kit.
async function ambilInfoKeamanan(employeeId: string): Promise<SecurityInfo> {
  const [dasar, devices] = await Promise.all([
    mockApi.getSecurityInfo(employeeId),
    ambilPerangkat(),
  ]);
  return { ...dasar, devices };
}

interface NotifRow {
  name: string;
  subject: string;
  body: string | null;
  category: NotifCategory;
  tone: AppNotification["tone"];
  time: string; // "YYYY-MM-DDTHH:MM:SS" dalam WIB, tanpa offset
  read: number;
}

function bentukNotifikasi(r: NotifRow): AppNotification {
  const [tanggal, jam = ""] = r.time.split("T");
  const hari = toISODate(new Date());
  const kemarin = toISODate(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const hhmm = jam.slice(0, 5);
  const { title, body } = terjemahkanNotifikasi(r.subject, r.body ?? "");
  const [group, timeLabel] =
    tanggal === hari
      ? [tt("notif.hariIni"), hhmm]
      : tanggal === kemarin
        ? [tt("notif.kemarin"), `${tt("notif.kemarin")} ${hhmm}`]
        : [tt("notif.sebelumnya"), `${tanggalPendekTahun(tanggal!)} ${hhmm}`];
  return {
    id: r.name,
    title,
    body,
    category: r.category,
    timeLabel,
    group,
    tone: r.tone,
    read: r.read === 1,
  };
}

const NAMA_KEPEGAWAIAN: Record<string, Kunci> = {
  "Full-time": "api.permanen",
  Contract: "api.kontrak",
};

interface ClockRes {
  message: {
    clocked_in: boolean;
    last_check_in: string | null;
    last_check_out: string | null;
  };
}

interface AttendanceRow {
  date: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
  working_hours: number | null;
  late_entry: number;
}

function ambilStatusJam(): Promise<ClockState> {
  return get<ClockRes>("/api/method/hris_get_clock_state").then((r) => ({
    clockedIn: r.message.clocked_in,
    lastCheckIn: r.message.last_check_in,
    lastCheckOut: r.message.last_check_out,
  }));
}

async function kirimCheckin(_employeeId: string, logType: "IN" | "OUT") {
  // Jam ditentukan server menurut zona waktu lokasi kerja (dinas luar ikut
  // zona tujuan), jadi jam perangkat tidak dikirim.
  await post("/api/method/hris_checkin", { log_type: logType });
  return ambilStatusJam();
}

// "Present"/"Absent"/"On Leave" dipetakan ke tiga status yang dikenal layar.
function bentukAbsensi(r: AttendanceRow): AttendanceRecord {
  const status: AttendanceStatus =
    r.status === "On Leave" || r.status === "Absent" || r.status === "Half Day"
      ? "izin"
      : r.late_entry
        ? "telat"
        : "hadir";
  const jam = r.working_hours
    ? tt("api.durasi", {
        h: Math.floor(r.working_hours),
        m: Math.round((r.working_hours % 1) * 60),
      })
    : r.check_in && !r.check_out
      ? tt("api.berjalan")
      : null;
  return {
    id: r.date,
    date: r.date,
    checkIn: r.check_in,
    checkOut: r.check_out,
    durationLabel: jam,
    status,
  };
}

interface CorrectionRow {
  name: string;
  date: string;
  check_in: string;
  check_out: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
}

function bentukKoreksi(
  r: CorrectionRow,
  employeeId: string,
): AttendanceCorrectionRequest {
  return {
    id: r.name,
    employeeId,
    date: r.date,
    requestedCheckIn: r.check_in,
    requestedCheckOut: r.check_out,
    reason: r.reason,
    status: r.status,
  };
}

interface SlipRow {
  name: string;
  start_date: string;
  posting_date: string;
  bank_account_no: string | null;
  gross_pay: number;
  total_deduction: number;
  net_pay: number;
  earnings: { salary_component: string; amount: number }[];
  deductions: { salary_component: string; amount: number }[];
}

// Nomor rekening penuh tidak ditampilkan di layar: hanya empat digit terakhir.
function samarkanRekening(no: string | null): string {
  return no ? `•••• ${no.slice(-4)}` : "—";
}

function bentukSlip(r: SlipRow): Payslip {
  const [tahun, bulan] = r.start_date.split("-").map(Number);
  const nama = namaBulan(new Date(tahun!, bulan! - 1, 1));
  return {
    id: r.name,
    period: `${nama} ${tahun}`,
    monthShort: namaBulan(new Date(tahun!, bulan! - 1, 1))
      .slice(0, 3)
      .toUpperCase(),
    // Belum ada sumber untuk "Termasuk THR"; slip dianggap reguler.
    note: tt("api.reguler"),
    status: tt("api.diterbitkan"),
    bankAccount: samarkanRekening(r.bank_account_no),
    paidAt: tanggalPendekTahun(r.posting_date),
    earnings: r.earnings.map((e) => ({
      label: terjemahkan("salaryComponent", e.salary_component),
      amount: e.amount,
    })),
    deductions: r.deductions.map((d) => ({
      label: terjemahkan("salaryComponent", d.salary_component),
      amount: d.amount,
    })),
    grossPay: r.gross_pay,
    totalDeduction: r.total_deduction,
    netPay: r.net_pay,
  };
}

interface TaxRes {
  message: {
    year: number;
    months: { month: number; pph21: number; bpjs: number; gross: number }[];
    latest: {
      period: string;
      gross_pay: number;
      pph21: number;
      bpjs: { label: string; amount: number }[];
    } | null;
  } | null;
}

export const erpnextApi: HrisApi = {
  ...mockApi,

  async login(email: string, password: string): Promise<Employee> {
    await post("/api/method/login", { usr: email, pwd: password });
    try {
      return await ambilKaryawanSaatIni();
    } catch (e) {
      // Jangan biarkan sesi di server hidup padahal aplikasi menganggap
      // login gagal.
      await post("/api/method/logout").catch(() => {});
      throw e;
    }
  },

  async getCurrentEmployee(): Promise<Employee> {
    return ambilKaryawanSaatIni();
  },

  async logout(): Promise<void> {
    await post("/api/method/logout");
  },

  async getOvertimes(employeeId: string): Promise<OvertimeRecord[]> {
    const res = await get<{ message: LemburRow[] }>(
      "/api/method/hris_get_overtimes",
    );
    return res.message.map((r) => ({
      id: r.name,
      employeeId,
      date: r.date,
      startMinute: r.start_minute,
      endMinute: r.end_minute,
      hours: r.hours,
      note: r.note,
      status: r.status,
    }));
  },

  async getLanguage() {
    const res = await get<{ message: { language: string } }>(
      "/api/method/hris_get_my_language",
    );
    return res.message.language === "id" ? "id" : "en";
  },

  async setLanguage(language: "id" | "en") {
    await post("/api/method/hris_set_my_language", { language });
  },

  async getLeaveBalances(employeeId: string): Promise<LeaveBalance[]> {
    return ambilSaldo(employeeId);
  },

  async getLeaveRequests(employeeId: string): Promise<LeaveRequest[]> {
    const res = await get<{ data: LeaveRow[] }>(
      `/api/resource/${encodeURIComponent("Leave Application")}`,
      {
        filters: [
          ["employee", "=", employeeId],
          ["status", "!=", "Cancelled"],
        ],
        fields: LEAVE_FIELDS,
        order_by: "creation desc",
        limit_page_length: 50,
      },
    );
    const [lembur, dinas] = await Promise.all([
      ambilLembur(false),
      ambilDinas(false),
    ]);
    return [...res.data.map(bentukPengajuan), ...lembur, ...dinas].sort(
      urutBaru,
    );
  },

  // Pemanggil dikenali server dari sesinya, jadi employeeId tidak dikirim.
  async getColleagues(): Promise<Colleague[]> {
    const res = await get<{
      message: {
        name: string;
        employee_name: string;
        designation: string | null;
      }[];
    }>("/api/method/hris_get_colleagues");
    return res.message.map((r) => ({
      id: r.name,
      initials: inisial(r.employee_name),
      fullName: r.employee_name,
      jobTitle: r.designation ? terjemahkan("designation", r.designation) : "—",
    }));
  },

  async getLeaveApprover(): Promise<LeaveApprover | null> {
    const res = await get<{ message: { email: string; name: string } | null }>(
      "/api/method/hris_get_my_approver",
    );
    if (!res.message) return null;
    return {
      id: res.message.email,
      fullName: res.message.name ?? res.message.email,
      initials: inisial(res.message.name ?? res.message.email),
    };
  },

  async submitLeaveRequest(input) {
    if (input.type === "lembur") {
      if (!input.overtimeEnd)
        throw new ApiError(tt("err.dataKurang"), 0, "NoEnd");
      const res = await post<{ message: LemburRow }>(
        "/api/method/hris_submit_overtime",
        {
          date: input.fromDate,
          end_time: input.overtimeEnd,
          note: input.reason,
        },
      );
      return bentukLembur(res.message, input.employeeId);
    }
    if (input.type === "dinas_luar") {
      const t = input.travel;
      if (!t) throw new ApiError(tt("err.dataKurang"), 0, "NoTravel");
      const res = await post<{ message: DinasRow }>(
        "/api/method/hris_submit_travel_request",
        {
          destination: t.destination,
          from_date: input.fromDate,
          to_date: input.toDate,
          transport: TRANSPORT_SERVER[t.transport] ?? "Bus",
          purpose: t.purpose,
          costs: t.costs
            .filter((x) => x.amount > 0)
            .map(
              (x) =>
                `${BIAYA_SERVER[x.category] ?? "Others"}|${bersih(x.description)}|${x.amount}`,
            )
            .join(";"),
        },
      );
      return bentukDinas(res.message, input.employeeId);
    }
    const jenis = NAMA_JENIS[input.type];
    if (!jenis) return mockApi.submitLeaveRequest(input);

    const approver = await this.getLeaveApprover(input.employeeId);
    if (!approver) {
      throw new ApiError(tt("err.tanpaApprover"), 0, "NoApprover");
    }

    const res = await post<{ data: LeaveRow }>(
      `/api/resource/${encodeURIComponent("Leave Application")}`,
      {
        employee: input.employeeId,
        leave_type: jenis,
        from_date: input.fromDate,
        to_date: input.toDate,
        description: input.reason,
        leave_approver: approver.id,
        custom_delegate: input.delegateId ?? "",
      },
    );
    return bentukPengajuan(res.data);
  },

  async getPendingApprovals(): Promise<LeaveRequest[]> {
    const [cuti, lembur, dinas] = await Promise.all([
      ambilMenunggu(),
      ambilLembur(true),
      ambilDinas(true),
    ]);
    const menunggu = (r: LeaveRequest) => r.decision === null;
    return [
      ...cuti,
      ...lembur.filter(menunggu),
      ...dinas.filter(menunggu),
    ].sort(urutBaru);
  },

  async getFeed(employeeId: string, role: Role): Promise<FeedItem[]> {
    if (role === "ess") {
      return (await ambilMilikSendiri(employeeId)).map((r) => keFeed(r, false));
    }
    return (await this.getPendingApprovals(employeeId))
      .slice(0, 3)
      .map((r) => keFeed(r, true));
  },

  // Satu PUT: status saja hanya mengubah draft dan tidak memotong saldo,
  // docstatus 1 yang membuat keputusannya final.
  async decideLeaveRequest(requestId, decision): Promise<LeaveRequest> {
    const lembur = ID_LEMBUR.test(requestId);
    if (lembur || ID_DINAS.test(requestId)) {
      const res = await post<{ message: LemburRow & DinasRow }>(
        lembur
          ? "/api/method/hris_decide_overtime"
          : "/api/method/hris_decide_travel_request",
        { name: requestId, decision },
      );
      return lembur ? bentukLembur(res.message) : bentukDinas(res.message);
    }
    const res = await put<{ data: LeaveRow }>(
      `/api/resource/${encodeURIComponent("Leave Application")}/${encodeURIComponent(requestId)}`,
      {
        status: decision === "approve" ? "Approved" : "Rejected",
        docstatus: 1,
      },
    );
    return bentukPengajuan(res.data);
  },

  // Penyaringan hak akses (HR semua, atasan hanya bawahan) dilakukan Server Script.
  async getStaffDirectory(): Promise<StaffDirectory> {
    const res = await get<{
      message: { total_active: number; items: StaffRow[] };
    }>("/api/method/hris_get_staff_directory");
    return {
      totalActive: res.message.total_active,
      items: res.message.items.map(bentukStaff),
    };
  },

  async getEmploymentSummary(): Promise<EmploymentSlice[] | null> {
    const res = await get<{
      message: { label: string; count: number }[] | null;
    }>("/api/method/hris_get_employment_summary");
    if (!res.message) return null;
    return res.message.map((s) => ({
      label: NAMA_KEPEGAWAIAN[s.label]
        ? tt(NAMA_KEPEGAWAIAN[s.label]!)
        : s.label,
      count: s.count,
    }));
  },

  async getClockState(): Promise<ClockState> {
    return ambilStatusJam();
  },

  async clockIn(employeeId: string): Promise<ClockState> {
    return kirimCheckin(employeeId, "IN");
  },

  async clockOut(employeeId: string): Promise<ClockState> {
    return kirimCheckin(employeeId, "OUT");
  },

  async getAttendanceHistory(): Promise<AttendanceRecord[]> {
    const res = await get<{ message: AttendanceRow[] }>(
      "/api/method/hris_get_attendance_history",
    );
    return res.message.map(bentukAbsensi);
  },

  async submitAttendanceCorrection(
    input,
  ): Promise<AttendanceCorrectionRequest> {
    const res = await post<{ message: CorrectionRow }>(
      "/api/method/hris_submit_attendance_correction",
      {
        date: input.date,
        check_in: input.requestedCheckIn,
        check_out: input.requestedCheckOut,
        reason: input.reason,
      },
    );
    return bentukKoreksi(res.message, input.employeeId);
  },

  async getAttendanceCorrections(employeeId: string) {
    const res = await get<{ message: CorrectionRow[] }>(
      "/api/method/hris_get_attendance_corrections",
    );
    return res.message.map((r) => bentukKoreksi(r, employeeId));
  },

  async getPayslips(): Promise<Payslip[]> {
    const res = await get<{ message: SlipRow[] }>(
      "/api/method/hris_get_payslips",
    );
    return res.message.map(bentukSlip);
  },

  async getTaxSummary(): Promise<TaxSummary> {
    const res = await get<TaxRes>("/api/method/hris_get_tax_summary");
    const data = res.message;
    const tahun = data?.year ?? new Date().getFullYear();
    const latest = data?.latest;
    const gross = latest?.gross_pay ?? 0;
    const bulanTerakhir = (data?.months ?? [])
      .filter((m) => m.gross > 0)
      .at(-1);
    return {
      year: tahun,
      // PTKP, NPWP, dan TER tidak ada sumbernya di ERPNext; tidak dikarang.
      scheme: "—",
      // Hanya bulan yang punya slip, supaya grafik tidak penuh batang kosong.
      monthly: (data?.months ?? [])
        .filter((m) => m.gross > 0)
        .map((m) => ({
          monthShort: namaBulan(new Date(2000, m.month - 1, 1)).slice(0, 3),
          amount: m.pph21,
        })),
      peakReason: "",
      // Nama bulan dari nomor bulan, bukan dari teks server (berbahasa Inggris).
      basePeriod: bulanTerakhir
        ? namaBulan(new Date(2000, bulanTerakhir.month - 1, 1))
        : "—",
      grossPay: gross,
      terCategory: "—",
      ptkpStatus: "—",
      npwpMasked: "—",
      monthTax: latest?.pph21 ?? 0,
      // Tinggal porsi karyawan (persen dari bruto); porsi perusahaan tidak ada.
      bpjs: (latest?.bpjs ?? []).map((b) => ({
        label: terjemahkan("salaryComponent", b.label),
        employeePct: gross ? Math.round((b.amount / gross) * 10000) / 100 : 0,
        companyPct: 0,
      })),
    };
  },
  async getPersonalProfile(): Promise<PersonalProfile> {
    const res = await get<{ message: ProfileRow }>(
      "/api/method/hris_get_my_profile",
    );
    return bentukProfil(res.message);
  },

  async savePersonalProfile(
    _employeeId: string,
    data: EditableProfile,
  ): Promise<PersonalProfile> {
    const res = await post<{ message: ProfileRow }>(
      "/api/method/hris_update_my_profile",
      {
        phone: data.phone,
        personal_email: data.personalEmail,
        address: data.address,
        em2_name: data.em2Name,
        em2_relation: kembalikan("relation", data.em2Relation),
        em2_phone: data.em2Phone,
      },
    );
    return bentukProfil(res.message);
  },

  async getSecurityInfo(employeeId: string): Promise<SecurityInfo> {
    return ambilInfoKeamanan(employeeId);
  },

  async setSecurityToggle(
    employeeId: string,
    key: SecurityToggleKey,
    enabled: boolean,
  ): Promise<SecurityInfo> {
    // Toggle masih mock; daftar perangkat tetap yang asli.
    await mockApi.setSecurityToggle(employeeId, key, enabled);
    return ambilInfoKeamanan(employeeId);
  },

  async logoutOtherDevices(employeeId: string): Promise<SecurityInfo> {
    await post("/api/method/hris_logout_other_sessions");
    return ambilInfoKeamanan(employeeId);
  },

  // Setelah berhasil, server mematikan sesi ini; permintaan berikutnya
  // membuat aplikasi kembali ke layar login lewat penanganan sesi berakhir.
  async changePassword(
    _employeeId: string,
    current: string,
    next: string,
  ): Promise<void> {
    try {
      await post("/api/method/frappe.core.doctype.user.user.update_password", {
        old_password: current,
        new_password: next,
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        throw new ApiError(tt("err.passwordLama"), 401, "WrongPassword");
      }
      if (e instanceof ApiError && e.status === 417) {
        throw new ApiError(tt("err.passwordLemah"), 417, "WeakPassword");
      }
      throw e;
    }
  },
  async getNotificationInbox(): Promise<AppNotification[]> {
    const res = await get<{ message: NotifRow[] }>(
      "/api/method/hris_get_notifications",
    );
    return res.message.map(bentukNotifikasi);
  },

  async markNotificationsRead(
    _employeeId: string,
    ids?: string[],
  ): Promise<AppNotification[]> {
    const res = await post<{ message: NotifRow[] }>(
      "/api/method/hris_mark_notifications_read",
      // Dipisah koma: Server Script tidak bisa mengurai JSON dari isi form.
      ids ? { names: ids.join(",") } : undefined,
    );
    return res.message.map(bentukNotifikasi);
  },
};
