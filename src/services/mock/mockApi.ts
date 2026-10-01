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
  FeedItem,
  Payslip,
  OvertimeRecord,
  AppNotification,
  TaxSummary,
  Appraisal,
  Staff,
  StaffDirectory,
} from "../types";
import {
  MOCK_ATTENDANCE,
  MOCK_EMPLOYEES,
  MOCK_LEAVE_BALANCES,
  MOCK_LEAVE_REQUESTS,
  MOCK_FEED,
  MOCK_PAYSLIPS,
  MOCK_PENDING_APPROVALS,
  MOCK_CORRECTIONS,
  MOCK_OVERTIMES,
  MOCK_INBOX,
  MOCK_TAX,
  MOCK_APPRAISAL,
  MOCK_STAFF,
  TOTAL_KARYAWAN_AKTIF,
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
let attendanceCorrections: AttendanceCorrectionRequest[] = [
  ...MOCK_CORRECTIONS,
];
let inbox: AppNotification[] = [...MOCK_INBOX];
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

  async getOvertimes(employeeId: string): Promise<OvertimeRecord[]> {
    await delay();
    return MOCK_OVERTIMES.filter((r) => r.employeeId === employeeId);
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

  async getTaxSummary(_employeeId: string): Promise<TaxSummary> {
    await delay();
    return MOCK_TAX;
  },

  async getAppraisal(_employeeId: string): Promise<Appraisal> {
    await delay();
    return MOCK_APPRAISAL;
  },

  async getStaffDirectory(employeeId: string): Promise<StaffDirectory> {
    await delay();
    const pemanggil = Object.values(MOCK_EMPLOYEES).find(
      (e) => e.id === employeeId,
    );

    // HR melihat semua; atasan hanya bawahan langsungnya. Penyaringan hak
    // akses ada di service, bukan di layar — di Fase 2 ini jadi tugas backend.
    const items: Staff[] =
      pemanggil?.role === "hr"
        ? MOCK_STAFF
        : MOCK_STAFF.filter((s) => s.manager === pemanggil?.fullName);

    return { totalActive: TOTAL_KARYAWAN_AKTIF, items };
  },

  async getFeed(_employeeId: string): Promise<FeedItem[]> {
    await delay(150);
    return MOCK_FEED;
  },

  async getNotificationInbox(_employeeId: string): Promise<AppNotification[]> {
    await delay();
    return inbox;
  },

  async markNotificationsRead(
    _employeeId: string,
    ids?: string[],
  ): Promise<AppNotification[]> {
    await delay(120);
    // Status baca disimpan di service, bukan di layar — supaya tidak hilang
    // saat layarnya ditinggal lalu dibuka lagi.
    inbox = inbox.map((n) =>
      !ids || ids.includes(n.id) ? { ...n, read: true } : n,
    );
    return inbox;
  },
};
