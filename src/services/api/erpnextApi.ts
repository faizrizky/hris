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
  GeofenceRule,
  CheckinLocation,
  FaceStatus,
  OfflineCheckin,
  ProfileChange,
  FeedbackForm,
  ReviewDocument,
  TeamAppraisal,
  AttachmentFile,
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
  getMonthName,
  formatShortDate,
  formatShortDateWithYear,
  toISODate,
} from "../../utils/date";
import { ApiError, get, post, put, upload } from "./http";
import { formatFileSize } from "../../utils/file";
import { File as FileFs } from "expo-file-system";
import { getCurrentPushToken } from "../push";
import { getDeviceInfo } from "../device";
import { getTrustedTime } from "../trustedTime";
import {
  QueueItem,
  getQueue,
  antre,
  removeFromQueue,
  getQueueCount,
} from "../offlineQueue";
import {
  translateServerLabel,
  translateNotification,
} from "@/i18n/serverLabels";
import { translate } from "@/i18n";
import type { TranslationKey } from "@/i18n/id";

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

function initialsOf(nama: string): string {
  return nama
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

// ERPNext menambahkan sufiks company: "Keuangan - FT" -> "Keuangan".
function withoutSuffix(departmentName: string | null): string {
  return departmentName
    ? translateServerLabel(
        "department",
        departmentName.replace(/ - [^-]+$/, ""),
      )
    : "—";
}

// Doc User dan Has Role tidak bisa dibaca role Employee, jadi role diambil
// dari endpoint server yang mengembalikan role pemanggil sendiri.
async function fetchRole(): Promise<Role> {
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
      translate("err.peran"),
      e instanceof ApiError ? e.status : 0,
      "RoleFetchFailed",
    );
  }
  if (roles.includes("HR Manager") || roles.includes("HR User")) return "hr";
  if (roles.includes("Leave Approver")) return "mss";
  return "ess";
}

