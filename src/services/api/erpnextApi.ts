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
  BpjsItem,
} from "../types";
import { tanggalPendek, tanggalPendekTahun, toISODate } from "../../utils/date";
import { ApiError, get, post, put } from "./http";

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
  return departemen ? departemen.replace(/ - [^-]+$/, "") : "—";
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
      "Gagal memuat peran akun",
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
    throw new ApiError(
      "Akun belum terhubung ke karyawan",
      200,
      "NoEmployeeLinked",
    );
  }

  return {
    id: row.name,
    nik: row.employee_number ?? "—",
    fullName: row.employee_name,
    role: await ambilRole(),
    jobTitle: row.designation ?? "—",
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
  "Cuti Tahunan": { type: "cuti", label: "Cuti tahunan" },
  "Cuti Sakit": { type: "sakit", label: "Cuti sakit" },
};

const NAMA_JENIS: Partial<Record<LeaveType, string>> = {
  cuti: "Cuti Tahunan",
  sakit: "Cuti Sakit",
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
const STATUS_CUTI: Record<string, { decision: LeaveDecision; stage: string }> =
  {
    Open: { decision: null, stage: "Menunggu persetujuan" },
    Approved: { decision: "approve", stage: "Disetujui" },
    Rejected: { decision: "reject", stage: "Ditolak" },
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
    employeeJobTitle: row.custom_designation ?? "",
    type: row.leave_type === "Cuti Sakit" ? "sakit" : "cuti",
    label: `${row.leave_type} · ${row.total_leave_days} hari`,
    reason: row.description ? `${periode} · ${row.description}` : periode,
    delegateName: row.custom_delegate_name,
    stage: status.stage,
    quota: "—",
    approverName: pemberiSetuju,
    approverInitials: inisial(pemberiSetuju),
    decision: status.decision,
    createdAt: row.posting_date,
  };
}

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
  { label: string; tone: FeedItem["tone"] }
> = {
  approve: { label: "Disetujui", tone: "ok" },
  reject: { label: "Ditolak", tone: "bad" },
  menunggu: { label: "Menunggu", tone: "warn" },
};

