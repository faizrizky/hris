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
} from "../types";
import { tanggalPendek, tanggalPendekTahun, toISODate } from "../../utils/date";
import { ApiError, get, post } from "./http";

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
    employeeJobTitle: "", // Leave Application tidak punya designation
    type: row.leave_type === "Cuti Sakit" ? "sakit" : "cuti",
    label: `${row.leave_type} · ${row.total_leave_days} hari`,
    reason: row.description ? `${periode} · ${row.description}` : periode,
    delegateName: null, // belum ada field-nya di ERPNext
    stage: status.stage,
    quota: "—",
    approverName: pemberiSetuju,
    approverInitials: inisial(pemberiSetuju),
    decision: status.decision,
    createdAt: row.posting_date,
  };
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
      fullName: res.message.name,
      initials: inisial(res.message.name),
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
};
