// Implementasi HrisApi yang bicara ke ERPNext asli.
// Bertahap: yang sudah asli hanya login, getCurrentEmployee, logout.
// Sisanya masih mockApi sampai dimigrasikan satu per satu.

import { mockApi } from "../mock/mockApi";
import { Employee, HrisApi, Role } from "../types";
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

// BELUM TERVERIFIKASI: membaca doc User milik sendiri untuk daftar role.
async function ambilRole(email: string): Promise<Role> {
  const res = await get<{ data: { roles?: { role: string }[] } }>(
    `/api/resource/User/${encodeURIComponent(email)}`,
  );
  const roles = (res.data.roles ?? []).map((r) => r.role);
  if (roles.includes("HR Manager") || roles.includes("HR User")) return "hr";
  if (roles.includes("Leave Approver")) return "mss";
  return "ess";
}

async function ambilKaryawanSaatIni(): Promise<Employee> {
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
    role: await ambilRole(email),
    jobTitle: row.designation ?? "—",
    department: tanpaSufiks(row.department),
    avatarInitials: inisial(row.employee_name),
    joinDate: row.date_of_joining ?? "",
    kpiScore: 0, // TODO: ambil dari Appraisal saat slice Appraisal dikerjakan
  };
}

export const erpnextApi: HrisApi = {
  ...mockApi,

  async login(email: string, password: string): Promise<Employee> {
    await post("/api/method/login", { usr: email, pwd: password });
    return ambilKaryawanSaatIni();
  },

  async getCurrentEmployee(): Promise<Employee> {
    return ambilKaryawanSaatIni();
  },

  async logout(): Promise<void> {
    await post("/api/method/logout");
  },
};
