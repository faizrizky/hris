# Graph Report - hris-mobile  (2026-10-20)

## Corpus Check
- 441 files · ~279,310 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 22 file(s) not represented in the graph (top: (none) 10, .zip 5, .onnx 3)

## Summary
- 2795 nodes · 8402 edges · 247 communities (112 shown, 135 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 223 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `48d60a53`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- date.ts
- HrisClockModule.swift
- goBackAnimated
- services/types.ts
- useFaceEnroll.ts
- react
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
- useTheme
- Ceklis uji di HP
- useWorkLocation.ts
- useSession
- useAttendanceCorrection.ts
- LeaveRequestScreen.tsx
- HrisFaceModule.kt
- useProfilePhotoScreen.ts
- offlineQueue.ts
- FloatingTabBar.tsx
- ErrorState
- useProfileSecurity.ts
- session.tsx
- face_lib.py
- FetchResult
- Web (admin/HR)
- useLeaveRequestForm.ts
- useProfileUpload.ts
- BackgroundCheckSettings
- docker_credentials_local
- frappe_model_document
- device_lib.py
- kirim-update.sh
- formatShortDateWithYear
- trustedTime.ts
- useOvertime.ts
- test_bgc_analysis.py
- index.tsx
- useProfileEdit.ts
- AnimatedSplash.tsx
- initiate_background_check
- test_resume_screening_workflow.py
- re
- test_scoring.py
- FindingData
- test_i18n.py
- frappe
- export_processor.py
- translate
- test_background_check_social_consent.py
- AttendanceHistoryScreen.tsx
- test_export.py
- Prompt untuk Antigravity: Resume Screening + Background Check di ERPNext
- TestResumeScreeningTemplate
- crawler_session.py
- test_social.py
- translateServerLabel
- fetch.py
- enabled
- Spesifikasi: Background Checking di ERPNext
- run_all_sources
- detect_login_page
- Spesifikasi: Resume Screening (ATS) di ERPNext
- .test_ats_consent_context_contains_all_social_platforms_and_other_accounts
- 6. Algoritma (tanpa LLM)
- ResumeScreeningTemplate
- Prompt untuk Antigravity: Lapisan pengambil halaman Scrapling untuk Background Check
- background_check.js
- README.md
- eslint.config.js
- 5. Algoritma penilaian (tanpa LLM)
- get_default_cache_backend
- test_crawler_account.py
- hris_ats
- FaceCheck.tsx
- TestBackgroundCheckSettings
- FetchConfig
- background_check_settings.py
- Prompt untuk Antigravity: Media sosial penuh pada Background Check
- SamsungRing.tsx
- _fetch_single_mode
- ClockScreen
- _read_fixture
- Kelemahan dan solusi
- AUDIT BASELINE & INVENTARIS SISTEM HRIS_ATS (FASE 1)
- useT
- revoke_consent
- i18n.py
- resume_screening_template.js
- background_check_settings.js
- extract.py
- Reveal.tsx
- TestBackgroundCheckExport
- evaluate_case_severity
- Prompt untuk Antigravity: Perbaikan setelah uji Fase 2 (sosmed)
- clean_snippet
- BackgroundCheckCrawlerAccount
- AppraisalScreen.tsx
- useProfilePassword.ts
- parse_facebook_export
- test_candidate_comments_lookback_and_author_filter
- classify_text
- crawler_login_dialog.js
- 5. Sumber data
- DatePickerCard.tsx
- greeting.ts
- PlatformCheckProvider
- TripExpenseCard
- generate_automated_summary

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
- `Fase 4: Ekspor data kandidat: post dan komentar milik kandidat` --references--> `assert_social_consent()`  [INFERRED]
  PROMPT-ANTIGRAVITY-SOSMED.md → docker/apps/hris_ats/hris_ats/bgc/consent.py
- `Fase 5: Koneksi OAuth resmi (opsional)` --references--> `assert_social_consent()`  [INFERRED]
  PROMPT-ANTIGRAVITY-SOSMED.md → docker/apps/hris_ats/hris_ats/bgc/consent.py
- `3a. Domain terlarang menjadi settingan` --references--> `ForbiddenDomainError`  [INFERRED]
  PROMPT-ANTIGRAVITY-PERBAIKAN.md → docker/apps/hris_ats/hris_ats/bgc/fetch.py
- `5.1 Mesin pengambil halaman: Scrapling` --references--> `ForbiddenDomainError`  [INFERRED]
  SPEC-BACKGROUND-CHECK.md → docker/apps/hris_ats/hris_ats/bgc/fetch.py
- `Fase 4: Provider live lewat `fetch.py` dan pemakaian `mock_provider`` --references--> `FetchConfig`  [INFERRED]
  PROMPT-ANTIGRAVITY-SCRAPLING.md → docker/apps/hris_ats/hris_ats/bgc/fetch.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Seed, server scripts and smoke test flow** — docker_readme_seed, docker_readme_server_scripts, docker_readme_smoke_test, docker_readme_test_accounts [EXTRACTED 0.85]
- **ERPNext dev compose stack services** — docker_docker_compose_backend, docker_docker_compose_frontend, docker_docker_compose_websocket, docker_docker_compose_queue_workers, docker_docker_compose_scheduler, docker_docker_compose_db, docker_docker_compose_redis [EXTRACTED 0.95]
- **HrisApi contract with mock and ERPNext implementations** — readme_hrisapi_contract, readme_mock_api, readme_erpnext_api, readme_api_index_swap [EXTRACTED 0.95]

## Communities (247 total, 135 thin omitted)

### Community 0 - "date.ts"
Cohesion: 0.20
Nodes (18): useLeaveRequestForm(), getActiveLanguage(), employmentText(), countDays(), countWorkdays(), formatHourDuration(), formatLongDate(), formatShortDate() (+10 more)

### Community 1 - "HrisClockModule.swift"
Cohesion: 0.20
Nodes (4): ExpoModulesCore, Foundation, HrisClockModule, HrisFaceModule

### Community 2 - "goBackAnimated"
Cohesion: 0.12
Nodes (39): expo-linear-gradient, react-native-safe-area-context, react-native-svg, PrimaryButton(), Props, styles, RevealScrollView, useAppraisalFeedback() (+31 more)

### Community 3 - "services/types.ts"
Cohesion: 0.06
Nodes (39): Props, CORRECTION_STATUS_LABEL, CORRECTION_STATUS_TONE, DOC_STATUS_TONE, LEAVE_TYPE_LABEL, LEAVE_TYPE_TONE, leaveDecisionBadge(), localizeLabels() (+31 more)

### Community 4 - "useFaceEnroll.ts"
Cohesion: 0.09
Nodes (24): EnrollAnimationValues, ENTER_EASING, useEnrollAnimations(), Challenge, COMMAND_TIMEOUT_MS, ENOUGH, HINT_MS, median() (+16 more)

### Community 5 - "react"
Cohesion: 0.15
Nodes (30): @expo/vector-icons, react, react-native, ConfirmContext, ConfirmDialog(), ConfirmFn, ConfirmOptions, makeStyles() (+22 more)

### Community 6 - "mockApi.ts"
Cohesion: 0.08
Nodes (40): attendanceCorrections, clockState, documents, inbox, leaveRequests, pendingApprovals, MOCK_APPRAISAL, MOCK_ATTENDANCE (+32 more)

### Community 8 - "erpnextApi.ts"
Cohesion: 0.04
Nodes (66): AppraisalRes, attachAll(), AttachmentRow, AttendanceRow, BALANCE_KINDS, ChangeRow, clean(), clientKey() (+58 more)

### Community 9 - "AttendanceCorrectionHistoryScreen.tsx"
Cohesion: 0.09
Nodes (61): EmptyState(), makeStyles(), ListSearchBar(), makeStyles(), LoadMoreButton(), makeStyles(), makeStyles(), PagedItems() (+53 more)

### Community 10 - "package.json"
Cohesion: 0.08
Nodes (24): main, name, private, version, @babel/core, babel-plugin-module-resolver, babel-preset-expo, expo-application (+16 more)

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
Cohesion: 0.15
Nodes (10): ensure_adaptive_page(), query_adaptive_element(), parse_court_ma_detail_page(), parse_court_ma_search_page(), parse_indonesian_date(), test_parse_court_ma_detail_page_fixture(), test_parse_court_ma_search_page_fixture(), test_parse_court_ma_search_unparseable_structure_raises() (+2 more)

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

### Community 30 - "useTheme"
Cohesion: 0.08
Nodes (46): Card(), makeStyles(), GlassPill(), Props, styles, IconBox(), makeStyles(), LanguagePicker() (+38 more)

### Community 39 - "Ceklis uji di HP"
Cohesion: 0.13
Nodes (14): Ceklis uji di HP, Fase 0: Persiapan, Fase 1: Login dan sesi, Fase 2: Bahasa, Fase 3: Karyawan (rani), Fase 3b: Fitur lanjutan (rani, dewi, sari), Fase 3c: Foto profil dan verifikasi wajah (rani, sari, dewi), Fase 3d: Build baru (com.hrismobile): perangkat, kunci, biometrik, anti-spoofing, push (+6 more)

### Community 40 - "useWorkLocation.ts"
Cohesion: 0.28
Nodes (8): expo-location, distanceInMeters(), LocationPermission, NearestWorkLocation, toCheckinLocation(), useWorkLocation(), CheckinLocation, GeofenceRule

### Community 41 - "useSession"
Cohesion: 0.13
Nodes (33): @react-navigation/native, useConfirm(), useActivePolling(), Filter, useAttendanceCorrectionHistory(), Filter, useAttendanceHistory(), useDocumentReview() (+25 more)

### Community 47 - "useAttendanceCorrection.ts"
Cohesion: 0.15
Nodes (15): CHECKIN_MAX_MINUTES, CHECKIN_MIN_MINUTES, CHECKOUT_MAX_MINUTES, CHECKOUT_MIN_MINUTES, DEFAULT_CHECKIN_MINUTES, DEFAULT_CHECKOUT_MINUTES, useAttendanceCorrection(), CorrectionKind (+7 more)

### Community 72 - "LeaveRequestScreen.tsx"
Cohesion: 0.22
Nodes (16): ApprovalFlowCard(), FormDoneView(), makeStyles(), DOC_NAMA, LeaveRequestForm(), LeaveRequestScreen(), makeStyles(), makeStyles() (+8 more)

### Community 104 - "useProfilePhotoScreen.ts"
Cohesion: 0.28
Nodes (9): expo-image-picker, useProfile(), cache, useProfilePhoto(), EASE, UpdateStage, useProfilePhotoScreen(), downloadFile() (+1 more)

### Community 108 - "offlineQueue.ts"
Cohesion: 0.25
Nodes (12): useQueueCount(), syncQueue(), antre(), getQueue, getQueueCount(), Listener, listeners, listenToQueue() (+4 more)

### Community 109 - "FloatingTabBar.tsx"
Cohesion: 0.18
Nodes (16): FloatingTabBar(), LABEL, makeStyles(), RIGHT, TONE_ICONS, NotificationTab, useNotification(), markBackNavigation() (+8 more)

### Community 110 - "ErrorState"
Cohesion: 0.18
Nodes (23): ErrorState(), makeStyles(), makeStyles(), PdfButton(), goBackOrHome(), Line(), makeStyles(), PayslipCompareCard() (+15 more)

### Community 111 - "useProfileSecurity.ts"
Cohesion: 0.16
Nodes (29): @react-native-async-storage/async-storage, useLogin(), LoginPrefillHandlers, useLoginPrefill(), USERNAME_STORAGE_KEY, useProfileSecurity(), getServerAddress(), setServerAddress() (+21 more)

### Community 112 - "session.tsx"
Cohesion: 0.24
Nodes (13): App(), expo-status-bar, ConfirmProvider(), useRegisterPushToken(), useSyncAccountLanguage(), useSyncOfflineCheckins(), LanguageProvider(), setSessionExpiredHandler() (+5 more)

### Community 113 - "face_lib.py"
Cohesion: 0.22
Nodes (3): fl_centroid(), fl_norm(), fl_parse()

### Community 114 - "FetchResult"
Cohesion: 0.10
Nodes (22): FetchResult, CourtMAProvider, extract_party_identity_from_pdf(), _generate_blank_pdf_bytes(), test_court_ma_pagination_all_three_pages_and_crawldir_lifecycle(), fake_fetch(), test_court_ma_pagination_stops_at_max_results(), fake_fetch() (+14 more)

### Community 115 - "Web (admin/HR)"
Cohesion: 0.18
Nodes (10): Core HR, Gap fitur KantorKu vs HRIS kita, General & Employee Services, Learning & Development, Mobile (ESS App), Payroll, Finance & Benefits, Performance Management, Prioritas (+2 more)

### Community 116 - "useLeaveRequestForm.ts"
Cohesion: 0.18
Nodes (10): FORM_META, FORM_SEGMENTS, FormKind, LeaveRequestParams, LeaveKind, SERVER_KINDS, Expense, TransportMode (+2 more)

### Community 121 - "useProfileUpload.ts"
Cohesion: 0.23
Nodes (12): expo-document-picker, expo-image-manipulator, FileEntry, useProfileUpload(), DocCategory, extensionOf(), formatFileSize(), MAX_BYTES (+4 more)

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
Cohesion: 0.12
Nodes (14): expo, addressReady, DEFAULT_SERVER_ADDRESS, encode(), get(), Params, put(), request() (+6 more)

### Community 134 - "useOvertime.ts"
Cohesion: 0.29
Nodes (7): OVERTIME_LIMIT_HOURS, OVERTIME_PAY_PER_HOUR, useOvertime(), ALL_TAB, useStaffAttendance(), StaffDirectory, toISODate()

### Community 135 - "test_bgc_analysis.py"
Cohesion: 0.09
Nodes (25): calculate_account_identity_match(), calculate_match_confidence(), evaluate_match_with_excerpt(), generate_name_variants(), is_mononym(), normalize_name(), analyze_posts(), test_analyze_posts_politeness_and_activity() (+17 more)

### Community 136 - "index.tsx"
Cohesion: 0.11
Nodes (27): DateSheet(), makeStyles(), Props, en, id, TranslationKey, content(), Ctx (+19 more)

### Community 137 - "useProfileEdit.ts"
Cohesion: 0.32
Nodes (11): useProfileData(), useProfileEdit(), EditableProfile, EmergencyContact, FamilyMember, completenessPercent(), findShortcomings(), isValidEmail() (+3 more)

### Community 138 - "AnimatedSplash.tsx"
Cohesion: 0.15
Nodes (18): expo-file-system, expo-intent-launcher, expo-splash-screen, expo-updates, AnimatedSplash(), EASE, makeStyles(), NAMA (+10 more)

### Community 140 - "initiate_background_check"
Cohesion: 0.08
Nodes (3): initiate_background_check(), TestBackgroundCheckConsent, TestBackgroundCheckPhase7

### Community 141 - "test_resume_screening_workflow.py"
Cohesion: 0.07
Nodes (13): bulk_rescreen(), get_template_for_job(), on_interview_update(), on_job_applicant_insert(), on_job_applicant_update(), on_job_offer_update(), process_resume_screening(), rescreen() (+5 more)

### Community 142 - "re"
Cohesion: 0.08
Nodes (17): ExtractionResult, evaluate(), evaluate(), evaluate(), evaluate(), extract_date_ranges(), parse_date_token(), detect_candidate_degree() (+9 more)

### Community 144 - "test_scoring.py"
Cohesion: 0.10
Nodes (22): run_screening(), extract_cv(), _build_header_regex(), count_recognized_sections(), split_sections(), calculate_total_score(), test_all_10_fixtures_end_to_end(), test_extraction_docx() (+14 more)

### Community 145 - "FindingData"
Cohesion: 0.11
Nodes (9): is_redis_available(), BaseProvider, FindingData, MockProvider, PostsProvider, WebSearchProvider, _save_findings(), test_mock_provider_runs_offline() (+1 more)

### Community 146 - "test_i18n.py"
Cohesion: 0.07
Nodes (28): _clean_snippet(), _is_allowed(), _parse_csv_rows(), parse_linkedin_export(), validate_consent_text_version(), execute(), create_docx(), create_english_pdf() (+20 more)

### Community 147 - "frappe"
Cohesion: 0.10
Nodes (16): execute(), execute(), execute(), execute(), execute(), after_install(), after_migrate(), setup_custom_fields() (+8 more)

### Community 148 - "export_processor.py"
Cohesion: 0.11
Nodes (6): calculate_risk_level(), process_candidate_export_data(), upload_candidate_export(), get_findings_data(), rerun_background_check(), update_finding_verdict()

### Community 149 - "translate"
Cohesion: 0.19
Nodes (18): ColleagueSheet(), makeStyles(), makeStyles(), PickerSheet(), translate(), attachmentLabel(), getLeaveInfo(), IMPORTANT_LEAVE_KINDS (+10 more)

### Community 150 - "test_background_check_social_consent.py"
Cohesion: 0.11
Nodes (8): delete_file_record_and_disk(), daily_retention_purge(), assert_test_site(), ensure_test_company(), ensure_test_encryption_key(), ensure_test_hr_user(), _guarded_setup(), _guarded_setup_class()

### Community 151 - "AttendanceHistoryScreen.tsx"
Cohesion: 0.14
Nodes (25): DonutChart(), Props, Segment, styles, makeStyles(), StatusBadge(), ATTENDANCE_STATUS_LABEL, ATTENDANCE_STATUS_TONE (+17 more)

### Community 152 - "test_export.py"
Cohesion: 0.09
Nodes (24): 6.1 Matriks Verifikasi Fitur Fase 3, 3e, 4, 5, dan 6, parse_candidate_export(), _clean_snippet(), _format_timestamp(), _is_allowed(), parse_instagram_export(), ArchiveSizeExceededError, ExportSecurityError (+16 more)

### Community 153 - "Prompt untuk Antigravity: Resume Screening + Background Check di ERPNext"
Cohesion: 0.10
Nodes (20): exists(), make(), Aturan kerja, Fase 0: Kerangka dan setup pengembangan, Fase 1: Doctype Resume Screening, Fase 2: Ekstraksi dan 9 metrik (fungsi murni), Fase 3: Alur Resume Screening, Fase 4: Tampilan Resume Screening (+12 more)

### Community 155 - "crawler_session.py"
Cohesion: 0.09
Nodes (16): assert_crawler_admin(), close_login_session(), complete_login_session(), disconnect_account(), get_crawler_account_for_domain(), get_crawler_account_for_platform(), get_crawler_accounts_list(), get_redis_client() (+8 more)

### Community 156 - "test_social.py"
Cohesion: 0.14
Nodes (18): assert_social_consent(), SocialConsentError, get_social_adapter(), SocialPublicProvider, DummyAccount, DummyBGC, DummyScopeRow, setup_test_site_env() (+10 more)

### Community 157 - "translateServerLabel"
Cohesion: 0.13
Nodes (22): translateServerLabel(), fetchBalances(), fetchCurrentEmployee(), fetchOvertime(), fetchOwn(), fetchRole(), fetchTrips(), fetchWfh() (+14 more)

### Community 158 - "fetch.py"
Cohesion: 0.07
Nodes (18): 4.1 Tabel Rekapitulasi Temuan Tinggi & Sedang, determine_mode(), FetchError, FetchNetworkError, get_cache_key(), get_default_cache_backend(), get_site_secret(), hash_url() (+10 more)

### Community 159 - "enabled"
Cohesion: 0.36
Nodes (7): enabled(), 4.2 Background Check Finding, 4.3 Background Check Platform (katalog), 4.4 Background Check Lexicon, 4.5 Background Check Settings (Single), 4.6 Background Check Crawler Account, 4. Doctype

### Community 160 - "Spesifikasi: Background Checking di ERPNext"
Cohesion: 0.17
Nodes (11): 10. Keputusan, 11. Status pengerjaan, 12. Bahasa dan terjemahan, 13. Urutan pengerjaan yang tersisa, 1. Posisi di alur, 2.1 Yang tidak dibangun, 2. Telaah desain per layar, 7. Pemetaan layar ke Desk (+3 more)

### Community 161 - "run_all_sources"
Cohesion: 0.07
Nodes (8): 2. Matriks Audit Kepatuhan Spesifikasi, submit_candidate_consent(), is_social_account(), run_all_sources(), TestBackgroundCheckRunner, TestBackgroundCheckSocialConsent, fake_fetch(), test_guard_i_social_media_scope_and_account_runner_isolation()

### Community 162 - "detect_login_page"
Cohesion: 0.14
Nodes (9): create_adaptive_adaptor(), get_adaptive_db_file(), get_adaptive_storage_dir(), is_response_blocked(), anonymize_mentions(), BaseSocialAdapter, detect_login_page(), extract_page_signals() (+1 more)

### Community 163 - "Spesifikasi: Resume Screening (ATS) di ERPNext"
Cohesion: 0.17
Nodes (11): 10. Hal yang perlu diputuskan sebelum dibangun, 11. Urutan pengerjaan setelah disetujui, 12. Bahasa dan terjemahan, 1. Posisi di alur rekrutmen, 2. Keputusan arsitektur: perlu custom app, 4. Field tambahan di doctype bawaan, 6. Alur proses, 7. Pemetaan layar desain ke Desk (+3 more)

### Community 165 - "6. Algoritma (tanpa LLM)"
Cohesion: 0.22
Nodes (9): 6.1 Persiapan identitas, 6.2.1 Kecocokan identitas akun platform, 6.2 Skor kecocokan identitas (Article, File, Case), 6.3 Klasifikasi Article dan File, 6.4 Case history, 6.5 Analisis post dan komentar (pengganti layar 10), 6.6 Tingkat risiko, 6.7 Ringkasan otomatis (layar 03) (+1 more)

### Community 167 - "Prompt untuk Antigravity: Lapisan pengambil halaman Scrapling untuk Background Check"
Cohesion: 0.10
Nodes (18): 5a. Field baru, 5b. Penelusuran semua halaman (Spider), 5c. Selektor adaptif dan `find_similar`, 5d. PDF putusan, 5e. Kecocokan identitas akun platform, 5f. Isi artikel bersih (disiapkan, belum dipakai), Aturan kerja, Fase 1: Dependensi dan setup (+10 more)

### Community 168 - "background_check.js"
Cohesion: 0.13
Nodes (13): consent_file(), consent_method(), render_account_findings(), renderCard(), social_consent(), 3a. Domain terlarang menjadi settingan, 3b. Persetujuan kandidat untuk media sosial (wajib, per akun), 3c. Tombol "Uji pengambilan" di Settings (+5 more)

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
Cohesion: 0.17
Nodes (11): Aturan kerja, Fase 2: Bahasa yang konsisten, Fase 4: Perbaikan temuan audit, Fase 5: Verifikasi akhir, Format laporan setiap fase, Kapan wajib berhenti dan bertanya, Keputusan, Konteks (+3 more)

### Community 204 - "test_crawler_account.py"
Cohesion: 0.08
Nodes (4): filter_and_validate_cookies(), save_crawler_storage_state(), ensure_test_bgc_officer_user(), TestCrawlerAccount

### Community 207 - "FaceCheck.tsx"
Cohesion: 0.14
Nodes (17): expo-camera, FaceCheck(), makeStyles(), advanceSequence(), Challenge, detectFace(), DetectionResult, getFaceEmbedding() (+9 more)

### Community 208 - "TestBackgroundCheckSettings"
Cohesion: 0.07
Nodes (3): TestBackgroundCheckSettings, fake_fetch(), mock_challenge()

### Community 209 - "FetchConfig"
Cohesion: 0.07
Nodes (20): extract_article_text(), fetch(), FetchConfig, ForbiddenDomainError, get_fetch_config_from_settings(), MemoryCacheBackend, test_extract_article_text_fallback_when_page_markdown_missing(), test_extract_article_text_with_sample_fixture() (+12 more)

### Community 210 - "background_check_settings.py"
Cohesion: 0.09
Nodes (15): check_and_update_crawler_rate_limits(), extract_profile_data_summary(), get_decrypted_storage_state(), get_eligible_crawler_account_for_url(), mark_crawler_account_challenge(), blocked_domains_row_exists(), get_blocked_domains(), get_domain() (+7 more)

### Community 211 - "Prompt untuk Antigravity: Media sosial penuh pada Background Check"
Cohesion: 0.09
Nodes (22): 2a. Doctype dan tab Social Accounts, 2b. Tombol Login: pop-up browser jarak jauh, 2c. Test session, Disconnect, dan status, 2d. Test (tanpa platform sungguhan), 3a. Eskalasi otomatis mode pengambilan, 3b. Penjaga persetujuan terpusat, 3c. Sesi akun crawler pada `fetch.py`, 3d. Provider media sosial per platform (+14 more)

### Community 212 - "SamsungRing.tsx"
Cohesion: 0.23
Nodes (14): CircleAnim, EASE, FaceRing(), GAnim, LineAnim, TICKS, clamp(), DIRECTION_ANGLE (+6 more)

### Community 213 - "_fetch_single_mode"
Cohesion: 0.14
Nodes (9): acquire_crawler_account_lock(), enforce_crawler_delay(), release_crawler_account_lock(), BaseCacheBackend, check_robots_txt(), enforce_rate_limit(), _fetch_single_mode(), FrappeRedisCacheBackend (+1 more)

### Community 214 - "ClockScreen"
Cohesion: 0.27
Nodes (13): useClock(), goHome(), ClockScreen(), DoneMeta(), makeStyles(), makeStyles(), MapPreview(), isFaceSupported() (+5 more)

### Community 215 - "_read_fixture"
Cohesion: 0.24
Nodes (11): FacebookAdapter, InstagramAdapter, _read_fixture(), test_facebook_adapter_login_wall(), test_facebook_adapter_not_found(), test_facebook_adapter_profile_and_posts(), test_facebook_author_certainty_comments(), test_instagram_adapter_login_wall() (+3 more)

### Community 216 - "Kelemahan dan solusi"
Cohesion: 0.22
Nodes (8): Backlog: ide perbaikan akurasi skor Resume Screening (ATS), Catatan lain yang ikut dibereskan, Dampak rendah, Dampak sedang, Dampak tinggi, Kelemahan dan solusi, Keyakinan dan keadilan, Urutan yang disarankan

### Community 217 - "AUDIT BASELINE & INVENTARIS SISTEM HRIS_ATS (FASE 1)"
Cohesion: 0.25
Nodes (8): 1. Ringkasan Eksekutif & Hasil Baseline, 3.1 Rincian Masalah Kritis String UI, 3.2 Tabel Lengkap Inventaris String, 3. Inventaris String UI (Total: 552 Entri), 4. Status Penyelesaian Temuan Audit (Fase 1 s.d. 4), 5. Temuan Tak Terduga & Kondisi Lingkungan, 6. Audit Akhir & Verifikasi Fase 3 s.d. 6 (Media Sosial, Komentar, Ekspor, & Kepatuhan Penuh), AUDIT BASELINE & INVENTARIS SISTEM HRIS_ATS (FASE 1)

### Community 218 - "useT"
Cohesion: 0.30
Nodes (15): useT(), AnnouncementsList(), AnnouncementsScreen(), Card(), makeStyles(), AttendanceCorrectionScreen(), makeStyles(), CORRECTION_KINDS (+7 more)

### Community 219 - "revoke_consent"
Cohesion: 0.14
Nodes (6): clean_bgc_cache(), clean_bgc_crawldir(), revoke_consent(), get_crawldir(), BackgroundCheck, Manajemen Persetujuan Kandidat & Privasi (UU PDP)

### Community 220 - "i18n.py"
Cohesion: 0.25
Nodes (7): _format_rendered(), _load_csv_translations(), LocalizedText, render(), _render_single_template(), _translate_template_str(), test_guard_d_render_bilingual_behavior()

### Community 221 - "resume_screening_template.js"
Cohesion: 0.25
Nodes (5): weight(), 3.1 Resume Screening Template, 3.2 Resume Screening, 3.3 Resume Screening Settings (Single), 3. Doctype baru

### Community 222 - "background_check_settings.js"
Cohesion: 0.67
Nodes (3): render_crawler_accounts_table(), render_test_fetch_results(), show_test_fetch_dialog()

### Community 224 - "extract.py"
Cohesion: 0.22
Nodes (5): _detect_multi_column(), extract_docx(), extract_pdf(), normalize_text(), PageData

### Community 225 - "Reveal.tsx"
Cohesion: 0.21
Nodes (13): EASE, LAYOUT_KEYS, ListSlot, Reveal(), RevealContext, RevealCtx, RevealFlatList(), RevealScope() (+5 more)

### Community 227 - "evaluate_case_severity"
Cohesion: 0.18
Nodes (5): detect_party_role(), evaluate_case_severity(), test_case_role_detection(), test_case_severity_mapping_criminal_defendant_is_high(), test_case_severity_mapping_perdata_permohonan_is_info()

### Community 228 - "Prompt untuk Antigravity: Perbaikan setelah uji Fase 2 (sosmed)"
Cohesion: 0.18
Nodes (9): Aturan kerja ringkas, Format laporan, Konteks, Perbaikan 1: Deteksi halaman login salah (positif palsu), Perbaikan 2: Test Fetch belum memakai sesi akun crawler, Perbaikan 3: Default field Settings baru tidak terisi (nilai 0), Perbaikan 4: Browser jarak jauh (lanjutan dari temuan sebelumnya), Perbaikan 5: Penyesuaian rencana Fase 3 (+1 more)

### Community 229 - "clean_snippet"
Cohesion: 0.27
Nodes (7): clean_snippet(), TikTokAdapter, test_clean_snippet_anonymizes_mentions(), test_clean_snippet_length_cap(), test_tiktok_adapter_login_wall(), test_tiktok_adapter_profile_and_posts(), test_tiktok_author_certainty_comments()

### Community 231 - "AppraisalScreen.tsx"
Cohesion: 0.47
Nodes (9): makeStyles(), SegmentedControl(), AppraisalSaya(), AppraisalScreen(), GoalCard(), makeStyles(), RaterRow(), ScoreRing() (+1 more)

### Community 232 - "useProfilePassword.ts"
Cohesion: 0.50
Nodes (7): useProfilePassword(), getPasswordRequirements(), getStrengthLabel(), getStrengthTone(), PasswordRequirement, scorePassword(), TOTAL_REQUIREMENTS

### Community 233 - "parse_facebook_export"
Cohesion: 0.39
Nodes (4): _clean_snippet(), _format_timestamp(), _is_allowed(), parse_facebook_export()

### Community 234 - "test_candidate_comments_lookback_and_author_filter"
Cohesion: 0.39
Nodes (4): LinkedInAdapter, test_candidate_comments_lookback_and_author_filter(), test_linkedin_adapter_comments_fixture(), test_linkedin_adapter_profile_and_posts()

### Community 235 - "classify_text"
Cohesion: 0.29
Nodes (4): classify_text(), downgrade_severity(), test_classify_prestasi_and_profesional(), test_classify_risk_lexicon_and_confidence_downgrade()

### Community 236 - "crawler_login_dialog.js"
Cohesion: 0.48
Nodes (5): do_poll(), flush_type_buffer(), get_adaptive_delay(), schedule_next_poll(), send_input_immediately()

### Community 237 - "5. Sumber data"
Cohesion: 0.29
Nodes (7): 5.1 Mesin pengambil halaman: Scrapling, 5.2 Tombol "Test Fetch" di Settings, 5.3 Ekspor data yang diunggah kandidat, 5.4 Koneksi OAuth resmi (opsional), 5.5 Sesi akun crawler (login interaktif), 5.6 Komentar milik kandidat dari crawl, 5. Sumber data

### Community 238 - "DatePickerCard.tsx"
Cohesion: 0.38
Nodes (6): Cell, DatePickerCard(), FooterItem, makeStyles(), Props, getMonthLabel()

### Community 239 - "greeting.ts"
Cohesion: 0.48
Nodes (6): dot(), employeeGreeting(), getGreetingKind(), getShiftInfo(), Greeting, minutesOf()

### Community 242 - "TripExpenseCard"
Cohesion: 0.50
Nodes (5): expenseCategory(), makeStyles(), totalExpense(), TotalRow(), TripExpenseCard()

## Knowledge Gaps
- **30 isolated node(s):** `hris_ats`, `Foundation`, `@expo/metro-runtime`, `expo-build-properties`, `react-native-screens` (+25 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1112 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **135 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HrisApi` connect `HrisApi` to `services/types.ts`, `mockApi.ts`, `erpnextApi.ts`, `useSession`, `background_check.js`?**
  _High betweenness centrality (0.402) - this node is a cross-community bridge._
- **What connects `hris_ats`, `Foundation`, `@expo/metro-runtime` to the rest of the system?**
  _30 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `goBackAnimated` be split into smaller, more focused modules?**
  _Cohesion score 0.11683599419448476 - nodes in this community are weakly interconnected._
- **Why does `Fase 3: Domain media sosial sebagai settingan, persetujuan kandidat, dan tombol uji` connect `background_check.js` to `get_default_cache_backend`?**
  _High betweenness centrality (0.388) - this node is a cross-community bridge._
- **Should `services/types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05609756097560976 - nodes in this community are weakly interconnected._
- **Should `useFaceEnroll.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09401709401709402 - nodes in this community are weakly interconnected._
- **Should `mockApi.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08084163898117387 - nodes in this community are weakly interconnected._