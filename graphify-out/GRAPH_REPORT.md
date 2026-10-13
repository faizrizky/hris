# Graph Report - HRIS  (2026-10-14)

## Corpus Check
- 191 files · ~115,235 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .example 1, .podspec 1)

## Summary
- 1057 nodes · 3827 edges · 114 communities (40 shown, 74 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `12ce2890`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- LeaveRequestScreen.tsx
- CutiFormCards.tsx
- index.tsx
- useTheme
- useLokasiKerja.ts
- PayslipCards.tsx
- mockApi.ts
- HrisApi
- erpnextApi.ts
- offlineQueue.ts
- package.json
- dependencies
- expo
- Docker Compose stack ERPNext dev
- eslint.config.js
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
- trustedTime.ts
- smoke.sh
- Autentikasi token API key:secret
- Administrator tidak punya record Employee
- seed.sh script
- ProfileEditScreen.tsx
- Panduan uji di HP
- types.ts
- tt
- App.tsx
- HrisClockModule.kt
- push.ts
- NavBar.tsx
- LoginScreen.tsx
- http.ts
- DocPreview
- session.tsx
- PrimaryButton.tsx

## God Nodes (most connected - your core abstractions)
1. `useTheme()` - 181 edges
2. `useT()` - 129 edges
3. `react` - 77 edges
4. `react-native` - 71 edges
5. `Palette` - 64 edges
6. `useSession()` - 59 edges
7. `Skeleton()` - 58 edges
8. `HrisApi` - 58 edges
9. `ErrorState()` - 54 edges
10. `kembali()` - 54 edges

## Surprising Connections (you probably didn't know these)
- `Server Script (docker/server-scripts)` --semantically_similar_to--> `Server Script hris_* (get_my_roles, get_colleagues, get_my_approver)`  [INFERRED] [semantically similar]
  docker/README.md → BACKLOG.md
- `EXPO_PUBLIC_API_BASE_URL` --shares_data_with--> `erpnextApi (integrasi fase 2)`  [INFERRED]
  docker/README.md → README.md
- `erpnextApi (integrasi fase 2)` --references--> `ERPNext v16`  [INFERRED]
  README.md → docker/README.md
- `App()` --calls--> `SessionProvider()`  [EXTRACTED]
  App.tsx → src/services/session.tsx
- `service scheduler` --conceptually_related_to--> `P3 Absensi`  [INFERRED]
  docker/docker-compose.yml → BACKLOG.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Seed, server scripts and smoke test flow** — docker_readme_seed, docker_readme_server_scripts, docker_readme_smoke_test, docker_readme_test_accounts [EXTRACTED 0.85]
- **ERPNext dev compose stack services** — docker_docker_compose_backend, docker_docker_compose_frontend, docker_docker_compose_websocket, docker_docker_compose_queue_workers, docker_docker_compose_scheduler, docker_docker_compose_db, docker_docker_compose_redis [EXTRACTED 0.95]
- **HrisApi contract with mock and ERPNext implementations** — readme_hrisapi_contract, readme_mock_api, readme_erpnext_api, readme_api_index_swap [EXTRACTED 0.95]

## Communities (114 total, 74 thin omitted)

### Community 0 - "LeaveRequestScreen.tsx"
Cohesion: 0.05
Nodes (81): expo-document-picker, useConfirm(), Cell, DatePickerCard(), FooterItem, makeStyles(), Props, makeStyles() (+73 more)

### Community 1 - "CutiFormCards.tsx"
Cohesion: 0.15
Nodes (21): ColleagueSheet(), makeStyles(), adalahIzinPenting(), CutiDetailCard(), CutiTypeCard(), HARI_MAKS, infoCuti(), IZIN_PENTING (+13 more)

### Community 2 - "index.tsx"
Cohesion: 0.09
Nodes (75): expo-linear-gradient, @expo/vector-icons, react, react-native, react-native-safe-area-context, react-native-svg, @react-navigation/native, ConfirmContext (+67 more)

### Community 3 - "useTheme"
Cohesion: 0.05
Nodes (131): Card(), makeStyles(), CreateSheet(), makeStyles(), DonutChart(), EmptyState(), makeStyles(), ErrorState() (+123 more)

### Community 4 - "useLokasiKerja.ts"
Cohesion: 0.28
Nodes (8): expo-location, IzinLokasi, jarakMeter(), keLokasi(), TerdekatKerja, useLokasiKerja(), AturanLokasi, LokasiCheckin

### Community 5 - "PayslipCards.tsx"
Cohesion: 0.26
Nodes (12): BULAN_ID, ID, KategoriLabel, Line(), makeStyles(), PayslipCompareCard(), PayslipHero(), PayslipHistoryCard() (+4 more)

### Community 6 - "mockApi.ts"
Cohesion: 0.08
Nodes (42): AppraisalRes, attendanceCorrections, clockState, documents, inbox, leaveRequests, pendingApprovals, EARNINGS_REGULER (+34 more)

### Community 8 - "erpnextApi.ts"
Cohesion: 0.04
Nodes (58): ambilInfoKeamanan(), ambilMenunggu(), ambilPerangkat(), ambilStatusJam(), AttendanceRow, BADGE_KEPUTUSAN, bentukPerangkat(), bersih() (+50 more)

### Community 9 - "offlineQueue.ts"
Cohesion: 0.29
Nodes (9): @react-native-async-storage/async-storage, useJumlahAntrean(), antre(), baca(), dengarkanAntrean(), hapusDariAntrean(), ItemAntrean, Pendengar (+1 more)

### Community 10 - "package.json"
Cohesion: 0.12
Nodes (15): main, name, private, version, @babel/core, babel-plugin-module-resolver, babel-preset-expo, expo-build-properties (+7 more)

### Community 11 - "dependencies"
Cohesion: 0.08
Nodes (25): dependencies, expo, expo-blur, expo-build-properties, expo-constants, expo-device, expo-document-picker, expo-file-system (+17 more)

### Community 12 - "expo"
Cohesion: 0.10
Nodes (19): package, permissions, projectId, expo, android, assetBundlePatterns, extra, ios (+11 more)

### Community 13 - "Docker Compose stack ERPNext dev"
Cohesion: 0.24
Nodes (12): service backend (gunicorn), service configurator, service create-site, image hris-erpnext:16 (pull_policy never), service db (MariaDB 11.8), service frontend (nginx, port 8080), service queue-short dan queue-long, redis-cache dan redis-queue (+4 more)

### Community 14 - "eslint.config.js"
Cohesion: 0.40
Nodes (4): { defineConfig }, expoConfig, eslint, eslint-config-expo

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

### Community 25 - "trustedTime.ts"
Cohesion: 0.20
Nodes (4): expo, Anchor, HrisClockNative, Native

### Community 26 - "smoke.sh"
Cohesion: 0.70
Nodes (4): call(), expect(), run_user(), smoke.sh script

### Community 27 - "Autentikasi token API key:secret"
Cohesion: 0.67
Nodes (3): Autentikasi token API key:secret, generate_keys method (perlu verifikasi v16), Autentikasi session cookie (CSRF)

### Community 30 - "ProfileEditScreen.tsx"
Cohesion: 0.11
Nodes (29): DateSheet(), makeStyles(), Props, HUBUNGAN, KELUARGA, LockedRow(), makeStyles(), NAMA_NIKAH (+21 more)

### Community 39 - "Panduan uji di HP"
Cohesion: 0.14
Nodes (13): Fase 0: Persiapan, Fase 1: Login dan sesi, Fase 2: Bahasa, Fase 3: Karyawan (rani), Fase 3b: Fitur lanjutan (rani, dewi, sari), Fase 4: Atasan (dewi), Fase 5: HR (sari) dan web, Fase 6: Zona waktu dinas (+5 more)

### Community 40 - "types.ts"
Cohesion: 0.06
Nodes (37): Props, CORRECTION_STATUS_LABEL, CORRECTION_STATUS_TONE, LEAVE_TYPE_LABEL, LEAVE_TYPE_TONE, OVERTIME_STATUS_LABEL, OVERTIME_STATUS_TONE, ActiveDevice (+29 more)

### Community 41 - "tt"
Cohesion: 0.10
Nodes (33): labelBahasa(), leaveDecisionBadge(), isi(), tt(), terjemahkan(), terjemahkanNotifikasi(), ambilDinas(), ambilKaryawanSaatIni() (+25 more)

### Community 47 - "App.tsx"
Cohesion: 0.33
Nodes (8): App(), expo-status-bar, ConfirmDialog(), ConfirmProvider(), makeStyles(), LanguageProvider(), RootNavigator(), ThemeProvider()

### Community 96 - "HrisClockModule.kt"
Cohesion: 0.17
Nodes (4): ExpoModulesCore, Foundation, HrisClockModule, HrisClockModule

### Community 104 - "push.ts"
Cohesion: 0.33
Nodes (5): expo-constants, expo-device, expo-notifications, TokenPush, tokenPushSaatIni()

### Community 108 - "NavBar.tsx"
Cohesion: 0.19
Nodes (12): expo-blur, GlassPill(), Props, styles, makeStyles(), NavBar(), Props, AttendanceStack() (+4 more)

### Community 109 - "LoginScreen.tsx"
Cohesion: 0.29
Nodes (11): LanguagePicker(), RadialGlow(), LoginScreen(), makeStyles(), makeStyles(), MenuRow(), ProfileScreen(), Stat() (+3 more)

### Community 110 - "http.ts"
Cohesion: 0.27
Nodes (11): ALAMAT_BAWAAN, encode(), get(), Params, pesanServer(), post(), put(), request() (+3 more)

### Community 111 - "DocPreview"
Cohesion: 0.33
Nodes (8): expo-file-system, expo-sharing, DocPreview(), makeStyles(), unduhBerkas(), adalahGambar(), bukaLampiran(), simpanLampiran()

### Community 112 - "session.tsx"
Cohesion: 0.36
Nodes (8): useBahasa(), setSessionExpiredHandler(), jumlahAntrean(), ambilTokenPush(), SessionContext, SessionContextValue, SessionProvider(), muatJangkar()

### Community 113 - "PrimaryButton.tsx"
Cohesion: 0.50
Nodes (3): PrimaryButton(), Props, styles

## Knowledge Gaps
- **30 isolated node(s):** `ExpoModulesCore`, `Foundation`, `@expo/metro-runtime`, `expo-build-properties`, `react-native-screens` (+25 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 405 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **74 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HrisApi` connect `HrisApi` to `erpnextApi.ts`, `index.tsx`, `types.ts`, `mockApi.ts`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **What connects `ExpoModulesCore`, `Foundation`, `@expo/metro-runtime` to the rest of the system?**
  _30 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `LeaveRequestScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.054945054945054944 - nodes in this community are weakly interconnected._
- **Why does `useTheme()` connect `useTheme` to `LeaveRequestScreen.tsx`, `CutiFormCards.tsx`, `index.tsx`, `PayslipCards.tsx`, `NavBar.tsx`, `LoginScreen.tsx`, `App.tsx`, `DocPreview`, `PrimaryButton.tsx`, `ProfileEditScreen.tsx`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Should `index.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08890193775689958 - nodes in this community are weakly interconnected._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Should `useTheme` be split into smaller, more focused modules?**
  _Cohesion score 0.05411323115420707 - nodes in this community are weakly interconnected._