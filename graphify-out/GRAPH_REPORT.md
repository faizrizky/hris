# Graph Report - hris-mobile  (2026-10-19)

## Corpus Check
- 413 files · ~246,978 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 17 file(s) not represented in the graph (top: (none) 10, .onnx 3, .podspec 2)

## Summary
- 2421 nodes · 7375 edges · 224 communities (93 shown, 131 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 149 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c504de06`
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
- AttendanceCorrectionHistoryScreen.tsx
- package.json
- dependencies
- expo
- Docker Compose stack ERPNext dev
- court_ma.py
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
- useTheme
- useProfileSecurity.ts
- session.tsx
- face_lib.py
- FetchResult
- Web (admin/HR)
- useLeaveRequestForm.ts
- useProfileUpload.ts
- background_check_settings.py
- docker_credentials_local
- frappe_model_document
- device_lib.py
- kirim-update.sh
- formatShortDateWithYear
- trustedTime.ts
- useOvertime.ts
- test_bgc_analysis.py
- useT
- useProfileEdit.ts
- AnimatedSplash.tsx
- initiate_background_check
- test_resume_screening_workflow.py
- re
- test_scoring.py
- FindingData
- test_i18n.py
- frappe
- update_finding_verdict
- translate
- submit_candidate_consent
- AttendanceHistoryScreen.tsx
- generate_fixtures.py
- Prompt untuk Antigravity: Resume Screening + Background Check di ERPNext
- TestResumeScreeningTemplate
- LoginScreen.tsx
- index.tsx
- translateServerLabel
- fetch.py
- enabled
- Spesifikasi: Background Checking di ERPNext
- run_all_sources
- ProfilePhotoScreen.tsx
- Spesifikasi: Resume Screening (ATS) di ERPNext
- TestBackgroundCheckSocialConsent
- 6. Algoritma (tanpa LLM)
- ResumeScreeningTemplate
- Prompt untuk Antigravity: Lapisan pengambil halaman Scrapling untuk Background Check
- background_check.js
- README.md
- eslint.config.js
- 5. Algoritma penilaian (tanpa LLM)
- get_default_cache_backend
- ensure_test_hr_user
- hris_ats
- FaceCheck.tsx
- TestBackgroundCheckSettings
- FetchConfig
- test_fetch.py
- Prompt untuk Antigravity: Media sosial penuh pada Background Check
- SamsungRing.tsx
- fetch
- ClockScreen
- test_article.py
- Kelemahan dan solusi
- AUDIT BASELINE & INVENTARIS SISTEM HRIS_ATS (FASE 1)
- TaxScreen.tsx
- BackgroundCheck
- HrisFaceNative
- background_check_settings.js

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
- `3a. Domain terlarang menjadi settingan` --references--> `ForbiddenDomainError`  [INFERRED]
  PROMPT-ANTIGRAVITY-PERBAIKAN.md → docker/apps/hris_ats/hris_ats/bgc/fetch.py
- `Fase 4: Provider live lewat `fetch.py` dan pemakaian `mock_provider`` --references--> `FetchConfig`  [INFERRED]
  PROMPT-ANTIGRAVITY-SCRAPLING.md → docker/apps/hris_ats/hris_ats/bgc/fetch.py
- `Konteks` --references--> `social_consent()`  [INFERRED]
  PROMPT-ANTIGRAVITY-SOSMED.md → docker/apps/hris_ats/hris_ats/hris_ats/doctype/background_check/background_check.js
- `Pekerjaan` --references--> `render()`  [INFERRED]
  PROMPT-ANTIGRAVITY-PERBAIKAN.md → docker/apps/hris_ats/hris_ats/i18n.py
- `Fase 1: Audit dan baseline (tanpa mengubah perilaku)` --references--> `MemoryCacheBackend`  [INFERRED]
  PROMPT-ANTIGRAVITY-PERBAIKAN.md → docker/apps/hris_ats/hris_ats/bgc/fetch.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Seed, server scripts and smoke test flow** — docker_readme_seed, docker_readme_server_scripts, docker_readme_smoke_test, docker_readme_test_accounts [EXTRACTED 0.85]
- **ERPNext dev compose stack services** — docker_docker_compose_backend, docker_docker_compose_frontend, docker_docker_compose_websocket, docker_docker_compose_queue_workers, docker_docker_compose_scheduler, docker_docker_compose_db, docker_docker_compose_redis [EXTRACTED 0.95]
- **HrisApi contract with mock and ERPNext implementations** — readme_hrisapi_contract, readme_mock_api, readme_erpnext_api, readme_api_index_swap [EXTRACTED 0.95]

## Communities (224 total, 131 thin omitted)

### Community 0 - "date.ts"
Cohesion: 0.14
Nodes (24): Cell, DatePickerCard(), FooterItem, makeStyles(), Props, useLeaveRequestForm(), getActiveLanguage(), employmentText() (+16 more)

### Community 1 - "HrisClockModule.swift"
Cohesion: 0.20
Nodes (4): ExpoModulesCore, Foundation, HrisClockModule, HrisFaceModule

### Community 2 - "react"
Cohesion: 0.13
Nodes (43): expo-linear-gradient, @expo/vector-icons, react, react-native, react-native-safe-area-context, Props, GlassPill(), Props (+35 more)

### Community 3 - "services/types.ts"
Cohesion: 0.05
Nodes (42): Props, CORRECTION_STATUS_LABEL, CORRECTION_STATUS_TONE, DOC_STATUS_LABEL, DOC_STATUS_TONE, LEAVE_TYPE_LABEL, LEAVE_TYPE_TONE, leaveDecisionBadge() (+34 more)

### Community 4 - "useFaceEnroll.ts"
Cohesion: 0.09
Nodes (22): expo-camera, EnrollAnimationValues, ENTER_EASING, useEnrollAnimations(), Challenge, COMMAND_TIMEOUT_MS, ENOUGH, HINT_MS (+14 more)

### Community 5 - "ConfirmDialog.tsx"
Cohesion: 0.17
Nodes (18): ConfirmContext, ConfirmDialog(), ConfirmFn, ConfirmOptions, makeStyles(), Rect, Req, TONE_ICONS (+10 more)

### Community 6 - "mockApi.ts"
Cohesion: 0.07
Nodes (46): AppraisalRes, attendanceCorrections, clockState, documents, inbox, leaveRequests, mockApi, pendingApprovals (+38 more)

### Community 8 - "erpnextApi.ts"
Cohesion: 0.04
Nodes (53): attachAll(), AttachmentRow, AttendanceRow, BALANCE_KINDS, ChangeRow, clean(), ClockRes, ContactRow (+45 more)

### Community 9 - "AttendanceCorrectionHistoryScreen.tsx"
Cohesion: 0.11
Nodes (61): EmptyState(), makeStyles(), ErrorState(), makeStyles(), ListSearchBar(), makeStyles(), makeStyles(), PagedItems() (+53 more)

### Community 10 - "package.json"
Cohesion: 0.08
Nodes (25): main, name, private, version, @babel/core, babel-plugin-module-resolver, babel-preset-expo, expo-application (+17 more)

### Community 11 - "dependencies"
Cohesion: 0.06
Nodes (33): dependencies, expo, expo-application, expo-blur, expo-build-properties, expo-camera, expo-constants, expo-device (+25 more)

### Community 12 - "expo"
Cohesion: 0.06
Nodes (32): backgroundColor, foregroundImage, adaptiveIcon, googleServicesFile, package, permissions, projectId, expo (+24 more)

### Community 13 - "Docker Compose stack ERPNext dev"
Cohesion: 0.24
Nodes (12): service backend (gunicorn), service configurator, service create-site, image hris-erpnext:16 (pull_policy never), service db (MariaDB 11.8), service frontend (nginx, port 8080), service queue-short dan queue-long, redis-cache dan redis-queue (+4 more)

### Community 14 - "court_ma.py"
Cohesion: 0.07
Nodes (19): create_adaptive_adaptor(), ensure_adaptive_page(), get_adaptive_db_file(), get_adaptive_storage_dir(), query_adaptive_element(), evaluate_case_severity(), BaseProvider, get_crawldir() (+11 more)

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
Cohesion: 0.38
Nodes (6): ERPNext + Frappe HR instance untuk pengembangan lokal, Seed data uji (seed.sh), Server Script (docker/server-scripts), Smoke test endpoint (smoke.sh), Akun uji rani, mss.test, hr.test, Pemecahan masalah (Network request failed, create-site, build)

### Community 21 - "devDependencies"
Cohesion: 0.25
Nodes (8): devDependencies, @babel/core, babel-plugin-module-resolver, babel-preset-expo, eslint, eslint-config-expo, @types/react, typescript

### Community 22 - "erpnextApi (integrasi fase 2)"
Cohesion: 0.22
Nodes (9): erpnextApi, HrisApi interface (src/services/types.ts), ERPNext v16, Akses dari HP lewat Expo (IP LAN, bukan localhost), EXPO_PUBLIC_API_BASE_URL, FRAPPE_SITE_NAME_HEADER, erpnextApi (integrasi fase 2), HrisApi interface (kontrak data) (+1 more)

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
Cohesion: 0.12
Nodes (26): Card(), makeStyles(), EASE, LAYOUT_KEYS, ListSlot, Reveal(), RevealContext, RevealCtx (+18 more)

### Community 39 - "Ceklis uji di HP"
Cohesion: 0.13
Nodes (14): Ceklis uji di HP, Fase 0: Persiapan, Fase 1: Login dan sesi, Fase 2: Bahasa, Fase 3: Karyawan (rani), Fase 3b: Fitur lanjutan (rani, dewi, sari), Fase 3c: Foto profil dan verifikasi wajah (rani, sari, dewi), Fase 3d: Build baru (com.hrismobile): perangkat, kunci, biometrik, anti-spoofing, push (+6 more)

### Community 40 - "useWorkLocation.ts"
Cohesion: 0.28
Nodes (8): expo-location, distanceInMeters(), LocationPermission, NearestWorkLocation, toCheckinLocation(), useWorkLocation(), CheckinLocation, GeofenceRule

### Community 41 - "useSession"
Cohesion: 0.13
Nodes (34): @react-navigation/native, useConfirm(), DOC_CATEGORY_LABEL, useActivePolling(), useAppraisalFeedback(), Filter, useAttendanceCorrectionHistory(), Filter (+26 more)

### Community 47 - "useAttendanceCorrection.ts"
Cohesion: 0.13
Nodes (26): makeStyles(), PickerSheet(), ATTENDANCE_STATUS_LABEL, CHECKIN_MAX_MINUTES, CHECKIN_MIN_MINUTES, CHECKOUT_MAX_MINUTES, CHECKOUT_MIN_MINUTES, DEFAULT_CHECKIN_MINUTES (+18 more)

### Community 72 - "LeaveRequestScreen.tsx"
Cohesion: 0.16
Nodes (23): LineIcon(), goHome(), ApprovalFlowCard(), FormDoneView(), makeStyles(), DOC_NAMA, LeaveRequestForm(), LeaveRequestScreen() (+15 more)

### Community 104 - "useProfilePhotoScreen.ts"
Cohesion: 0.21
Nodes (14): expo-image-picker, useProfile(), cache, useProfilePhoto(), EASE, UpdateStage, useProfilePhotoScreen(), DocPreview() (+6 more)

### Community 108 - "offlineQueue.ts"
Cohesion: 0.25
Nodes (12): useQueueCount(), syncQueue(), antre(), getQueue, getQueueCount(), Listener, listeners, listenToQueue() (+4 more)

### Community 109 - "FloatingTabBar.tsx"
Cohesion: 0.19
Nodes (14): FloatingTabBar(), LABEL, makeStyles(), RIGHT, TONE_ICONS, NotificationTab, useNotification(), markBackNavigation() (+6 more)

### Community 110 - "useTheme"
Cohesion: 0.17
Nodes (26): LoadMoreButton(), makeStyles(), makeStyles(), PdfButton(), makeStyles(), SegmentedControl(), makeStyles(), StatusBadge() (+18 more)

### Community 111 - "useProfileSecurity.ts"
Cohesion: 0.13
Nodes (33): @react-native-async-storage/async-storage, useLogin(), LoginPrefillHandlers, useLoginPrefill(), USERNAME_STORAGE_KEY, useProfileSecurity(), addressReady, DEFAULT_SERVER_ADDRESS (+25 more)

### Community 112 - "session.tsx"
Cohesion: 0.20
Nodes (16): App(), expo-status-bar, ConfirmProvider(), useRegisterPushToken(), useSyncAccountLanguage(), useSyncOfflineCheckins(), LanguageProvider(), useLanguage() (+8 more)

### Community 113 - "face_lib.py"
Cohesion: 0.22
Nodes (3): fl_centroid(), fl_norm(), fl_parse()

### Community 114 - "FetchResult"
Cohesion: 0.11
Nodes (21): FetchResult, ForbiddenDomainError, CourtMAProvider, extract_party_identity_from_pdf(), _generate_blank_pdf_bytes(), test_court_ma_name_twins_discrimination(), test_court_ma_pagination_all_three_pages_and_crawldir_lifecycle(), fake_fetch() (+13 more)

### Community 115 - "Web (admin/HR)"
Cohesion: 0.18
Nodes (10): Core HR, Gap fitur KantorKu vs HRIS kita, General & Employee Services, Learning & Development, Mobile (ESS App), Payroll, Finance & Benefits, Performance Management, Prioritas (+2 more)

### Community 116 - "useLeaveRequestForm.ts"
Cohesion: 0.19
Nodes (17): FORM_META, FORM_SEGMENTS, FormKind, LeaveRequestParams, Expense, EXPENSE_CATEGORIES, expenseCategory(), makeStyles() (+9 more)

### Community 121 - "useProfileUpload.ts"
Cohesion: 0.42
Nodes (7): expo-document-picker, FileEntry, useProfileUpload(), extensionOf(), formatFileSize(), MAX_BYTES, withoutExtension()

### Community 122 - "background_check_settings.py"
Cohesion: 0.10
Nodes (9): is_scrapling_browser_installed(), BackgroundCheckSettings, detect_login_page(), extract_title_and_text(), get_scrapling_browser_status(), _log_test_fetch(), test_fetch(), test_login_page_detection_and_title_extraction() (+1 more)

### Community 123 - "docker_credentials_local"
Cohesion: 0.29
Nodes (3): push-rilis.sh script, rilis-apk.sh script, tes-push.sh script

### Community 124 - "frappe_model_document"
Cohesion: 0.05
Nodes (12): BackgroundCheckAccount, BackgroundCheckConsentScope, BackgroundCheckFinding, BackgroundCheckLexicon, BackgroundCheckPlatform, BackgroundCheckSourceRun, ResumeScreeningMetricWeight, ResumeScreeningResult (+4 more)

### Community 132 - "formatShortDateWithYear"
Cohesion: 0.29
Nodes (5): ID, LabelCategory, MONTHS_ID, translateNotification(), mapNotification()

### Community 133 - "trustedTime.ts"
Cohesion: 0.08
Nodes (20): expo, clientKey(), fetchClockStatus(), localTime(), sendCheckin(), sendItem(), statusFromQueue(), encode() (+12 more)

### Community 134 - "useOvertime.ts"
Cohesion: 0.33
Nodes (6): OVERTIME_LIMIT_HOURS, OVERTIME_PAY_PER_HOUR, useOvertime(), ALL_TAB, useStaffAttendance(), toISODate()

### Community 135 - "test_bgc_analysis.py"
Cohesion: 0.06
Nodes (30): detect_party_role(), classify_text(), downgrade_severity(), calculate_account_identity_match(), calculate_match_confidence(), evaluate_match_with_excerpt(), generate_name_variants(), is_mononym() (+22 more)

### Community 136 - "useT"
Cohesion: 0.10
Nodes (42): DateSheet(), makeStyles(), makeStyles(), NavBar(), useT(), goBackAnimated(), AttendanceStack(), HomeStack() (+34 more)

### Community 137 - "useProfileEdit.ts"
Cohesion: 0.32
Nodes (11): useProfileData(), useProfileEdit(), EditableProfile, EmergencyContact, FamilyMember, completenessPercent(), findShortcomings(), isValidEmail() (+3 more)

### Community 138 - "AnimatedSplash.tsx"
Cohesion: 0.16
Nodes (17): expo-file-system, expo-intent-launcher, expo-splash-screen, expo-updates, AnimatedSplash(), EASE, makeStyles(), NAMA (+9 more)

### Community 140 - "initiate_background_check"
Cohesion: 0.09
Nodes (3): initiate_background_check(), TestBackgroundCheckConsent, TestBackgroundCheckPhase7

### Community 141 - "test_resume_screening_workflow.py"
Cohesion: 0.10
Nodes (7): bulk_rescreen(), on_job_applicant_insert(), on_job_applicant_update(), rescreen(), rescreen_applicant(), trigger_screening_if_eligible(), TestResumeScreeningWorkflow

### Community 142 - "re"
Cohesion: 0.07
Nodes (22): _detect_multi_column(), extract_docx(), extract_pdf(), ExtractionResult, normalize_text(), PageData, evaluate(), evaluate() (+14 more)

### Community 144 - "test_scoring.py"
Cohesion: 0.07
Nodes (26): run_screening(), extract_cv(), _build_header_regex(), count_recognized_sections(), split_sections(), calculate_total_score(), get_template_for_job(), on_interview_update() (+18 more)

### Community 145 - "FindingData"
Cohesion: 0.08
Nodes (10): analyze_posts(), get_fetch_config_from_settings(), FindingData, MockProvider, PostsProvider, WebSearchProvider, _save_findings(), test_analyze_posts_politeness_and_activity() (+2 more)

### Community 146 - "test_i18n.py"
Cohesion: 0.08
Nodes (22): generate_automated_summary(), validate_consent_text_version(), _format_rendered(), _load_csv_translations(), LocalizedText, render(), _render_single_template(), _translate_template_str() (+14 more)

### Community 147 - "frappe"
Cohesion: 0.13
Nodes (14): execute(), execute(), validate_interview(), after_install(), after_migrate(), setup_custom_fields(), setup_default_lexicon(), setup_default_platforms() (+6 more)

### Community 148 - "update_finding_verdict"
Cohesion: 0.24
Nodes (3): get_findings_data(), rerun_background_check(), update_finding_verdict()

### Community 149 - "translate"
Cohesion: 0.16
Nodes (22): ColleagueSheet(), makeStyles(), translate(), attachmentLabel(), getLeaveInfo(), IMPORTANT_LEAVE_KINDS, isImportantLeave(), kindName() (+14 more)

### Community 150 - "submit_candidate_consent"
Cohesion: 0.12
Nodes (12): 2. Matriks Audit Kepatuhan Spesifikasi, 4.1 Tabel Rekapitulasi Temuan Tinggi & Sedang, clean_bgc_cache(), clean_bgc_crawldir(), delete_file_record_and_disk(), revoke_consent(), submit_candidate_consent(), get_cache_key() (+4 more)

### Community 151 - "AttendanceHistoryScreen.tsx"
Cohesion: 0.20
Nodes (18): DonutChart(), Props, Segment, styles, ATTENDANCE_STATUS_TONE, AttendanceHistoryScreen(), makeStyles(), Recap() (+10 more)

### Community 152 - "generate_fixtures.py"
Cohesion: 0.22
Nodes (11): create_docx(), create_english_pdf(), create_fresh_graduate_pdf(), create_indonesian_pdf(), create_mixed_dates_pdf(), create_no_phone_pdf(), create_overlapping_roles_pdf(), create_scanned_image_pdf() (+3 more)

### Community 153 - "Prompt untuk Antigravity: Resume Screening + Background Check di ERPNext"
Cohesion: 0.10
Nodes (20): exists(), make(), Aturan kerja, Fase 0: Kerangka dan setup pengembangan, Fase 1: Doctype Resume Screening, Fase 2: Ekstraksi dan 9 metrik (fungsi murni), Fase 3: Alur Resume Screening, Fase 4: Tampilan Resume Screening (+12 more)

### Community 155 - "LoginScreen.tsx"
Cohesion: 0.23
Nodes (12): react-native-svg, LanguagePicker(), LogoHris(), Props, RadialGlow(), LoginScreen(), makeStyles(), makeStyles() (+4 more)

### Community 156 - "index.tsx"
Cohesion: 0.24
Nodes (9): en, id, TranslationKey, content(), Ctx, DICTIONARY, Language, LanguageCtx (+1 more)

### Community 157 - "translateServerLabel"
Cohesion: 0.11
Nodes (26): translateServerLabel(), fetchBalances(), fetchCurrentEmployee(), fetchLeaveAttachments(), fetchOvertime(), fetchOwn(), fetchPending(), fetchRole() (+18 more)

### Community 158 - "fetch.py"
Cohesion: 0.10
Nodes (8): FetchError, FetchNetworkError, get_blocked_domains(), get_site_secret(), hash_url(), RobotsDisallowedError, StealthBrowserNotInstalledError, test_hmac_cache_key_generation()

### Community 159 - "enabled"
Cohesion: 0.21
Nodes (12): enabled(), weight(), 4.2 Background Check Finding, 4.3 Background Check Platform (katalog), 4.4 Background Check Lexicon, 4.5 Background Check Settings (Single), 4. Doctype baru, 3.1 Resume Screening Template (+4 more)

### Community 160 - "Spesifikasi: Background Checking di ERPNext"
Cohesion: 0.15
Nodes (12): 10. Hal yang perlu diputuskan sebelum dibangun, 11. Urutan pengerjaan setelah disetujui, 1. Posisi di alur, 2.1 Bagian layar 10 yang tidak akan dibangun, 2. Telaah desain per layar, 3. Persetujuan kandidat (wajib sebelum pengecekan), 5.1 Mesin pengambil halaman: Scrapling, 5. Sumber data (+4 more)

### Community 161 - "run_all_sources"
Cohesion: 0.10
Nodes (4): RedisUnavailableError, run_all_sources(), TestBackgroundCheckRunner, fake_fetch()

### Community 162 - "ProfilePhotoScreen.tsx"
Cohesion: 0.35
Nodes (9): Head(), HeadVariant, Button(), ErrorBox(), Guide(), makeStyles(), Mark(), ProfilePhotoScreen() (+1 more)

### Community 163 - "Spesifikasi: Resume Screening (ATS) di ERPNext"
Cohesion: 0.20
Nodes (9): 10. Hal yang perlu diputuskan sebelum dibangun, 11. Urutan pengerjaan setelah disetujui, 1. Posisi di alur rekrutmen, 2. Keputusan arsitektur: perlu custom app, 4. Field tambahan di doctype bawaan, 6. Alur proses, 8. Hak akses, 9. Privasi dan keadilan (+1 more)

### Community 164 - "TestBackgroundCheckSocialConsent"
Cohesion: 0.08
Nodes (4): is_social_account(), TestBackgroundCheckSocialConsent, test_guard_i_social_media_scope_and_account_runner_isolation(), get_context()

### Community 165 - "6. Algoritma (tanpa LLM)"
Cohesion: 0.22
Nodes (9): 6.1 Persiapan identitas, 6.2.1 Kecocokan identitas akun platform, 6.2 Skor kecocokan identitas (Article, File, Case), 6.3 Klasifikasi Article dan File, 6.4 Case history, 6.5 Analisis post (pengganti layar 10), 6.6 Tingkat risiko, 6.7 Ringkasan otomatis (layar 03) (+1 more)

### Community 167 - "Prompt untuk Antigravity: Lapisan pengambil halaman Scrapling untuk Background Check"
Cohesion: 0.10
Nodes (18): 5a. Field baru, 5b. Penelusuran semua halaman (Spider), 5c. Selektor adaptif dan `find_similar`, 5d. PDF putusan, 5e. Kecocokan identitas akun platform, 5f. Isi artikel bersih (disiapkan, belum dipakai), Aturan kerja, Fase 1: Dependensi dan setup (+10 more)

### Community 168 - "background_check.js"
Cohesion: 0.14
Nodes (7): consent_file(), consent_method(), 3a. Domain terlarang menjadi settingan, 3b. Persetujuan kandidat untuk media sosial (wajib, per akun), 3c. Tombol "Uji pengambilan" di Settings, Fase 3: Domain media sosial sebagai settingan, persetujuan kandidat, dan tombol uji, 4.1 Background Check

### Community 169 - "README.md"
Cohesion: 0.17
Nodes (11): Attribution, Aturan Internasionalisasi (i18n Rules), Audit & Kepatuhan, Contributing, Fitur Utama, HRIS ATS, Installation, License (+3 more)

### Community 171 - "eslint.config.js"
Cohesion: 0.40
Nodes (4): { defineConfig }, expoConfig, eslint, eslint-config-expo

### Community 172 - "5. Algoritma penilaian (tanpa LLM)"
Cohesion: 0.40
Nodes (5): 5.1 Ekstraksi, 5.2 Metrik (masing-masing 0–100), 5.3 Skor total dan label, 5.4 Batasan yang harus diketahui, 5. Algoritma penilaian (tanpa LLM)

### Community 179 - "get_default_cache_backend"
Cohesion: 0.11
Nodes (15): get_default_cache_backend(), is_redis_available(), test_get_default_cache_backend_fail_closed_in_live(), Aturan kerja, Fase 1: Audit dan baseline (tanpa mengubah perilaku), Fase 2: Bahasa yang konsisten, Fase 4: Perbaikan temuan audit, Fase 5: Verifikasi akhir (+7 more)

### Community 207 - "FaceCheck.tsx"
Cohesion: 0.22
Nodes (16): useFaceEnroll(), FaceCheck(), makeStyles(), advanceSequence(), Challenge, detectFace(), DetectionResult, getFaceEmbedding() (+8 more)

### Community 209 - "FetchConfig"
Cohesion: 0.17
Nodes (8): FetchConfig, MemoryCacheBackend, test_cache_hit_does_not_hit_network(), test_forbidden_domains_always_rejected(), test_rate_limiting_enforced(), test_robots_txt_enforcement(), mock_raw_fetch(), test_stealth_without_browser_raises_exception()

### Community 210 - "test_fetch.py"
Cohesion: 0.17
Nodes (7): determine_mode(), get_domain(), is_forbidden_domain(), setup_test_site_secret(), test_determine_mode_combinations(), test_domain_extraction_and_forbidden_check(), test_dynamic_blocked_domains_and_subdomains()

### Community 211 - "Prompt untuk Antigravity: Media sosial penuh pada Background Check"
Cohesion: 0.12
Nodes (15): 1a. Eskalasi otomatis mode pengambilan, 1b. Penjaga persetujuan terpusat, 1c. Provider media sosial publik, Aturan kerja, Fase 1: Post publik lewat crawl, stealth, dan eskalasi otomatis, Fase 2: Unggah ekspor data oleh kandidat, Fase 3: Koneksi OAuth resmi (opsional), Fase 4: Verifikasi akhir dan audit (+7 more)

### Community 212 - "SamsungRing.tsx"
Cohesion: 0.23
Nodes (14): CircleAnim, EASE, FaceRing(), GAnim, LineAnim, TICKS, clamp(), DIRECTION_ANGLE (+6 more)

### Community 213 - "fetch"
Cohesion: 0.25
Nodes (5): BaseCacheBackend, check_robots_txt(), enforce_rate_limit(), fetch(), FrappeRedisCacheBackend

### Community 214 - "ClockScreen"
Cohesion: 0.24
Nodes (11): useClock(), setTabBarHidden(), ClockScreen(), DoneMeta(), makeStyles(), isFaceSupported(), difference(), formatDuration() (+3 more)

### Community 215 - "test_article.py"
Cohesion: 0.27
Nodes (3): extract_article_text(), test_extract_article_text_fallback_when_page_markdown_missing(), test_extract_article_text_with_sample_fixture()

### Community 216 - "Kelemahan dan solusi"
Cohesion: 0.22
Nodes (8): Backlog: ide perbaikan akurasi skor Resume Screening (ATS), Catatan lain yang ikut dibereskan, Dampak rendah, Dampak sedang, Dampak tinggi, Kelemahan dan solusi, Keyakinan dan keadilan, Urutan yang disarankan

### Community 217 - "AUDIT BASELINE & INVENTARIS SISTEM HRIS_ATS (FASE 1)"
Cohesion: 0.29
Nodes (7): 1. Ringkasan Eksekutif & Hasil Baseline, 3.1 Rincian Masalah Kritis String UI, 3.2 Tabel Lengkap Inventaris String, 3. Inventaris String UI (Total: 552 Entri), 4. Status Penyelesaian Temuan Audit (Fase 1 s.d. 4), 5. Temuan Tak Terduga & Kondisi Lingkungan, AUDIT BASELINE & INVENTARIS SISTEM HRIS_ATS (FASE 1)

### Community 218 - "TaxScreen.tsx"
Cohesion: 0.57
Nodes (6): BAR_HEIGHT, BpjsRow(), LegendDot(), makeStyles(), percent(), TaxScreen()

## Knowledge Gaps
- **30 isolated node(s):** `hris_ats`, `Foundation`, `@expo/metro-runtime`, `expo-build-properties`, `react-native-screens` (+25 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 978 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **131 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HrisApi` connect `HrisApi` to `services/types.ts`, `mockApi.ts`, `erpnextApi.ts`, `useSession`, `background_check.js`?**
  _High betweenness centrality (0.358) - this node is a cross-community bridge._
- **What connects `hris_ats`, `Foundation`, `@expo/metro-runtime` to the rest of the system?**
  _30 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `date.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14153846153846153 - nodes in this community are weakly interconnected._
- **Why does `Fase 3: Domain media sosial sebagai settingan, persetujuan kandidat, dan tombol uji` connect `background_check.js` to `get_default_cache_backend`?**
  _High betweenness centrality (0.348) - this node is a cross-community bridge._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.12598770851624233 - nodes in this community are weakly interconnected._
- **Should `services/types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.052854122621564484 - nodes in this community are weakly interconnected._
- **Should `useFaceEnroll.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._