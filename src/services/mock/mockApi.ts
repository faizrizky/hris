// Implementasi HrisApi pakai data dummy (Fase 1 — mocking).
// Fase 2 tinggal buat src/services/api/erpnextApi.ts yang implement interface
// yang sama, lalu ganti export di src/services/api/index.ts. Komponen layar
// tidak perlu diubah sama sekali.

import {
  AttendanceCorrectionRequest,
  AttendanceRecord,
  ClockState,
  Employee,
  HrisApi,
  LeaveBalance,
  LeaveRequest,
  NotificationItem,
  Payslip,
} from "../types";
import {
  MOCK_ATTENDANCE,
  MOCK_EMPLOYEES,
  MOCK_LEAVE_BALANCES,
  MOCK_LEAVE_REQUESTS,
  MOCK_NOTIFICATIONS,
  MOCK_PAYSLIPS,
  MOCK_PENDING_APPROVALS,
} from "./mockData";

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

// State in-memory sederhana supaya interaksi (clock in/out, ajukan cuti,
// approve/reject) terlihat "nyata" selama fase mocking, tanpa persist ke disk.
let clockState: ClockState = {
  clockedIn: false,
  lastCheckIn: null,
  lastCheckOut: null,
};
let leaveRequests: LeaveRequest[] = [...MOCK_LEAVE_REQUESTS];
let attendanceCorrections: AttendanceCorrectionRequest[] = [];
let pendingApprovals: LeaveRequest[] = [...MOCK_PENDING_APPROVALS];
let currentEmployee: Employee = MOCK_EMPLOYEES.ess;

export const mockApi: HrisApi = {
  async login(email: string, _password: string): Promise<Employee> {
    await delay();
    // Mocking: email apa saja bisa login, role ditentukan dari prefix email
    // (ess@, mss@, hr@) supaya gampang dites tiga role tanpa backend.
    const prefix = email.split("@")[0]?.toLowerCase();
    currentEmployee = MOCK_EMPLOYEES[prefix] ?? MOCK_EMPLOYEES.ess;
    return currentEmployee;
  },

  async getCurrentEmployee(): Promise<Employee> {
    await delay(100);
    return currentEmployee;
  },

  async getClockState(_employeeId: string): Promise<ClockState> {
    await delay(150);
    return clockState;
  },

  async clockIn(_employeeId: string): Promise<ClockState> {
    await delay();
    const now = new Date();
    clockState = {
      clockedIn: true,
      lastCheckIn: now.toTimeString().slice(0, 5),
      lastCheckOut: null,
    };
    return clockState;
  },

  async clockOut(_employeeId: string): Promise<ClockState> {
    await delay();
    const now = new Date();
    clockState = {
      ...clockState,
      clockedIn: false,
      lastCheckOut: now.toTimeString().slice(0, 5),
    };
    return clockState;
  },

  async getAttendanceHistory(_employeeId: string): Promise<AttendanceRecord[]> {
    await delay();
    return MOCK_ATTENDANCE;
  },

  async getAttendanceCorrections(
    employeeId: string,
  ): Promise<AttendanceCorrectionRequest[]> {
    await delay();
    return attendanceCorrections.filter((r) => r.employeeId === employeeId);
  },

  async getLeaveBalances(_employeeId: string): Promise<LeaveBalance[]> {
    await delay(150);
    return MOCK_LEAVE_BALANCES;
  },

  async getLeaveRequests(employeeId: string): Promise<LeaveRequest[]> {
    await delay();
    return leaveRequests.filter((r) => r.employeeId === employeeId);
  },

  async submitLeaveRequest(input): Promise<LeaveRequest> {
    await delay();
    const pemohon = MOCK_EMPLOYEES[input.employeeId];
    const created: LeaveRequest = {
      id: `l${Date.now()}`,
      employeeId: input.employeeId,
      employeeName: pemohon?.fullName ?? "—",
      employeeInitials: pemohon?.avatarInitials ?? "—",
      employeeJobTitle: pemohon?.jobTitle ?? "—",
      type: input.type,
      label: input.label,
      reason: input.reason,
      stage: "Tahap 1 dari 2",
      quota: "—",
      approverName: "Bayu P. → HR",
      approverInitials: "BP",
      decision: null,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    leaveRequests = [created, ...leaveRequests];
    return created;
  },

  async submitAttendanceCorrection(
    input,
  ): Promise<AttendanceCorrectionRequest> {
    await delay();
    const created: AttendanceCorrectionRequest = {
      id: `c${Date.now()}`,
      employeeId: input.employeeId,
      date: input.date,
      requestedCheckIn: input.requestedCheckIn,
      requestedCheckOut: input.requestedCheckOut,
      reason: input.reason,
      status: "pending",
    };
    attendanceCorrections = [created, ...attendanceCorrections];
    return created;
  },

  async getPendingApprovals(_approverId: string): Promise<LeaveRequest[]> {
    await delay();
    return pendingApprovals.filter((r) => r.decision === null);
  },

  async decideLeaveRequest(
    requestId: string,
    decision: "approve" | "reject",
  ): Promise<LeaveRequest> {
    await delay();
    pendingApprovals = pendingApprovals.map((r) =>
      r.id === requestId ? { ...r, decision } : r,
    );
    const updated = pendingApprovals.find((r) => r.id === requestId);
    if (!updated) throw new Error("Leave request not found");
    return updated;
  },

  async getPayslips(_employeeId: string): Promise<Payslip[]> {
    await delay();
    return MOCK_PAYSLIPS;
  },

  async getNotifications(_employeeId: string): Promise<NotificationItem[]> {
    await delay(150);
    return MOCK_NOTIFICATIONS;
  },
};
