# Graph Report - HRIS  (2026-10-11)

## Corpus Check
- 163 files · ~100,241 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 2, .example 1)

## Summary
- 933 nodes · 3433 edges · 90 communities (30 shown, 60 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a96d02c7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useT
- RootNavigator.tsx
- index.tsx
- useTheme
- useSession
- http.ts
- mockApi.ts
- HrisApi
- erpnextApi.ts
- types.ts
- package.json
- dependencies
- expo
- Docker Compose stack ERPNext dev
- ProfileEditScreen
- seed.py
- HRIS Mobile (Fase 1 Mocking)
- terjemahkan
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
- Employee
- Panduan uji di HP
- push.ts
- ClockScreen
- Appraisal

## God Nodes (most connected - your core abstractions)
1. `useTheme()` - 174 edges
2. `useT()` - 122 edges
3. `react` - 72 edges
4. `react-native` - 67 edges
5. `Palette` - 61 edges
6. `useSession()` - 57 edges
7. `Skeleton()` - 54 edges
8. `HrisApi` - 53 edges
9. `ErrorState()` - 50 edges
10. `describeError()` - 48 edges

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

## Communities (90 total, 60 thin omitted)

### Community 0 - "useT"
Cohesion: 0.06
Nodes (82): ColleagueSheet(), makeStyles(), Props, CreateSheet(), Item, makeStyles(), Cell, DatePickerCard() (+74 more)

### Community 1 - "RootNavigator.tsx"
Cohesion: 0.08
Nodes (35): App(), expo-blur, expo-status-bar, ConfirmDialog(), ConfirmProvider(), makeStyles(), GlassPill(), Props (+27 more)

### Community 2 - "index.tsx"
Cohesion: 0.08
Nodes (87): expo-linear-gradient, @expo/vector-icons, react, react-native, react-native-safe-area-context, @react-navigation/native, ConfirmContext, ConfirmFn (+79 more)

### Community 3 - "useTheme"
Cohesion: 0.06
Nodes (78): useConfirm(), makeStyles(), PdfButton(), makeStyles(), PickerSheet(), PrimaryButton(), Props, styles (+70 more)

### Community 4 - "useSession"
Cohesion: 0.06
Nodes (68): react-native-svg, Card(), makeStyles(), DonutChart(), Props, Segment, styles, Props (+60 more)

### Community 5 - "http.ts"
Cohesion: 0.14
Nodes (24): DocPreview(), makeStyles(), makeStyles(), ProfilePasswordScreen(), ambilStatusJam(), kirimCheckin(), ApiError, encode() (+16 more)

### Community 6 - "mockApi.ts"
Cohesion: 0.08
Nodes (39): attendanceCorrections, clockState, documents, inbox, leaveRequests, mockApi, pendingApprovals, EARNINGS_REGULER (+31 more)

### Community 8 - "erpnextApi.ts"
Cohesion: 0.05
Nodes (48): ambilDokumen(), ambilInfoKeamanan(), ambilPerangkat(), AttendanceRow, BADGE_KEPUTUSAN, bentukDokumen(), bentukPerangkat(), bentukSlip() (+40 more)

### Community 9 - "types.ts"
Cohesion: 0.08
Nodes (25): NotifRow, ActiveDevice, AppNotification, BerkasLampiran, ChangeStatus, DocCategory, EditableProfile, EmergencyContact (+17 more)

### Community 10 - "package.json"
Cohesion: 0.11
Nodes (18): main, name, private, version, @babel/core, babel-plugin-module-resolver, babel-preset-expo, expo (+10 more)

### Community 11 - "dependencies"
Cohesion: 0.09
Nodes (23): dependencies, expo, expo-blur, expo-constants, expo-device, expo-document-picker, expo-file-system, expo-image-picker (+15 more)

### Community 12 - "expo"
Cohesion: 0.13
Nodes (14): package, expo, android, assetBundlePatterns, ios, name, orientation, plugins (+6 more)

### Community 13 - "Docker Compose stack ERPNext dev"
Cohesion: 0.24
Nodes (12): service backend (gunicorn), service configurator, service create-site, image hris-erpnext:16 (pull_policy never), service db (MariaDB 11.8), service frontend (nginx, port 8080), service queue-short dan queue-long, redis-cache dan redis-queue (+4 more)

### Community 14 - "ProfileEditScreen"
Cohesion: 0.13
Nodes (21): expo-document-picker, DateSheet(), makeStyles(), makeStyles(), ProfileDataScreen(), LockedRow(), makeStyles(), ProfileEditScreen() (+13 more)

### Community 15 - "seed.py"
Cohesion: 0.15
Nodes (3): ensure_roles(), log(), make()

### Community 16 - "HRIS Mobile (Fase 1 Mocking)"
Cohesion: 0.20
Nodes (10): Employee Checkin doctype, Verifikasi wajah ML Kit dan lokasi (fase belakangan), P3 Absensi, service scheduler, Face recognition ML Kit, Struktur folder src (navigation, screens, services, theme, components), HRIS Mobile (Fase 1 Mocking), Fitur Must-have (clock, absensi, cuti, approval, slip gaji, profil) (+2 more)

### Community 17 - "terjemahkan"
Cohesion: 0.15
Nodes (19): terjemahkan(), ambilDinas(), ambilKaryawanSaatIni(), ambilLembur(), ambilMenunggu(), ambilMilikSendiri(), ambilRole(), ambilSaldo() (+11 more)

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

### Community 39 - "Panduan uji di HP"
Cohesion: 0.15
Nodes (12): Fase 0: Persiapan, Fase 1: Login dan sesi, Fase 2: Bahasa, Fase 3: Karyawan (rani), Fase 4: Atasan (dewi), Fase 5: HR (sari) dan web, Fase 6: Zona waktu dinas, Fase 7: Galat dan batas (+4 more)

### Community 40 - "push.ts"
Cohesion: 0.29
Nodes (6): expo-constants, expo-device, expo-notifications, ambilTokenPush(), TokenPush, tokenPushSaatIni()

### Community 41 - "ClockScreen"
Cohesion: 0.50
Nodes (5): ClockScreen(), DoneMeta(), makeStyles(), makeStyles(), MapPreview()

## Knowledge Gaps
- **28 isolated node(s):** `@expo/metro-runtime`, `expo`, `react-native-screens`, `@babel/core`, `@types/react` (+23 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 348 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **60 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HrisApi` connect `HrisApi` to `erpnextApi.ts`, `types.ts`, `index.tsx`, `mockApi.ts`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **What connects `@expo/metro-runtime`, `expo`, `react-native-screens` to the rest of the system?**
  _28 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useT` be split into smaller, more focused modules?**
  _Cohesion score 0.05673758865248227 - nodes in this community are weakly interconnected._
- **Why does `useTheme()` connect `useTheme` to `useT`, `RootNavigator.tsx`, `index.tsx`, `useSession`, `http.ts`, `ClockScreen`, `ProfileEditScreen`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Should `RootNavigator.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07682926829268293 - nodes in this community are weakly interconnected._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Should `index.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08222413052812366 - nodes in this community are weakly interconnected._