// Domain types dipakai bareng oleh mock API (sekarang) dan ERPNext API asli (nanti).
// Field-nya sengaja dipetakan mirip DocType ERPNext supaya swap ke Fase 2 minim perubahan.

export type Role = "ess" | "mss" | "hr";

export interface Employee {
  id: string; // -> Employee.name di ERPNext
  nik: string; // -> employee_number
  fullName: string; // -> employee_name
  role: Role;
  jobTitle: string; // -> designation
  department: string; // -> department
  avatarInitials: string;
  joinDate: string; // ISO, -> date_of_joining
  kpiScore: number; // -> skor akhir Appraisal ERPNext
}

export type AttendanceStatus = "hadir" | "telat" | "izin";

export interface AttendanceRecord {
  id: string;
  date: string; // ISO date
  checkIn: string | null; // "08:02"
  checkOut: string | null;
  durationLabel: string | null; // "9j 14m"
  status: AttendanceStatus;
}

export type AttendanceRequestedStatus = "pending" | "approved" | "rejected";

export interface AttendanceCorrectionRequest {
  id: string;
  employeeId: string;
  date: string;
  requestedCheckIn: string;
  requestedCheckOut: string;
  reason: string;
  status: AttendanceRequestedStatus;
}

export type OvertimeStatus = "pending" | "approved" | "paid" | "rejected";

export interface OvertimeRecord {
  id: string;
  employeeId: string;
  date: string; // ISO
  startMinute: number; // 480 = 08:00, disimpan sebagai menit agar mudah dihitung
  endMinute: number;
  hours: number; // 4, 2, 0.5
  note: string;
  status: OvertimeStatus;
}

export interface ClockState {
  clockedIn: boolean;
  lastCheckIn: string | null;
  lastCheckOut: string | null;
}

export type LeaveType = "cuti" | "lembur" | "dinas_luar" | "sakit";
export type LeaveDecision = "approve" | "reject" | null;

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string; // -> employee_name
  employeeInitials: string;
  employeeJobTitle: string; // -> designation
  type: LeaveType;
  label: string;
  reason: string;
  delegateName: string | null;
  stage: string;
  quota: string;
  approverName: string;
  approverInitials: string;
  decision: LeaveDecision;
  createdAt: string;
}

export interface LeaveBalance {
  type: LeaveType;
  label: string;
  remaining: number;
  total: number;
  unit: "hari" | "jam";
}

export interface PayslipLine {
  label: string;
  amount: number;
}

export interface Payslip {
  id: string;
  period: string; // "Agustus 2026"
  monthShort: string; // "AGT" — chip di daftar slip sebelumnya
  note: string; // "Reguler" / "Termasuk THR"
  status: string; // "Dibayar"
  bankAccount: string; // -> bank_account_no
  paidAt: string; // -> posting_date
  earnings: PayslipLine[]; // -> Salary Slip.earnings
  deductions: PayslipLine[]; // -> Salary Slip.deductions
  grossPay: number; // -> gross_pay
  totalDeduction: number; // -> total_deduction
  netPay: number; // -> net_pay
}

export interface TaxMonthly {
  monthShort: string; // "Jan"
  amount: number;
}

export interface BpjsItem {
  label: string; // "BPJS Kesehatan"
  employeePct: number; // porsi karyawan, mis. 1
  companyPct: number; // porsi perusahaan, mis. 4
}

export interface TaxSummary {
  year: number;
  scheme: string; // "TER"
  monthly: TaxMonthly[]; // YTD dihitung dari sini, tidak disimpan terpisah
  peakReason: string; // "THR" — alasan bulan tertinggi
  basePeriod: string; // "Agustus"
  grossPay: number;
  terCategory: string; // "TER A · 2,5%"
  ptkpStatus: string; // "TK/0"
  npwpMasked: string; // "•••• 8823"
  monthTax: number;
  bpjs: BpjsItem[];
}

export interface AppraisalRater {
  name: string; // "Atasan langsung — Bayu P."
  score: number; // 4.3
  weight: number; // bobot dalam persen, mis. 50
}