async function fetchCurrentEmployee() {
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
    throw new ApiError(translate("err.tanpaKaryawan"), 200, "NoEmployeeLinked");
  }

  return {
    id: row.name,
    nik: row.employee_number ?? "—",
    fullName: row.employee_name,
    role: await fetchRole(),
    jobTitle: row.designation
      ? translateServerLabel("designation", row.designation)
      : "—",
    department: withoutSuffix(row.department),
    avatarInitials: initialsOf(row.employee_name),
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
const BALANCE_KINDS: Record<string, { type: LeaveType; label: string }> = {
  "Annual Leave": { type: "cuti", label: "Annual Leave" },
  "Sick Leave": { type: "sakit", label: "Sick Leave" },
};

const KIND_NAMES: Partial<Record<LeaveType, string>> = {
  cuti: "Annual Leave",
  sakit: "Sick Leave",
};

async function fetchBalances(employeeId: string): Promise<LeaveBalance[]> {
  // Leave Allocation tidak bisa dibaca role Employee, jadi saldo lewat
  // endpoint hrms ini.
  const res = await get<LeaveDetailsRes>(
    "/api/method/hrms.hr.doctype.leave_application.leave_application.get_leave_details",
    { employee: employeeId, date: toISODate(new Date()) },
  );

  const result: LeaveBalance[] = [];
  for (const [nama, v] of Object.entries(res.message.leave_allocation)) {
    const kind = BALANCE_KINDS[nama];
    if (!kind) continue;
    result.push({
      ...kind,
      label: translateServerLabel("leaveType", nama),
      remaining: v.remaining_leaves,
      total: v.total_leaves,
      unit: "hari",
    });
  }
  return result;
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
const LEAVE_STATUSES: Record<
  string,
  { decision: LeaveDecision; stage: () => string }
> = {
  Open: { decision: null, stage: () => translate("api.menungguPersetujuan") },
  Approved: { decision: "approve", stage: () => translate("st.disetujui") },
  Rejected: { decision: "reject", stage: () => translate("st.ditolak") },
};

function formatLeavePeriod(dari: string, until: string): string {
  return dari === until
    ? formatShortDateWithYear(dari)
    : `${formatShortDate(dari)} – ${formatShortDateWithYear(until)}`;
}

function mapSubmission(row: LeaveRow): LeaveRequest {
  const status = LEAVE_STATUSES[row.status] ?? LEAVE_STATUSES.Open;
  const approver = row.leave_approver_name ?? row.leave_approver;
  const period = formatLeavePeriod(row.from_date, row.to_date);
  return {
    id: row.name,
    employeeId: row.employee,
    employeeName: row.employee_name,
    employeeInitials: initialsOf(row.employee_name),
    employeeJobTitle: row.custom_designation
      ? translateServerLabel("designation", row.custom_designation)
      : "",
    type: row.leave_type === "Sick Leave" ? "sakit" : "cuti",
    label: `${translateServerLabel("leaveType", row.leave_type)} · ${translate("lr.nHari", { n: row.total_leave_days })}`,
    reason: row.description ? `${period} · ${row.description}` : period,
    delegateName: row.custom_delegate_name,
    stage: status.stage(),
    quota: "—",
    approverName: approver,
    approverInitials: initialsOf(approver),
    decision: status.decision,
    createdAt: row.posting_date,
  };
}

// ---- Lembur dan Dinas Luar (endpoint Server Script) ----

interface AttachmentRow {
  file_name: string;
  file_url: string;
}

const toAttachment = (l?: AttachmentRow[]) =>
  l?.length
    ? l.map((x) => ({ name: x.file_name, url: x.file_url }))
    : undefined;

interface OvertimeRow {
  attachments?: AttachmentRow[];
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

interface TripRow {
  attachments?: AttachmentRow[];
  costs?: { attachments?: AttachmentRow[] }[];
  name: string;
  employee?: string;
  employee_name?: string;
  designation?: string | null;
  destination: string | null;
  from_date: string | null;
  to_date: string | null;
  transport: string | null;
  purpose: string | null;
  total_cost?: number;
  status: "pending" | "approved" | "rejected";
}

const STATUS_SERVER: Record<
  string,
  { decision: LeaveRequest["decision"]; stage: () => string }
> = {
  pending: { decision: null, stage: () => translate("api.menungguAtasan") },
  approved: { decision: "approve", stage: () => translate("st.disetujui") },
  rejected: { decision: "reject", stage: () => translate("st.ditolak") },
};

const OVERTIME_ID_PREFIX = /^OT-/;
const TRIP_ID_PREFIX = /^HR-TRQ-/;
const ID_WFH = /^WFH-/;

const serverHoursMinutes = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function mapOvertime(r: OvertimeRow, saya?: string): LeaveRequest {
  const st = STATUS_SERVER[r.status] ?? STATUS_SERVER.pending;
  const nama = r.employee_name ?? saya ?? "—";
  return {
    id: r.name,
    employeeId: r.employee ?? "",
    employeeName: nama,
    employeeInitials: initialsOf(nama),
    employeeJobTitle: r.designation
      ? translateServerLabel("designation", r.designation)
      : "",
    type: "lembur",
    attachments: toAttachment(r.attachments),
    label: translate("api.lemburLabel", {
      jam: r.hours,
      tgl: formatShortDate(r.date),
    }),
    reason: `${serverHoursMinutes(r.start_minute)}–${serverHoursMinutes(r.end_minute)} · ${r.note}`,
    delegateName: null,
    stage: st.stage(),
    quota: "—",
    approverName: "",
    approverInitials: "",
    decision: st.decision,
    createdAt: r.date,
  };
}

function mapTrip(r: TripRow, saya?: string): LeaveRequest {
  const st = STATUS_SERVER[r.status] ?? STATUS_SERVER.pending;
  const nama = r.employee_name ?? saya ?? "—";
  return {
    id: r.name,
    employeeId: r.employee ?? "",
    employeeName: nama,
    employeeInitials: initialsOf(nama),
    employeeJobTitle: r.designation
      ? translateServerLabel("designation", r.designation)
      : "",
    type: "dinas_luar",
    attachments: toAttachment([
      ...(r.attachments ?? []),
      ...(r.costs ?? []).flatMap((c) => c.attachments ?? []),
    ]),
    label: translate("api.dinasLabel", { kota: r.destination ?? "—" }),
    // Pengajuan dinas dari server bisa belum berisi tanggal/tujuan; jangan sampai merusak seluruh Beranda.
    reason: `${r.from_date && r.to_date ? formatLeavePeriod(r.from_date, r.to_date) : "—"} · ${r.purpose ?? "—"}`,
    delegateName: null,
    stage: st.stage(),
    quota: "—",
    approverName: "",
    approverInitials: "",
    decision: st.decision,
    createdAt: r.from_date ?? "",
  };
}

interface WfhRow {
  name: string;
  employee?: string;
  employee_name?: string;
  designation?: string | null;
  from_date: string;
  to_date: string;
  days: string[];
  reason: string;
  status: "pending" | "approved" | "rejected";
}

function mapWfh(r: WfhRow, saya?: string): LeaveRequest {
  const st = STATUS_SERVER[r.status] ?? STATUS_SERVER.pending;
  const nama = r.employee_name ?? saya ?? "—";
  const dayCount = r.days
    .map((d) => translate(`hari.${d}` as never))
    .join(", ");
  return {
    id: r.name,
    employeeId: r.employee ?? "",
    employeeName: nama,
    employeeInitials: initialsOf(nama),
    employeeJobTitle: r.designation
      ? translateServerLabel("designation", r.designation)
      : "",
    type: "wfh",
    label: dayCount
      ? translate("api.wfhLabel", { hari: dayCount })
      : translate("api.wfhLabelSemua"),
    reason: `${formatLeavePeriod(r.from_date, r.to_date)} · ${r.reason}`,
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

const SERVER_EXPENSE_KINDS: Record<string, string> = {
  Transportasi: "Travel",
  Hotel: "Others",
  Konsumsi: "Food",
  "Parkir & Tol": "Travel",
  Lainnya: "Others",
};

// Pemisah format "kategori|keterangan|nominal;..." tidak boleh ada di isi.
const clean = (t: string) => t.replace(/[|;]/g, " ").trim();

// Fitur di luar paket langganan company ditolak server (docker/seed/seed.py, "# @fitur:"). Daftar gabungan
// (cuti + lembur + dinas + WFH) tetap tampil: bagian yang di luar paket dianggap kosong, bukan galat.
async function emptyIfNotInPlan<T>(load: Promise<T[]>): Promise<T[]> {
  try {
    return await load;
  } catch (e) {
    if (
      e instanceof ApiError &&
      e.excType === "PermissionError" &&
      e.message.includes("subscription plan")
    )
      return [];
    throw e;
  }
}

async function fetchOvertime(tim: boolean): Promise<LeaveRequest[]> {
  return emptyIfNotInPlan(
    get<{ message: OvertimeRow[] }>(
      "/api/method/hris_get_overtimes",
      tim ? { scope: "team" } : undefined,
    ).then((res) => res.message.map((r) => mapOvertime(r))),
  );
}

async function fetchTrips(tim: boolean): Promise<LeaveRequest[]> {
  return emptyIfNotInPlan(
    get<{ message: TripRow[] }>(
      "/api/method/hris_get_travel_requests",
      tim ? { scope: "team" } : undefined,
    ).then((res) => res.message.map((r) => mapTrip(r))),
  );
}

async function fetchWfh(tim: boolean): Promise<LeaveRequest[]> {
  return emptyIfNotInPlan(
    get<{ message: WfhRow[] }>(
      "/api/method/hris_get_wfh",
      tim ? { scope: "team" } : undefined,
    ).then((res) => res.message.map((r) => mapWfh(r))),
  );
}

const newestFirst = (a: LeaveRequest, b: LeaveRequest) =>
  b.createdAt.localeCompare(a.createdAt);

// Lampiran pengajuan cuti diambil sekali untuk semua pengajuan sekaligus.
async function fetchLeaveAttachments(
  list: LeaveRequest[],
): Promise<LeaveRequest[]> {
  const nama = list.map((r) => r.id).filter((id) => id.startsWith("HR-LAP"));
  if (nama.length === 0) return list;
  try {
    const res = await get<{
      data: { file_name: string; file_url: string; attached_to_name: string }[];
    }>(`/api/resource/File`, {
      filters: [
        ["attached_to_doctype", "=", "Leave Application"],
        ["attached_to_name", "in", nama],
      ],
      fields: ["file_name", "file_url", "attached_to_name"],
      limit_page_length: 200,
    });
    const labelMap = new Map<string, { name: string; url: string }[]>();
    for (const f of res.data) {
      labelMap.set(f.attached_to_name, [
        ...(labelMap.get(f.attached_to_name) ?? []),
        { name: f.file_name, url: f.file_url },
      ]);
    }
    return list.map((r) =>
      labelMap.has(r.id) ? { ...r, attachments: labelMap.get(r.id) } : r,
    );
  } catch {
    // Lampiran hanya pelengkap; gagal memuatnya tidak boleh menggagalkan daftar.
    return list;
  }
}

async function fetchPending(): Promise<LeaveRequest[]> {
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
  return fetchLeaveAttachments(res.data.map(mapSubmission));
}

async function fetchOwn(employeeId: string): Promise<LeaveRequest[]> {
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
  return res.data.map(mapSubmission);
}

// Unggah satu berkas ke upload_file. fetch bawaan Expo tidak menerima bentuk
// {uri,name,type} khas React Native, jadi isinya dibaca lewat expo-file-system
// dan dikirim sebagai bagian multipart biasa (objek dengan bytes()).
async function uploadFile(
  f: AttachmentFile,
  doctype: string,
  docname: string,
  fieldname: string,
): Promise<void> {
  const source = new FileFs(f.uri);
  const form = new FormData();
  // fetch Expo meng-encode nama berkas (spasi jadi %20), jadi dibersihkan dulu.
  form.append("file", {
    name: f.name.replace(/[^\w.\-]+/g, "_"),
    type: f.mimeType || "application/octet-stream",
    bytes: () => source.bytes(),
  } as unknown as Blob);
  form.append("is_private", "1");
  form.append("doctype", doctype);
  form.append("docname", docname);
  form.append("fieldname", fieldname);
  await upload("/api/method/upload_file", form);
}

// Lampiran dikirim setelah dokumennya ada. Satu yang gagal tidak menggagalkan
// pengajuan; jumlah yang gagal dikembalikan supaya pengguna diberi tahu.
async function attachAll(
  doctype: string,
  docname: string,
  list: { f: AttachmentFile; field: string }[],
): Promise<number> {
  let hasFailed = 0;
  for (const { f, field } of list) {
    try {
      await uploadFile(f, doctype, docname, field);
    } catch {
      hasFailed += 1;
    }
  }
  return hasFailed;
}

// ---- Dokumen Digital dan Appraisal ----

interface DocumentRow {
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

const DOC_CATEGORIES: Record<DocumentRow["category"], DocCategory> = {
  Contract: "kontrak",
  Decree: "sk",
  Certificate: "sertifikat",
  Identity: "identitas",
};

const SERVER_DOC_CATEGORIES: Record<DocCategory, DocumentRow["category"]> = {
  kontrak: "Contract",
  sk: "Decree",
  sertifikat: "Certificate",
  identitas: "Identity",
};

// Hitungan hari kalender dari hari ini; negatif = sudah lewat.
function daysUntil(iso: string): number {
  const dayCount = fromISODate(toISODate(new Date()));
  return Math.round(
    (fromISODate(iso).getTime() - dayCount.getTime()) / 86400000,
  );
}

function mapDocument(r: DocumentRow): EmployeeDocument {
  const remainder = r.expires_on ? daysUntil(r.expires_on) : null;
  const isExpiringSoon =
    r.status === "Verified" && remainder !== null && remainder <= 60;
  const status: DocStatus =
    r.status === "Rejected"
      ? "rejected"
      : r.status === "Change Requested"
        ? "changeRequested"
        : r.status === "Pending"
          ? "pending"
          : isExpiringSoon
            ? "expiring"
            : "verified";
  const dateLabel = isExpiringSoon
    ? remainder! < 0
      ? translate("doc.sudahBerakhir")
      : translate("doc.berakhirHari", { n: remainder! })
    : r.expires_on
      ? translate("doc.berlakuSd", {
          tgl: formatShortDateWithYear(r.expires_on),
        })
      : translate("doc.diunggah", {
          tgl: r.uploaded_on ? formatShortDateWithYear(r.uploaded_on) : "—",
        });
  return {
    id: r.name,
    category: DOC_CATEGORIES[r.category] ?? "sertifikat",
    ext: r.ext ?? "FILE",
    name: r.document_name,
    sizeLabel: r.size_bytes ? formatFileSize(r.size_bytes) : "—",
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

async function fetchDocuments(): Promise<EmployeeDocument[]> {
  const res = await get<{ message: DocumentRow[] }>(
    "/api/method/hris_get_my_documents",
  );
  return res.message.map(mapDocument);
}

interface ReviewRow extends DocumentRow {
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

const RATING: Record<string, TranslationKey> = {
  Excellent: "rate.Excellent",
  Good: "rate.Good",
  Fair: "rate.Fair",
  "Needs Improvement": "rate.Needs Improvement",
  Poor: "rate.Poor",
};

const DECISION_BADGES: Record<
  string,
  { label: TranslationKey; tone: FeedItem["tone"] }
> = {
  approve: { label: "st.disetujui", tone: "ok" },
  reject: { label: "st.ditolak", tone: "bad" },
  menunggu: { label: "st.menunggu", tone: "warn" },
};

function toFeedItem(r: LeaveRequest, forApprover: boolean): FeedItem {
  const badge = DECISION_BADGES[r.decision ?? "menunggu"]!;
  return {
    id: r.id,
    // Approver melihat siapa pemohonnya; pemohon melihat inisialnya sendiri.
    initials: forApprover ? r.employeeInitials : r.approverInitials,
    title: forApprover ? `${r.employeeName} · ${r.label}` : r.label,
    subtitle: r.reason,
    badge: translate(badge.label),
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

function employmentText(r: StaffRow): string {
  if (r.employment_type !== "Contract") return translate("api.permanen");
  if (!r.contract_end_date) return translate("api.kontrak");
  const [yearValue] = r.contract_end_date.split("-").map(Number);
  return translate("api.kontrakSd", {
    bulan: getMonthName(fromISODate(r.contract_end_date)),
    tahun: yearValue!,
  });
}

function mapStaff(r: StaffRow): Staff {
  return {
    id: r.name,
    initials: initialsOf(r.employee_name),
    fullName: r.employee_name,
    jobTitle: r.designation
      ? translateServerLabel("designation", r.designation)
      : "—",
    department: withoutSuffix(r.department),
    code: r.employee_number ?? r.name,
    status: r.employment_type === "Contract" ? "Kontrak" : "Tetap",
    employment: employmentText(r),
    joinDate: r.date_of_joining ?? "",
    manager: r.reports_to_name ?? "—",
    shift: r.shift ? translateServerLabel("shift", r.shift) : "—",
    email: r.company_email ?? "—",
    phone: r.cell_number ?? "—",
    leaveLeft: r.leave_left ?? 0,
    attendanceRate: r.attendance_rate ?? 0,
    kpiScore: 0, // tetap: menunggu slice Appraisal
    today: {
      state: r.today.state ?? "belum",
      checkIn: r.today.check_in,
      checkOut: r.today.check_out,
      label: translateServerLabel("attendanceLabel", r.today.label),
    },
  };
}

// ---------------------------------------------------------------------------
// Profil dan keamanan
// ---------------------------------------------------------------------------

interface ContactRow {
  name: string | null;
  relation: string | null;
  phone: string | null;
}

// Parameter form-encoded untuk menyimpan/mengajukan data pribadi. Daftar dikirim
// sebagai teks: kontak "nama|relasi|telepon;...", keluarga "nama|relasi|tgl|0/1;...".
function profileParams(data: EditableProfile) {
  const clean = (x: string) => x.replace(/[|;]/g, " ").trim();
  return {
    phone: data.phone,
    marital_status: data.maritalStatus,
    personal_email: data.personalEmail,
    address: data.address,
    family: data.family
      .map((m) =>
        [
          clean(m.name),
          m.relation,
          m.birthDate ?? "",
          m.dependent ? "1" : "0",
        ].join("|"),
      )
      .join(";"),
    emergency_contacts: data.contacts
      .map((k) => [k.name, k.relation, k.phone].map(clean).join("|"))
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

function mapChange(r: ChangeRow): ProfileChange {
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
      ? translateServerLabel("designation", r.designation)
      : undefined,
    department: r.department ? withoutSuffix(r.department) : undefined,
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
  emergency: ContactRow;
  em2: ContactRow;
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

const GENDERS: Record<string, TranslationKey> = {
  Male: "api.lakiLaki",
  Female: "api.perempuan",
};

const MARITAL_STATUSES: Record<string, TranslationKey> = {
  Single: "api.belumMenikah",
  Married: "api.menikah",
  Divorced: "api.ceraiHidup",
  Widowed: "api.ceraiMati",
};

function mapProfile(r: ProfileRow): PersonalProfile {
  return {
    fullName: r.employee_name,
    // NIK, NPWP, dan PTKP tidak punya sumber di ERPNext, jadi tidak dikarang.
    nikMasked: "—",
    birthPlace: r.place_of_birth ?? "—",
    birthDate: r.date_of_birth ?? "",
    gender: GENDERS[r.gender ?? ""]
      ? translate(GENDERS[r.gender ?? ""]!)
      : (r.gender ?? "—"),
    maritalStatus: MARITAL_STATUSES[r.marital_status ?? ""]
      ? translate(MARITAL_STATUSES[r.marital_status ?? ""]!)
      : (r.marital_status ?? "—"),
    religion: r.religion ?? "—",
    npwpMasked: "—",
    workEmail: r.company_email ?? "—",
    ktpAddress: r.permanent_address ?? "—",
    ptkpStatus: r.ptkp_status ?? "—",
    primaryEmergency: {
      name: r.emergency.name ?? "—",
      relation: r.emergency.relation
        ? translateServerLabel("relation", r.emergency.relation)
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

interface SessionRow {
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
          : translate("api.browser");
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

function mapDevice(
  s: SessionRow,
  count = 1,
  sessionIds: string[] = [s.id],
): ActiveDevice {
  const ua = s.user_agent ?? "";
  const mobile = /expo|cfnetwork|okhttp|dalvik/i.test(ua);
  const formatTime = s.last_updated ? s.last_updated.slice(0, 16) : "";
  return {
    id: s.id,
    name: mobile
      ? translate("api.appHris")
      : ua
        ? namaBrowser(ua)
        : translate("api.perangkat"),
    meta: [
      s.ip ?? "—",
      formatTime,
      count > 1 ? translate("sec.nSesi", { n: count }) : "",
    ]
      .filter(Boolean)
      .join(" · "),
    kind: mobile ? "mobile" : "web",
    current: s.current,
    sessionIds,
  };
}

async function fetchDevices(): Promise<ActiveDevice[]> {
  const res = await get<{ message: SessionRow[] }>(
    "/api/method/hris_get_active_sessions",
  );
  // Satu baris per perangkat: sesi dengan jenis, nama tampilan, dan IP yang sama
  // digabung (versi user agent yang sedikit berbeda tetap dianggap satu),
  // diwakili sesi terbarunya (atau sesi perangkat ini bila termasuk).
  const groups = new Map<string, SessionRow[]>();
  for (const s of res.message) {
    const d = mapDevice(s);
    const k = `${d.kind}|${d.name}|${s.ip ?? ""}`;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  return [...groups.values()]
    .map((list) => {
      const deputy =
        list.find((s) => s.current) ??
        [...list].sort((a, b) =>
          (b.last_updated ?? "").localeCompare(a.last_updated ?? ""),
        )[0]!;
      return mapDevice(
        deputy,
        list.length,
        list.map((x) => x.id),
      );
    })
    .sort((a, b) => Number(b.current) - Number(a.current));
}

// Daftar perangkat asli; verifikasi wajah dan toggle masih dari mock sampai
// fase ML Kit.
async function fetchSecurityInfo(employeeId: string): Promise<SecurityInfo> {
  const [baseName, devices] = await Promise.all([
    mockApi.getSecurityInfo(employeeId),
    fetchDevices(),
  ]);
  return { ...baseName, devices };
}

interface NotificationRow {
  name: string;
  subject: string;
  body: string | null;
  category: NotifCategory;
  tone: AppNotification["tone"];
  time: string; // "YYYY-MM-DDTHH:MM:SS" dalam WIB, tanpa offset
  read: number;
  document_type?: string | null;
  document_name?: string | null;
  document_status?: string | null;
  file_url?: string | null;
}

function mapNotification(r: NotificationRow): AppNotification {
  const [date, jam = ""] = r.time.split("T");
  const dayCount = toISODate(new Date());
  const yesterday = toISODate(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const hhmm = jam.slice(0, 5);
  const { title, body } = translateNotification(r.subject, r.body ?? "");
  const [group, timeLabel] =
    date === dayCount
      ? [translate("notif.hariIni"), hhmm]
      : date === yesterday
        ? [translate("notif.kemarin"), `${translate("notif.kemarin")} ${hhmm}`]
        : [
            translate("notif.sebelumnya"),
            `${formatShortDateWithYear(date!)} ${hhmm}`,
          ];
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
    documentStatus: r.document_status ?? null,
    fileUrl: r.file_url ?? null,
  };
}

const EMPLOYMENT_NAMES: Record<string, TranslationKey> = {
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
    shift_name?: string | null;
    shift_start?: string | null;
    shift_end?: string | null;
    late_grace_min?: number;
    early_grace_min?: number;
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
let lastStatus: ClockState | null = null;

const localTime = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// Status sementara dari antrean offline: memperlihatkan hasil ketukan karyawan
// walau server belum menerimanya.
async function statusFromQueue(): Promise<ClockState | null> {
  const list = await getQueue();
  const lastLocation = list.at(-1);
  if (!lastLocation) return lastStatus;
  const jam = localTime(lastLocation.capturedMs || lastLocation.deviceMs);
  return {
    clockedIn: lastLocation.logType === "IN",
    lastCheckIn:
      lastLocation.logType === "IN" ? jam : (lastStatus?.lastCheckIn ?? null),
    lastCheckOut: lastLocation.logType === "OUT" ? jam : null,
    timezoneLabel: lastStatus?.timezoneLabel,
    workLocation: lastStatus?.workLocation ?? null,
    pendingOffline: true,
    shiftName: lastStatus?.shiftName ?? null,
    shiftStart: lastStatus?.shiftStart ?? null,
    shiftEnd: lastStatus?.shiftEnd ?? null,
    lateGraceMin: lastStatus?.lateGraceMin,
    earlyGraceMin: lastStatus?.earlyGraceMin,
  };
}

async function fetchClockStatus(): Promise<ClockState> {
  try {
    const r = await get<ClockRes>("/api/method/hris_get_clock_state");
    const status: ClockState = {
      clockedIn: r.message.clocked_in,
      lastCheckIn: r.message.last_check_in,
      lastCheckOut: r.message.last_check_out,
      timezoneLabel: r.message.timezone_label ?? undefined,
      workLocation: r.message.work_location ?? null,
      shiftName: r.message.shift_name ?? null,
      shiftStart: r.message.shift_start ?? null,
      shiftEnd: r.message.shift_end ?? null,
      lateGraceMin: r.message.late_grace_min ?? 0,
      earlyGraceMin: r.message.early_grace_min ?? 0,
    };
    lastStatus = status;
    return status;
  } catch (e) {
    // Tanpa sinyal: tampilkan keadaan terakhir yang diketahui beserta antrean.
    if (e instanceof ApiError && e.status === 0) {
      const temporary = await statusFromQueue();
      if (temporary) return temporary;
    }
    throw e;
  }
}

const clientKey = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

async function sendItem(i: QueueItem, offline: boolean) {
  const dev = await getDeviceInfo();
  await post("/api/method/hris_checkin", {
    log_type: i.logType,
    device_id: dev.id,
    device_name: dev.nama,
    platform: dev.platform,
    client_id: i.clientId,
    ...(i.faceVec ? { face_vec: JSON.stringify(i.faceVec) } : {}),
    ...(i.spoof
      ? {
          spoof_mean: i.spoof.mean,
          spoof_scores: JSON.stringify(i.spoof.scores),
        }
      : {}),
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

async function sendCheckin(
  _employeeId: string,
  logType: "IN" | "OUT",
  lokasi?: CheckinLocation,
  faceVec?: number[],
  spoof?: { mean: number; scores: number[] },
) {
  const t = getTrustedTime();
  const item: QueueItem = {
    clientId: clientKey(),
    logType,
    capturedMs: t.ms,
    deviceMs: Date.now(),
    trusted: t.trusted,
    anchorAgeS: t.anchorAgeS,
    faceVec,
    spoof,
    lokasi,
  };
  try {
    // Jam ditentukan server menurut zona kerja; client_id mencegah check-in
    // dobel bila jawabannya hilang di jalan lalu item dikirim ulang dari antrean.
    await sendItem(item, false);
  } catch (e) {
    if (e instanceof ApiError && e.status === 0) {
      await antre(item);
      const temporary = await statusFromQueue();
      if (temporary) return temporary;
    }
    throw e;
  }
  return fetchClockStatus();
}

let isSyncing = false;

// Mengirim antrean berurutan. Berhenti di galat jaringan (coba lagi nanti);
// item yang ditolak server (4xx) dibuang supaya antrean tidak macet selamanya.
async function syncQueue(): Promise<{ sent: number; remaining: number }> {
  if (isSyncing) return { sent: 0, remaining: await getQueueCount() };
  isSyncing = true;
  let isSubmitted = 0;
  try {
    for (const item of [...(await getQueue())]) {
      try {
        await sendItem(item, true);
        await removeFromQueue(item.clientId);
        isSubmitted += 1;
      } catch (e) {
        if (e instanceof ApiError && e.status === 0) break;
        if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
          await removeFromQueue(item.clientId);
          continue;
        }
        break;
      }
    }
  } finally {
    isSyncing = false;
  }
  if (isSubmitted > 0) lastStatus = null;
  return { sent: isSubmitted, remaining: await getQueueCount() };
}

// "Present"/"Absent"/"On Leave" dipetakan ke tiga status yang dikenal layar.
function mapAttendance(r: AttendanceRow): AttendanceRecord {
  const status: AttendanceStatus =
    r.status === "On Leave" || r.status === "Absent" || r.status === "Half Day"
      ? "izin"
      : r.late_entry
        ? "telat"
        : "hadir";
  const jam = r.working_hours
    ? translate("api.durasi", {
        h: Math.floor(r.working_hours),
        m: Math.round((r.working_hours % 1) * 60),
      })
    : r.check_in && !r.check_out
      ? translate("api.berjalan")
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
  attachments?: AttachmentRow[];
}

function mapCorrection(
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
    attachments: toAttachment(r.attachments),
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
function maskAccount(no: string | null): string {
  return no ? `•••• ${no.slice(-4)}` : "—";
}

function mapPayslip(r: SlipRow): Payslip {
  const [yearValue, month] = r.start_date.split("-").map(Number);
  const nama = getMonthName(new Date(yearValue!, month! - 1, 1));
  return {
    id: r.name,
    period: `${nama} ${yearValue}`,
    monthShort: getMonthName(new Date(yearValue!, month! - 1, 1))
      .slice(0, 3)
      .toUpperCase(),
    // Belum ada sumber untuk "Termasuk THR"; slip dianggap reguler.
    note: translate("api.reguler"),
    status: translate("api.diterbitkan"),
    bankAccount: maskAccount(r.bank_account_no),
    paidAt: formatShortDateWithYear(r.posting_date),
    earnings: r.earnings.map((e) => ({
      label: translateServerLabel("salaryComponent", e.salary_component),
      amount: e.amount,
    })),
    deductions: r.deductions.map((d) => ({
      label: translateServerLabel("salaryComponent", d.salary_component),
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
      return await fetchCurrentEmployee();
    } catch (e) {
      // Jangan biarkan sesi di server hidup padahal aplikasi menganggap
      // login gagal.
      await post("/api/method/logout").catch(() => {});
      throw e;
    }
  },

  async registerDevice() {
    const dev = await getDeviceInfo();
    const r = await post<{
      message: { status: "Approved" | "Pending" | "Rejected" | "Unknown" };
    }>("/api/method/hris_register_device", {
      device_id: dev.id,
      device_name: dev.nama,
      platform: dev.platform,
    });
    return { status: r.message.status };
  },

  async getCurrentEmployee(): Promise<Employee> {
    return fetchCurrentEmployee();
  },

  async logout(): Promise<void> {
    // Token dilepas dulu selagi sesi masih berlaku; gagal tidak boleh menahan logout.
    const token = getCurrentPushToken();
    if (token) {
      await post("/api/method/hris_unregister_push_token", { token }).catch(
        () => {},
      );
    }
    await post("/api/method/logout");
  },

  async getDocuments(): Promise<EmployeeDocument[]> {
    return fetchDocuments();
  },

  // Dua langkah: buat dokumen (employee dari sesi), lalu lampirkan file lewat
  // upload_file. Batas 5 MB dan tipe pdf/jpg/png dijaga server.
  async uploadDocument(_employeeId, input) {
    if (!input.file)
      throw new ApiError(translate("err.dokumenGagal"), 0, "NoFile");
    const createdAt = await post<{ message: { name: string } }>(
      "/api/method/hris_create_my_document",
      {
        document_name: input.name,
        category: SERVER_DOC_CATEGORIES[input.category],
        expires_on: input.expiresOn,
      },
    );
    try {
      await uploadFile(
        input.file,
        "Employee Document",
        createdAt.message.name,
        "file",
      );
    } catch (e) {
      // Dokumen tanpa berkas tidak berguna; dihapus supaya tidak muncul dobel saat diulang.
      await post("/api/method/hris_delete_my_document", {
        name: createdAt.message.name,
      }).catch(() => {});
      throw e;
    }
    return fetchDocuments();
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
      rating: RATING[a.rating] ? translate(RATING[a.rating]!) : a.rating,
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
    const res = await get<{ message: OvertimeRow[] }>(
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
    return fetchBalances(employeeId);
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
    const [overtime, trip, wfh] = await Promise.all([
      fetchOvertime(false),
      fetchTrips(false),
      fetchWfh(false),
    ]);
    const leave = await fetchLeaveAttachments(res.data.map(mapSubmission));
    return [...leave, ...overtime, ...trip, ...wfh].sort(newestFirst);
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
      initials: initialsOf(r.employee_name),
      fullName: r.employee_name,
      jobTitle: r.designation
        ? translateServerLabel("designation", r.designation)
        : "—",
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
      initials: initialsOf(res.message.name ?? res.message.email),
    };
  },

  async submitLeaveRequest(input) {
    if (input.type === "lembur") {
      if (!input.overtimeEnd)
        throw new ApiError(translate("err.dataKurang"), 0, "NoEnd");
      const res = await post<{ message: OvertimeRow }>(
        "/api/method/hris_submit_overtime",
        {
          date: input.fromDate,
          end_time: input.overtimeEnd,
          note: input.reason,
        },
      );
      const hasFailed = await attachAll(
        "Overtime Request",
        res.message.name,
        (input.attachments ?? []).map((f) => ({ f, field: "proof" })),
      );
      return {
        ...mapOvertime(res.message, input.employeeId),
        failedProofCount: hasFailed || undefined,
      };
    }
    if (input.type === "wfh") {
      const res = await post<{ message: WfhRow }>(
        "/api/method/hris_submit_wfh",
        {
          from_date: input.fromDate,
          to_date: input.toDate,
          days: (input.wfhDays ?? []).join(","),
          reason: input.reason,
        },
      );
      return mapWfh(res.message, input.employeeId);
    }
    if (input.type === "dinas_luar") {
      const t = input.travel;
      if (!t) throw new ApiError(translate("err.dataKurang"), 0, "NoTravel");
      const res = await post<{ message: TripRow }>(
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
                `${SERVER_EXPENSE_KINDS[x.category] ?? "Others"}|${clean(x.description)}|${x.amount}`,
            )
            .join(";"),
        },
      );
      // Indeks bukti mengikuti urutan baris biaya yang benar-benar dikirim.
      const isSubmitted = t.costs.filter((x) => x.amount > 0);
      const hasFailed = await attachAll(
        "Travel Request",
        res.message.name,
        isSubmitted.flatMap((x, n) =>
          x.proof ? [{ f: x.proof, field: `cost_${n}` }] : [],
        ),
      );
      return {
        ...mapTrip(res.message, input.employeeId),
        failedProofCount: hasFailed || undefined,
      };
    }
    const kind = input.leaveType ?? KIND_NAMES[input.type];
    if (!kind) return mockApi.submitLeaveRequest(input);

    const approver = await this.getLeaveApprover(input.employeeId);
    if (!approver) {
      throw new ApiError(translate("err.tanpaApprover"), 0, "NoApprover");
    }

    const res = await post<{ data: LeaveRow }>(
      `/api/resource/${encodeURIComponent("Leave Application")}`,
      {
        employee: input.employeeId,
        leave_type: kind,
        from_date: input.fromDate,
        to_date: input.toDate,
        description: input.reason,
        leave_approver: approver.id,
        custom_delegate: input.delegateId ?? "",
      },
    );
    // Bukti (surat dokter, akta, dll.) dilampirkan setelah pengajuan ada.
    const gagal = await attachAll(
      "Leave Application",
      res.data.name,
      (input.attachments ?? []).map((f) => ({ f, field: "proof" })),
    );
    return {
      ...mapSubmission(res.data),
      failedProofCount: gagal || undefined,
    };
  },

  async getPendingApprovals(): Promise<LeaveRequest[]> {
    const [leave, overtime, trip, wfh] = await Promise.all([
      fetchPending(),
      fetchOvertime(true),
      fetchTrips(true),
      fetchWfh(true),
    ]);
    const isPending = (r: LeaveRequest) => r.decision === null;
    return [
      ...leave,
      ...overtime.filter(isPending),
      ...trip.filter(isPending),
      ...wfh.filter(isPending),
    ].sort(newestFirst);
  },

  async getFeed(employeeId: string, role: Role): Promise<FeedItem[]> {
    if (role === "ess") {
      return (await fetchOwn(employeeId)).map((r) => toFeedItem(r, false));
    }
    return (await this.getPendingApprovals(employeeId))
      .slice(0, 3)
      .map((r) => toFeedItem(r, true));
  },

  // Satu PUT: status saja hanya mengubah draft dan tidak memotong saldo,
  // docstatus 1 yang membuat keputusannya final.
  async decideLeaveRequest(requestId, decision): Promise<LeaveRequest> {
    if (ID_WFH.test(requestId)) {
      const res = await post<{ message: WfhRow }>(
        "/api/method/hris_decide_wfh",
        { name: requestId, decision },
      );
      return mapWfh(res.message);
    }
    const overtime = OVERTIME_ID_PREFIX.test(requestId);
    if (overtime || TRIP_ID_PREFIX.test(requestId)) {
      const res = await post<{ message: OvertimeRow & TripRow }>(
        overtime
          ? "/api/method/hris_decide_overtime"
          : "/api/method/hris_decide_travel_request",
        { name: requestId, decision },
      );
      return overtime ? mapOvertime(res.message) : mapTrip(res.message);
    }
    const res = await put<{ data: LeaveRow }>(
      `/api/resource/${encodeURIComponent("Leave Application")}/${encodeURIComponent(requestId)}`,
      {
        status: decision === "approve" ? "Approved" : "Rejected",
        docstatus: 1,
      },
    );
    return mapSubmission(res.data);
  },

  // Penyaringan hak akses (HR semua, atasan hanya bawahan) dilakukan Server Script.
  async getStaffDirectory(): Promise<StaffDirectory> {
    const res = await get<{
      message: { total_active: number; items: StaffRow[] };
    }>("/api/method/hris_get_staff_directory");
    return {
      totalActive: res.message.total_active,
      items: res.message.items.map(mapStaff),
    };
  },

  async getEmploymentSummary(): Promise<EmploymentSlice[] | null> {
    const res = await get<{
      message: { label: string; count: number }[] | null;
    }>("/api/method/hris_get_employment_summary");
    if (!res.message) return null;
    return res.message.map((s) => ({
      label: EMPLOYMENT_NAMES[s.label]
        ? translate(EMPLOYMENT_NAMES[s.label]!)
        : s.label,
      count: s.count,
    }));
  },

  async syncOfflineCheckins() {
    return syncQueue();
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
        ? translateServerLabel("designation", r.designation)
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
    return fetchClockStatus();
  },

  async getWorkLocations(): Promise<GeofenceRule> {
    const res = await get<{
      message: {
        geofence_mode: GeofenceRule["mode"];
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
    lokasi?: CheckinLocation,
    faceVec?: number[],
    spoof?: { mean: number; scores: number[] },
  ): Promise<ClockState> {
    return sendCheckin(employeeId, "IN", lokasi, faceVec, spoof);
  },

  async clockOut(
    employeeId: string,
    lokasi?: CheckinLocation,
    faceVec?: number[],
    spoof?: { mean: number; scores: number[] },
  ): Promise<ClockState> {
    return sendCheckin(employeeId, "OUT", lokasi, faceVec, spoof);
  },

  async getFaceStatus(): Promise<FaceStatus> {
    const res = await get<{
      message: {
        state: FaceStatus["state"];
        grace_until: string | null;
        note: string | null;
        ktp_url: string | null;
        profile_url: string | null;
        min_ktp: number;
        min_profile: number;
        min_checkin: number;
        require_enrollment: number;
      };
    }>("/api/method/hris_get_face_status");
    const m = res.message;
    return {
      state: m.state,
      graceUntil: m.grace_until,
      note: m.note,
      ktpUrl: m.ktp_url,
      profileUrl: m.profile_url,
      minKtp: m.min_ktp,
      minProfile: m.min_profile,
      minCheckin: m.min_checkin,
      requireEnrollment: !!m.require_enrollment,
    };
  },

  async logFaceCheck(input) {
    await post("/api/method/hris_log_face_check", {
      log_type: input.logType,
      outcome: input.outcome,
      scores: JSON.stringify(input.scores),
    });
  },

  async getFaceEnrollmentsForReview() {
    const r = await get<{
      message: {
        name: string;
        employee: string;
        employee_name: string;
        created: string;
        score_ktp: number | null;
        score_profile: number | null;
        score_profile_ktp: number | null;
        spoof_mean: number | null;
        selfie_url: string | null;
        profile_url: string | null;
        ktp_url: string | null;
        min_ktp: number;
        min_profile: number;
      }[];
    }>("/api/method/hris_get_face_enrollments_for_review");
    return r.message.map((x) => ({
      name: x.name,
      employee: x.employee,
      employeeName: x.employee_name,
      created: x.created,
      scoreKtp: x.score_ktp,
      scoreProfile: x.score_profile,
      scoreProfileKtp: x.score_profile_ktp,
      spoofMean: x.spoof_mean,
      selfieUrl: x.selfie_url,
      profileUrl: x.profile_url,
      ktpUrl: x.ktp_url,
      minKtp: x.min_ktp,
      minProfile: x.min_profile,
    }));
  },

  async decideFaceEnrollment(name, decision, note) {
    await post("/api/method/hris_decide_face_enrollment", {
      name,
      decision,
      ...(note ? { note } : {}),
    });
  },

  async submitFaceEnrollment(input) {
    const res = await post<{
      message: { name: string; score_ktp: number; score_profile: number };
    }>("/api/method/hris_submit_face_enrollment", {
      embeddings: JSON.stringify(input.embeddings),
      ktp_embedding: JSON.stringify(input.ktpEmbedding),
      profile_embedding: JSON.stringify(input.profileEmbedding),
      // Selfie hanya bahan tinjauan HR; dikirim bersama pengajuan (server yang menyimpan).
      ...(input.selfie
        ? { selfie_b64: await new FileFs(input.selfie.uri).base64() }
        : {}),
      ...(input.spoof
        ? {
            spoof_mean: input.spoof.mean,
            spoof_scores: JSON.stringify(input.spoof.scores),
          }
        : {}),
    });
    return {
      scoreKtp: res.message.score_ktp,
      scoreProfile: res.message.score_profile,
    };
  },

  async submitProfilePhoto(input) {
    const res = await post<{
      message: {
        name: string | null;
        score_face: number | null;
        score_ktp: number | null;
        below_min: boolean;
      };
    }>("/api/method/hris_submit_profile_photo", {
      embedding: JSON.stringify(input.embedding),
      ...(input.ktpEmbedding
        ? { ktp_embedding: JSON.stringify(input.ktpEmbedding) }
        : {}),
      ...(input.dryRun
        ? { dry_run: 1 }
        : input.photo
          ? { photo_b64: await new FileFs(input.photo.uri).base64() }
          : {}),
    });
    return {
      scoreFace: res.message.score_face,
      scoreKtp: res.message.score_ktp,
      belowMin: res.message.below_min,
    };
  },

  async getAttendanceHistory(): Promise<AttendanceRecord[]> {
    const res = await get<{ message: AttendanceRow[] }>(
      "/api/method/hris_get_attendance_history",
    );
    return res.message.map(mapAttendance);
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
        ? translateServerLabel("designation", r.designation)
        : "",
      department: withoutSuffix(r.department),
      name: r.document_name,
      category: DOC_CATEGORIES[r.category] ?? "sertifikat",
      ext: r.ext ?? "FILE",
      sizeLabel: r.size_bytes ? formatFileSize(r.size_bytes) : "—",
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
    await uploadFile(file, "Employee Document", id, "file");
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
        ? translateServerLabel("designation", r.designation)
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
    return res.message.map(mapAttendance);
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
    const hasFailed = await attachAll(
      "Attendance Request",
      res.message.name,
      (input.attachments ?? []).map((f) => ({ f, field: "proof" })),
    );
    return {
      ...mapCorrection(res.message, input.employeeId),
      failedProofCount: hasFailed || undefined,
    };
  },

  async getAttendanceCorrections(employeeId: string) {
    const res = await get<{ message: CorrectionRow[] }>(
      "/api/method/hris_get_attendance_corrections",
    );
    return res.message.map((r) => mapCorrection(r, employeeId));
  },

  async getPayslips(): Promise<Payslip[]> {
    const res = await get<{ message: SlipRow[] }>(
      "/api/method/hris_get_payslips",
    );
    return res.message.map(mapPayslip);
  },

  async getTaxSummary(): Promise<TaxSummary> {
    const res = await get<TaxRes>("/api/method/hris_get_tax_summary");
    const data = res.message;
    const yearValue = data?.year ?? new Date().getFullYear();
    const latest = data?.latest;
    const gross = latest?.gross_pay ?? 0;
    const latestMonth = (data?.months ?? []).filter((m) => m.gross > 0).at(-1);
    return {
      year: yearValue,
      // PTKP, NPWP, dan TER tidak ada sumbernya di ERPNext; tidak dikarang.
      scheme: "—",
      // Hanya bulan yang punya slip, supaya grafik tidak penuh batang kosong.
      monthly: (data?.months ?? [])
        .filter((m) => m.gross > 0)
        .map((m) => ({
          monthShort: getMonthName(new Date(2000, m.month - 1, 1)).slice(0, 3),
          amount: m.pph21,
        })),
      peakReason: "",
      // Nama bulan dari nomor bulan, bukan dari teks server (berbahasa Inggris).
      basePeriod: latestMonth
        ? getMonthName(new Date(2000, latestMonth.month - 1, 1))
        : "—",
      grossPay: gross,
      terCategory: data?.ter_category
        ? translate("tax.terKategori", { k: data.ter_category })
        : "—",
      ptkpStatus: data?.ptkp_status ?? "—",
      ptkpAnnual: data?.ptkp_annual ?? 0,
      npwpMasked: "—",
      monthTax: latest?.pph21 ?? 0,
      // Tinggal porsi karyawan (persen dari bruto); porsi perusahaan tidak ada.
      bpjs: (latest?.bpjs ?? []).map((b) => ({
        label: translateServerLabel("salaryComponent", b.label),
        employeePct: gross ? Math.round((b.amount / gross) * 10000) / 100 : 0,
        companyPct: 0,
      })),
    };
  },
  async getPersonalProfile(): Promise<PersonalProfile> {
    const res = await get<{ message: ProfileRow }>(
      "/api/method/hris_get_my_profile",
    );
    return mapProfile(res.message);
  },

  async savePersonalProfile(
    _employeeId: string,
    data: EditableProfile,
  ): Promise<PersonalProfile> {
    const res = await post<{ message: ProfileRow }>(
      "/api/method/hris_update_my_profile",
      profileParams(data),
    );
    return mapProfile(res.message);
  },

  async submitProfileChange(data: EditableProfile, reason: string) {
    await post("/api/method/hris_submit_profile_change", {
      ...profileParams(data),
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
        attachments?: AttachmentRow[];
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
      attachments: toAttachment(a.attachments) ?? [],
      postedBy: a.posted_by,
    }));
  },

  async getMyProfileChanges(): Promise<ProfileChange[]> {
    const res = await get<{ message: ChangeRow[] }>(
      "/api/method/hris_get_my_profile_changes",
    );
    return res.message.map(mapChange);
  },

  async getProfileChangesForReview(status): Promise<ProfileChange[]> {
    const res = await get<{ message: ChangeRow[] }>(
      "/api/method/hris_get_profile_changes_for_review",
      { status },
    );
    return res.message.map(mapChange);
  },

  async decideProfileChange(id, decision, note) {
    await post("/api/method/hris_decide_profile_change", {
      name: id,
      decision,
      note,
    });
  },

  async getSecurityInfo(employeeId: string): Promise<SecurityInfo> {
    return fetchSecurityInfo(employeeId);
  },

  async setSecurityToggle(
    employeeId: string,
    key: SecurityToggleKey,
    enabled: boolean,
  ): Promise<SecurityInfo> {
    // Toggle masih mock; daftar perangkat tetap yang asli.
    await mockApi.setSecurityToggle(employeeId, key, enabled);
    return fetchSecurityInfo(employeeId);
  },

  async logoutDevice(
    employeeId: string,
    sessionIds: string[],
  ): Promise<SecurityInfo> {
    await post("/api/method/hris_logout_sessions", {
      ids: JSON.stringify(sessionIds),
    });
    return fetchSecurityInfo(employeeId);
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
        throw new ApiError(translate("err.passwordLama"), 401, "WrongPassword");
      }
      if (e instanceof ApiError && e.status === 417) {
        throw new ApiError(translate("err.passwordLemah"), 417, "WeakPassword");
      }
      throw e;
    }
  },
  async getNotificationInbox(): Promise<AppNotification[]> {
    const res = await get<{ message: NotificationRow[] }>(
      "/api/method/hris_get_notifications",
    );
    return res.message.map(mapNotification);
  },

  async markNotificationsRead(
    _employeeId: string,
    ids?: string[],
  ): Promise<AppNotification[]> {
    const res = await post<{ message: NotificationRow[] }>(
      "/api/method/hris_mark_notifications_read",
      // Dipisah koma: Server Script tidak bisa mengurai JSON dari isi form.
      ids ? { names: ids.join(",") } : undefined,
    );
    return res.message.map(mapNotification);
  },
};
