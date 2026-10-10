# Graph Report - HRIS  (2026-10-10)

## Corpus Check
- 96 files · ~61,297 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 2, .example 1)

## Summary
- 694 nodes · 2318 edges · 39 communities (27 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.88)
- Token cost: 96,738 input · 0 output

## Community Hubs (Navigation)
- Komponen Pemilih Tanggal
- Navigasi dan Aplikasi Utama
- Komponen UI Bersama
- Slip Gaji dan Aturan Lembur
- Label Status dan Grafik
- Animasi Reveal
- Data Mock API
- Kontrak HrisApi
- Integrasi ERPNext
- Tipe Domain
- Package dan Dependensi
- Dependensi Expo
- Konfigurasi Expo
- Layanan Docker Compose
- Unggah Dokumen Profil
- Skrip Seed Python
- Absensi dan Wajah (P3)
- Clock In/Out dan HTTP
- Backlog Migrasi
- Build Image Docker
- ERPNext Lokal dan Akses HP
- Dev Dependencies
- Titik Ganti API
- Skrip npm
- Konfigurasi TypeScript
- Konfigurasi ESLint
- Smoke Test
- Autentikasi API
- Employee dan User
- Skrip seed.sh
- Sesi dan Employee

## God Nodes (most connected - your core abstractions)
1. `useTheme()` - 144 edges
2. `react` - 58 edges
3. `useSession()` - 56 edges
4. `react-native` - 53 edges
5. `Palette` - 49 edges
6. `Skeleton()` - 46 edges
7. `LineIcon()` - 40 edges
8. `HrisApi` - 37 edges
9. `@expo/vector-icons` - 35 edges
10. `react-native-safe-area-context` - 34 edges

## Surprising Connections (you probably didn't know these)
- `Server Script (docker/server-scripts)` --semantically_similar_to--> `Server Script hris_* (get_my_roles, get_colleagues, get_my_approver)`  [INFERRED] [semantically similar]
  docker/README.md → BACKLOG.md
- `EXPO_PUBLIC_API_BASE_URL` --shares_data_with--> `erpnextApi (integrasi fase 2)`  [INFERRED]
  docker/README.md → README.md
- `erpnextApi (integrasi fase 2)` --references--> `ERPNext v16`  [INFERRED]
  README.md → docker/README.md
- `service scheduler` --conceptually_related_to--> `P3 Absensi`  [INFERRED]
  docker/docker-compose.yml → BACKLOG.md
- `App()` --calls--> `ConfirmProvider()`  [EXTRACTED]
  App.tsx → src/components/ConfirmDialog.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **ERPNext dev compose stack services** — docker_docker_compose_backend, docker_docker_compose_frontend, docker_docker_compose_websocket, docker_docker_compose_queue_workers, docker_docker_compose_scheduler, docker_docker_compose_db, docker_docker_compose_redis [EXTRACTED 0.95]
- **HrisApi contract with mock and ERPNext implementations** — readme_hrisapi_contract, readme_mock_api, readme_erpnext_api, readme_api_index_swap [EXTRACTED 0.95]
- **Seed, server scripts and smoke test flow** — docker_readme_seed, docker_readme_server_scripts, docker_readme_smoke_test, docker_readme_test_accounts [EXTRACTED 0.85]

## Communities (39 total, 12 thin omitted)

### Community 0 - "Komponen Pemilih Tanggal"
Cohesion: 0.06
Nodes (73): @expo/vector-icons, Cell, DatePickerCard(), FooterItem, HARI_PENDEK, makeStyles(), Props, LineIcon() (+65 more)

### Community 1 - "Navigasi dan Aplikasi Utama"
Cohesion: 0.06
Nodes (66): App(), expo-linear-gradient, expo-status-bar, react-native-safe-area-context, @react-navigation/bottom-tabs, @react-navigation/native, ConfirmProvider(), useConfirm() (+58 more)

### Community 2 - "Komponen UI Bersama"
Cohesion: 0.07
Nodes (57): react, react-native, react-native-svg, ColleagueSheet(), makeStyles(), ConfirmContext, ConfirmDialog(), ConfirmFn (+49 more)