export interface AppraisalGoal {
  name: string;
  progress: number; // persen, mis. 96
  note: string;
}

export interface Appraisal {
  cycle: string; // "Siklus H1 2026"
  method: string; // "Penilaian 360° berbobot, final 30 Sep"
  score: number; // 4.2 — sama dengan Employee.kpiScore
  maxScore: number; // 5
  rating: string; // "Exceeds"
  ratingTone: "ok" | "warn" | "info" | "bad";
  raters: AppraisalRater[];
  goals: AppraisalGoal[];
}

export type EmploymentStatus = "Tetap" | "Kontrak";
export type StaffAttendanceState = "attend" | "late" | "leave";

// Staff = karyawan lain yang dilihat atasan/HR. Dibedakan dari Employee,
// yang khusus untuk user yang sedang login.
export interface Staff {
  id: string;
  initials: string;
  fullName: string;
  jobTitle: string;
  department: string;
  code: string; // "EMP-0117"
  status: EmploymentStatus;
  employment: string; // "Permanent" / "Kontrak · s.d. Mei 2027"
  joinDate: string; // ISO
  manager: string;
  shift: string;
  email: string;
  phone: string;
  attendanceRate: number; // 96.2 persen
  leaveLeft: number; // hari
  kpiScore: number;
  today: {
    state: StaffAttendanceState;
    checkIn: string | null;
    checkOut: string | null;
    label: string; // "Hadir" / "Telat" / "Sakit" / "Dinas luar"
  };
}

export interface StaffDirectory {
  totalActive: number; // total karyawan aktif perusahaan
  items: Staff[]; // yang boleh dilihat oleh pemanggil
}

export interface EmploymentSlice {
  label: string; // "Permanent"
  count: number; // 78
}

export interface FeedItem {
  id: string;
  initials: string;
  title: string;
  subtitle: string;
  badge: string;
  tone: "ok" | "warn" | "info" | "bad";
  createdAt: string;
}

export type NotifCategory =
  | "Approval"
  | "Payroll"
  | "Presensi"
  | "Appraisal"
  | "Pengumuman";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  category: NotifCategory;
  timeLabel: string; // "08:41" / "Kemarin 21:30"
  group: string; // "Hari ini" / "Kemarin" — jadi judul seksi
  tone: "ok" | "warn" | "info" | "bad";
  read: boolean;
}

export interface FamilyMember {
  initials: string;
  name: string;
  relation: string;
  age: string; // "58 th"
  dependent: boolean;
}

export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
}

/** Bagian yang boleh diubah karyawan sendiri. */
export interface EditableProfile {
  phone: string;
  personalEmail: string;
  address: string;
  em2Name: string;
  em2Relation: string;
  em2Phone: string;
}

/** Sisanya hanya bisa diubah HR lewat pengajuan dokumen. */
export interface PersonalProfile {
  fullName: string;
  nikMasked: string;
  birthPlace: string;
  birthDate: string; // ISO
  gender: string;
  maritalStatus: string;
  religion: string;
  npwpMasked: string;
  workEmail: string;
  ktpAddress: string;
  ptkpStatus: string;
  family: FamilyMember[];
  primaryEmergency: EmergencyContact;
  editable: EditableProfile;
}

export type DocCategory = "kontrak" | "sk" | "sertifikat" | "identitas";
export type DocStatus = "verified" | "pending" | "expiring";

export interface EmployeeDocument {
  id: string;
  category: DocCategory;
  ext: string; // "PDF" | "JPG" | "PNG"
  name: string;
  sizeLabel: string; // "1,2 MB"
  dateLabel: string; // "14 Sep 2023" / "berakhir 30 hari lagi"
  status: DocStatus;
}

export type SecurityToggleKey = "face" | "presence" | "lock" | "twofa";

export interface SecurityToggle {
  key: SecurityToggleKey;
  title: string;
  subtitle: string;
  enabled: boolean;
}