function keFeed(r: LeaveRequest, untukApprover: boolean): FeedItem {
  const badge = BADGE_KEPUTUSAN[r.decision ?? "menunggu"]!;
  return {
    id: r.id,
    // Approver melihat siapa pemohonnya; pemohon melihat inisialnya sendiri.
    initials: untukApprover ? r.employeeInitials : r.approverInitials,
    title: untukApprover ? `${r.employeeName} · ${r.label}` : r.label,
    subtitle: r.reason,
    badge: badge.label,
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

const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function teksKepegawaian(r: StaffRow): string {
  if (r.employment_type !== "Contract") return "Permanent";
  if (!r.contract_end_date) return "Kontrak";
  const [tahun, bulan] = r.contract_end_date.split("-").map(Number);
  return `Kontrak · s.d. ${BULAN[bulan! - 1]} ${tahun}`;
}

function bentukStaff(r: StaffRow): Staff {
  return {
    id: r.name,
    initials: inisial(r.employee_name),
    fullName: r.employee_name,
    jobTitle: r.designation ?? "—",
    department: tanpaSufiks(r.department),
    code: r.employee_number ?? r.name,
    status: r.employment_type === "Contract" ? "Kontrak" : "Tetap",
    employment: teksKepegawaian(r),
    joinDate: r.date_of_joining ?? "",
    manager: r.reports_to_name ?? "—",
    shift: r.shift ?? "—",
    email: r.company_email ?? "—",
    phone: r.cell_number ?? "—",
    leaveLeft: r.leave_left ?? 0,
    attendanceRate: r.attendance_rate ?? 0,
    kpiScore: 0, // tetap: menunggu slice Appraisal
    today: {
      state: r.today.state ?? "belum",
      checkIn: r.today.check_in,
      checkOut: r.today.check_out,
      label: r.today.label,
    },
  };
}

const NAMA_KEPEGAWAIAN: Record<string, string> = {
  "Full-time": "Permanent",
  Contract: "Kontrak",
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

// Waktu perangkat dikirim apa adanya dalam WIB (zona server). "YYYY-MM-DD HH:MM:SS".
function sekarangWib(): string {
  const d = new Date();
  const dua = (n: number) => String(n).padStart(2, "0");
  return `${toISODate(d)} ${dua(d.getHours())}:${dua(d.getMinutes())}:${dua(d.getSeconds())}`;
}

function ambilStatusJam(): Promise<ClockState> {
  return get<ClockRes>("/api/method/hris_get_clock_state").then((r) => ({
    clockedIn: r.message.clocked_in,
    lastCheckIn: r.message.last_check_in,
    lastCheckOut: r.message.last_check_out,
  }));
}

async function kirimCheckin(employeeId: string, logType: "IN" | "OUT") {
  await post(`/api/resource/${encodeURIComponent("Employee Checkin")}`, {
    employee: employeeId,
    log_type: logType,
    time: sekarangWib(),
    device_id: "hris-mobile",
  });
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
    ? `${Math.floor(r.working_hours)}j ${Math.round((r.working_hours % 1) * 60)}m`
    : r.check_in && !r.check_out
      ? "berjalan"
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

const BULAN_SINGKAT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agt",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

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
  const nama = BULAN[bulan! - 1]!;
  return {
    id: r.name,
    period: `${nama} ${tahun}`,
    monthShort: BULAN_SINGKAT[bulan! - 1]!.toUpperCase(),
    // Belum ada sumber untuk "Termasuk THR"; slip dianggap reguler.
    note: "Reguler",
    status: "Diterbitkan",
    bankAccount: samarkanRekening(r.bank_account_no),
    paidAt: tanggalPendekTahun(r.posting_date),
    earnings: r.earnings.map((e) => ({
      label: e.salary_component,
      amount: e.amount,
    })),
    deductions: r.deductions.map((d) => ({
      label: d.salary_component,
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
    return res.data.map(bentukPengajuan);
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
      jobTitle: r.designation ?? "—",
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
    // Lembur dan dinas luar belum punya endpoint asli.
    const jenis = NAMA_JENIS[input.type];
    if (!jenis) return mockApi.submitLeaveRequest(input);

    const approver = await this.getLeaveApprover(input.employeeId);
    if (!approver) {
      throw new ApiError("Belum ada approver", 0, "NoApprover");
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
    return ambilMenunggu();
  },

  async getFeed(employeeId: string, role: Role): Promise<FeedItem[]> {
    if (role === "ess") {
      return (await ambilMilikSendiri(employeeId)).map((r) => keFeed(r, false));
    }
    return (await ambilMenunggu()).slice(0, 3).map((r) => keFeed(r, true));
  },

  // Satu PUT: status saja hanya mengubah draft dan tidak memotong saldo,
  // docstatus 1 yang membuat keputusannya final.
  async decideLeaveRequest(requestId, decision): Promise<LeaveRequest> {
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
      label: NAMA_KEPEGAWAIAN[s.label] ?? s.label,
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
    return {
      year: tahun,
      // PTKP, NPWP, dan TER tidak ada sumbernya di ERPNext; tidak dikarang.
      scheme: "—",
      // Hanya bulan yang punya slip, supaya grafik tidak penuh batang kosong.
      monthly: (data?.months ?? [])
        .filter((m) => m.gross > 0)
        .map((m) => ({
          monthShort: BULAN_SINGKAT[m.month - 1]!,
          amount: m.pph21,
        })),
      peakReason: "",
      basePeriod: latest ? latest.period.split(" ")[0]! : "—",
      grossPay: gross,
      terCategory: "—",
      ptkpStatus: "—",
      npwpMasked: "—",
      monthTax: latest?.pph21 ?? 0,
      // Tinggal porsi karyawan (persen dari bruto); porsi perusahaan tidak ada.
      bpjs: (latest?.bpjs ?? []).map((b) => ({
        label: b.label,
        employeePct: gross ? Math.round((b.amount / gross) * 10000) / 100 : 0,
        companyPct: 0,
      })),
    };
  },
};
