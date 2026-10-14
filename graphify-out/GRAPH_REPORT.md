# Graph Report - HRIS  (2026-10-14)

## Corpus Check
- 205 files · ~125,166 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 2, .podspec 2, .example 1)

## Summary
- 1147 nodes · 4059 edges · 120 communities (40 shown, 80 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e8c423fc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ProfileUploadScreen.tsx
- HrisClockModule.swift
- useTheme
- PayslipCards.tsx
- ProfilePhotoScreen.tsx
- CutiFormCards.tsx
- mockApi.ts
- HrisApi
- erpnextApi.ts
- LeaveRequestScreen.tsx
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
- smoke.sh
- Autentikasi token API key:secret
- Administrator tidak punya record Employee
- seed.sh script
- index.tsx
- Panduan uji di HP
- types.ts
- tt
- ProfileScreen.tsx
- HrisFaceModule.kt
- offlineQueue.ts
- ConfirmDialog.tsx
- HomeScreen.tsx
- http.ts
- LineIcon
- ProfileEditScreen.tsx
- face_lib.py
- push.ts
- ThemeContext.tsx

## God Nodes (most connected - your core abstractions)
1. `useTheme()` - 185 edges
2. `useT()` - 136 edges
3. `react` - 80 edges
4. `react-native` - 73 edges
5. `Palette` - 67 edges
6. `useSession()` - 61 edges
7. `HrisApi` - 61 edges
8. `Skeleton()` - 58 edges
9. `kembali()` - 58 edges
10. `ErrorState()` - 54 edges

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

## Communities (120 total, 80 thin omitted)

### Community 0 - "ProfileUploadScreen.tsx"
Cohesion: 0.20
Nodes (14): expo-document-picker, DateSheet(), makeStyles(), Props, Berkas, CONTOH, KATEGORI, makeStyles() (+6 more)

### Community 1 - "HrisClockModule.swift"
Cohesion: 0.20
Nodes (4): ExpoModulesCore, Foundation, HrisClockModule, HrisFaceModule

### Community 2 - "useTheme"
Cohesion: 0.09
Nodes (106): @expo/vector-icons, react-native-safe-area-context, @react-navigation/native, EmptyState(), makeStyles(), ErrorState(), makeStyles(), EASE (+98 more)

### Community 3 - "PayslipCards.tsx"
Cohesion: 0.31
Nodes (12): makeStyles(), PdfButton(), Line(), makeStyles(), PayslipCompareCard(), PayslipHero(), PayslipHistoryCard(), PayslipInfoCard() (+4 more)

### Community 4 - "ProfilePhotoScreen.tsx"
Cohesion: 0.08
Nodes (36): expo-file-system, expo-sharing, react-native-svg, Props, Segment, styles, FaceCheck(), makeStyles() (+28 more)

### Community 5 - "CutiFormCards.tsx"
Cohesion: 0.18
Nodes (15): makeStyles(), PickerSheet(), Props, adalahIzinPenting(), CutiTypeCard(), HARI_MAKS, infoCuti(), IZIN_PENTING (+7 more)

### Community 6 - "mockApi.ts"
Cohesion: 0.08
Nodes (40): attendanceCorrections, clockState, documents, inbox, leaveRequests, pendingApprovals, EARNINGS_REGULER, MOCK_APPRAISAL (+32 more)

### Community 8 - "erpnextApi.ts"
Cohesion: 0.04
Nodes (52): ambilDokumen(), ambilInfoKeamanan(), ambilMenunggu(), ambilPerangkat(), AppraisalRes, AttendanceRow, BADGE_KEPUTUSAN, bentukDokumen() (+44 more)

### Community 9 - "LeaveRequestScreen.tsx"
Cohesion: 0.05
Nodes (88): expo-linear-gradient, ColleagueSheet(), makeStyles(), Cell, DatePickerCard(), FooterItem, makeStyles(), Props (+80 more)

### Community 10 - "package.json"
Cohesion: 0.12
Nodes (15): main, name, private, version, @babel/core, babel-plugin-module-resolver, babel-preset-expo, expo-build-properties (+7 more)

### Community 11 - "dependencies"
Cohesion: 0.08
Nodes (26): dependencies, expo, expo-blur, expo-build-properties, expo-camera, expo-constants, expo-device, expo-document-picker (+18 more)

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

### Community 26 - "smoke.sh"
Cohesion: 0.70
Nodes (4): call(), expect(), run_user(), smoke.sh script

### Community 27 - "Autentikasi token API key:secret"
Cohesion: 0.67
Nodes (3): Autentikasi token API key:secret, generate_keys method (perlu verifikasi v16), Autentikasi session cookie (CSRF)

### Community 30 - "index.tsx"
Cohesion: 0.18
Nodes (14): @react-native-async-storage/async-storage, en, id, Kunci, Bahasa, Ctx, KAMUS, LanguageCtx (+6 more)

### Community 39 - "Panduan uji di HP"
Cohesion: 0.14
Nodes (13): Fase 0: Persiapan, Fase 1: Login dan sesi, Fase 2: Bahasa, Fase 3: Karyawan (rani), Fase 3b: Fitur lanjutan (rani, dewi, sari), Fase 4: Atasan (dewi), Fase 5: HR (sari) dan web, Fase 6: Zona waktu dinas (+5 more)

### Community 40 - "types.ts"
Cohesion: 0.05
Nodes (39): expo-location, Props, IzinLokasi, jarakMeter(), keLokasi(), TerdekatKerja, useLokasiKerja(), NotifRow (+31 more)

### Community 41 - "tt"
Cohesion: 0.10
Nodes (31): labelBahasa(), leaveDecisionBadge(), isi(), tt(), terjemahkan(), labelLampiran(), kategoriBiaya(), ambilDinas() (+23 more)

### Community 47 - "ProfileScreen.tsx"
Cohesion: 0.11
Nodes (25): expo-blur, GlassPill(), Props, styles, LanguagePicker(), makeStyles(), NavBar(), Props (+17 more)

### Community 104 - "offlineQueue.ts"
Cohesion: 0.17
Nodes (18): useJumlahAntrean(), ambilStatusJam(), idKlien(), jamLokal(), kirimCheckin(), kirimItem(), sinkronAntrean(), statusDariAntrean() (+10 more)

### Community 108 - "ConfirmDialog.tsx"
Cohesion: 0.20
Nodes (14): ConfirmContext, ConfirmFn, ConfirmOptions, IKON, Rect, Req, useConfirm(), DOC_CATEGORY_LABEL (+6 more)

### Community 109 - "HomeScreen.tsx"
Cohesion: 0.08
Nodes (43): Card(), makeStyles(), DonutChart(), bungkus(), bungkusSlot(), Reveal(), RevealFlatList(), makeStyles() (+35 more)

### Community 110 - "http.ts"
Cohesion: 0.07
Nodes (38): App(), expo, expo-status-bar, ConfirmDialog(), ConfirmProvider(), makeStyles(), LanguageProvider(), useBahasa() (+30 more)

### Community 111 - "LineIcon"
Cohesion: 0.18
Nodes (14): @react-navigation/bottom-tabs, CreateSheet(), Item, makeStyles(), FloatingTabBar(), iconStyles, LABEL, makeStyles() (+6 more)

### Community 112 - "ProfileEditScreen.tsx"
Cohesion: 0.22
Nodes (15): HUBUNGAN, KELUARGA, LockedRow(), makeStyles(), NAMA_NIKAH, ProfileEditScreen(), STATUS_NIKAH, EditableProfile (+7 more)

### Community 113 - "face_lib.py"
Cohesion: 0.24
Nodes (3): fl_centroid(), fl_norm(), fl_parse()

### Community 114 - "push.ts"
Cohesion: 0.33
Nodes (5): expo-constants, expo-device, expo-notifications, TokenPush, tokenPushSaatIni()

### Community 122 - "ThemeContext.tsx"
Cohesion: 0.17
Nodes (17): react, react-native, Props, PrimaryButton(), Props, styles, makeStyles(), Props (+9 more)

## Knowledge Gaps
- **29 isolated node(s):** `Foundation`, `@expo/metro-runtime`, `expo-build-properties`, `react-native-screens`, `@babel/core` (+24 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 442 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **80 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HrisApi` connect `HrisApi` to `erpnextApi.ts`, `useTheme`, `types.ts`, `mockApi.ts`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **What connects `Foundation`, `@expo/metro-runtime`, `expo-build-properties` to the rest of the system?**
  _29 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useTheme` be split into smaller, more focused modules?**
  _Cohesion score 0.08694718763417776 - nodes in this community are weakly interconnected._
- **Why does `useTheme()` connect `useTheme` to `ProfileUploadScreen.tsx`, `PayslipCards.tsx`, `ProfilePhotoScreen.tsx`, `CutiFormCards.tsx`, `LeaveRequestScreen.tsx`, `ConfirmDialog.tsx`, `HomeScreen.tsx`, `http.ts`, `LineIcon`, `ProfileScreen.tsx`, `ProfileEditScreen.tsx`, `ThemeContext.tsx`, `index.tsx`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Should `ProfilePhotoScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08048103607770583 - nodes in this community are weakly interconnected._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `mockApi.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08194905869324474 - nodes in this community are weakly interconnected._