export interface ActiveDevice {
  id: string;
  name: string;
  meta: string;
  kind: "mobile" | "web";
  current: boolean;
}

export interface SecurityInfo {
  faceEnrolledAt: string; // ISO
  faceUpdatedAt: string; // ISO
  livenessOk: boolean;
  matchScore: number; // 98.4
  passwordChangedDaysAgo: number;
  toggles: SecurityToggle[];
  devices: ActiveDevice[];
}

export interface Colleague {
  id: string;
  initials: string;
  fullName: string;
  jobTitle: string;
}

export interface LeaveApprover {
  id: string; // email user approver
  fullName: string;
  initials: string;
}

// Kontrak yang dipakai UI — mock & real ERPNext service sama-sama implement ini.
export interface HrisApi {
  login(email: string, password: string): Promise<Employee>;
  getCurrentEmployee(): Promise<Employee>;
  logout(): Promise<void>;
  getClockState(employeeId: string): Promise<ClockState>;
  clockIn(employeeId: string): Promise<ClockState>;
  clockOut(employeeId: string): Promise<ClockState>;
  getAttendanceHistory(employeeId: string): Promise<AttendanceRecord[]>;
  getAttendanceCorrections(
    employeeId: string,
  ): Promise<AttendanceCorrectionRequest[]>;
  getOvertimes(employeeId: string): Promise<OvertimeRecord[]>;
  getLeaveBalances(employeeId: string): Promise<LeaveBalance[]>;
  getLeaveRequests(employeeId: string): Promise<LeaveRequest[]>;
  submitLeaveRequest(input: {
    employeeId: string;
    type: LeaveType;
    label: string;
    reason: string;
    fromDate: string; // ISO
    toDate: string; // ISO
    delegateId?: string;
    delegateName?: string;
  }): Promise<LeaveRequest>;

  getLeaveApprover(employeeId: string): Promise<LeaveApprover | null>;

  submitAttendanceCorrection(input: {
    employeeId: string;
    date: string;
    requestedCheckIn: string;
    requestedCheckOut: string;
    reason: string;
  }): Promise<AttendanceCorrectionRequest>;

  getPendingApprovals(approverId: string): Promise<LeaveRequest[]>;
  decideLeaveRequest(
    requestId: string,
    decision: "approve" | "reject",
  ): Promise<LeaveRequest>;

  getPayslips(employeeId: string): Promise<Payslip[]>;

  getTaxSummary(employeeId: string): Promise<TaxSummary>;

  getAppraisal(employeeId: string): Promise<Appraisal>;

  getStaffDirectory(employeeId: string): Promise<StaffDirectory>;

  getEmploymentSummary(employeeId: string): Promise<EmploymentSlice[] | null>;

  getColleagues(employeeId: string): Promise<Colleague[]>;

  getFeed(employeeId: string): Promise<FeedItem[]>;

  getNotificationInbox(employeeId: string): Promise<AppNotification[]>;
  markNotificationsRead(
    employeeId: string,
    ids?: string[], // tanpa ids = tandai semua
  ): Promise<AppNotification[]>;

  getPersonalProfile(employeeId: string): Promise<PersonalProfile>;
  savePersonalProfile(
    employeeId: string,
    data: EditableProfile,
  ): Promise<PersonalProfile>;

  getDocuments(employeeId: string): Promise<EmployeeDocument[]>;
  uploadDocument(
    employeeId: string,
    input: {
      category: DocCategory;
      ext: string;
      name: string;
      sizeLabel: string;
      expiresLabel?: string;
    },
  ): Promise<EmployeeDocument[]>;

  getSecurityInfo(employeeId: string): Promise<SecurityInfo>;
  setSecurityToggle(
    employeeId: string,
    key: SecurityToggleKey,
    enabled: boolean,
  ): Promise<SecurityInfo>;
  logoutOtherDevices(employeeId: string): Promise<SecurityInfo>;
  changePassword(
    employeeId: string,
    current: string,
    next: string,
  ): Promise<void>;
}
