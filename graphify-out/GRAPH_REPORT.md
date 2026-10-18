# Graph Report - hris-mobile  (2026-10-18)

## Corpus Check
- 392 files · ~199,758 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 17 file(s) not represented in the graph (top: (none) 10, .onnx 3, .podspec 2)

## Summary
- 2023 nodes · 6329 edges · 207 communities (79 shown, 128 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 53 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `59a4e506`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- date.ts
- HrisClockModule.swift
- react
- services/types.ts
- useFaceEnroll.ts
- ConfirmDialog.tsx
- mockApi.ts
- HrisApi
- erpnextApi.ts
- useTheme
- package.json
- dependencies
- expo
- Docker Compose stack ERPNext dev
- statusLabels.ts
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
- useWorkLocation.ts
- useSession
- useAttendanceCorrection.ts
- LeaveRequestScreen.tsx
- HrisFaceModule.kt
- useProfilePhotoScreen.ts
- offlineQueue.ts
- FloatingTabBar.tsx
- AttendanceCorrectionHistoryScreen.tsx
- useProfileSecurity.ts
- App.tsx
- face_lib.py
- http.ts
- Web (admin/HR)
- TaxScreen.tsx
- useProfileUpload.ts
- useLeaveRequestForm.ts
- docker_credentials_local
- frappe_model_document
- device_lib.py
- kirim-update.sh
- formatShortDateWithYear
- trustedTime.ts
- describeError
- test_bgc_analysis.py
- RootNavigator.tsx
- useProfileEdit.ts
- AnimatedSplash.tsx
- initiate_background_check
- workflow.py
- re
- test_scoring.py
- FindingData
- runner.py
- frappe
- background_check.py
- translate
- test_background_check_phase7.py
- primaryButtonStyle
- generate_fixtures.py
- Prompt untuk Antigravity: Resume Screening + Background Check di ERPNext
- TestResumeScreeningTemplate
- LoginScreen.tsx
- StaffAttendanceScreen.tsx
- extract.py
- date_consistency.py
- enabled
- Spesifikasi: Background Checking di ERPNext
- LineIcon
- ProfilePhotoScreen.tsx
- Spesifikasi: Resume Screening (ATS) di ERPNext
- 4. Doctype baru
- 6. Algoritma (tanpa LLM)
- ResumeScreeningTemplate
- greeting.ts
- README.md
- eslint.config.js
- 5. Algoritma penilaian (tanpa LLM)
- hris_ats

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
- `4.3 Background Check Platform (katalog)` --references--> `enabled()`  [INFERRED]
  SPEC-BACKGROUND-CHECK.md → docker/apps/hris_ats/hris_ats/hris_ats/doctype/resume_screening_template/resume_screening_template.js
- `3.3 Resume Screening Settings (Single)` --references--> `enabled()`  [INFERRED]
  SPEC-RESUME-SCREENING.md → docker/apps/hris_ats/hris_ats/hris_ats/doctype/resume_screening_template/resume_screening_template.js
- `7. Pemetaan layar desain ke Desk` --references--> `enabled()`  [INFERRED]
  SPEC-RESUME-SCREENING.md → docker/apps/hris_ats/hris_ats/hris_ats/doctype/resume_screening_template/resume_screening_template.js
- `Server Script (docker/server-scripts)` --semantically_similar_to--> `Server Script hris_* (get_my_roles, get_colleagues, get_my_approver)`  [INFERRED] [semantically similar]
  docker/README.md → BACKLOG.md
- `4.4 Background Check Lexicon` --references--> `weight()`  [INFERRED]
  SPEC-BACKGROUND-CHECK.md → docker/apps/hris_ats/hris_ats/hris_ats/doctype/resume_screening_template/resume_screening_template.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Seed, server scripts and smoke test flow** — docker_readme_seed, docker_readme_server_scripts, docker_readme_smoke_test, docker_readme_test_accounts [EXTRACTED 0.85]
- **ERPNext dev compose stack services** — docker_docker_compose_backend, docker_docker_compose_frontend, docker_docker_compose_websocket, docker_docker_compose_queue_workers, docker_docker_compose_scheduler, docker_docker_compose_db, docker_docker_compose_redis [EXTRACTED 0.95]
- **HrisApi contract with mock and ERPNext implementations** — readme_hrisapi_contract, readme_mock_api, readme_erpnext_api, readme_api_index_swap [EXTRACTED 0.95]

## Communities (207 total, 128 thin omitted)

### Community 0 - "date.ts"
Cohesion: 0.22
Nodes (13): getActiveLanguage(), percent(), formatLongDate(), formatShortDuration(), getActiveMonths(), getActiveWeekdays(), getMonthLabel(), getMonthName() (+5 more)

### Community 1 - "HrisClockModule.swift"
Cohesion: 0.20
Nodes (4): ExpoModulesCore, Foundation, HrisClockModule, HrisFaceModule

### Community 2 - "react"
Cohesion: 0.18
Nodes (30): expo-linear-gradient, @expo/vector-icons, react, react-native, react-native-safe-area-context, Props, IconBox(), makeStyles() (+22 more)

### Community 3 - "services/types.ts"
Cohesion: 0.07
Nodes (34): Props, hasShownDeviceReminder, hasShownFaceReminder, AppNavigation, NotificationRow, Announcement, AppNotification, AppraisalGoal (+26 more)

### Community 4 - "useFaceEnroll.ts"
Cohesion: 0.05
Nodes (56): useClock(), EnrollAnimationValues, ENTER_EASING, useEnrollAnimations(), Challenge, COMMAND_TIMEOUT_MS, ENOUGH, HINT_MS (+48 more)

### Community 5 - "ConfirmDialog.tsx"
Cohesion: 0.16
Nodes (19): ConfirmContext, ConfirmDialog(), ConfirmFn, ConfirmOptions, makeStyles(), Rect, Req, TONE_ICONS (+11 more)

### Community 6 - "mockApi.ts"
Cohesion: 0.07
Nodes (43): AppraisalRes, attendanceCorrections, clockState, documents, inbox, leaveRequests, mockApi, pendingApprovals (+35 more)

### Community 8 - "erpnextApi.ts"
Cohesion: 0.04
Nodes (75): translateServerLabel(), attachAll(), AttachmentRow, AttendanceRow, BALANCE_KINDS, ChangeRow, clean(), ClockRes (+67 more)

### Community 9 - "useTheme"
Cohesion: 0.11
Nodes (68): EmptyState(), ErrorState(), makeStyles(), PagedList(), makeStyles(), SegmentedControl(), Skeleton(), useAppraisalFeedback() (+60 more)

### Community 10 - "package.json"
Cohesion: 0.07
Nodes (27): main, name, private, version, @babel/core, babel-plugin-module-resolver, babel-preset-expo, expo-application (+19 more)

### Community 11 - "dependencies"
Cohesion: 0.06
Nodes (33): dependencies, expo, expo-application, expo-blur, expo-build-properties, expo-camera, expo-constants, expo-device (+25 more)

### Community 12 - "expo"
Cohesion: 0.06
Nodes (32): backgroundColor, foregroundImage, adaptiveIcon, googleServicesFile, package, permissions, projectId, expo (+24 more)

### Community 13 - "Docker Compose stack ERPNext dev"
Cohesion: 0.24
Nodes (12): service backend (gunicorn), service configurator, service create-site, image hris-erpnext:16 (pull_policy never), service db (MariaDB 11.8), service frontend (nginx, port 8080), service queue-short dan queue-long, redis-cache dan redis-queue (+4 more)

### Community 14 - "statusLabels.ts"
Cohesion: 0.11
Nodes (17): CORRECTION_STATUS_LABEL, CORRECTION_STATUS_TONE, DOC_CATEGORY_LABEL, DOC_STATUS_LABEL, DOC_STATUS_TONE, LEAVE_TYPE_LABEL, LEAVE_TYPE_TONE, leaveDecisionBadge() (+9 more)

### Community 16 - "HRIS Mobile (Fase 1 Mocking)"
Cohesion: 0.20
Nodes (10): Employee Checkin doctype, Verifikasi wajah ML Kit dan lokasi (fase belakangan), P3 Absensi, service scheduler, Face recognition ML Kit, Struktur folder src (navigation, screens, services, theme, components), HRIS Mobile (Fase 1 Mocking), Fitur Must-have (clock, absensi, cuti, approval, slip gaji, profil) (+2 more)

### Community 17 - "Menjalankan di Android tanpa Play Store"
Cohesion: 0.29
Nodes (6): A. Cepat: Expo Go (tanpa build), B. Aplikasi sendiri (APK) lewat EAS Build — untuk push dan pemakaian harian, Konfigurasi terkini (2026-10-16), Memperbarui aplikasi tanpa build ulang (EAS Update), Menjalankan di Android tanpa Play Store, Push pengumuman pembaruan

### Community 18 - "Backlog migrasi mock ke ERPNext"
Cohesion: 0.22
Nodes (8): Backlog migrasi mock ke ERPNext, Leave Application doctype, P1 Menyelesaikan alur Cuti, P2 Data HR, P4 Payroll, P5 Lainnya (lembur, dinas luar, appraisal, notifikasi, profil, keamanan), Server Script hris_* (get_my_roles, get_colleagues, get_my_approver), Teknis yang menunggu

### Community 19 - "build-image.sh"
Cohesion: 0.18
Nodes (7): build-image.sh script, dev-ats.sh script, apps.json, VS Code Devcontainer (ditolak, terlalu rumit), frappe/frappe_docker repo resmi, hrms (Frappe HR), pwd.yml (ditolak, tidak bisa tambah app)

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

### Community 30 - "HomeScreen.tsx"
Cohesion: 0.10
Nodes (30): Card(), makeStyles(), DonutChart(), Props, Segment, styles, EASE, LAYOUT_KEYS (+22 more)

### Community 39 - "Ceklis uji di HP"
Cohesion: 0.13
Nodes (14): Ceklis uji di HP, Fase 0: Persiapan, Fase 1: Login dan sesi, Fase 2: Bahasa, Fase 3: Karyawan (rani), Fase 3b: Fitur lanjutan (rani, dewi, sari), Fase 3c: Foto profil dan verifikasi wajah (rani, sari, dewi), Fase 3d: Build baru (com.hrismobile): perangkat, kunci, biometrik, anti-spoofing, push (+6 more)

### Community 40 - "useWorkLocation.ts"
Cohesion: 0.28
Nodes (8): expo-location, distanceInMeters(), LocationPermission, NearestWorkLocation, toCheckinLocation(), useWorkLocation(), CheckinLocation, GeofenceRule

### Community 41 - "useSession"
Cohesion: 0.13
Nodes (25): Filter, useAttendanceCorrectionHistory(), Filter, useAttendanceHistory(), useDocumentReview(), useFaceReview(), useLeaveList(), Load (+17 more)

### Community 47 - "useAttendanceCorrection.ts"
Cohesion: 0.12
Nodes (25): makeStyles(), PickerSheet(), ATTENDANCE_STATUS_LABEL, CHECKIN_MAX_MINUTES, CHECKIN_MIN_MINUTES, CHECKOUT_MAX_MINUTES, CHECKOUT_MIN_MINUTES, DEFAULT_CHECKIN_MINUTES (+17 more)

### Community 72 - "LeaveRequestScreen.tsx"
Cohesion: 0.23
Nodes (17): DatePickerCard(), goHome(), AttendanceCorrectionScreen(), makeStyles(), ApprovalFlowCard(), FormDoneView(), makeStyles(), DOC_NAMA (+9 more)

### Community 104 - "useProfilePhotoScreen.ts"
Cohesion: 0.20
Nodes (16): expo-file-system, useProfile(), useProfilePhoto(), EASE, UpdateStage, useProfilePhotoScreen(), DocPreview(), makeStyles() (+8 more)

### Community 108 - "offlineQueue.ts"
Cohesion: 0.13
Nodes (22): useQueueCount(), useSyncOfflineCheckins(), clientKey(), fetchClockStatus(), localTime(), sendCheckin(), sendItem(), statusFromQueue() (+14 more)

### Community 109 - "FloatingTabBar.tsx"
Cohesion: 0.16
Nodes (17): @react-navigation/bottom-tabs, FloatingTabBar(), LABEL, makeStyles(), RIGHT, TONE_ICONS, NotificationTab, useNotification() (+9 more)

### Community 110 - "AttendanceCorrectionHistoryScreen.tsx"
Cohesion: 0.15
Nodes (35): makeStyles(), ListSearchBar(), makeStyles(), LoadMoreButton(), makeStyles(), makeStyles(), makeStyles(), StatusBadge() (+27 more)

### Community 111 - "useProfileSecurity.ts"
Cohesion: 0.16
Nodes (29): @react-native-async-storage/async-storage, useLogin(), LoginPrefillHandlers, useLoginPrefill(), USERNAME_STORAGE_KEY, useProfileSecurity(), getServerAddress(), setServerAddress() (+21 more)

### Community 112 - "App.tsx"
Cohesion: 0.33
Nodes (8): App(), expo-splash-screen, expo-status-bar, ConfirmProvider(), LanguageProvider(), setSessionExpiredHandler(), SessionProvider(), ThemeProvider()

### Community 113 - "face_lib.py"
Cohesion: 0.22
Nodes (3): fl_centroid(), fl_norm(), fl_parse()

### Community 114 - "http.ts"
Cohesion: 0.27
Nodes (11): addressReady, DEFAULT_SERVER_ADDRESS, encode(), get(), Params, post(), put(), request() (+3 more)

### Community 115 - "Web (admin/HR)"
Cohesion: 0.18
Nodes (10): Core HR, Gap fitur KantorKu vs HRIS kita, General & Employee Services, Learning & Development, Mobile (ESS App), Payroll, Finance & Benefits, Performance Management, Prioritas (+2 more)

### Community 116 - "TaxScreen.tsx"
Cohesion: 0.17
Nodes (22): makeStyles(), PdfButton(), EXPENSE_CATEGORIES, makeStyles(), PER_DIEM_PER_DAY, TotalRow(), Line(), makeStyles() (+14 more)

### Community 121 - "useProfileUpload.ts"
Cohesion: 0.25
Nodes (13): DateSheet(), makeStyles(), FileEntry, useProfileUpload(), CATEGORIES, makeStyles(), ProfileUploadScreen(), SAMPLE (+5 more)

### Community 122 - "useLeaveRequestForm.ts"
Cohesion: 0.16
Nodes (18): Cell, FooterItem, makeStyles(), Props, FORM_META, FORM_SEGMENTS, FormKind, LeaveRequestParams (+10 more)

### Community 123 - "docker_credentials_local"
Cohesion: 0.29
Nodes (3): push-rilis.sh script, rilis-apk.sh script, tes-push.sh script

### Community 124 - "frappe_model_document"
Cohesion: 0.05
Nodes (13): BackgroundCheckAccount, BackgroundCheckConsentScope, BackgroundCheckFinding, BackgroundCheckLexicon, BackgroundCheckPlatform, BackgroundCheckSettings, BackgroundCheckSourceRun, ResumeScreeningMetricWeight (+5 more)

### Community 132 - "formatShortDateWithYear"
Cohesion: 0.29
Nodes (5): ID, LabelCategory, MONTHS_ID, translateNotification(), mapNotification()

### Community 133 - "trustedTime.ts"
Cohesion: 0.18
Nodes (5): expo, Anchor, HrisClockNative, Native, TrustedTime

### Community 134 - "describeError"
Cohesion: 0.20
Nodes (15): @react-navigation/native, useConfirm(), OVERTIME_LIMIT_HOURS, OVERTIME_PAY_PER_HOUR, useActivePolling(), useEmployeeDocumentDetail(), useHome(), useLeaveApproval() (+7 more)

### Community 135 - "test_bgc_analysis.py"
Cohesion: 0.08
Nodes (18): detect_party_role(), evaluate_case_severity(), classify_text(), downgrade_severity(), calculate_match_confidence(), generate_name_variants(), is_mononym(), normalize_name() (+10 more)

### Community 136 - "RootNavigator.tsx"
Cohesion: 0.12
Nodes (20): GlassPill(), Props, styles, makeStyles(), NavBar(), Props, AttendanceStack(), HomeStack() (+12 more)

### Community 137 - "useProfileEdit.ts"
Cohesion: 0.32
Nodes (11): useProfileData(), useProfileEdit(), EditableProfile, EmergencyContact, FamilyMember, completenessPercent(), findShortcomings(), isValidEmail() (+3 more)

### Community 138 - "AnimatedSplash.tsx"
Cohesion: 0.19
Nodes (15): expo-intent-launcher, expo-updates, AnimatedSplash(), EASE, makeStyles(), NAMA, SPLASH_DURATION_MS, UpdateStage (+7 more)

### Community 140 - "initiate_background_check"
Cohesion: 0.08
Nodes (5): initiate_background_check(), revoke_consent(), submit_candidate_consent(), TestBackgroundCheckConsent, TestBackgroundCheckRunner

### Community 141 - "workflow.py"
Cohesion: 0.07
Nodes (12): bulk_rescreen(), get_template_for_job(), on_interview_update(), on_job_applicant_insert(), on_job_applicant_update(), on_job_offer_update(), process_resume_screening(), rescreen() (+4 more)

### Community 142 - "re"
Cohesion: 0.10
Nodes (11): ExtractionResult, evaluate(), evaluate(), detect_candidate_degree(), evaluate(), parse_degree_level(), evaluate(), evaluate() (+3 more)

### Community 144 - "test_scoring.py"
Cohesion: 0.10
Nodes (22): run_screening(), extract_cv(), evaluate(), _build_header_regex(), count_recognized_sections(), split_sections(), calculate_total_score(), test_all_10_fixtures_end_to_end() (+14 more)

### Community 145 - "FindingData"
Cohesion: 0.11
Nodes (6): BaseProvider, FindingData, CourtMAProvider, MockProvider, WebSearchProvider, test_mock_provider_runs_offline()

### Community 146 - "runner.py"
Cohesion: 0.09
Nodes (8): analyze_posts(), generate_automated_summary(), PlatformCheckProvider, PostsProvider, run_all_sources(), _save_findings(), test_analyze_posts_politeness_and_activity(), test_generate_automated_summary_omits_zero_clauses()

### Community 147 - "frappe"
Cohesion: 0.16
Nodes (12): after_install(), after_migrate(), setup_custom_fields(), setup_default_lexicon(), setup_default_platforms(), setup_default_settings(), setup_job_applicant_source(), setup_kanban_board() (+4 more)

### Community 148 - "background_check.py"
Cohesion: 0.11
Nodes (8): calculate_risk_level(), BackgroundCheck, get_findings_data(), rerun_background_check(), update_finding_verdict(), test_calculate_risk_level_medium_threshold(), test_calculate_risk_level_relevant_high_is_high(), test_calculate_risk_level_unreviewed_high_is_needs_verification()

### Community 149 - "translate"
Cohesion: 0.14
Nodes (22): ColleagueSheet(), makeStyles(), translate(), attachmentLabel(), getLeaveInfo(), IMPORTANT_LEAVE_KINDS, isImportantLeave(), kindName() (+14 more)

### Community 151 - "primaryButtonStyle"
Cohesion: 0.20
Nodes (16): PrimaryButton(), Props, styles, ATTENDANCE_STATUS_TONE, makeStyles(), makeStyles(), makeStyles(), makeStyles() (+8 more)

### Community 152 - "generate_fixtures.py"
Cohesion: 0.20
Nodes (11): create_docx(), create_english_pdf(), create_fresh_graduate_pdf(), create_indonesian_pdf(), create_mixed_dates_pdf(), create_no_phone_pdf(), create_overlapping_roles_pdf(), create_scanned_image_pdf() (+3 more)

### Community 153 - "Prompt untuk Antigravity: Resume Screening + Background Check di ERPNext"
Cohesion: 0.12
Nodes (16): Aturan kerja, Fase 0: Kerangka dan setup pengembangan, Fase 1: Doctype Resume Screening, Fase 2: Ekstraksi dan 9 metrik (fungsi murni), Fase 3: Alur Resume Screening, Fase 4: Tampilan Resume Screening, Fase 5: Doctype dan persetujuan Background Check, Fase 6: Provider dan analisis Background Check (+8 more)

### Community 155 - "LoginScreen.tsx"
Cohesion: 0.24
Nodes (12): react-native-svg, LanguagePicker(), LogoHris(), Props, RadialGlow(), LoginScreen(), makeStyles(), makeStyles() (+4 more)

### Community 156 - "StaffAttendanceScreen.tsx"
Cohesion: 0.20
Nodes (11): en, id, TranslationKey, ChangeSummary(), FIELD, makeStyles(), AttendanceCard(), Cell() (+3 more)

### Community 157 - "extract.py"
Cohesion: 0.22
Nodes (5): _detect_multi_column(), extract_docx(), extract_pdf(), normalize_text(), PageData

### Community 158 - "date_consistency.py"
Cohesion: 0.22
Nodes (5): evaluate(), extract_date_ranges(), parse_date_token(), calculate_total_experience_years(), evaluate()

### Community 159 - "enabled"
Cohesion: 0.23
Nodes (8): enabled(), weight(), 4.4 Background Check Lexicon, 3.1 Resume Screening Template, 3.2 Resume Screening, 3.3 Resume Screening Settings (Single), 3. Doctype baru, 7. Pemetaan layar desain ke Desk

### Community 160 - "Spesifikasi: Background Checking di ERPNext"
Cohesion: 0.17
Nodes (11): 10. Hal yang perlu diputuskan sebelum dibangun, 11. Urutan pengerjaan setelah disetujui, 1. Posisi di alur, 2.1 Bagian layar 10 yang tidak akan dibangun, 2. Telaah desain per layar, 3. Persetujuan kandidat (wajib sebelum pengecekan), 5. Sumber data, 7. Pemetaan layar ke Desk (+3 more)

### Community 161 - "LineIcon"
Cohesion: 0.29
Nodes (9): LineIcon(), makeStyles(), OvertimeDescriptionCard(), OvertimeHoursCard(), OvertimeProofCard(), makeStyles(), TRANSPORT_MODES, TransportMode (+1 more)

### Community 162 - "ProfilePhotoScreen.tsx"
Cohesion: 0.35
Nodes (9): Head(), HeadVariant, Button(), ErrorBox(), Guide(), makeStyles(), Mark(), ProfilePhotoScreen() (+1 more)

### Community 163 - "Spesifikasi: Resume Screening (ATS) di ERPNext"
Cohesion: 0.20
Nodes (9): 10. Hal yang perlu diputuskan sebelum dibangun, 11. Urutan pengerjaan setelah disetujui, 1. Posisi di alur rekrutmen, 2. Keputusan arsitektur: perlu custom app, 4. Field tambahan di doctype bawaan, 6. Alur proses, 8. Hak akses, 9. Privasi dan keadilan (+1 more)

### Community 164 - "4. Doctype baru"
Cohesion: 0.25
Nodes (9): exists(), make(), Fase 7: Tampilan Background Check, retensi, seed, Kondisi repo dan lingkungan, 4.1 Background Check, 4.2 Background Check Finding, 4.3 Background Check Platform (katalog), 4.5 Background Check Settings (Single) (+1 more)

### Community 165 - "6. Algoritma (tanpa LLM)"
Cohesion: 0.25
Nodes (8): 6.1 Persiapan identitas, 6.2 Skor kecocokan identitas (Article, File, Case), 6.3 Klasifikasi Article dan File, 6.4 Case history, 6.5 Analisis post (pengganti layar 10), 6.6 Tingkat risiko, 6.7 Ringkasan otomatis (layar 03), 6. Algoritma (tanpa LLM)

### Community 167 - "greeting.ts"
Cohesion: 0.48
Nodes (6): dot(), employeeGreeting(), getGreetingKind(), getShiftInfo(), Greeting, minutesOf()

### Community 169 - "README.md"
Cohesion: 0.33
Nodes (5): Attribution, Contributing, HRIS ATS, Installation, License

### Community 171 - "eslint.config.js"
Cohesion: 0.40
Nodes (4): { defineConfig }, expoConfig, eslint, eslint-config-expo

### Community 172 - "5. Algoritma penilaian (tanpa LLM)"
Cohesion: 0.40
Nodes (5): 5.1 Ekstraksi, 5.2 Metrik (masing-masing 0–100), 5.3 Skor total dan label, 5.4 Batasan yang harus diketahui, 5. Algoritma penilaian (tanpa LLM)

## Knowledge Gaps
- **30 isolated node(s):** `hris_ats`, `Foundation`, `@expo/metro-runtime`, `expo-build-properties`, `react-native-screens` (+25 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 812 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **128 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HrisApi` connect `HrisApi` to `erpnextApi.ts`, `useSession`, `services/types.ts`, `mockApi.ts`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **What connects `hris_ats`, `Foundation`, `@expo/metro-runtime` to the rest of the system?**
  _30 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `services/types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06507936507936508 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `services/types.ts`, `useFaceEnroll.ts`, `ConfirmDialog.tsx`, `describeError`, `RootNavigator.tsx`, `useTheme`, `package.json`, `AnimatedSplash.tsx`, `useProfileEdit.ts`, `translate`, `primaryButtonStyle`, `LoginScreen.tsx`, `StaffAttendanceScreen.tsx`, `HomeScreen.tsx`, `LineIcon`, `ProfilePhotoScreen.tsx`, `useWorkLocation.ts`, `useSession`, `useAttendanceCorrection.ts`, `LeaveRequestScreen.tsx`, `useProfilePhotoScreen.ts`, `offlineQueue.ts`, `FloatingTabBar.tsx`, `AttendanceCorrectionHistoryScreen.tsx`, `useProfileSecurity.ts`, `App.tsx`, `TaxScreen.tsx`, `useProfileUpload.ts`, `useLeaveRequestForm.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `useFaceEnroll.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05223880597014925 - nodes in this community are weakly interconnected._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Should `mockApi.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06956521739130435 - nodes in this community are weakly interconnected._