### Community 3 - "Slip Gaji dan Aturan Lembur"
Cohesion: 0.11
Nodes (43): makeStyles(), PdfButton(), Skeleton(), BATAS_LEMBUR_JAM, UPAH_LEMBUR_PER_JAM, OVERTIME_STATUS_LABEL, OVERTIME_STATUS_TONE, AppraisalScreen() (+35 more)

### Community 4 - "Label Status dan Grafik"
Cohesion: 0.10
Nodes (38): DonutChart(), ATTENDANCE_STATUS_TONE, CORRECTION_STATUS_LABEL, CORRECTION_STATUS_TONE, DOC_CATEGORY_LABEL, DOC_STATUS_LABEL, DOC_STATUS_TONE, LEAVE_TYPE_LABEL (+30 more)

### Community 5 - "Animasi Reveal"
Cohesion: 0.10
Nodes (35): Card(), makeStyles(), bungkus(), bungkusSlot(), EASE, LAYOUT_KEYS, ListSlot, Reveal() (+27 more)

### Community 6 - "Data Mock API"
Cohesion: 0.10
Nodes (32): attendanceCorrections, clockState, documents, inbox, leaveRequests, pendingApprovals, EARNINGS_REGULER, MOCK_APPRAISAL (+24 more)

### Community 8 - "Integrasi ERPNext"
Cohesion: 0.08
Nodes (28): ambilKaryawanSaatIni(), ambilMenunggu(), ambilMilikSendiri(), ambilRole(), AttendanceRow, BADGE_KEPUTUSAN, bentukPengajuan(), bentukStaff() (+20 more)

### Community 9 - "Tipe Domain"
Cohesion: 0.10
Nodes (20): Props, ActiveDevice, Appraisal, AttendanceCorrectionRequest, AttendanceRecord, Colleague, DocCategory, EmergencyContact (+12 more)

### Community 10 - "Package dan Dependensi"
Cohesion: 0.11
Nodes (17): main, name, private, version, @babel/core, babel-plugin-module-resolver, babel-preset-expo, expo (+9 more)

### Community 11 - "Dependensi Expo"
Cohesion: 0.11
Nodes (18): dependencies, expo, expo-blur, expo-document-picker, expo-image-picker, expo-linear-gradient, @expo/metro-runtime, expo-status-bar (+10 more)

### Community 12 - "Konfigurasi Expo"
Cohesion: 0.13
Nodes (14): package, expo, android, assetBundlePatterns, ios, name, orientation, plugins (+6 more)

### Community 13 - "Layanan Docker Compose"
Cohesion: 0.24
Nodes (12): service backend (gunicorn), service configurator, service create-site, image hris-erpnext:16 (pull_policy never), service db (MariaDB 11.8), service frontend (nginx, port 8080), service queue-short dan queue-long, redis-cache dan redis-queue (+4 more)

### Community 14 - "Unggah Dokumen Profil"
Cohesion: 0.27
Nodes (11): DateSheet(), makeStyles(), Berkas, CONTOH, KATEGORI, makeStyles(), ProfileUploadScreen(), ekstensiDari() (+3 more)

### Community 15 - "Skrip Seed Python"
Cohesion: 0.20
Nodes (3): ensure_roles(), log(), make()

### Community 16 - "Absensi dan Wajah (P3)"
Cohesion: 0.20
Nodes (10): Employee Checkin doctype, Verifikasi wajah ML Kit dan lokasi (fase belakangan), P3 Absensi, service scheduler, Face recognition ML Kit, Struktur folder src (navigation, screens, services, theme, components), HRIS Mobile (Fase 1 Mocking), Fitur Must-have (clock, absensi, cuti, approval, slip gaji, profil) (+2 more)

### Community 17 - "Clock In/Out dan HTTP"
Cohesion: 0.31
Nodes (9): ambilStatusJam(), kirimCheckin(), sekarangWib(), encode(), get(), Params, post(), put() (+1 more)

