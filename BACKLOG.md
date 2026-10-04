# Backlog migrasi mock ke ERPNext

Status per 2026-10-04. Sumber kebenaran: method di `HrisApi` ([src/services/types.ts](src/services/types.ts)) yang belum di-override `erpnextApi`.

## Sudah asli
- Login, logout, karyawan saat ini, role (`hris_get_my_roles`), sesi kedaluwarsa
- Saldo cuti, daftar pengajuan cuti milik sendiri
- Rekan sedepartemen untuk delegasi (`hris_get_colleagues`)
- Approver cuti (`hris_get_my_approver`)
- Kirim pengajuan cuti (hanya Tahunan dan Sakit; belum teruji di perangkat)

## Masih mock, urut prioritas

### P1: menyelesaikan alur Cuti
- [ ] 2b: Alur approval di form memakai approver asli (kini masih Bayu/Dinda); tampilkan galat kirim ke pengguna
- [ ] Jenis cuti "Melahirkan" dan "Izin penting" belum punya Leave Type di ERPNext (kini terkirim sebagai Cuti Tahunan)
- [ ] `delegateName` di daftar cuti: ambil `custom_delegate_name`
- [ ] 2c: `getPendingApprovals` + `decideLeaveRequest` untuk `mss` (filter `leave_approver`, keputusan satu PUT `status` + `docstatus:1`), plus "Perlu persetujuan" di Beranda
- [ ] `employeeJobTitle` di daftar menunggu: pakai `custom_designation`

### P2: data HR
- [ ] `getStaffDirectory`, `getEmploymentSummary`: HR bisa baca semua Employee; `mss` hanya bawahan langsung, butuh Server Script (User Permission membatasi)
- [ ] Kartu Employment Status di Beranda, dan angka "128 karyawan aktif" (hardcode)
- [ ] Layar Absensi Kry (`StaffAttendance*`): Attendance + Leave Application per hari

### P3: Absensi
- [ ] `getClockState`, `clockIn`, `clockOut`: Employee Checkin (kirim `time` WIB; izin permlevel 1 sudah di seed)
- [ ] `getAttendanceHistory`: Attendance milik sendiri (hanya baca)
- [ ] `submitAttendanceCorrection`, `getAttendanceCorrections`: doctype Attendance Request
- [ ] Statistik Beranda (kehadiran %, terlambat, jam lembur) dihitung dari data asli
- [ ] Verifikasi wajah (identity matching, ML Kit) dan lokasi: fase belakangan

### P4: Payroll
- [ ] `getPayslips`: Salary Slip milik sendiri (rani sudah bisa baca)
- [ ] `getTaxSummary`: PPh21/BPJS belum ada lokalisasi Indonesia di ERPNext; perlu keputusan sumber data

### P5: lainnya
- [ ] `getOvertimes`, lembur di form dan approval: periksa Overtime Slip di hrms v16
- [ ] Dinas luar: Travel Request, Employee Advance, Expense Claim
- [ ] `getAppraisal`: doctype Appraisal
- [ ] `getFeed`, `getNotificationInbox`, `markNotificationsRead`: Notification Log atau custom
- [ ] Profil: `getPersonalProfile`, `savePersonalProfile`, dokumen (File attachment)
- [ ] Keamanan: `changePassword`, `setSecurityToggle`, `logoutOtherDevices`

## Teknis yang menunggu
- [ ] Uji POST form-encoded ke `Leave Application` di perangkat (kini belum dicoba)
- [ ] `inisial(null)` bila nama approver kosong
- [ ] Seed dari nol (`down -v`) belum diuji untuk skrip dan field baru
- [ ] Waktu Employee Checkin dari klien tidak divalidasi server
- [ ] Rani bisa melihat nama semua User (`GET /api/resource/User`)
- [ ] Scheduler aktif, tapi auto attendance dari checkin belum diuji
- [ ] Uji di HP fisik (ATS iOS / cleartext Android untuk build non-Expo Go)
