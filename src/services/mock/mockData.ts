import {
  AttendanceRecord,
  Employee,
  LeaveBalance,
  LeaveRequest,
  NotificationItem,
  Payslip,
} from "../types";

export const MOCK_EMPLOYEES: Record<string, Employee> = {
  ess: {
    id: "ess",
    nik: "EMP-0241",
    fullName: "Rani Wijaya",
    role: "ess",
    jobTitle: "Staff Finance",
    department: "Divisi Keuangan",
    avatarInitials: "RW",
  },
  mss: {
    id: "mss",
    nik: "EMP-0088",
    fullName: "Bayu Pratama",
    role: "mss",
    jobTitle: "Manager Operasional",
    department: "Operasional",
    avatarInitials: "BP",
  },
  hr: {
    id: "hr",
    nik: "EMP-0012",
    fullName: "Dinda Larasati",
    role: "hr",
    jobTitle: "HR Admin",
    department: "People Ops",
    avatarInitials: "DL",
  },
};

export const MOCK_ATTENDANCE: AttendanceRecord[] = [
  {
    id: "a14",
    date: "2026-09-14",
    checkIn: "08:02",
    checkOut: null,
    durationLabel: "berjalan",
    status: "hadir",
  },
  {
    id: "a13",
    date: "2026-09-13",
    checkIn: "07:58",
    checkOut: "17:12",
    durationLabel: "9j 14m",
    status: "hadir",
  },
  {
    id: "a12",
    date: "2026-09-12",
    checkIn: "08:24",
    checkOut: "18:40",
    durationLabel: "10j 16m",
    status: "telat",
  },
  {
    id: "a11",
    date: "2026-09-11",
    checkIn: "07:51",
    checkOut: "17:05",
    durationLabel: "9j 14m",
    status: "hadir",
  },
  {
    id: "a10",
    date: "2026-09-10",
    checkIn: null,
    checkOut: null,
    durationLabel: "Izin sakit",
    status: "izin",
  },
  {
    id: "a09",
    date: "2026-09-09",
    checkIn: "08:11",
    checkOut: "17:20",
    durationLabel: "9j 09m",
    status: "telat",
  },
  {
    id: "a06",
    date: "2026-09-06",
    checkIn: "07:47",
    checkOut: "17:02",
    durationLabel: "9j 15m",
    status: "hadir",
  },
];

export const MOCK_LEAVE_BALANCES: LeaveBalance[] = [
  { type: "cuti", label: "Cuti tahunan", remaining: 8, unit: "hari" },
  { type: "sakit", label: "Cuti sakit", remaining: 6, unit: "hari" },
  {
    type: "lembur",
    label: "Kuota lembur bulan ini",
    remaining: 12,
    unit: "jam",
  },
];

export const MOCK_LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: "l1",
    employeeId: "ess",
    type: "cuti",
    label: "Cuti tahunan · 3 hari",
    reason: "18 – 20 Sep 2026 · acara keluarga di Semarang",
    stage: "Tahap 1 dari 2",
    quota: "4 hari",
    decision: null,
    createdAt: "2026-09-10",
  },
];

// Approval yang masuk ke inbox manager/HR (role mss & hr)
export const MOCK_PENDING_APPROVALS: LeaveRequest[] = [
  {
    id: "p1",
    employeeId: "e-ds",
    type: "cuti",
    label: "Cuti tahunan · 3 hari — Dimas Saputra",
    reason: "18 – 20 Sep 2026 · acara keluarga di Semarang",
    stage: "Tahap 1 dari 2",
    quota: "4 hari",
    decision: null,
    createdAt: "2026-09-10",
  },
  {
    id: "p2",
    employeeId: "e-sa",
    type: "lembur",
    label: "Lembur 4 jam · 12 Sep — Sari Anggraini",
    reason: "Stock opname akhir periode, disetujui supervisor gudang",
    stage: "Tahap 1 dari 1",
    quota: "12 jam",
    decision: null,
    createdAt: "2026-09-12",
  },
  {
    id: "p3",
    employeeId: "e-ap",
    type: "dinas_luar",
    label: "Dinas luar · 2 hari — Ayu Permata",
    reason: "Kunjungan klien PT Sinar Abadi, Surabaya",
    stage: "Tahap 1 dari 2",
    quota: "—",
    decision: null,
    createdAt: "2026-09-11",
  },
];

export const MOCK_PAYSLIPS: Payslip[] = [
  {
    id: "ps-2026-08",
    period: "Agustus 2026",
    grossPay: 11500000,
    deductions: 2236250,
    netPay: 9263750,
  },
  {
    id: "ps-2026-07",
    period: "Juli 2026",
    grossPay: 11500000,
    deductions: 2236250,
    netPay: 9263750,
  },
  {
    id: "ps-2026-06",
    period: "Juni 2026",
    grossPay: 11000000,
    deductions: 2140000,
    netPay: 8860000,
  },
];

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n1",
    initials: "BP",
    title: "Cuti 18–20 Sep disetujui",
    subtitle: "Approver Bayu Pratama · tahap 2 HR",
    badge: "Approved",
    tone: "ok",
    createdAt: "2026-09-13",
  },
  {
    id: "n2",
    initials: "HR",
    title: "Slip gaji Agustus tersedia",
    subtitle: "Take home Rp 9.263.750",
    badge: "Baru",
    tone: "info",
    createdAt: "2026-09-01",
  },
  {
    id: "n3",
    initials: "OT",
    title: "Lembur 12 Sep menunggu",
    subtitle: "4 jam · Stock opname",
    badge: "Pending",
    tone: "warn",
    createdAt: "2026-09-12",
  },
];
