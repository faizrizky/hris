# Graph Report - hris-mobile  (2026-10-18)

## Corpus Check
- 268 files · ~155,832 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: .onnx 3, (none) 2, .podspec 2)

## Summary
- 1435 nodes · 5136 edges · 153 communities (64 shown, 89 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6be7b810`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- date.ts
- HrisClockModule.swift
- react
- react
- useFaceEnroll.ts
- LeaveFormCards.tsx
- mockApi.ts
- HrisApi
- erpnextApi.ts
- useT
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
- smoke.sh
- Autentikasi token API key:secret
- Administrator tidak punya record Employee
- seed.sh script
- HomeScreen.tsx
- Ceklis uji di HP
- services/types.ts
- useSession
- LeaveRequestScreen.tsx
- useProfileUpload.ts
- HrisFaceModule.kt
- AttendanceCorrectionHistoryScreen.tsx
- offlineQueue.ts
- FloatingTabBar.tsx
- translate
- useProfileSecurity.ts
- TripExpenseCard.tsx
- face_lib.py
- http.ts
- Web (admin/HR)
- TaxScreen.tsx
- useProfilePhotoScreen.ts
- SamsungRing.tsx
- docker_credentials_local
- formatShortDateWithYear
- device_lib.py
- kirim-update.sh
- ConfirmDialog.tsx
- trustedTime.ts
- useOvertime.ts
- HomeScreen.tsx
- GlassPill.tsx
- useProfileEdit.ts
- ProfileScreen.tsx
- translate
- primaryButtonStyle
- FaceCheck.tsx
- useAttendanceCorrection.ts
- AnnouncementsScreen.tsx
- AppraisalScreen.tsx
- ClockScreen
- StaffAttendanceScreen.tsx
- Reveal.tsx
- request
- useNotification.ts
- HrisFaceNative

## God Nodes (most connected - your core abstractions)
1. `useTheme()` - 207 edges
2. `useT()` - 181 edges
3. `react` - 121 edges
4. `react-native` - 90 edges
5. `useSession()` - 77 edges
6. `goBackAnimated()` - 73 edges
7. `Palette` - 69 edges
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
- `App()` --calls--> `RootNavigator()`  [EXTRACTED]
  App.tsx → src/navigation/RootNavigator.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Seed, server scripts and smoke test flow** — docker_readme_seed, docker_readme_server_scripts, docker_readme_smoke_test, docker_readme_test_accounts [EXTRACTED 0.85]
- **ERPNext dev compose stack services** — docker_docker_compose_backend, docker_docker_compose_frontend, docker_docker_compose_websocket, docker_docker_compose_queue_workers, docker_docker_compose_scheduler, docker_docker_compose_db, docker_docker_compose_redis [EXTRACTED 0.95]
- **HrisApi contract with mock and ERPNext implementations** — readme_hrisapi_contract, readme_mock_api, readme_erpnext_api, readme_api_index_swap [EXTRACTED 0.95]

## Communities (153 total, 89 thin omitted)

### Community 0 - "date.ts"
Cohesion: 0.17
Nodes (23): Cell, DatePickerCard(), FooterItem, makeStyles(), Props, FORM_META, useLeaveRequestForm(), getActiveLanguage() (+15 more)

### Community 1 - "HrisClockModule.swift"
Cohesion: 0.20
Nodes (4): ExpoModulesCore, Foundation, HrisClockModule, HrisFaceModule

### Community 2 - "react"
Cohesion: 0.14
Nodes (36): expo-linear-gradient, @expo/vector-icons, react, react-native, react-native-safe-area-context, Props, Props, Props (+28 more)

### Community 3 - "react"
Cohesion: 0.20
Nodes (18): @react-navigation/native, useConfirm(), DOC_CATEGORY_LABEL, useActivePolling(), useAppraisalFeedback(), useDocumentReviewDetail(), useEmployeeDocumentDetail(), useFaceReview() (+10 more)

### Community 4 - "useFaceEnroll.ts"
Cohesion: 0.10
Nodes (20): EnrollAnimationValues, ENTER_EASING, useEnrollAnimations(), Challenge, COMMAND_TIMEOUT_MS, ENOUGH, HINT_MS, median() (+12 more)

### Community 5 - "LeaveFormCards.tsx"
Cohesion: 0.16
Nodes (17): ColleagueSheet(), makeStyles(), Props, attachmentLabel(), getLeaveInfo(), IMPORTANT_LEAVE_KINDS, isImportantLeave(), kindName() (+9 more)

### Community 6 - "mockApi.ts"
Cohesion: 0.09
Nodes (35): AppraisalRes, attendanceCorrections, clockState, documents, inbox, leaveRequests, mockApi, pendingApprovals (+27 more)

### Community 8 - "erpnextApi.ts"
Cohesion: 0.05
Nodes (46): AttendanceRow, BALANCE_KINDS, ChangeRow, clean(), ClockRes, CorrectionRow, DECISION_BADGES, DinasRow (+38 more)

### Community 9 - "useT"
Cohesion: 0.23
Nodes (19): DateSheet(), makeStyles(), useT(), goHome(), AttendanceCorrectionScreen(), makeStyles(), CORRECTION_KINDS, CorrectionProofCard() (+11 more)

### Community 10 - "package.json"
Cohesion: 0.07
Nodes (28): { defineConfig }, expoConfig, main, name, private, version, @babel/core, babel-plugin-module-resolver (+20 more)

### Community 11 - "dependencies"
Cohesion: 0.06
Nodes (33): dependencies, expo, expo-application, expo-blur, expo-build-properties, expo-camera, expo-constants, expo-device (+25 more)

### Community 12 - "expo"
Cohesion: 0.06
Nodes (32): backgroundColor, foregroundImage, adaptiveIcon, googleServicesFile, package, permissions, projectId, expo (+24 more)

### Community 13 - "Docker Compose stack ERPNext dev"
Cohesion: 0.24
Nodes (12): service backend (gunicorn), service configurator, service create-site, image hris-erpnext:16 (pull_policy never), service db (MariaDB 11.8), service frontend (nginx, port 8080), service queue-short dan queue-long, redis-cache dan redis-queue (+4 more)

### Community 14 - "useTheme"
Cohesion: 0.12
Nodes (46): ErrorState(), makeStyles(), LanguagePicker(), Skeleton(), goBackAnimated(), HomeStack(), NotifStack(), Stack (+38 more)

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

### Community 30 - "HomeScreen.tsx"
Cohesion: 0.18
Nodes (17): Card(), makeStyles(), Reveal(), wrapChild(), wrapSlot(), EmploymentCard(), HomeScreen(), makeStyles() (+9 more)

### Community 39 - "Ceklis uji di HP"
Cohesion: 0.13
Nodes (14): Ceklis uji di HP, Fase 0: Persiapan, Fase 1: Login dan sesi, Fase 2: Bahasa, Fase 3: Karyawan (rani), Fase 3b: Fitur lanjutan (rani, dewi, sari), Fase 3c: Foto profil dan verifikasi wajah (rani, sari, dewi), Fase 3d: Build baru (com.hrismobile): perangkat, kunci, biometrik, anti-spoofing, push (+6 more)

### Community 40 - "services/types.ts"
Cohesion: 0.08
Nodes (32): expo-location, hasShownDeviceReminder, hasShownFaceReminder, distanceInMeters(), LocationPermission, NearestWorkLocation, toCheckinLocation(), useWorkLocation() (+24 more)

### Community 41 - "useSession"
Cohesion: 0.17
Nodes (19): Filter, useAttendanceCorrectionHistory(), Filter, useAttendanceHistory(), useDocumentReview(), useLeaveList(), Load, useLoad() (+11 more)

### Community 47 - "LeaveRequestScreen.tsx"
Cohesion: 0.17
Nodes (20): LineIcon(), FORM_SEGMENTS, FormKind, LeaveRequestParams, DOC_NAMA, LeaveRequestForm(), LeaveRequestScreen(), makeStyles() (+12 more)

### Community 72 - "useProfileUpload.ts"
Cohesion: 0.36
Nodes (8): expo-document-picker, expo-image-picker, FileEntry, useProfileUpload(), extensionOf(), formatFileSize(), MAX_BYTES, withoutExtension()

### Community 104 - "AttendanceCorrectionHistoryScreen.tsx"
Cohesion: 0.20
Nodes (23): EmptyState(), makeStyles(), RevealFlatList(), makeStyles(), StatusBadge(), ICON, goBackOrHome(), AttendanceCorrectionHistoryScreen() (+15 more)

### Community 108 - "offlineQueue.ts"
Cohesion: 0.14
Nodes (19): useQueueCount(), clientKey(), fetchClockStatus(), localTime(), sendCheckin(), sendItem(), statusFromQueue(), syncQueue() (+11 more)

### Community 109 - "FloatingTabBar.tsx"
Cohesion: 0.18
Nodes (13): @react-navigation/bottom-tabs, FloatingTabBar(), LABEL, makeStyles(), RIGHT, TONE_ICONS, markBackNavigation(), listeners (+5 more)

### Community 110 - "translate"
Cohesion: 0.13
Nodes (22): translateServerLabel(), fetchBalances(), fetchCurrentEmployee(), fetchOvertime(), fetchOwn(), fetchRole(), fetchTrips(), fetchWfh() (+14 more)

### Community 111 - "useProfileSecurity.ts"
Cohesion: 0.11
Nodes (39): @react-native-async-storage/async-storage, useLogin(), LoginPrefillHandlers, useLoginPrefill(), USERNAME_STORAGE_KEY, useProfilePassword(), useProfileSecurity(), makeStyles() (+31 more)

### Community 112 - "TripExpenseCard.tsx"
Cohesion: 0.26
Nodes (12): makeStyles(), PickerSheet(), DinasBiayaCard(), Expense, EXPENSE_CATEGORIES, expenseCategory(), makeStyles(), PER_DIEM_PER_DAY (+4 more)

### Community 113 - "face_lib.py"
Cohesion: 0.22
Nodes (3): fl_centroid(), fl_norm(), fl_parse()

### Community 114 - "http.ts"
Cohesion: 0.17
Nodes (12): ALL_TAB, useStaffList(), addressReady, DEFAULT_SERVER_ADDRESS, Params, setSessionExpiredHandler(), SessionContext, SessionContextValue (+4 more)

### Community 115 - "Web (admin/HR)"
Cohesion: 0.18
Nodes (10): Core HR, Gap fitur KantorKu vs HRIS kita, General & Employee Services, Learning & Development, Mobile (ESS App), Payroll, Finance & Benefits, Performance Management, Prioritas (+2 more)

### Community 116 - "TaxScreen.tsx"
Cohesion: 0.19
Nodes (19): makeStyles(), PdfButton(), Line(), makeStyles(), PayslipCompareCard(), PayslipHero(), PayslipHistoryCard(), PayslipInfoCard() (+11 more)

### Community 121 - "useProfilePhotoScreen.ts"
Cohesion: 0.18
Nodes (16): expo-file-system, EASE, UpdateStage, useProfilePhotoScreen(), DocPreview(), makeStyles(), Card(), makeStyles() (+8 more)

### Community 122 - "SamsungRing.tsx"
Cohesion: 0.23
Nodes (14): CircleAnim, EASE, FaceRing(), GAnim, LineAnim, TICKS, clamp(), DIRECTION_ANGLE (+6 more)

### Community 123 - "docker_credentials_local"
Cohesion: 0.29
Nodes (3): push-rilis.sh script, rilis-apk.sh script, tes-push.sh script

### Community 124 - "formatShortDateWithYear"
Cohesion: 0.22
Nodes (9): ID, LabelCategory, MONTHS_ID, translateNotification(), daysUntil(), fetchDocuments(), mapDocument(), mapNotification() (+1 more)

### Community 132 - "ConfirmDialog.tsx"
Cohesion: 0.17
Nodes (16): App(), expo-status-bar, ConfirmContext, ConfirmDialog(), ConfirmFn, ConfirmOptions, ConfirmProvider(), makeStyles() (+8 more)

### Community 133 - "trustedTime.ts"
Cohesion: 0.13
Nodes (13): expo, useRegisterPushToken(), useSyncAccountLanguage(), useSyncOfflineCheckins(), useLanguage(), getQueueCount(), fetchPushToken(), Anchor (+5 more)

### Community 134 - "useOvertime.ts"
Cohesion: 0.25
Nodes (8): OVERTIME_LIMIT_HOURS, OVERTIME_PAY_PER_HOUR, useOvertime(), ALL_TAB, useStaffAttendance(), OvertimeRecord, StaffAttendanceState, toISODate()

### Community 135 - "HomeScreen.tsx"
Cohesion: 0.13
Nodes (24): DonutChart(), Props, Segment, styles, Props, RadialGlow(), ATTENDANCE_STATUS_TONE, AttendanceHistoryScreen() (+16 more)

### Community 136 - "GlassPill.tsx"
Cohesion: 0.18
Nodes (11): expo-blur, GlassPill(), Props, styles, makeStyles(), NavBar(), AttendanceStack(), LeaveStack() (+3 more)

### Community 137 - "useProfileEdit.ts"
Cohesion: 0.33
Nodes (11): useProfileData(), useProfileEdit(), EditableProfile, PersonalProfile, ProfileChange, completenessPercent(), findShortcomings(), isValidEmail() (+3 more)

### Community 138 - "ProfileScreen.tsx"
Cohesion: 0.14
Nodes (19): expo-intent-launcher, expo-splash-screen, expo-updates, AnimatedSplash(), EASE, makeStyles(), NAMA, SPLASH_DURATION_MS (+11 more)

### Community 140 - "translate"
Cohesion: 0.09
Nodes (26): ATTENDANCE_STATUS_LABEL, CORRECTION_STATUS_LABEL, CORRECTION_STATUS_TONE, DOC_STATUS_LABEL, DOC_STATUS_TONE, LEAVE_TYPE_LABEL, LEAVE_TYPE_TONE, leaveDecisionBadge() (+18 more)

### Community 141 - "primaryButtonStyle"
Cohesion: 0.14
Nodes (22): react-native-svg, PrimaryButton(), Props, styles, makeStyles(), makeStyles(), makeStyles(), makeStyles() (+14 more)

### Community 142 - "FaceCheck.tsx"
Cohesion: 0.22
Nodes (16): useFaceEnroll(), FaceCheck(), makeStyles(), advanceSequence(), Challenge, detectFace(), getFaceEmbedding(), getSpoofScore() (+8 more)

### Community 144 - "useAttendanceCorrection.ts"
Cohesion: 0.17
Nodes (14): CHECKIN_MAX_MINUTES, CHECKIN_MIN_MINUTES, CHECKOUT_MAX_MINUTES, CHECKOUT_MIN_MINUTES, DEFAULT_CHECKIN_MINUTES, DEFAULT_CHECKOUT_MINUTES, useAttendanceCorrection(), CorrectionKind (+6 more)

### Community 145 - "AnnouncementsScreen.tsx"
Cohesion: 0.32
Nodes (10): makeStyles(), SegmentedControl(), AnnouncementsList(), AnnouncementsScreen(), Card(), makeStyles(), CATEGORY_ICONS, makeStyles() (+2 more)

### Community 146 - "AppraisalScreen.tsx"
Cohesion: 0.40
Nodes (11): AppraisalSaya(), AppraisalScreen(), GoalCard(), makeStyles(), RaterRow(), ScoreRing(), Baris(), makeStyles() (+3 more)

### Community 147 - "ClockScreen"
Cohesion: 0.24
Nodes (11): useClock(), setTabBarHidden(), ClockScreen(), DoneMeta(), makeStyles(), isFaceSupported(), difference(), formatDuration() (+3 more)

### Community 148 - "StaffAttendanceScreen.tsx"
Cohesion: 0.27
Nodes (9): en, id, Kunci, AttendanceCard(), Cell(), makeStyles(), StaffAttendanceScreen(), TABS (+1 more)

### Community 149 - "Reveal.tsx"
Cohesion: 0.22
Nodes (9): EASE, LAYOUT_KEYS, ListSlot, RevealContext, RevealCtx, RevealScope(), styles, consumeBackMark() (+1 more)

### Community 150 - "request"
Cohesion: 0.22
Nodes (9): attachAll(), uploadFile(), encode(), get(), put(), request(), serverMessage(), upload() (+1 more)

### Community 151 - "useNotification.ts"
Cohesion: 0.50
Nodes (4): NotificationTab, useNotification(), setUnreadCount(), AppNotification

## Knowledge Gaps
- **29 isolated node(s):** `Foundation`, `@expo/metro-runtime`, `expo-build-properties`, `react-native-screens`, `@babel/core` (+24 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 536 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **89 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HrisApi` connect `HrisApi` to `erpnextApi.ts`, `useSession`, `services/types.ts`, `mockApi.ts`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **What connects `Foundation`, `@expo/metro-runtime`, `expo-build-properties` to the rest of the system?**
  _29 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.14244306418219463 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `date.ts`, `react`, `ConfirmDialog.tsx`, `useFaceEnroll.ts`, `useOvertime.ts`, `HomeScreen.tsx`, `GlassPill.tsx`, `useProfileEdit.ts`, `package.json`, `ProfileScreen.tsx`, `trustedTime.ts`, `primaryButtonStyle`, `useTheme`, `useT`, `useAttendanceCorrection.ts`, `AnnouncementsScreen.tsx`, `AppraisalScreen.tsx`, `FaceCheck.tsx`, `StaffAttendanceScreen.tsx`, `Reveal.tsx`, `useNotification.ts`, `LeaveFormCards.tsx`, `services/types.ts`, `useSession`, `LeaveRequestScreen.tsx`, `useProfileUpload.ts`, `AttendanceCorrectionHistoryScreen.tsx`, `offlineQueue.ts`, `FloatingTabBar.tsx`, `useProfileSecurity.ts`, `TripExpenseCard.tsx`, `http.ts`, `TaxScreen.tsx`, `useProfilePhotoScreen.ts`, `SamsungRing.tsx`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `useFaceEnroll.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Why does `useT()` connect `useT` to `date.ts`, `react`, `react`, `useFaceEnroll.ts`, `LeaveFormCards.tsx`, `trustedTime.ts`, `HomeScreen.tsx`, `useProfileEdit.ts`, `ProfileScreen.tsx`, `translate`, `primaryButtonStyle`, `useTheme`, `FaceCheck.tsx`, `useAttendanceCorrection.ts`, `AnnouncementsScreen.tsx`, `AppraisalScreen.tsx`, `ClockScreen`, `StaffAttendanceScreen.tsx`, `HomeScreen.tsx`, `services/types.ts`, `useSession`, `LeaveRequestScreen.tsx`, `useProfileUpload.ts`, `AttendanceCorrectionHistoryScreen.tsx`, `FloatingTabBar.tsx`, `useProfileSecurity.ts`, `TripExpenseCard.tsx`, `http.ts`, `TaxScreen.tsx`, `useProfilePhotoScreen.ts`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Should `mockApi.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08677098150782361 - nodes in this community are weakly interconnected._