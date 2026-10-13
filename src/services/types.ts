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
  attachments?: { name: string; url: string }[];
  buktiGagal?: number;
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

// Lokasi saat check-in; server menilai jarak, akurasi, dan keaslian lokasinya.
export interface LokasiCheckin {
  lat: number;
  lng: number;
  accuracyM: number;
  gpsMs: number; // cap waktu fix GPS (epoch ms)
  mocked: boolean;
}

export interface WorkLocation {
  name: string;
  locationName: string;
  latitude: number;
  longitude: number;
  radiusM: number;
}

// Aturan lokasi untuk presensi hari ini, dari server.
export interface AturanLokasi {
  locations: WorkLocation[];
  mode: "Off" | "Flag" | "Block";
  maxAccuracyM: number;
  wfhToday: boolean; // jadwal WFH hari ini: bebas area
  requireLocation: boolean;
}

export interface ClockState {
  clockedIn: boolean;
  lastCheckIn: string | null;
  lastCheckOut: string | null;
  timezoneLabel?: string; // "WIB", "WITA", "GMT+8", dari server
  workLocation?: string | null;
  pendingOffline?: boolean; // ada check-in yang masih menunggu dikirim
}

export type LeaveType = "cuti" | "lembur" | "dinas_luar" | "sakit" | "wfh";
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
  attachments?: { name: string; url: string }[];
  buktiGagal?: number; // jumlah lampiran yang gagal diunggah setelah pengajuan terkirim
}

export interface BerkasLampiran {
  uri: string;
  name: string;
  mimeType: string;
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
  terCategory: string; // "TER A"
  ptkpStatus: string; // "TK/0"
  ptkpAnnual: number; // PTKP setahun untuk status itu (Rp)
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
export type StaffAttendanceState = "attend" | "late" | "leave" | "belum";

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
  "Approval" | "Payroll" | "Presensi" | "Appraisal" | "Pengumuman";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  category: NotifCategory;
  timeLabel: string; // "08:41" / "Kemarin 21:30"
  group: string; // "Hari ini" / "Kemarin" — jadi judul seksi
  tone: "ok" | "warn" | "info" | "bad";
  read: boolean;
  documentType?: string | null; // doctype ERPNext yang dirujuk, untuk dibuka saat diketuk
  documentName?: string | null;
  fileUrl?: string | null; // Employee Document: berkas yang bisa dibuka (HR/pemilik)
}

export interface FamilyMember {
  name: string;
  relation: string; // nilai baku ERPNext: Spouse, Child, Father, Mother, Sibling, Other
  birthDate: string | null; // ISO
  dependent: boolean; // tanggungan untuk PTKP
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
  // Relasi memakai nilai baku ERPNext (Mother, Friend, ...); tampilan diterjemahkan.
  contacts: EmergencyContact[];
  family: FamilyMember[];
  maritalStatus: string; // nilai baku ERPNext: Single, Married, Divorced, Widowed
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
  primaryEmergency: EmergencyContact;
  editable: EditableProfile;
  canEditDirectly: boolean; // hanya HR; lainnya mengajukan permintaan
  pendingChange: string | null;
}

export type DocCategory = "kontrak" | "sk" | "sertifikat" | "identitas";
export type DocStatus =
  "verified" | "pending" | "expiring" | "rejected" | "changeRequested";

export interface EmployeeDocument {
  id: string;
  category: DocCategory;
  ext: string; // "PDF" | "JPG" | "PNG"
  name: string;
  sizeLabel: string; // "1,2 MB"
  dateLabel: string; // "14 Sep 2023" / "berakhir 30 hari lagi"
  status: DocStatus;
  fileUrl?: string | null;
  fileName?: string | null;
  rejectionReason?: string | null;
  changeReason?: string | null;
  expiresOn?: string | null; // ISO
  uploadedOn?: string | null; // ISO
}

export interface Announcement {
  id: string;
  title: string;
  content: string; // teks bersih
  priority: "Normal" | "Important";
  publishedOn: string | null; // ISO
  expiresOn: string | null; // ISO
  attachments: { name: string; url: string }[];
  postedBy: string | null;
}

export type OfflineReviewStatus = "Needs Review" | "Approved" | "Rejected";

export interface OfflineCheckin {
  id: string;
  employeeName: string;
  designation: string;
  logType: "IN" | "OUT";
  time: string; // "YYYY-MM-DD HH:MM:SS" zona kerja (yang tercatat)
  claimedTime: string | null; // jam yang diklaim karyawan
  flags: string; // alasan ditandai (bahasa Inggris dari server)
  status: OfflineReviewStatus;
  skewSeconds: number;
  queueAgeSeconds: number;
  offline: boolean;
  distanceM: number | null;
  geoStatus: "No Location" | "Inside" | "Outside";
  mocked: boolean;
  gpsAccuracyM: number | null;
  workLocation: string | null;
}

export type ChangeStatus = "Pending" | "Approved" | "Rejected";

export interface ProfileChange {
  id: string;
  status: ChangeStatus;
  reason: string;
  hrNote: string | null;
  changes: { field: string; current: string; proposed: string }[];
  createdOn: string | null; // ISO
  decidedOn: string | null; // ISO
  employeeName?: string;
  designation?: string;
  department?: string;
}

export type ReviewStatus =
  "Pending" | "Verified" | "Rejected" | "Change Requested";

/** Dokumen karyawan yang ditinjau HR. */
export interface ReviewDocument {
  id: string;
  employeeName: string;
  designation: string;
  department: string;
  name: string;
  category: DocCategory;
  ext: string;
  sizeLabel: string;
  uploadedOn: string | null; // ISO
  expiresOn: string | null; // ISO
  status: ReviewStatus;
  fileUrl: string | null;
  fileName: string | null;
  rejectionReason: string | null;
  changeReason: string | null;
}

