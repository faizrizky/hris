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
  type: LeaveType;
  label: string; // "Cuti tahunan · 3 hari"
  reason: string;
  stage: string; // "Tahap 1 dari 2"
  quota: string; // "4 hari"
  decision: LeaveDecision;
  createdAt: string;
}

export interface LeaveBalance {
  type: LeaveType;
  label: string;
  remaining: number;
  unit: "hari" | "jam";
}

export interface Payslip {
  id: string;
  period: string; // "Agustus 2026"
  grossPay: number;
  deductions: number;
  netPay: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  subtitle: string;
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
