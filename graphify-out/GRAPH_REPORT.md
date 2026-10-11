# Graph Report - HRIS  (2026-10-12)

## Corpus Check
- 167 files · ~101,978 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 2, .example 1)

## Summary
- 952 nodes · 3594 edges · 90 communities (31 shown, 59 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `aa225579`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- LeaveRequestScreen.tsx
- AttendanceCorrectionHistoryScreen.tsx
- ThemeContext.tsx
- RootNavigator.tsx
- HomeScreen.tsx
- http.ts
- types.ts
- HrisApi
- erpnextApi.ts
- ProfilePasswordScreen.tsx
- package.json
- dependencies
- expo
- Docker Compose stack ERPNext dev
- useTheme
- seed.py
- HRIS Mobile (Fase 1 Mocking)
- Menjalankan di Android tanpa Play Store
- Backlog migrasi mock ke ERPNext
- build-image.sh
- ERPNext + Frappe HR instance untuk pengembangan lokal
- devDependencies
- erpnextApi (integrasi fase 2)
- scripts
- tsconfig.json
- eslint.config.js
- smoke.sh
- Autentikasi token API key:secret
- Administrator tidak punya record Employee
- seed.sh script
- index.tsx
- Panduan uji di HP
- push.ts
- tt
- Colleague

## God Nodes (most connected - your core abstractions)
1. `useTheme()` - 177 edges
2. `useT()` - 125 edges
3. `react` - 73 edges
4. `react-native` - 68 edges
5. `Palette` - 62 edges
6. `useSession()` - 57 edges
7. `Skeleton()` - 56 edges
8. `HrisApi` - 54 edges
9. `ErrorState()` - 52 edges
10. `kembali()` - 52 edges

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
- **Seed, server scripts and smoke test flow** — docker_readme_seed, docker_readme_server_scripts, docker_readme_smoke_test, docker_readme_test_accounts [EXTRACTED 0.85]
- **ERPNext dev compose stack services** — docker_docker_compose_backend, docker_docker_compose_frontend, docker_docker_compose_websocket, docker_docker_compose_queue_workers, docker_docker_compose_scheduler, docker_docker_compose_db, docker_docker_compose_redis [EXTRACTED 0.95]
- **HrisApi contract with mock and ERPNext implementations** — readme_hrisapi_contract, readme_mock_api, readme_erpnext_api, readme_api_index_swap [EXTRACTED 0.95]

## Communities (90 total, 59 thin omitted)

### Community 0 - "LeaveRequestScreen.tsx"
Cohesion: 0.06
Nodes (68): DatePickerCard(), FooterItem, makeStyles(), makeStyles(), PickerSheet(), ATTENDANCE_STATUS_LABEL, bahasaAktif(), BULAN_ID (+60 more)

### Community 1 - "AttendanceCorrectionHistoryScreen.tsx"
Cohesion: 0.12
Nodes (29): DonutChart(), ATTENDANCE_STATUS_TONE, CORRECTION_STATUS_LABEL, CORRECTION_STATUS_TONE, OVERTIME_STATUS_LABEL, OVERTIME_STATUS_TONE, AttendanceCorrectionHistoryScreen(), CHIPS (+21 more)

### Community 2 - "ThemeContext.tsx"
Cohesion: 0.06
Nodes (60): react, react-native, react-native-svg, ConfirmContext, ConfirmDialog(), ConfirmFn, ConfirmOptions, IKON (+52 more)

### Community 3 - "RootNavigator.tsx"
Cohesion: 0.08
Nodes (77): expo-linear-gradient, @expo/vector-icons, react-native-safe-area-context, @react-navigation/native, useConfirm(), ErrorState(), RadialGlow(), EASE (+69 more)

### Community 4 - "HomeScreen.tsx"
Cohesion: 0.09
Nodes (50): expo-sharing, Card(), makeStyles(), EmptyState(), makeStyles(), LineIcon(), bungkus(), bungkusSlot() (+42 more)

### Community 5 - "http.ts"
Cohesion: 0.24
Nodes (12): ambilStatusJam(), kirimCheckin(), lampirkanSemua(), unggahBerkas(), encode(), get(), Params, pesanServer() (+4 more)

### Community 6 - "types.ts"
Cohesion: 0.06
Nodes (57): AppraisalRes, attendanceCorrections, clockState, documents, inbox, leaveRequests, mockApi, pendingApprovals (+49 more)

### Community 8 - "erpnextApi.ts"
Cohesion: 0.05
Nodes (47): ambilDokumen(), ambilInfoKeamanan(), ambilPerangkat(), AttendanceRow, BADGE_KEPUTUSAN, bentukDokumen(), bentukPerangkat(), bersih() (+39 more)

### Community 9 - "ProfilePasswordScreen.tsx"
Cohesion: 0.56
Nodes (7): makeStyles(), ProfilePasswordScreen(), labelKekuatan(), skorPassword(), syaratPassword, toneKekuatan(), TOTAL_SYARAT

### Community 10 - "package.json"
Cohesion: 0.10
Nodes (20): main, name, private, version, @babel/core, babel-plugin-module-resolver, babel-preset-expo, expo (+12 more)

### Community 11 - "dependencies"
Cohesion: 0.08
Nodes (24): dependencies, expo, expo-blur, expo-build-properties, expo-constants, expo-device, expo-document-picker, expo-file-system (+16 more)

### Community 12 - "expo"
Cohesion: 0.13
Nodes (14): package, expo, android, assetBundlePatterns, ios, name, orientation, plugins (+6 more)

### Community 13 - "Docker Compose stack ERPNext dev"
Cohesion: 0.24
Nodes (12): service backend (gunicorn), service configurator, service create-site, image hris-erpnext:16 (pull_policy never), service db (MariaDB 11.8), service frontend (nginx, port 8080), service queue-short dan queue-long, redis-cache dan redis-queue (+4 more)

### Community 14 - "useTheme"
Cohesion: 0.11
Nodes (47): ColleagueSheet(), makeStyles(), makeStyles(), PdfButton(), makeStyles(), SegmentedControl(), Load, useLoad() (+39 more)

### Community 15 - "seed.py"
Cohesion: 0.15
Nodes (3): ensure_roles(), log(), make()

### Community 16 - "HRIS Mobile (Fase 1 Mocking)"
Cohesion: 0.20
Nodes (10): Employee Checkin doctype, Verifikasi wajah ML Kit dan lokasi (fase belakangan), P3 Absensi, service scheduler, Face recognition ML Kit, Struktur folder src (navigation, screens, services, theme, components), HRIS Mobile (Fase 1 Mocking), Fitur Must-have (clock, absensi, cuti, approval, slip gaji, profil) (+2 more)

### Community 17 - "Menjalankan di Android tanpa Play Store"
Cohesion: 0.50
Nodes (3): A. Cepat: Expo Go (tanpa build), B. Aplikasi sendiri (APK) lewat EAS Build — untuk push dan pemakaian harian, Menjalankan di Android tanpa Play Store

### Community 18 - "Backlog migrasi mock ke ERPNext"
Cohesion: 0.22
Nodes (8): Backlog migrasi mock ke ERPNext, Leave Application doctype, P1 Menyelesaikan alur Cuti, P2 Data HR, P4 Payroll, P5 Lainnya (lembur, dinas luar, appraisal, notifikasi, profil, keamanan), Server Script hris_* (get_my_roles, get_colleagues, get_my_approver), Teknis yang menunggu

### Community 19 - "build-image.sh"
Cohesion: 0.22
Nodes (6): build-image.sh script, apps.json, VS Code Devcontainer (ditolak, terlalu rumit), frappe/frappe_docker repo resmi, hrms (Frappe HR), pwd.yml (ditolak, tidak bisa tambah app)

### Community 20 - "ERPNext + Frappe HR instance untuk pengembangan lokal"
Cohesion: 0.28
Nodes (9): ERPNext + Frappe HR instance untuk pengembangan lokal, Akses dari HP lewat Expo (IP LAN, bukan localhost), EXPO_PUBLIC_API_BASE_URL, FRAPPE_SITE_NAME_HEADER, Seed data uji (seed.sh), Server Script (docker/server-scripts), Smoke test endpoint (smoke.sh), Akun uji rani, mss.test, hr.test (+1 more)

### Community 21 - "devDependencies"
Cohesion: 0.25
Nodes (8): devDependencies, @babel/core, babel-plugin-module-resolver, babel-preset-expo, eslint, eslint-config-expo, @types/react, typescript

### Community 22 - "erpnextApi (integrasi fase 2)"
Cohesion: 0.33
Nodes (6): erpnextApi, HrisApi interface (src/services/types.ts), ERPNext v16, erpnextApi (integrasi fase 2), HrisApi interface (kontrak data), mockApi (implementasi data dummy)

### Community 23 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, android, ios, lint, start, typecheck, web

### Community 24 - "tsconfig.json"
Cohesion: 0.29
Nodes (6): expo/tsconfig.base, compilerOptions, paths, strict, extends, include

### Community 25 - "eslint.config.js"
Cohesion: 0.40
Nodes (4): { defineConfig }, expoConfig, eslint, eslint-config-expo

### Community 26 - "smoke.sh"
Cohesion: 0.70
Nodes (4): call(), expect(), run_user(), smoke.sh script

### Community 27 - "Autentikasi token API key:secret"
Cohesion: 0.67
Nodes (3): Autentikasi token API key:secret, generate_keys method (perlu verifikasi v16), Autentikasi session cookie (CSRF)

### Community 30 - "index.tsx"
Cohesion: 0.06
Nodes (58): App(), @react-navigation/bottom-tabs, ConfirmProvider(), CreateSheet(), makeStyles(), DateSheet(), makeStyles(), FloatingTabBar() (+50 more)

### Community 39 - "Panduan uji di HP"
Cohesion: 0.15
Nodes (12): Fase 0: Persiapan, Fase 1: Login dan sesi, Fase 2: Bahasa, Fase 3: Karyawan (rani), Fase 4: Atasan (dewi), Fase 5: HR (sari) dan web, Fase 6: Zona waktu dinas, Fase 7: Galat dan batas (+4 more)

### Community 40 - "push.ts"
Cohesion: 0.33
Nodes (5): expo-constants, expo-device, expo-notifications, TokenPush, tokenPushSaatIni()

### Community 41 - "tt"
Cohesion: 0.10
Nodes (31): labelBahasa(), isi(), tt(), terjemahkan(), terjemahkanNotifikasi(), ambilDinas(), ambilKaryawanSaatIni(), ambilLembur() (+23 more)

## Knowledge Gaps
- **29 isolated node(s):** `@expo/metro-runtime`, `expo`, `expo-build-properties`, `react-native-screens`, `@babel/core` (+24 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 356 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **59 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HrisApi` connect `HrisApi` to `erpnextApi.ts`, `RootNavigator.tsx`, `types.ts`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **What connects `@expo/metro-runtime`, `expo`, `expo-build-properties` to the rest of the system?**
  _29 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `LeaveRequestScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06392405063291139 - nodes in this community are weakly interconnected._
- **Why does `useTheme()` connect `useTheme` to `LeaveRequestScreen.tsx`, `AttendanceCorrectionHistoryScreen.tsx`, `ThemeContext.tsx`, `RootNavigator.tsx`, `HomeScreen.tsx`, `ProfilePasswordScreen.tsx`, `index.tsx`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Should `AttendanceCorrectionHistoryScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12310606060606061 - nodes in this community are weakly interconnected._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Should `ThemeContext.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06022408963585434 - nodes in this community are weakly interconnected._