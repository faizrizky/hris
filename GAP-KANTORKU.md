# Gap fitur KantorKu vs HRIS kita

Sumber: https://kantorku.id/pricing/ (diambil 2026-10-15). Halaman tidak menandai paket per item rinci, jadi pemetaan paket hanya dari kartu ringkasan.

Pembanding "web kita" = ERPNext + HRMS v16 dengan custom doctype/server script di `docker/`. "Mobile kita" = app Expo di repo ini.

Legenda: ✅ ada · 🟡 sebagian · ❌ belum ada. "Bawaan" = ada di ERPNext/HRMS tapi belum kita konfigurasikan atau hubungkan ke mobile (dari pengetahuan HRMS v16 dan `docker/seed/seed.py`, belum dicek ke instance yang berjalan).

## Mobile (ESS App)

| Fitur KantorKu | Kita |
|---|---|
| Check-in/out | ✅ GPS, geofence, face, offline |
| Pengajuan cuti | ✅ |
| Pengajuan reimbursement | ❌ (hanya biaya di form dinas luar) |
| Pengajuan cash advance | ❌ |
| Slip gaji | ✅ plus ringkasan PPh21/BPJS |
| Mobile learning | ❌ |
| Approval atasan | ✅ cuti, lembur, dinas, WFH, koreksi, dokumen, ubah profil |
| Pengumuman | ✅ |
| Notifikasi | 🟡 in-app jalan; push menunggu dev build + akun Apple Developer |
| 2FA, OTP, autentikasi perangkat | 🟡 ganti password, sesi aktif, logout perangkat lain; 2FA/OTP belum |
| Lembur, dinas luar, WFH, koreksi absen | ✅ (nilai tambah, tidak ada di halaman pricing) |
| Appraisal dan feedback | 🟡 belum 360° penuh |

## Web (admin/HR)

### Core HR
| Fitur | Kita |
|---|---|
| Database karyawan terpusat | ✅ |
| ID karyawan otomatis | ✅ bawaan |
| Field data custom | ✅ Custom Field |
| Riwayat promosi/demosi/mutasi | 🟡 bawaan |
| Pengingat kontrak habis | ❌ |
| Dokumen karyawan | ✅ Dokumen Digital + verifikasi HR |
| Multi-company/cabang | 🟡 bawaan |
| Struktur organisasi + bagan visual | 🟡 bawaan |
| Job architecture | ❌ |
| Onboarding | 🟡 bawaan, tanpa UI mobile |
| Offboarding + exit interview | 🟡 bawaan |
| Serah terima tugas, pengembalian aset | 🟡 bawaan |

### Workforce Management
| Fitur | Kita |
|---|---|
| Shift per kantor/cabang/divisi | ✅ Shift Type + Shift Location |
| Penugasan shift massal | ✅ bawaan |
| Request ganti shift | 🟡 bawaan, belum di mobile |
| Task management + insentif | ❌ |
| Absensi GPS dan face | ✅ |
| Fingerprint, palm | ❌ |
| Integrasi hardware real-time | ❌ |
| Kebijakan custom + cuti bersama | ✅ Holiday List, Leave Policy |
| Sanksi (SP, potong cuti/gaji) | ❌ |
| Cuti: pengajuan, saldo, kalender | ✅ |
| Lembur: pengajuan + approval | ✅ |
| Lembur: kebijakan/batas, rencana, input mundur | ❌ |
| On-call dan standby | ❌ |

### Payroll, Finance & Benefits
| Fitur | Kita |
|---|---|
| Gaji, THR | 🟡 THR belum |
| Tunjangan, potongan, BPJS, pajak | ✅ |
| Penggajian terjadwal | ❌ |
| Slip gaji digital | ✅ |
| Laporan BPJS dan pajak otomatis | ❌ |
| Reimbursement | 🟡 bawaan Expense Claim |
| Cash advance | 🟡 bawaan Employee Advance |
| Loan | ❌ (butuh app Lending) |

### Performance Management
| Fitur | Kita |
|---|---|
| OKR/KPI cascade + monitoring | 🟡 Goal/KRA di seed saja |
| Review 360° | 🟡 |
| 9-box | ❌ |
| Feedback instan + apresiasi | ❌ |
| Form custom, akses privat | 🟡 bawaan |
| Bonus | 🟡 bawaan Additional Salary |

### Learning & Development
| Fitur | Kita |
|---|---|
| LMS, skill mapping, reminder | ❌ (Frappe LMS belum dipasang) |
| Asesmen, kuis, rencana pengembangan | ❌ |
| Sertifikat digital, kedaluwarsa, compliance | ❌ |

### General & Employee Services
| Fitur | Kita |
|---|---|
| Pengumuman umum, bertarget, terjadwal | ✅ |
| Akses berdasarkan role/organisasi/level | ✅ |
| Workflow approval multi-layer custom | 🟡 satu level (atasan langsung) |
| Dashboard dan insight HR | ❌ |
| Laporan (karyawan, absensi, payroll, kinerja, turnover) | 🟡 Report bawaan |
| MFA web | 🟡 2FA bawaan Frappe belum dinyalakan |

## Prioritas

1. Murah (tinggal konfigurasi + layar mobile): reimbursement, cash advance, bonus, onboarding/offboarding, ganti shift, promosi/mutasi.
2. Menengah: dashboard HR, sanksi, on-call, THR + penggajian terjadwal, laporan BPJS/pajak, workflow multi-layer, 2FA/OTP.
3. Besar (dari nol): LMS + sertifikasi, 9-box, OKR lengkap, loan, fingerprint/palm + integrasi alat.
