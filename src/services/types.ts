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

export interface NotificationItem {
  id: string;
  initials: string;
  title: string;
  subtitle: string;
  badge: string;
  tone: "ok" | "warn" | "info" | "bad";
  createdAt: string;
}

// Kontrak yang dipakai UI — mock & real ERPNext service sama-sama implement ini.
export interface HrisApi {
  login(email: string, password: string): Promise<Employee>;
  getCurrentEmployee(): Promise<Employee>;

  getClockState(employeeId: string): Promise<ClockState>;
  clockIn(employeeId: string): Promise<ClockState>;
  clockOut(employeeId: string): Promise<ClockState>;
  getAttendanceHistory(employeeId: string): Promise<AttendanceRecord[]>;
  getAttendanceCorrections(
    employeeId: string,
  ): Promise<AttendanceCorrectionRequest[]>;
  getLeaveBalances(employeeId: string): Promise<LeaveBalance[]>;
  getLeaveRequests(employeeId: string): Promise<LeaveRequest[]>;
  submitLeaveRequest(input: {
    employeeId: string;
    type: LeaveType;
    label: string;
    reason: string;
  }): Promise<LeaveRequest>;

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

  getNotifications(employeeId: string): Promise<NotificationItem[]>;
}
