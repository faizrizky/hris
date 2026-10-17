# Graph Report - HRIS  (2026-10-17)

## Corpus Check
- 230 files · ~150,072 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: .onnx 3, (none) 2, .podspec 2)

## Summary
- 1311 nodes · 4519 edges · 140 communities (52 shown, 88 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `61331fb2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- AttendanceCorrectionScreen.tsx
- HrisClockModule.swift
- index.tsx
- useConfirm
- FaceCheck.tsx
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
- HomeScreen.tsx
- Ceklis uji di HP
- types.ts
- tt
- PayslipCards.tsx
- ProfileUploadScreen.tsx
- HrisFaceModule.kt
- useLokasiKerja.ts
- offlineQueue.ts
- FaceEnrollScreen.tsx
- http.ts
- ProfileSecurityScreen.tsx
- ProfilePhotoScreen.tsx
- face_lib.py
- App.tsx
- Web (admin/HR)
- NavBar.tsx
- AnimatedSplash.tsx
- LingkaranSamsung.tsx
- docker_credentials_local
- ClockState
- device_lib.py
- kirim-update.sh
- LoginScreen.tsx
- ProfileSecurityScreen.tsx
- ProfilePasswordScreen.tsx
- push.ts
- useTheme
- ProfileScreen
- Foto

## God Nodes (most connected - your core abstractions)
1. `useTheme()` - 195 edges
2. `useT()` - 144 edges
3. `react` - 88 edges
4. `react-native` - 82 edges
5. `Palette` - 70 edges
6. `useSession()` - 65 edges
7. `HrisApi` - 64 edges
8. `kembali()` - 61 edges
9. `Skeleton()` - 60 edges
10. `ErrorState()` - 56 edges

## Surprising Connections (you probably didn't know these)
- `Server Script (docker/server-scripts)` --semantically_similar_to--> `Server Script hris_* (get_my_roles, get_colleagues, get_my_approver)`  [INFERRED] [semantically similar]
  docker/README.md → BACKLOG.md
- `EXPO_PUBLIC_API_BASE_URL` --shares_data_with--> `erpnextApi (integrasi fase 2)`  [INFERRED]
  docker/README.md → README.md
- `erpnextApi (integrasi fase 2)` --references--> `ERPNext v16`  [INFERRED]
  README.md → docker/README.md
- `App()` --calls--> `AnimatedSplash()`  [EXTRACTED]
  App.tsx → src/components/AnimatedSplash.tsx
- `App()` --calls--> `KunciProvider()`  [EXTRACTED]
  App.tsx → src/services/kunciApp.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Seed, server scripts and smoke test flow** — docker_readme_seed, docker_readme_server_scripts, docker_readme_smoke_test, docker_readme_test_accounts [EXTRACTED 0.85]
- **ERPNext dev compose stack services** — docker_docker_compose_backend, docker_docker_compose_frontend, docker_docker_compose_websocket, docker_docker_compose_queue_workers, docker_docker_compose_scheduler, docker_docker_compose_db, docker_docker_compose_redis [EXTRACTED 0.95]
- **HrisApi contract with mock and ERPNext implementations** — readme_hrisapi_contract, readme_mock_api, readme_erpnext_api, readme_api_index_swap [EXTRACTED 0.95]

## Communities (140 total, 88 thin omitted)

### Community 0 - "AttendanceCorrectionScreen.tsx"
Cohesion: 0.23
Nodes (18): ATTENDANCE_STATUS_LABEL, keBeranda(), AttendanceCorrectionScreen(), makeStyles(), AlasanKoreksiCard(), BuktiKoreksiCard(), JamAjuanCard(), JENIS_KOREKSI (+10 more)

### Community 1 - "HrisClockModule.swift"
Cohesion: 0.20
Nodes (4): ExpoModulesCore, Foundation, HrisClockModule, HrisFaceModule

### Community 2 - "index.tsx"
Cohesion: 0.08
Nodes (106): expo-linear-gradient, @expo/vector-icons, react, react-native, react-native-safe-area-context, @react-navigation/native, ConfirmContext, ConfirmFn (+98 more)

### Community 3 - "useConfirm"
Cohesion: 0.15
Nodes (19): useConfirm(), makeStyles(), PdfButton(), makeStyles(), PickerSheet(), EmployeeDocumentDetailScreen(), makeStyles(), Biaya (+11 more)

### Community 4 - "FaceCheck.tsx"
Cohesion: 0.16
Nodes (16): FaceCheck(), makeStyles(), awalUrutan(), BATAS_LANGKAH_MS, deteksiWajah(), embeddingWajah(), HasilDeteksi, HrisFaceNative (+8 more)

### Community 5 - "CutiFormCards.tsx"
Cohesion: 0.19
Nodes (16): ColleagueSheet(), makeStyles(), Props, adalahIzinPenting(), CutiDetailCard(), CutiTypeCard(), HARI_MAKS, infoCuti() (+8 more)

### Community 6 - "mockApi.ts"
Cohesion: 0.07
Nodes (45): AppraisalRes, attendanceCorrections, clockState, documents, inbox, leaveRequests, mockApi, pendingApprovals (+37 more)

### Community 8 - "erpnextApi.ts"
Cohesion: 0.05
Nodes (52): ambilDokumen(), ambilInfoKeamanan(), ambilMenunggu(), ambilPerangkat(), AttendanceRow, BADGE_KEPUTUSAN, bentukDokumen(), bentukPerangkat() (+44 more)

### Community 9 - "LeaveRequestScreen.tsx"
Cohesion: 0.18
Nodes (23): useT(), DinasDetailCard(), DinasTujuanCard(), makeStyles(), Transportasi, ApprovalFlowCard(), ApprovalStep, FormDoneView() (+15 more)

### Community 10 - "package.json"
Cohesion: 0.11
Nodes (18): main, name, private, version, @babel/core, babel-plugin-module-resolver, babel-preset-expo, expo-build-properties (+10 more)

### Community 11 - "dependencies"
Cohesion: 0.06
Nodes (33): dependencies, expo, expo-application, expo-blur, expo-build-properties, expo-camera, expo-constants, expo-device (+25 more)

### Community 12 - "expo"
Cohesion: 0.06
Nodes (32): backgroundColor, foregroundImage, adaptiveIcon, googleServicesFile, package, permissions, projectId, expo (+24 more)

### Community 13 - "Docker Compose stack ERPNext dev"
Cohesion: 0.24
Nodes (12): service backend (gunicorn), service configurator, service create-site, image hris-erpnext:16 (pull_policy never), service db (MariaDB 11.8), service frontend (nginx, port 8080), service queue-short dan queue-long, redis-cache dan redis-queue (+4 more)

### Community 14 - "eslint.config.js"
Cohesion: 0.40
Nodes (4): { defineConfig }, expoConfig, eslint, eslint-config-expo

### Community 15 - "seed.py"
Cohesion: 0.14
Nodes (3): ensure_roles(), log(), make()

### Community 16 - "HRIS Mobile (Fase 1 Mocking)"
Cohesion: 0.29
Nodes (7): Verifikasi wajah ML Kit dan lokasi (fase belakangan), Face recognition ML Kit, Struktur folder src (navigation, screens, services, theme, components), HRIS Mobile (Fase 1 Mocking), Fitur Must-have (clock, absensi, cuti, approval, slip gaji, profil), React Native (Expo) + TypeScript, Login mock berbasis prefix email (ess, mss, hr)

### Community 17 - "Menjalankan di Android tanpa Play Store"
Cohesion: 0.33
Nodes (5): A. Cepat: Expo Go (tanpa build), B. Aplikasi sendiri (APK) lewat EAS Build — untuk push dan pemakaian harian, Konfigurasi terkini (2026-10-16), Memperbarui aplikasi tanpa build ulang (EAS Update), Menjalankan di Android tanpa Play Store

### Community 18 - "Backlog migrasi mock ke ERPNext"
Cohesion: 0.22
Nodes (9): Backlog migrasi mock ke ERPNext, Employee Checkin doctype, Leave Application doctype, P1 Menyelesaikan alur Cuti, P3 Absensi, P4 Payroll, P5 Lainnya (lembur, dinas luar, appraisal, notifikasi, profil, keamanan), Teknis yang menunggu (+1 more)

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
Cohesion: 0.22
Nodes (8): erpnextApi, HrisApi interface (src/services/types.ts), P2 Data HR, Server Script hris_* (get_my_roles, get_colleagues, get_my_approver), ERPNext v16, erpnextApi (integrasi fase 2), HrisApi interface (kontrak data), mockApi (implementasi data dummy)

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

### Community 30 - "HomeScreen.tsx"
Cohesion: 0.06
Nodes (68): Card(), makeStyles(), Cell, DatePickerCard(), FooterItem, makeStyles(), Props, DonutChart() (+60 more)

### Community 39 - "Ceklis uji di HP"
Cohesion: 0.13
Nodes (14): Ceklis uji di HP, Fase 0: Persiapan, Fase 1: Login dan sesi, Fase 2: Bahasa, Fase 3: Karyawan (rani), Fase 3b: Fitur lanjutan (rani, dewi, sari), Fase 3c: Foto profil dan verifikasi wajah (rani, sari, dewi), Fase 3d: Build baru (com.hrismobile): perangkat, kunci, biometrik, anti-spoofing, push (+6 more)

### Community 40 - "types.ts"
Cohesion: 0.06
Nodes (40): ATTENDANCE_STATUS_TONE, CORRECTION_STATUS_LABEL, CORRECTION_STATUS_TONE, DOC_STATUS_LABEL, DOC_STATUS_TONE, LEAVE_TYPE_LABEL, LEAVE_TYPE_TONE, OVERTIME_STATUS_LABEL (+32 more)

### Community 41 - "tt"
Cohesion: 0.08
Nodes (35): labelBahasa(), isi(), tt(), BULAN_ID, ID, KategoriLabel, terjemahkan(), terjemahkanNotifikasi() (+27 more)

### Community 47 - "PayslipCards.tsx"
Cohesion: 0.24
Nodes (16): Line(), makeStyles(), PayslipCompareCard(), PayslipHero(), PayslipHistoryCard(), PayslipInfoCard(), PayslipLinesCard(), makeStyles() (+8 more)

### Community 72 - "ProfileUploadScreen.tsx"
Cohesion: 0.09
Nodes (34): DateSheet(), makeStyles(), DocumentReviewDetailScreen(), makeStyles(), DocRow(), makeStyles(), ChangeSummary(), FIELD (+26 more)

### Community 104 - "useLokasiKerja.ts"
Cohesion: 0.28
Nodes (8): expo-location, IzinLokasi, jarakMeter(), keLokasi(), TerdekatKerja, useLokasiKerja(), AturanLokasi, LokasiCheckin

### Community 108 - "offlineQueue.ts"
Cohesion: 0.17
Nodes (18): useJumlahAntrean(), ambilStatusJam(), idKlien(), jamLokal(), kirimCheckin(), kirimItem(), sinkronAntrean(), statusDariAntrean() (+10 more)

### Community 109 - "FaceEnrollScreen.tsx"
Cohesion: 0.13
Nodes (19): expo-camera, pendengar, setTabBarHidden(), useTabBarHidden(), ClockScreen(), DoneMeta(), makeStyles(), acakTantangan() (+11 more)

### Community 110 - "http.ts"
Cohesion: 0.10
Nodes (18): expo, expo-application, @react-native-async-storage/async-storage, ALAMAT_BAWAAN, encode(), get(), Params, pesanServer() (+10 more)

### Community 111 - "ProfileSecurityScreen.tsx"
Cohesion: 0.28
Nodes (14): adaLoginBiometrik(), autentikasi(), bacaKunci(), jenisBiometrik(), kunciDitahan(), PengaturanKunci, simpanKunci(), tahanKunci() (+6 more)

### Community 112 - "ProfilePhotoScreen.tsx"
Cohesion: 0.14
Nodes (22): expo-image-picker, expo-sharing, react-native-svg, cache, useFotoProfil(), DocPreview(), makeStyles(), Kepala() (+14 more)

### Community 113 - "face_lib.py"
Cohesion: 0.22
Nodes (3): fl_centroid(), fl_norm(), fl_parse()

### Community 114 - "App.tsx"
Cohesion: 0.15
Nodes (16): App(), expo-status-bar, ConfirmDialog(), ConfirmProvider(), makeStyles(), FloatingTabBar(), makeStyles(), TabIcon() (+8 more)

### Community 115 - "Web (admin/HR)"
Cohesion: 0.18
Nodes (10): Core HR, Gap fitur KantorKu vs HRIS kita, General & Employee Services, Learning & Development, Mobile (ESS App), Payroll, Finance & Benefits, Performance Management, Prioritas (+2 more)

### Community 116 - "NavBar.tsx"
Cohesion: 0.19
Nodes (12): expo-blur, GlassPill(), Props, styles, makeStyles(), NavBar(), Props, AttendanceStack() (+4 more)

### Community 121 - "AnimatedSplash.tsx"
Cohesion: 0.16
Nodes (17): expo-file-system, expo-intent-launcher, expo-splash-screen, expo-updates, AnimatedSplash(), DURASI_SPLASH_MS, EASE, makeStyles() (+9 more)

### Community 122 - "LingkaranSamsung.tsx"
Cohesion: 0.25
Nodes (13): CincinWajah(), CircleAnim, EASE, GAnim, LineAnim, TICKS, ARAH_SUDUT, jalurIrisan() (+5 more)

### Community 124 - "ClockState"
Cohesion: 0.47
Nodes (5): ClockState, HasilStatus, menit(), selisih(), statusPresensi()

### Community 132 - "LoginScreen.tsx"
Cohesion: 0.26
Nodes (11): LanguagePicker(), LogoHris(), Props, RadialGlow(), LoginScreen(), makeStyles(), alamatServer(), aturAlamatServer() (+3 more)

### Community 133 - "ProfileSecurityScreen.tsx"
Cohesion: 0.31
Nodes (8): makeStyles(), PILL, ProfileSecurityScreen(), simpanKredensial(), useKunci(), ActiveDevice, FaceState, SecurityToggleKey

### Community 134 - "ProfilePasswordScreen.tsx"
Cohesion: 0.29
Nodes (12): ConfirmOptions, Req, Props, makeStyles(), ProfilePasswordScreen(), hapusKredensial(), SemanticTone, labelKekuatan() (+4 more)

### Community 135 - "push.ts"
Cohesion: 0.29
Nodes (6): expo-constants, expo-device, expo-notifications, ambilTokenPush(), TokenPush, tokenPushSaatIni()

### Community 136 - "useTheme"
Cohesion: 0.14
Nodes (25): PrimaryButton(), Props, styles, makeStyles(), SegmentedControl(), AppraisalSaya(), AppraisalScreen(), GoalCard() (+17 more)

### Community 137 - "ProfileScreen"
Cohesion: 0.60
Nodes (5): makeStyles(), MenuRow(), ProfileScreen(), Stat(), tahunSejak()

### Community 138 - "Foto"
Cohesion: 1.00
Nodes (3): Foto(), Kartu(), makeStyles()

## Knowledge Gaps
- **29 isolated node(s):** `Foundation`, `@expo/metro-runtime`, `expo-build-properties`, `react-native-screens`, `@babel/core` (+24 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 503 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **88 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HrisApi` connect `HrisApi` to `erpnextApi.ts`, `index.tsx`, `types.ts`, `mockApi.ts`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **What connects `Foundation`, `@expo/metro-runtime`, `expo-build-properties` to the rest of the system?**
  _29 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `index.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0808768517133024 - nodes in this community are weakly interconnected._
- **Why does `useTheme()` connect `useTheme` to `AttendanceCorrectionScreen.tsx`, `index.tsx`, `useConfirm`, `LoginScreen.tsx`, `CutiFormCards.tsx`, `FaceCheck.tsx`, `ProfilePasswordScreen.tsx`, `ProfileSecurityScreen.tsx`, `LeaveRequestScreen.tsx`, `Foto`, `ProfileScreen`, `HomeScreen.tsx`, `PayslipCards.tsx`, `ProfileUploadScreen.tsx`, `FaceEnrollScreen.tsx`, `ProfileSecurityScreen.tsx`, `ProfilePhotoScreen.tsx`, `App.tsx`, `NavBar.tsx`, `AnimatedSplash.tsx`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Should `mockApi.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0700354609929078 - nodes in this community are weakly interconnected._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Should `HrisApi` be split into smaller, more focused modules?**
  _Cohesion score 0.03278688524590164 - nodes in this community are weakly interconnected._