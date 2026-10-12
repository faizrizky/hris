# Graph Report - HRIS  (2026-10-12)

## Corpus Check
- 184 files · ~108,766 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .example 1, .podspec 1)

## Summary
- 1015 nodes · 3743 edges · 104 communities (36 shown, 68 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e35db888`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- LeaveRequestScreen.tsx
- HomeScreen.tsx
- index.tsx
- useTheme
- DocPreview.tsx
- http.ts
- mockApi.ts
- HrisApi
- erpnextApi.ts
- ProfilePasswordScreen.tsx
- package.json
- dependencies
- expo
- Docker Compose stack ERPNext dev
- DinasBiayaCard.tsx
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
- offlineQueue.ts
- smoke.sh
- Autentikasi token API key:secret
- Administrator tidak punya record Employee
- seed.sh script
- ProfileEditScreen.tsx
- Panduan uji di HP
- session.tsx
- terjemahkan
- types.ts
- HrisClockModule.kt
- trustedTime.ts
- PrimaryButton.tsx
- AppNotification

## God Nodes (most connected - your core abstractions)
1. `useTheme()` - 179 edges
2. `useT()` - 127 edges
3. `react` - 75 edges
4. `react-native` - 70 edges
5. `Palette` - 63 edges
6. `useSession()` - 59 edges
7. `Skeleton()` - 58 edges
8. `HrisApi` - 57 edges
9. `ErrorState()` - 54 edges
10. `kembali()` - 54 edges

## Surprising Connections (you probably didn't know these)
- `Server Script (docker/server-scripts)` --semantically_similar_to--> `Server Script hris_* (get_my_roles, get_colleagues, get_my_approver)`  [INFERRED] [semantically similar]
  docker/README.md → BACKLOG.md
- `EXPO_PUBLIC_API_BASE_URL` --shares_data_with--> `erpnextApi (integrasi fase 2)`  [INFERRED]
  docker/README.md → README.md
- `erpnextApi (integrasi fase 2)` --references--> `ERPNext v16`  [INFERRED]
  README.md → docker/README.md
- `App()` --calls--> `RootNavigator()`  [EXTRACTED]
  App.tsx → src/navigation/RootNavigator.tsx
- `service scheduler` --conceptually_related_to--> `P3 Absensi`  [INFERRED]
  docker/docker-compose.yml → BACKLOG.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Seed, server scripts and smoke test flow** — docker_readme_seed, docker_readme_server_scripts, docker_readme_smoke_test, docker_readme_test_accounts [EXTRACTED 0.85]
- **ERPNext dev compose stack services** — docker_docker_compose_backend, docker_docker_compose_frontend, docker_docker_compose_websocket, docker_docker_compose_queue_workers, docker_docker_compose_scheduler, docker_docker_compose_db, docker_docker_compose_redis [EXTRACTED 0.95]
- **HrisApi contract with mock and ERPNext implementations** — readme_hrisapi_contract, readme_mock_api, readme_erpnext_api, readme_api_index_swap [EXTRACTED 0.95]

## Communities (104 total, 68 thin omitted)

### Community 0 - "LeaveRequestScreen.tsx"
Cohesion: 0.07
Nodes (62): ColleagueSheet(), makeStyles(), Cell, DatePickerCard(), FooterItem, makeStyles(), Props, TabIcon() (+54 more)

### Community 1 - "HomeScreen.tsx"
Cohesion: 0.10
Nodes (43): Card(), makeStyles(), DonutChart(), RadialGlow(), bungkus(), bungkusSlot(), Reveal(), makeStyles() (+35 more)

### Community 2 - "index.tsx"
Cohesion: 0.08
Nodes (80): expo-linear-gradient, @expo/vector-icons, react, react-native, react-native-safe-area-context, react-native-svg, @react-navigation/native, ConfirmContext (+72 more)

### Community 3 - "useTheme"
Cohesion: 0.06
Nodes (121): useConfirm(), CreateSheet(), makeStyles(), EmptyState(), makeStyles(), ErrorState(), makeStyles(), FloatingTabBar() (+113 more)

### Community 4 - "DocPreview.tsx"
Cohesion: 0.40
Nodes (8): expo-file-system, expo-sharing, DocPreview(), makeStyles(), unduhBerkas(), adalahGambar(), bukaLampiran(), simpanLampiran()

### Community 5 - "http.ts"
Cohesion: 0.36
Nodes (9): encode(), get(), Params, pesanServer(), post(), put(), request(), upload() (+1 more)

### Community 6 - "mockApi.ts"
Cohesion: 0.07
Nodes (43): AppraisalRes, attendanceCorrections, clockState, documents, inbox, leaveRequests, mockApi, pendingApprovals (+35 more)

### Community 8 - "erpnextApi.ts"
Cohesion: 0.05
Nodes (52): ambilDokumen(), ambilInfoKeamanan(), ambilPerangkat(), ambilSaldo(), AttendanceRow, BADGE_KEPUTUSAN, bentukAbsensi(), bentukDokumen() (+44 more)

### Community 9 - "ProfilePasswordScreen.tsx"
Cohesion: 0.56
Nodes (7): makeStyles(), ProfilePasswordScreen(), labelKekuatan(), skorPassword(), syaratPassword, toneKekuatan(), TOTAL_SYARAT

### Community 10 - "package.json"
Cohesion: 0.08
Nodes (25): { defineConfig }, expoConfig, main, name, private, version, @babel/core, babel-plugin-module-resolver (+17 more)

### Community 11 - "dependencies"
Cohesion: 0.08
Nodes (24): dependencies, expo, expo-blur, expo-build-properties, expo-constants, expo-device, expo-document-picker, expo-file-system (+16 more)

### Community 12 - "expo"
Cohesion: 0.13
Nodes (14): package, expo, android, assetBundlePatterns, ios, name, orientation, plugins (+6 more)

### Community 13 - "Docker Compose stack ERPNext dev"
Cohesion: 0.24
Nodes (12): service backend (gunicorn), service configurator, service create-site, image hris-erpnext:16 (pull_policy never), service db (MariaDB 11.8), service frontend (nginx, port 8080), service queue-short dan queue-long, redis-cache dan redis-queue (+4 more)

### Community 14 - "DinasBiayaCard.tsx"
Cohesion: 0.14
Nodes (24): makeStyles(), PickerSheet(), BULAN_ID, ID, KategoriLabel, terjemahkanNotifikasi(), Biaya, DinasBiayaCard() (+16 more)

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

### Community 25 - "offlineQueue.ts"
Cohesion: 0.17
Nodes (18): useJumlahAntrean(), ambilStatusJam(), idKlien(), jamLokal(), kirimCheckin(), kirimItem(), sinkronAntrean(), statusDariAntrean() (+10 more)

### Community 26 - "smoke.sh"
Cohesion: 0.70
Nodes (4): call(), expect(), run_user(), smoke.sh script

### Community 27 - "Autentikasi token API key:secret"
Cohesion: 0.67
Nodes (3): Autentikasi token API key:secret, generate_keys method (perlu verifikasi v16), Autentikasi session cookie (CSRF)

### Community 30 - "ProfileEditScreen.tsx"
Cohesion: 0.11
Nodes (25): expo-document-picker, DateSheet(), makeStyles(), Props, HUBUNGAN, KELUARGA, NAMA_NIKAH, STATUS_NIKAH (+17 more)

### Community 39 - "Panduan uji di HP"
Cohesion: 0.15
Nodes (12): Fase 0: Persiapan, Fase 1: Login dan sesi, Fase 2: Bahasa, Fase 3: Karyawan (rani), Fase 4: Atasan (dewi), Fase 5: HR (sari) dan web, Fase 6: Zona waktu dinas, Fase 7: Galat dan batas (+4 more)

### Community 40 - "session.tsx"
Cohesion: 0.20
Nodes (14): App(), expo-status-bar, ConfirmDialog(), ConfirmProvider(), makeStyles(), LanguageProvider(), useBahasa(), setSessionExpiredHandler() (+6 more)

### Community 41 - "terjemahkan"
Cohesion: 0.14
Nodes (20): terjemahkan(), ambilDinas(), ambilKaryawanSaatIni(), ambilLembur(), ambilMenunggu(), ambilMilikSendiri(), ambilRole(), bentukDinas() (+12 more)

### Community 47 - "types.ts"
Cohesion: 0.06
Nodes (39): Props, CORRECTION_STATUS_LABEL, CORRECTION_STATUS_TONE, labelBahasa(), LEAVE_TYPE_LABEL, LEAVE_TYPE_TONE, leaveDecisionBadge(), OVERTIME_STATUS_LABEL (+31 more)

### Community 96 - "HrisClockModule.kt"
Cohesion: 0.17
Nodes (4): ExpoModulesCore, Foundation, HrisClockModule, HrisClockModule

### Community 97 - "trustedTime.ts"
Cohesion: 0.18
Nodes (5): expo, @react-native-async-storage/async-storage, Anchor, HrisClockNative, Native

### Community 98 - "PrimaryButton.tsx"
Cohesion: 0.50
Nodes (3): PrimaryButton(), Props, styles

### Community 99 - "AppNotification"
Cohesion: 0.67
Nodes (3): NotifRow, AppNotification, NotifCategory

## Knowledge Gaps
- **30 isolated node(s):** `ExpoModulesCore`, `Foundation`, `@expo/metro-runtime`, `expo-build-properties`, `react-native-screens` (+25 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 384 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **68 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HrisApi` connect `HrisApi` to `erpnextApi.ts`, `index.tsx`, `mockApi.ts`, `types.ts`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **What connects `ExpoModulesCore`, `Foundation`, `@expo/metro-runtime` to the rest of the system?**
  _30 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `LeaveRequestScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07484909456740442 - nodes in this community are weakly interconnected._
- **Why does `useTheme()` connect `useTheme` to `LeaveRequestScreen.tsx`, `HomeScreen.tsx`, `index.tsx`, `PrimaryButton.tsx`, `DocPreview.tsx`, `session.tsx`, `ProfilePasswordScreen.tsx`, `DinasBiayaCard.tsx`, `ProfileEditScreen.tsx`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Should `HomeScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09863945578231292 - nodes in this community are weakly interconnected._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Should `index.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07882808181315644 - nodes in this community are weakly interconnected._