export interface TeamAppraisal {
  employeeId: string;
  employeeName: string;
  designation: string;
  cycle: string;
  finalScore: number;
  myStatus: "none" | "draft" | "submitted";
  myScore: number | null;
}

export interface FeedbackForm {
  employeeId: string;
  employeeName: string;
  cycle: string;
  criteria: { name: string; weight: number }[];
  goals: { name: string; progress: number }[];
  mine: {
    status: "draft" | "submitted";
    ratings: Record<string, number>;
    feedback: string;
    totalScore: number;
  } | null;
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
  clockIn(employeeId: string, lokasi?: LokasiCheckin): Promise<ClockState>;
  clockOut(employeeId: string, lokasi?: LokasiCheckin): Promise<ClockState>;
  getWorkLocations(): Promise<AturanLokasi>;
  getAttendanceHistory(employeeId: string): Promise<AttendanceRecord[]>;
  // Riwayat karyawan lain, untuk atasan/HR (server membatasi hak aksesnya).
  getStaffAttendanceHistory(staffId: string): Promise<AttendanceRecord[]>;

  // Check-in offline: kirim antrean yang tertunda; peninjauan oleh atasan/HR.
  syncOfflineCheckins(): Promise<{ sent: number; remaining: number }>;
  getOfflineCheckins(
    status: OfflineReviewStatus | "all",
    scope?: "team",
  ): Promise<OfflineCheckin[]>;
  decideOfflineCheckin(
    id: string,
    decision: "approve" | "reject",
    note?: string,
  ): Promise<void>;

  // HR: tinjau Dokumen Digital karyawan.
  getDocumentsForReview(
    status: ReviewStatus | "all",
  ): Promise<ReviewDocument[]>;
  decideDocument(
    id: string,
    decision: "verify" | "reject" | "allow_change" | "deny_change",
    reason?: string,
  ): Promise<void>;
  // Karyawan: minta mengubah dokumen yang sudah terverifikasi, atau ganti berkasnya.
  requestDocumentChange(id: string, reason: string): Promise<void>;
  replaceDocumentFile(id: string, file: BerkasLampiran): Promise<void>;

  // Atasan/HR: penilaian kinerja tim.
  getTeamAppraisals(): Promise<TeamAppraisal[]>;
  getFeedbackForm(employeeId: string): Promise<FeedbackForm>;
  submitFeedback(input: {
    employeeId: string;
    ratings: Record<string, number>;
    feedback: string;
    submit: boolean;
  }): Promise<void>;
  getAttendanceCorrections(
    employeeId: string,
  ): Promise<AttendanceCorrectionRequest[]>;
  getOvertimes(employeeId: string): Promise<OvertimeRecord[]>;
  registerPushToken(input: {
    token: string;
    platform: string;
    deviceName: string;
  }): Promise<void>;
  unregisterPushToken(token: string): Promise<void>;
  getLanguage(): Promise<"id" | "en" | null>;
  setLanguage(language: "id" | "en"): Promise<void>;
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
    leaveType?: string; // nama Leave Type ERPNext bila bukan Tahunan/Sakit
    overtimeEnd?: string; // lembur: "HH:MM"
    wfhDays?: string[]; // wfh: mon..sun
    attachments?: BerkasLampiran[]; // lembur: bukti
    travel?: {
      destination: string;
      transport: string; // nilai TRANSPORTASI di aplikasi
      purpose: string;
      costs: {
        category: string;
        description: string;
        amount: number;
        proof?: BerkasLampiran;
      }[];
    };
  }): Promise<LeaveRequest>;

  getLeaveApprover(employeeId: string): Promise<LeaveApprover | null>;

  submitAttendanceCorrection(input: {
    employeeId: string;
    date: string;
    requestedCheckIn: string;
    requestedCheckOut: string;
    reason: string;
    attachments?: BerkasLampiran[];
  }): Promise<AttendanceCorrectionRequest>;

  getPendingApprovals(approverId: string): Promise<LeaveRequest[]>;
  decideLeaveRequest(
    requestId: string,
    decision: "approve" | "reject",
  ): Promise<LeaveRequest>;

  getPayslips(employeeId: string): Promise<Payslip[]>;

  getTaxSummary(employeeId: string): Promise<TaxSummary>;

  getAppraisal(employeeId: string): Promise<Appraisal | null>;

  getStaffDirectory(employeeId: string): Promise<StaffDirectory>;

  getEmploymentSummary(employeeId: string): Promise<EmploymentSlice[] | null>;

  getColleagues(employeeId: string): Promise<Colleague[]>;

  getFeed(employeeId: string, role: Role): Promise<FeedItem[]>;

  getNotificationInbox(employeeId: string): Promise<AppNotification[]>;
  markNotificationsRead(
    employeeId: string,
    ids?: string[], // tanpa ids = tandai semua
  ): Promise<AppNotification[]>;

  getPersonalProfile(employeeId: string): Promise<PersonalProfile>;
  // Karyawan non-HR tidak mengubah data pribadi langsung: mereka mengajukan permintaan.
  submitProfileChange(data: EditableProfile, reason: string): Promise<void>;
  getMyProfileChanges(): Promise<ProfileChange[]>;
  getAnnouncements(): Promise<Announcement[]>;
  getProfileChangesForReview(
    status: ChangeStatus | "all",
  ): Promise<ProfileChange[]>;
  decideProfileChange(
    id: string,
    decision: "approve" | "reject",
    note?: string,
  ): Promise<void>;
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
      expiresOn?: string; // ISO
      file?: { uri: string; name: string; mimeType: string };
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