### Community 18 - "Backlog Migrasi"
Cohesion: 0.22
Nodes (8): Backlog migrasi mock ke ERPNext, Leave Application doctype, P1 Menyelesaikan alur Cuti, P2 Data HR, P4 Payroll, P5 Lainnya (lembur, dinas luar, appraisal, notifikasi, profil, keamanan), Server Script hris_* (get_my_roles, get_colleagues, get_my_approver), Teknis yang menunggu

### Community 19 - "Build Image Docker"
Cohesion: 0.22
Nodes (6): build-image.sh script, apps.json, VS Code Devcontainer (ditolak, terlalu rumit), frappe/frappe_docker repo resmi, hrms (Frappe HR), pwd.yml (ditolak, tidak bisa tambah app)

### Community 20 - "ERPNext Lokal dan Akses HP"
Cohesion: 0.28
Nodes (9): ERPNext + Frappe HR instance untuk pengembangan lokal, Akses dari HP lewat Expo (IP LAN, bukan localhost), EXPO_PUBLIC_API_BASE_URL, FRAPPE_SITE_NAME_HEADER, Seed data uji (seed.sh), Server Script (docker/server-scripts), Smoke test endpoint (smoke.sh), Akun uji rani, mss.test, hr.test (+1 more)

### Community 21 - "Dev Dependencies"
Cohesion: 0.25
Nodes (8): devDependencies, @babel/core, babel-plugin-module-resolver, babel-preset-expo, eslint, eslint-config-expo, @types/react, typescript

### Community 22 - "Titik Ganti API"
Cohesion: 0.33
Nodes (6): erpnextApi, HrisApi interface (src/services/types.ts), ERPNext v16, erpnextApi (integrasi fase 2), HrisApi interface (kontrak data), mockApi (implementasi data dummy)

### Community 23 - "Skrip npm"
Cohesion: 0.29
Nodes (7): scripts, android, ios, lint, start, typecheck, web

### Community 24 - "Konfigurasi TypeScript"
Cohesion: 0.29
Nodes (6): expo/tsconfig.base, compilerOptions, paths, strict, extends, include

### Community 25 - "Konfigurasi ESLint"
Cohesion: 0.40
Nodes (4): { defineConfig }, expoConfig, eslint, eslint-config-expo

### Community 26 - "Smoke Test"
Cohesion: 0.83
Nodes (3): call(), run_user(), smoke.sh script

### Community 27 - "Autentikasi API"
Cohesion: 0.67
Nodes (3): Autentikasi token API key:secret, generate_keys method (perlu verifikasi v16), Autentikasi session cookie (CSRF)

## Knowledge Gaps
- **28 isolated node(s):** `@expo/metro-runtime`, `expo`, `react-native-screens`, `@babel/core`, `@types/react` (+23 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 233 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useTheme()` connect `Slip Gaji dan Aturan Lembur` to `Komponen Pemilih Tanggal`, `Navigasi dan Aplikasi Utama`, `Komponen UI Bersama`, `Label Status dan Grafik`, `Animasi Reveal`, `Unggah Dokumen Profil`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **What connects `@expo/metro-runtime`, `expo`, `react-native-screens` to the rest of the system?**
  _28 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Komponen Pemilih Tanggal` be split into smaller, more focused modules?**
  _Cohesion score 0.06162464985994398 - nodes in this community are weakly interconnected._
- **Why does `HrisApi` connect `Kontrak HrisApi` to `Integrasi ERPNext`, `Tipe Domain`, `Label Status dan Grafik`, `Data Mock API`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Should `Navigasi dan Aplikasi Utama` be split into smaller, more focused modules?**
  _Cohesion score 0.06288568909785483 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Komponen UI Bersama` to `Komponen Pemilih Tanggal`, `Navigasi dan Aplikasi Utama`, `Slip Gaji dan Aturan Lembur`, `Label Status dan Grafik`, `Animasi Reveal`, `Package dan Dependensi`, `Unggah Dokumen Profil`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Should `Komponen UI Bersama` be split into smaller, more focused modules?**
  _Cohesion score 0.0683526999316473 - nodes in this community are weakly interconnected._