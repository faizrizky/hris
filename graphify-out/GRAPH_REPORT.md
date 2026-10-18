# Graph Report - hris-mobile  (2026-10-18)

## Corpus Check
- 275 files · ~157,255 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: .onnx 3, (none) 2, .podspec 2)

## Summary
- 1454 nodes · 5331 edges · 142 communities (53 shown, 89 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `25366527`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- date.ts
- HrisClockModule.swift
- react
- react
- useFaceEnroll.ts
- translate
- mockApi.ts
- HrisApi
- erpnextApi.ts
- useTheme
- package.json
- dependencies
- expo
- Docker Compose stack ERPNext dev
- services/types.ts
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
- HomeScreen
- Ceklis uji di HP
- useWorkLocation.ts
- useSession
- useAttendanceCorrection.ts
- LeaveRequestScreen.tsx
- HrisFaceModule.kt
- useProfilePhotoScreen.ts
- offlineQueue.ts
- FloatingTabBar.tsx
- translate
- useProfileSecurity.ts
- App.tsx
- face_lib.py
- sendCheckin
- Web (admin/HR)
- TaxScreen.tsx
- useProfileUpload.ts
- useLeaveRequestForm.ts
- docker_credentials_local
- TripExpenseCard.tsx
- device_lib.py
- kirim-update.sh
- formatShortDateWithYear
- trustedTime.ts
- useOvertime.ts
- useHome.ts
- GlassPill.tsx
- useProfileEdit.ts
- AnimatedSplash.tsx
- Colleague

## God Nodes (most connected - your core abstractions)
1. `useTheme()` - 215 edges
2. `useT()` - 187 edges
3. `react` - 126 edges
4. `react-native` - 94 edges
5. `useSession()` - 77 edges
6. `goBackAnimated()` - 73 edges
7. `Palette` - 73 edges
8. `HrisApi` - 65 edges
9. `Skeleton()` - 60 edges
10. `describeError()` - 58 edges

## Surprising Connections (you probably didn't know these)
- `Server Script (docker/server-scripts)` --semantically_similar_to--> `Server Script hris_* (get_my_roles, get_colleagues, get_my_approver)`  [INFERRED] [semantically similar]
  docker/README.md → BACKLOG.md
- `EXPO_PUBLIC_API_BASE_URL` --shares_data_with--> `erpnextApi (integrasi fase 2)`  [INFERRED]
  docker/README.md → README.md
- `erpnextApi (integrasi fase 2)` --references--> `ERPNext v16`  [INFERRED]
  README.md → docker/README.md
- `App()` --calls--> `AnimatedSplash()`  [EXTRACTED]
  App.tsx → src/components/AnimatedSplash.tsx
- `App()` --calls--> `AppLockProvider()`  [EXTRACTED]
  App.tsx → src/services/appLock.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Seed, server scripts and smoke test flow** — docker_readme_seed, docker_readme_server_scripts, docker_readme_smoke_test, docker_readme_test_accounts [EXTRACTED 0.85]
- **ERPNext dev compose stack services** — docker_docker_compose_backend, docker_docker_compose_frontend, docker_docker_compose_websocket, docker_docker_compose_queue_workers, docker_docker_compose_scheduler, docker_docker_compose_db, docker_docker_compose_redis [EXTRACTED 0.95]
- **HrisApi contract with mock and ERPNext implementations** — readme_hrisapi_contract, readme_mock_api, readme_erpnext_api, readme_api_index_swap [EXTRACTED 0.95]

## Communities (142 total, 89 thin omitted)

### Community 0 - "date.ts"
Cohesion: 0.17
Nodes (17): makeStyles(), OvertimeRowSkeleton(), OvertimeScreen(), employmentText(), formatHoursMinutes(), formatLongDate(), formatShortDuration(), getActiveMonths() (+9 more)

### Community 1 - "HrisClockModule.swift"
Cohesion: 0.20
Nodes (4): ExpoModulesCore, Foundation, HrisClockModule, HrisFaceModule

### Community 2 - "react"
Cohesion: 0.06
Nodes (154): expo-linear-gradient, @expo/vector-icons, react, react-native, react-native-safe-area-context, react-native-svg, Props, DonutChart() (+146 more)

### Community 3 - "react"
Cohesion: 0.18
Nodes (19): useConfirm(), DOC_CATEGORY_LABEL, useActivePolling(), useAppraisalFeedback(), useDocumentReview(), useDocumentReviewDetail(), useEmployeeDocumentDetail(), useFaceReview() (+11 more)

### Community 4 - "useFaceEnroll.ts"
Cohesion: 0.05
Nodes (54): expo-camera, EnrollAnimationValues, ENTER_EASING, useEnrollAnimations(), Challenge, COMMAND_TIMEOUT_MS, ENOUGH, HINT_MS (+46 more)

### Community 5 - "translate"
Cohesion: 0.07
Nodes (47): ConfirmContext, ConfirmDialog(), ConfirmFn, ConfirmOptions, makeStyles(), Rect, Req, TONE_ICONS (+39 more)

### Community 6 - "mockApi.ts"
Cohesion: 0.07
Nodes (43): AppraisalRes, attendanceCorrections, clockState, documents, inbox, leaveRequests, mockApi, pendingApprovals (+35 more)

### Community 8 - "erpnextApi.ts"
Cohesion: 0.05
Nodes (52): AttachmentRow, AttendanceRow, BALANCE_KINDS, ChangeRow, clean(), ClockRes, ContactRow, CorrectionRow (+44 more)

### Community 9 - "useTheme"
Cohesion: 0.06
Nodes (84): ColleagueSheet(), makeStyles(), DatePickerCard(), DateSheet(), makeStyles(), makeStyles(), PdfButton(), makeStyles() (+76 more)

### Community 10 - "package.json"
Cohesion: 0.08
Nodes (26): { defineConfig }, expoConfig, main, name, private, version, @babel/core, babel-plugin-module-resolver (+18 more)

### Community 11 - "dependencies"
Cohesion: 0.06
Nodes (33): dependencies, expo, expo-application, expo-blur, expo-build-properties, expo-camera, expo-constants, expo-device (+25 more)

### Community 12 - "expo"
Cohesion: 0.06
Nodes (32): backgroundColor, foregroundImage, adaptiveIcon, googleServicesFile, package, permissions, projectId, expo (+24 more)

### Community 13 - "Docker Compose stack ERPNext dev"
Cohesion: 0.24
Nodes (12): service backend (gunicorn), service configurator, service create-site, image hris-erpnext:16 (pull_policy never), service db (MariaDB 11.8), service frontend (nginx, port 8080), service queue-short dan queue-long, redis-cache dan redis-queue (+4 more)

### Community 14 - "services/types.ts"
Cohesion: 0.07
Nodes (31): CORRECTION_STATUS_LABEL, CORRECTION_STATUS_TONE, DOC_STATUS_LABEL, DOC_STATUS_TONE, LEAVE_TYPE_LABEL, LEAVE_TYPE_TONE, localizeLabels(), OVERTIME_STATUS_LABEL (+23 more)

### Community 15 - "seed.py"
Cohesion: 0.14
Nodes (3): ensure_roles(), log(), make()

### Community 16 - "HRIS Mobile (Fase 1 Mocking)"
Cohesion: 0.29
Nodes (7): Verifikasi wajah ML Kit dan lokasi (fase belakangan), Face recognition ML Kit, Struktur folder src (navigation, screens, services, theme, components), HRIS Mobile (Fase 1 Mocking), Fitur Must-have (clock, absensi, cuti, approval, slip gaji, profil), React Native (Expo) + TypeScript, Login mock berbasis prefix email (ess, mss, hr)

### Community 17 - "Menjalankan di Android tanpa Play Store"
Cohesion: 0.29
Nodes (6): A. Cepat: Expo Go (tanpa build), B. Aplikasi sendiri (APK) lewat EAS Build — untuk push dan pemakaian harian, Konfigurasi terkini (2026-10-16), Memperbarui aplikasi tanpa build ulang (EAS Update), Menjalankan di Android tanpa Play Store, Push pengumuman pembaruan

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

### Community 30 - "HomeScreen"
Cohesion: 0.29
Nodes (11): Card(), makeStyles(), Reveal(), wrapChild(), wrapSlot(), EmploymentCard(), HomeScreen(), makeStyles() (+3 more)

### Community 39 - "Ceklis uji di HP"
Cohesion: 0.13
Nodes (14): Ceklis uji di HP, Fase 0: Persiapan, Fase 1: Login dan sesi, Fase 2: Bahasa, Fase 3: Karyawan (rani), Fase 3b: Fitur lanjutan (rani, dewi, sari), Fase 3c: Foto profil dan verifikasi wajah (rani, sari, dewi), Fase 3d: Build baru (com.hrismobile): perangkat, kunci, biometrik, anti-spoofing, push (+6 more)

### Community 40 - "useWorkLocation.ts"
Cohesion: 0.21
Nodes (11): expo-location, useClock(), distanceInMeters(), LocationPermission, NearestWorkLocation, toCheckinLocation(), useWorkLocation(), listeners (+3 more)

### Community 41 - "useSession"
Cohesion: 0.21
Nodes (16): Filter, useAttendanceCorrectionHistory(), Filter, useAttendanceHistory(), useLeaveList(), Load, useLoad(), formatTime() (+8 more)

### Community 47 - "useAttendanceCorrection.ts"
Cohesion: 0.14
Nodes (16): ATTENDANCE_STATUS_LABEL, CHECKIN_MAX_MINUTES, CHECKIN_MIN_MINUTES, CHECKOUT_MAX_MINUTES, CHECKOUT_MIN_MINUTES, DEFAULT_CHECKIN_MINUTES, DEFAULT_CHECKOUT_MINUTES, useAttendanceCorrection() (+8 more)

### Community 72 - "LeaveRequestScreen.tsx"
Cohesion: 0.21
Nodes (16): DOC_NAMA, LeaveRequestForm(), LeaveRequestScreen(), makeStyles(), makeStyles(), OvertimeDescriptionCard(), OvertimeHoursCard(), OvertimeProofCard() (+8 more)

### Community 104 - "useProfilePhotoScreen.ts"
Cohesion: 0.22
Nodes (13): expo-image-manipulator, expo-sharing, cache, useProfilePhoto(), EASE, UpdateStage, useProfilePhotoScreen(), downloadFile() (+5 more)

### Community 108 - "offlineQueue.ts"
Cohesion: 0.25
Nodes (12): useQueueCount(), syncQueue(), antre(), getQueue, getQueueCount(), Listener, listeners, listenToQueue() (+4 more)

### Community 109 - "FloatingTabBar.tsx"
Cohesion: 0.22
Nodes (13): FloatingTabBar(), LABEL, makeStyles(), RIGHT, TONE_ICONS, NotificationTab, useNotification(), markBackNavigation() (+5 more)

### Community 110 - "translate"
Cohesion: 0.13
Nodes (21): translateServerLabel(), fetchBalances(), fetchCurrentEmployee(), fetchOvertime(), fetchOwn(), fetchRole(), fetchTrips(), fetchWfh() (+13 more)

### Community 111 - "useProfileSecurity.ts"
Cohesion: 0.15
Nodes (30): @react-native-async-storage/async-storage, useLogin(), LoginPrefillHandlers, useLoginPrefill(), USERNAME_STORAGE_KEY, useProfileSecurity(), getServerAddress(), setServerAddress() (+22 more)

### Community 112 - "App.tsx"
Cohesion: 0.20
Nodes (14): App(), expo-splash-screen, expo-status-bar, ConfirmProvider(), useRegisterPushToken(), useSyncAccountLanguage(), useSyncOfflineCheckins(), LanguageProvider() (+6 more)

### Community 113 - "face_lib.py"
Cohesion: 0.22
Nodes (3): fl_centroid(), fl_norm(), fl_parse()

### Community 114 - "sendCheckin"
Cohesion: 0.25
Nodes (9): clientKey(), fetchClockStatus(), localTime(), sendCheckin(), sendItem(), statusFromQueue(), post(), getDeviceInfo() (+1 more)

### Community 115 - "Web (admin/HR)"
Cohesion: 0.18
Nodes (10): Core HR, Gap fitur KantorKu vs HRIS kita, General & Employee Services, Learning & Development, Mobile (ESS App), Payroll, Finance & Benefits, Performance Management, Prioritas (+2 more)

### Community 116 - "TaxScreen.tsx"
Cohesion: 0.36
Nodes (10): getActiveLanguage(), BAR_HEIGHT, BpjsRow(), LegendDot(), makeStyles(), percent(), TaxScreen(), BpjsItem (+2 more)

### Community 121 - "useProfileUpload.ts"
Cohesion: 0.25
Nodes (11): expo-document-picker, expo-file-system, expo-image-picker, FileEntry, useProfileUpload(), DocCategory, extensionOf(), formatFileSize() (+3 more)

### Community 122 - "useLeaveRequestForm.ts"
Cohesion: 0.19
Nodes (14): Cell, FooterItem, makeStyles(), Props, FORM_META, FORM_SEGMENTS, FormKind, LeaveRequestParams (+6 more)

### Community 123 - "docker_credentials_local"
Cohesion: 0.29
Nodes (3): push-rilis.sh script, rilis-apk.sh script, tes-push.sh script

### Community 124 - "TripExpenseCard.tsx"
Cohesion: 0.33
Nodes (9): Expense, EXPENSE_CATEGORIES, expenseCategory(), makeStyles(), PER_DIEM_PER_DAY, totalExpense(), TotalRow(), TripExpenseCard() (+1 more)

### Community 132 - "formatShortDateWithYear"
Cohesion: 0.27
Nodes (8): ID, LabelCategory, MONTHS_ID, translateNotification(), formatLeavePeriod(), mapNotification(), formatShortDate(), formatShortDateWithYear()

### Community 133 - "trustedTime.ts"
Cohesion: 0.10
Nodes (14): expo, attachAll(), uploadFile(), encode(), get(), put(), request(), serverMessage() (+6 more)

### Community 134 - "useOvertime.ts"
Cohesion: 0.14
Nodes (14): OVERTIME_LIMIT_HOURS, OVERTIME_PAY_PER_HOUR, useOvertime(), ALL_TAB, useStaffAttendance(), ALL_TAB, useStaffList(), addressReady (+6 more)

### Community 135 - "useHome.ts"
Cohesion: 0.32
Nodes (5): @react-navigation/native, hasShownDeviceReminder, hasShownFaceReminder, ALL_TAB, ClockState

### Community 136 - "GlassPill.tsx"
Cohesion: 0.18
Nodes (11): expo-blur, GlassPill(), Props, styles, makeStyles(), NavBar(), AttendanceStack(), LeaveStack() (+3 more)

### Community 137 - "useProfileEdit.ts"
Cohesion: 0.36
Nodes (10): useProfileData(), useProfileEdit(), EditableProfile, FamilyMember, completenessPercent(), findShortcomings(), isValidEmail(), isValidPhone() (+2 more)

### Community 138 - "AnimatedSplash.tsx"
Cohesion: 0.14
Nodes (21): expo-intent-launcher, expo-updates, AnimatedSplash(), EASE, makeStyles(), NAMA, SPLASH_DURATION_MS, UpdateStage (+13 more)

## Knowledge Gaps
- **29 isolated node(s):** `Foundation`, `@expo/metro-runtime`, `expo-build-properties`, `react-native-screens`, `@babel/core` (+24 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 537 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **89 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `react`, `useFaceEnroll.ts`, `translate`, `useOvertime.ts`, `useHome.ts`, `GlassPill.tsx`, `useTheme`, `package.json`, `AnimatedSplash.tsx`, `useProfileEdit.ts`, `useWorkLocation.ts`, `useSession`, `useAttendanceCorrection.ts`, `LeaveRequestScreen.tsx`, `useProfilePhotoScreen.ts`, `offlineQueue.ts`, `FloatingTabBar.tsx`, `useProfileSecurity.ts`, `App.tsx`, `TaxScreen.tsx`, `useProfileUpload.ts`, `useLeaveRequestForm.ts`, `TripExpenseCard.tsx`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **What connects `Foundation`, `@expo/metro-runtime`, `expo-build-properties` to the rest of the system?**
  _29 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.05676079667111057 - nodes in this community are weakly interconnected._
- **Why does `HrisApi` connect `HrisApi` to `erpnextApi.ts`, `useSession`, `mockApi.ts`, `services/types.ts`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Should `useFaceEnroll.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.052884615384615384 - nodes in this community are weakly interconnected._
- **Why does `useTheme()` connect `useTheme` to `date.ts`, `react`, `react`, `useFaceEnroll.ts`, `translate`, `GlassPill.tsx`, `useSession`, `AnimatedSplash.tsx`, `LeaveRequestScreen.tsx`, `FloatingTabBar.tsx`, `useProfileSecurity.ts`, `App.tsx`, `TaxScreen.tsx`, `useLeaveRequestForm.ts`, `TripExpenseCard.tsx`, `HomeScreen`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Should `translate` be split into smaller, more focused modules?**
  _Cohesion score 0.06676342525399129 - nodes in this community are weakly interconnected._