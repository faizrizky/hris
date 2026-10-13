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
  Announcement,
  Appraisal,
  AturanLokasi,
  LokasiCheckin,
  OfflineCheckin,
  ProfileChange,
  FeedbackForm,
  ReviewDocument,
  TeamAppraisal,
  BerkasLampiran,
  DocCategory,
  DocStatus,
  EmployeeDocument,
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
import { ApiError, get, post, put, upload } from "./http";
import { ukuranFile } from "../../utils/file";
import { File as FileFs } from "expo-file-system";
import { tokenPushSaatIni } from "../push";
import { waktuTerpercaya } from "../trustedTime";
import {
  ItemAntrean,
  ambilAntrean,
  antre,
  hapusDariAntrean,
  jumlahAntrean,
} from "../offlineQueue";
import { terjemahkan, terjemahkanNotifikasi } from "@/i18n/serverLabels";
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

interface LampiranRow {
  file_name: string;
  file_url: string;
}

const keLampiran = (l?: LampiranRow[]) =>
  l?.length
    ? l.map((x) => ({ name: x.file_name, url: x.file_url }))
    : undefined;

interface LemburRow {
  attachments?: LampiranRow[];
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
  attachments?: LampiranRow[];
  costs?: { attachments?: LampiranRow[] }[];
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
    attachments: keLampiran(r.attachments),
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
    attachments: keLampiran([
      ...(r.attachments ?? []),
      ...(r.costs ?? []).flatMap((c) => c.attachments ?? []),
    ]),
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

// Unggah satu berkas ke upload_file. fetch bawaan Expo tidak menerima bentuk
// {uri,name,type} khas React Native, jadi isinya dibaca lewat expo-file-system
// dan dikirim sebagai bagian multipart biasa (objek dengan bytes()).
async function unggahBerkas(
  f: BerkasLampiran,
  doctype: string,
  docname: string,
  fieldname: string,
): Promise<void> {
  const sumber = new FileFs(f.uri);
  const form = new FormData();
  // fetch Expo meng-encode nama berkas (spasi jadi %20), jadi dibersihkan dulu.
  form.append("file", {
    name: f.name.replace(/[^\w.\-]+/g, "_"),
    type: f.mimeType || "application/octet-stream",
    bytes: () => sumber.bytes(),
  } as unknown as Blob);
  form.append("is_private", "1");
  form.append("doctype", doctype);
  form.append("docname", docname);
  form.append("fieldname", fieldname);
  await upload("/api/method/upload_file", form);
}

// Lampiran dikirim setelah dokumennya ada. Satu yang gagal tidak menggagalkan
// pengajuan; jumlah yang gagal dikembalikan supaya pengguna diberi tahu.
async function lampirkanSemua(
  doctype: string,
  docname: string,
  daftar: { f: BerkasLampiran; field: string }[],
): Promise<number> {
  let gagal = 0;
  for (const { f, field } of daftar) {
    try {
      await unggahBerkas(f, doctype, docname, field);
    } catch {
      gagal += 1;
    }
  }
  return gagal;
}

// ---- Dokumen Digital dan Appraisal ----

interface DokumenRow {
  name: string;
  document_name: string;
  category: "Contract" | "Decree" | "Certificate" | "Identity";
  ext: string | null;
  size_bytes: number | null;
  uploaded_on: string | null;
  expires_on: string | null;
  status: "Pending" | "Verified" | "Rejected" | "Change Requested";
  change_reason?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  rejection_reason?: string | null;
}

const KATEGORI_DOK: Record<DokumenRow["category"], DocCategory> = {
  Contract: "kontrak",
  Decree: "sk",
  Certificate: "sertifikat",
  Identity: "identitas",
};

const KATEGORI_DOK_SERVER: Record<DocCategory, DokumenRow["category"]> = {
  kontrak: "Contract",
  sk: "Decree",
  sertifikat: "Certificate",
  identitas: "Identity",
};

// Hitungan hari kalender dari hari ini; negatif = sudah lewat.
function hariKe(iso: string): number {
  const hari = fromISODate(toISODate(new Date()));
  return Math.round((fromISODate(iso).getTime() - hari.getTime()) / 86400000);
}

function bentukDokumen(r: DokumenRow): EmployeeDocument {
  const sisa = r.expires_on ? hariKe(r.expires_on) : null;
  const hampirHabis = r.status === "Verified" && sisa !== null && sisa <= 60;
  const status: DocStatus =
    r.status === "Rejected"
      ? "rejected"
      : r.status === "Change Requested"
        ? "changeRequested"
        : r.status === "Pending"
          ? "pending"
          : hampirHabis
            ? "expiring"
            : "verified";
  const dateLabel = hampirHabis
    ? sisa! < 0
      ? tt("doc.sudahBerakhir")
      : tt("doc.berakhirHari", { n: sisa! })
    : r.expires_on
      ? tt("doc.berlakuSd", { tgl: tanggalPendekTahun(r.expires_on) })
      : tt("doc.diunggah", {
          tgl: r.uploaded_on ? tanggalPendekTahun(r.uploaded_on) : "—",
        });
  return {
    id: r.name,
    category: KATEGORI_DOK[r.category] ?? "sertifikat",
    ext: r.ext ?? "FILE",
    name: r.document_name,
    sizeLabel: r.size_bytes ? ukuranFile(r.size_bytes) : "—",
    dateLabel,
    status,
    fileUrl: r.file_url ?? null,
    fileName: r.file_name ? decodeURIComponent(r.file_name) : null,
    rejectionReason: r.rejection_reason ?? null,
    changeReason: r.change_reason ?? null,
    expiresOn: r.expires_on,
    uploadedOn: r.uploaded_on,
  };
}

async function ambilDokumen(): Promise<EmployeeDocument[]> {
  const res = await get<{ message: DokumenRow[] }>(
    "/api/method/hris_get_my_documents",
  );
  return res.message.map(bentukDokumen);
}

interface ReviewRow extends DokumenRow {
  employee_name: string;
  designation: string | null;
  department: string | null;
}

interface AppraisalRes {
  cycle: string;
  method: string;
  score: number;
  max_score: number;
  rating: string;
  rating_tone: Appraisal["ratingTone"];
  raters: { name: string; score: number; weight: number }[];
  goals: { name: string; progress: number; note: string | null }[];
}

const RATING: Record<string, Kunci> = {
  Excellent: "rate.Excellent",
  Good: "rate.Good",
  Fair: "rate.Fair",
  "Needs Improvement": "rate.Needs Improvement",
  Poor: "rate.Poor",
};

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

// Parameter form-encoded untuk menyimpan/mengajukan data pribadi. Daftar dikirim
// sebagai teks: kontak "nama|relasi|telepon;...", keluarga "nama|relasi|tgl|0/1;...".
function paramProfil(data: EditableProfile) {
  const bersih = (x: string) => x.replace(/[|;]/g, " ").trim();
  return {
    phone: data.phone,
    marital_status: data.maritalStatus,
    personal_email: data.personalEmail,
    address: data.address,
    family: data.family
      .map((m) =>
        [
          bersih(m.name),
          m.relation,
          m.birthDate ?? "",
          m.dependent ? "1" : "0",
        ].join("|"),
      )
      .join(";"),
    emergency_contacts: data.contacts
      .map((k) => [k.name, k.relation, k.phone].map(bersih).join("|"))
      .join(";"),
  };
}

interface ChangeRow {
  name: string;
  status: ProfileChange["status"];
  reason: string;
  hr_note: string | null;
  changes: { field: string; current: string; proposed: string }[];
  created_on: string | null;
  decided_on: string | null;
  employee_name?: string;
  designation?: string | null;
  department?: string | null;
}

function bentukPerubahan(r: ChangeRow): ProfileChange {
  return {
    id: r.name,
    status: r.status,
    reason: r.reason,
    hrNote: r.hr_note,
    changes: r.changes ?? [],
    createdOn: r.created_on ? r.created_on.slice(0, 10) : null,
    decidedOn: r.decided_on ? r.decided_on.slice(0, 10) : null,
    employeeName: r.employee_name,
    designation: r.designation
      ? terjemahkan("designation", r.designation)
      : undefined,
    department: r.department ? tanpaSufiks(r.department) : undefined,
  };
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
  ptkp_status?: string | null;
  can_edit_directly?: boolean;
  pending_change?: string | null;
  family?: {
    member_name: string;
    relation: string | null;
    date_of_birth: string | null;
    is_dependent: number;
  }[];
  emergency_contacts?: {
    contact_name: string;
    relation: string | null;
    phone: string;
  }[];
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
    ptkpStatus: r.ptkp_status ?? "—",
    primaryEmergency: {
      name: r.emergency.name ?? "—",
      relation: r.emergency.relation
        ? terjemahkan("relation", r.emergency.relation)
        : "—",
      phone: r.emergency.phone ?? "—",
    },
    canEditDirectly: r.can_edit_directly === true,
    pendingChange: r.pending_change ?? null,
    editable: {
      phone: r.cell_number ?? "",
      personalEmail: r.personal_email ?? "",
      address: r.current_address ?? "",
      maritalStatus: r.marital_status ?? "Single",
      family: (r.family ?? []).map((m) => ({
        name: m.member_name,
        relation: m.relation ?? "Other",
        birthDate: m.date_of_birth,
        dependent: m.is_dependent === 1,
      })),
      contacts: (r.emergency_contacts ?? []).map((k) => ({
        name: k.contact_name,
        relation: k.relation ?? "Other",
        phone: k.phone,
      })),
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

// "Chrome · macOS" dari user agent; cukup untuk membedakan perangkat di daftar.
function namaBrowser(ua: string): string {
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /firefox\//i.test(ua)
      ? "Firefox"
      : /chrome\//i.test(ua)
        ? "Chrome"
        : /safari\//i.test(ua)
          ? "Safari"
          : tt("api.browser");
  const os = /windows/i.test(ua)
    ? "Windows"
    : /mac os x|macintosh/i.test(ua)
      ? "macOS"
      : /android/i.test(ua)
        ? "Android"
        : /iphone|ipad/i.test(ua)
          ? "iOS"
          : /linux/i.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} · ${os}` : browser;
}

function bentukPerangkat(s: SesiRow, jumlah = 1): ActiveDevice {
  const ua = s.user_agent ?? "";
  const mobile = /expo|cfnetwork|okhttp|dalvik/i.test(ua);
  const waktu = s.last_updated ? s.last_updated.slice(0, 16) : "";
  return {
    id: s.id,
    name: mobile
      ? tt("api.appHris")
      : ua
        ? namaBrowser(ua)
        : tt("api.perangkat"),
    meta: [s.ip ?? "—", waktu, jumlah > 1 ? tt("sec.nSesi", { n: jumlah }) : ""]
      .filter(Boolean)
      .join(" · "),
    kind: mobile ? "mobile" : "web",
    current: s.current,
  };
}

async function ambilPerangkat(): Promise<ActiveDevice[]> {
  const res = await get<{ message: SesiRow[] }>(
    "/api/method/hris_get_active_sessions",
  );
  // Satu baris per perangkat: sesi dengan jenis, nama tampilan, dan IP yang sama
  // digabung (versi user agent yang sedikit berbeda tetap dianggap satu),
  // diwakili sesi terbarunya (atau sesi perangkat ini bila termasuk).
  const grup = new Map<string, SesiRow[]>();
  for (const s of res.message) {
    const d = bentukPerangkat(s);
    const k = `${d.kind}|${d.name}|${s.ip ?? ""}`;
    grup.set(k, [...(grup.get(k) ?? []), s]);
  }
  return [...grup.values()]
    .map((daftar) => {
      const wakil =
        daftar.find((s) => s.current) ??
        [...daftar].sort((a, b) =>
          (b.last_updated ?? "").localeCompare(a.last_updated ?? ""),
        )[0]!;
      return bentukPerangkat(wakil, daftar.length);
    })
    .sort((a, b) => Number(b.current) - Number(a.current));
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
  document_type?: string | null;
  document_name?: string | null;
  file_url?: string | null;
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
    documentType: r.document_type ?? null,
    documentName: r.document_name ?? null,
    fileUrl: r.file_url ?? null,
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
    timezone_label?: string | null;
    work_location?: string | null;
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

// Status jam terakhir yang berhasil dibaca; dipakai bila layar dibuka tanpa sinyal.
let statusTerakhir: ClockState | null = null;

const jamLokal = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// Status sementara dari antrean offline: memperlihatkan hasil ketukan karyawan
// walau server belum menerimanya.
async function statusDariAntrean(): Promise<ClockState | null> {
  const daftar = await ambilAntrean();
  const terakhir = daftar.at(-1);
  if (!terakhir) return statusTerakhir;
  const jam = jamLokal(terakhir.capturedMs || terakhir.deviceMs);
  return {
    clockedIn: terakhir.logType === "IN",
    lastCheckIn:
      terakhir.logType === "IN" ? jam : (statusTerakhir?.lastCheckIn ?? null),
    lastCheckOut: terakhir.logType === "OUT" ? jam : null,
    timezoneLabel: statusTerakhir?.timezoneLabel,
    workLocation: statusTerakhir?.workLocation ?? null,
    pendingOffline: true,
  };
}

async function ambilStatusJam(): Promise<ClockState> {
  try {
    const r = await get<ClockRes>("/api/method/hris_get_clock_state");
    const status: ClockState = {
      clockedIn: r.message.clocked_in,
      lastCheckIn: r.message.last_check_in,
      lastCheckOut: r.message.last_check_out,
      timezoneLabel: r.message.timezone_label ?? undefined,
      workLocation: r.message.work_location ?? null,
    };
    statusTerakhir = status;
    return status;
  } catch (e) {
    // Tanpa sinyal: tampilkan keadaan terakhir yang diketahui beserta antrean.
    if (e instanceof ApiError && e.status === 0) {
      const sementara = await statusDariAntrean();
      if (sementara) return sementara;
    }
    throw e;
  }
}

const idKlien = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

async function kirimItem(i: ItemAntrean, offline: boolean) {
  await post("/api/method/hris_checkin", {
    log_type: i.logType,
    client_id: i.clientId,
    ...(i.lokasi
      ? {
          lat: i.lokasi.lat,
          lng: i.lokasi.lng,
          accuracy_m: Math.round(i.lokasi.accuracyM),
          gps_ms: Math.round(i.lokasi.gpsMs),
          mocked: i.lokasi.mocked ? 1 : 0,
        }
      : {}),
    ...(offline
      ? {
          offline: 1,
          captured_ms: i.trusted ? Math.round(i.capturedMs) : 0,
          device_ms: Math.round(i.deviceMs),
          trusted: i.trusted ? 1 : 0,
          anchor_age_s: i.anchorAgeS,
        }
      : {}),
  });
}

async function kirimCheckin(
  _employeeId: string,
  logType: "IN" | "OUT",
  lokasi?: LokasiCheckin,
) {
  const t = waktuTerpercaya();
  const item: ItemAntrean = {
    clientId: idKlien(),
    logType,
    capturedMs: t.ms,
    deviceMs: Date.now(),
    trusted: t.trusted,
    anchorAgeS: t.anchorAgeS,
    lokasi,
  };
  try {
    // Jam ditentukan server menurut zona kerja; client_id mencegah check-in
    // dobel bila jawabannya hilang di jalan lalu item dikirim ulang dari antrean.
    await kirimItem(item, false);
  } catch (e) {
    if (e instanceof ApiError && e.status === 0) {
      await antre(item);
      const sementara = await statusDariAntrean();
      if (sementara) return sementara;
    }
    throw e;
  }
  return ambilStatusJam();
}

let sedangSinkron = false;

// Mengirim antrean berurutan. Berhenti di galat jaringan (coba lagi nanti);
// item yang ditolak server (4xx) dibuang supaya antrean tidak macet selamanya.
async function sinkronAntrean(): Promise<{ sent: number; remaining: number }> {
  if (sedangSinkron) return { sent: 0, remaining: await jumlahAntrean() };
  sedangSinkron = true;
  let terkirim = 0;
  try {
    for (const item of [...(await ambilAntrean())]) {
      try {
        await kirimItem(item, true);
        await hapusDariAntrean(item.clientId);
        terkirim += 1;
      } catch (e) {
        if (e instanceof ApiError && e.status === 0) break;
        if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
          await hapusDariAntrean(item.clientId);
          continue;
        }
        break;
      }
    }
  } finally {
    sedangSinkron = false;
  }
  if (terkirim > 0) statusTerakhir = null;
  return { sent: terkirim, remaining: await jumlahAntrean() };
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
  attachments?: LampiranRow[];
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
    attachments: keLampiran(r.attachments),
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
    ptkp_status?: string | null;
    ter_category?: string | null;
    ptkp_annual?: number | null;
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
    // Token dilepas dulu selagi sesi masih berlaku; gagal tidak boleh menahan logout.
    const token = tokenPushSaatIni();
    if (token) {
      await post("/api/method/hris_unregister_push_token", { token }).catch(
        () => {},
      );
    }
    await post("/api/method/logout");
  },

  async getDocuments(): Promise<EmployeeDocument[]> {
    return ambilDokumen();
  },

  // Dua langkah: buat dokumen (employee dari sesi), lalu lampirkan file lewat
  // upload_file. Batas 5 MB dan tipe pdf/jpg/png dijaga server.
  async uploadDocument(_employeeId, input) {
    if (!input.file) throw new ApiError(tt("err.dokumenGagal"), 0, "NoFile");
    const dibuat = await post<{ message: { name: string } }>(
      "/api/method/hris_create_my_document",
      {
        document_name: input.name,
        category: KATEGORI_DOK_SERVER[input.category],
        expires_on: input.expiresOn,
      },
    );
    try {
      await unggahBerkas(
        input.file,
        "Employee Document",
        dibuat.message.name,
        "file",
      );
    } catch (e) {
      // Dokumen tanpa berkas tidak berguna; dihapus supaya tidak muncul dobel saat diulang.
      await post("/api/method/hris_delete_my_document", {
        name: dibuat.message.name,
      }).catch(() => {});
      throw e;
    }
    return ambilDokumen();
  },

  async getAppraisal(): Promise<Appraisal | null> {
    const res = await get<{ message: AppraisalRes | null }>(
      "/api/method/hris_get_my_appraisal",
    );
    const a = res.message;
    // null = belum ada penilaian (bukan galat), layar menampilkan keadaan kosong.
    if (!a) return null;
    return {
      cycle: a.cycle,
      method: a.method,
      score: a.score,
      maxScore: a.max_score,
      rating: RATING[a.rating] ? tt(RATING[a.rating]!) : a.rating,
      ratingTone: a.rating_tone,
      raters: a.raters,
      goals: a.goals.map((g) => ({
        name: g.name,
        progress: g.progress,
        note: g.note ?? "",
      })),
    };
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

  async registerPushToken(input) {
    await post("/api/method/hris_register_push_token", {
      token: input.token,
      platform: input.platform,
      device_name: input.deviceName,
    });
  },

  async unregisterPushToken(token) {
    await post("/api/method/hris_unregister_push_token", { token });
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
      const gagal = await lampirkanSemua(
        "Overtime Request",
        res.message.name,
        (input.attachments ?? []).map((f) => ({ f, field: "proof" })),
      );
      return {
        ...bentukLembur(res.message, input.employeeId),
        buktiGagal: gagal || undefined,
      };
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
      // Indeks bukti mengikuti urutan baris biaya yang benar-benar dikirim.
      const terkirim = t.costs.filter((x) => x.amount > 0);
      const gagal = await lampirkanSemua(
        "Travel Request",
        res.message.name,
        terkirim.flatMap((x, n) =>
          x.proof ? [{ f: x.proof, field: `cost_${n}` }] : [],
        ),
      );
      return {
        ...bentukDinas(res.message, input.employeeId),
        buktiGagal: gagal || undefined,
      };
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

  async syncOfflineCheckins() {
    return sinkronAntrean();
  },

  async getOfflineCheckins(status, scope): Promise<OfflineCheckin[]> {
    const res = await get<{
      message: {
        name: string;
        employee_name: string;
        designation: string | null;
        log_type: "IN" | "OUT";
        time: string;
        claimed_time: string | null;
        flags: string[] | string | null;
        review_status: OfflineCheckin["status"];
        clock_skew_seconds: number | null;
        queue_age_seconds: number | null;
        offline?: number;
        distance_m?: number | null;
        geo_status?: OfflineCheckin["geoStatus"];
        mocked?: number;
        gps_accuracy_m?: number | null;
        work_location?: string | null;
      }[];
    }>("/api/method/hris_get_offline_checkins", { status, scope });
    return res.message.map((r) => ({
      id: r.name,
      employeeName: r.employee_name,
      designation: r.designation
        ? terjemahkan("designation", r.designation)
        : "",
      logType: r.log_type,
      time: r.time,
      claimedTime: r.claimed_time,
      flags: Array.isArray(r.flags) ? r.flags.join(", ") : (r.flags ?? ""),
      status: r.review_status,
      skewSeconds: r.clock_skew_seconds ?? 0,
      queueAgeSeconds: r.queue_age_seconds ?? 0,
      offline: r.offline === 1,
      distanceM: r.distance_m ?? null,
      geoStatus: r.geo_status ?? "No Location",
      mocked: r.mocked === 1,
      gpsAccuracyM: r.gps_accuracy_m ?? null,
      workLocation: r.work_location ?? null,
    }));
  },

  async decideOfflineCheckin(id, decision, note) {
    await post("/api/method/hris_decide_offline_checkin", {
      name: id,
      decision,
      note,
    });
  },

  async getClockState(): Promise<ClockState> {
    return ambilStatusJam();
  },

  async getWorkLocations(): Promise<AturanLokasi> {
    const res = await get<{
      message: {
        geofence_mode: AturanLokasi["mode"];
        max_accuracy_m: number;
        wfh_today: boolean;
        require_location: number;
        locations: {
          name: string;
          location_name: string;
          latitude: number;
          longitude: number;
          radius_m: number;
        }[];
      };
    }>("/api/method/hris_get_work_locations");
    const m = res.message;
    return {
      locations: m.locations.map((l) => ({
        name: l.name,
        locationName: l.location_name,
        latitude: l.latitude,
        longitude: l.longitude,
        radiusM: l.radius_m,
      })),
      mode: m.geofence_mode,
      maxAccuracyM: m.max_accuracy_m,
      wfhToday: m.wfh_today,
      requireLocation: m.require_location === 1,
    };
  },

  async clockIn(
    employeeId: string,
    lokasi?: LokasiCheckin,
  ): Promise<ClockState> {
    return kirimCheckin(employeeId, "IN", lokasi);
  },

  async clockOut(
    employeeId: string,
    lokasi?: LokasiCheckin,
  ): Promise<ClockState> {
    return kirimCheckin(employeeId, "OUT", lokasi);
  },

  async getAttendanceHistory(): Promise<AttendanceRecord[]> {
    const res = await get<{ message: AttendanceRow[] }>(
      "/api/method/hris_get_attendance_history",
    );
    return res.message.map(bentukAbsensi);
  },

  async getDocumentsForReview(status): Promise<ReviewDocument[]> {
    const res = await get<{ message: ReviewRow[] }>(
      "/api/method/hris_get_documents_for_review",
      { status },
    );
    return res.message.map((r) => ({
      id: r.name,
      employeeName: r.employee_name,
      designation: r.designation
        ? terjemahkan("designation", r.designation)
        : "",
      department: tanpaSufiks(r.department),
      name: r.document_name,
      category: KATEGORI_DOK[r.category] ?? "sertifikat",
      ext: r.ext ?? "FILE",
      sizeLabel: r.size_bytes ? ukuranFile(r.size_bytes) : "—",
      uploadedOn: r.uploaded_on,
      expiresOn: r.expires_on,
      status: r.status,
      fileUrl: r.file_url ?? null,
      fileName: r.file_name ? decodeURIComponent(r.file_name) : null,
      rejectionReason: r.rejection_reason ?? null,
      changeReason: r.change_reason ?? null,
    }));
  },

  async requestDocumentChange(id, reason) {
    await post("/api/method/hris_request_document_change", {
      name: id,
      reason,
    });
  },

  async replaceDocumentFile(id, file) {
    await unggahBerkas(file, "Employee Document", id, "file");
  },

  async decideDocument(id, decision, reason) {
    await post("/api/method/hris_decide_document", {
      name: id,
      decision,
      reason,
    });
  },

  async getTeamAppraisals(): Promise<TeamAppraisal[]> {
    const res = await get<{
      message: {
        employee: string;
        employee_name: string;
        designation: string | null;
        cycle: string;
        final_score: number | null;
        my_feedback_status: TeamAppraisal["myStatus"];
        my_feedback_score: number | null;
      }[];
    }>("/api/method/hris_get_team_appraisals");
    return res.message.map((r) => ({
      employeeId: r.employee,
      employeeName: r.employee_name,
      designation: r.designation
        ? terjemahkan("designation", r.designation)
        : "",
      cycle: r.cycle,
      finalScore: r.final_score ?? 0,
      myStatus: r.my_feedback_status,
      myScore: r.my_feedback_score,
    }));
  },

  async getFeedbackForm(employeeId: string): Promise<FeedbackForm> {
    const res = await get<{
      message: {
        employee: string;
        employee_name: string;
        cycle: string;
        criteria: { criteria: string; per_weightage: number }[];
        goals: { name: string; progress: number }[];
        my_feedback: {
          status: "draft" | "submitted";
          ratings: { criteria: string; rating: number }[];
          feedback: string | null;
          total_score: number;
        } | null;
      };
    }>("/api/method/hris_get_feedback_form", { employee: employeeId });
    const m = res.message;
    return {
      employeeId: m.employee,
      employeeName: m.employee_name,
      cycle: m.cycle,
      criteria: m.criteria.map((k) => ({
        name: k.criteria,
        weight: k.per_weightage,
      })),
      goals: m.goals,
      mine: m.my_feedback
        ? {
            status: m.my_feedback.status,
            ratings: Object.fromEntries(
              m.my_feedback.ratings.map((r) => [r.criteria, r.rating]),
            ),
            feedback: m.my_feedback.feedback ?? "",
            totalScore: m.my_feedback.total_score,
          }
        : null,
    };
  },

  async submitFeedback(input) {
    await post("/api/method/hris_submit_feedback", {
      employee: input.employeeId,
      ratings: Object.entries(input.ratings)
        .map(([k, v]) => `${k.replace(/[|;]/g, " ")}|${v}`)
        .join(";"),
      feedback: input.feedback,
      submit: input.submit ? 1 : 0,
    });
  },

  async getStaffAttendanceHistory(
    staffId: string,
  ): Promise<AttendanceRecord[]> {
    const res = await get<{ message: AttendanceRow[] }>(
      "/api/method/hris_get_staff_attendance_history",
      { employee: staffId },
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
    const gagal = await lampirkanSemua(
      "Attendance Request",
      res.message.name,
      (input.attachments ?? []).map((f) => ({ f, field: "proof" })),
    );
    return {
      ...bentukKoreksi(res.message, input.employeeId),
      buktiGagal: gagal || undefined,
    };
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
      terCategory: data?.ter_category
        ? tt("tax.terKategori", { k: data.ter_category })
        : "—",
      ptkpStatus: data?.ptkp_status ?? "—",
      ptkpAnnual: data?.ptkp_annual ?? 0,
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
      paramProfil(data),
    );
    return bentukProfil(res.message);
  },

  async submitProfileChange(data: EditableProfile, reason: string) {
    await post("/api/method/hris_submit_profile_change", {
      ...paramProfil(data),
      reason,
    });
  },

  async getAnnouncements(): Promise<Announcement[]> {
    const res = await get<{
      message: {
        name: string;
        title: string;
        content: string | null;
        priority: "Normal" | "Important";
        published_on: string | null;
        expires_on: string | null;
        attachments?: LampiranRow[];
        posted_by: string | null;
      }[];
    }>("/api/method/hris_get_announcements");
    return res.message.map((a) => ({
      id: a.name,
      title: a.title,
      content: a.content ?? "",
      priority: a.priority,
      publishedOn: a.published_on ? a.published_on.slice(0, 10) : null,
      expiresOn: a.expires_on,
      attachments: keLampiran(a.attachments) ?? [],
      postedBy: a.posted_by,
    }));
  },

  async getMyProfileChanges(): Promise<ProfileChange[]> {
    const res = await get<{ message: ChangeRow[] }>(
      "/api/method/hris_get_my_profile_changes",
    );
    return res.message.map(bentukPerubahan);
  },

  async getProfileChangesForReview(status): Promise<ProfileChange[]> {
    const res = await get<{ message: ChangeRow[] }>(
      "/api/method/hris_get_profile_changes_for_review",
      { status },
    );
    return res.message.map(bentukPerubahan);
  },

  async decideProfileChange(id, decision, note) {
    await post("/api/method/hris_decide_profile_change", {
      name: id,
      decision,
      note,
    });
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
