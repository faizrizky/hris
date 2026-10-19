# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Pengujian unit murni untuk modul analisis Background Check (tanpa ketergantungan frappe)."""

from hris_ats.bgc.analysis.identity import (
	normalize_name,
	generate_name_variants,
	is_mononym,
	calculate_match_confidence,
	calculate_account_identity_match,
	evaluate_match_with_excerpt,
)
from hris_ats.bgc.analysis.classify import classify_text
from hris_ats.bgc.analysis.case import detect_party_role, evaluate_case_severity
from hris_ats.bgc.analysis.posts import analyze_posts
from hris_ats.bgc.analysis.risk import calculate_risk_level
from hris_ats.bgc.analysis.summary import generate_automated_summary
from hris_ats.bgc.providers.mock import MockProvider


# =====================================================================
# 1. Identity Analysis Tests
# =====================================================================

def test_normalize_name_removes_titles_and_punctuation():
	raw = "Dr. Ir. Budi Santoso, S.Kom., M.T."
	clean = normalize_name(raw)
	assert clean == "budi santoso"


def test_mononym_detection():
	assert is_mononym("Suharto") is True
	assert is_mononym("Budi Santoso") is False
	assert is_mononym("Dr. Wahyu") is True


def test_generate_name_variants():
	variants = generate_name_variants("Ronald Richard Smith")
	assert "ronald richard smith" in variants
	assert "ronald smith" in variants


def test_calculate_match_confidence_exact_and_context():
	candidate = "Ronald Richard"
	variants = ["ronald richard"]
	context = ["Jakarta", "UI/UX"]
	text = "Ronald Richard mahasiswa desain meraih juara lomba UI/UX di Jakarta."

	conf, reasons = calculate_match_confidence(candidate, variants, context, text, total_hits=5)
	# 50 (nama persis) + 30 (2 konteks cocok) + 10 (unik) = 90
	assert conf == 90
	assert any("Nama persis" in r for r in reasons)
	assert any("Konteks cocok" in r for r in reasons)
	assert any("Bonus nama unik" in r for r in reasons)


def test_name_twins_context_discrimination():
	"""Dua orang bernama sama 'Muhammad Rizky':
	Satu di Pekanbaru (kandidat), satu lagi di Surabaya (bukan kandidat).
	"""
	candidate = "Muhammad Rizky"
	variants = ["muhammad rizky"]
	context = ["Pekanbaru", "PT Solusi Digital"]

	# Artikel 1: Orang lain di Surabaya
	text_surabaya = "Muhammad Rizky ditangkap di Surabaya terkait kasus penipuan."
	conf_surabaya, _ = calculate_match_confidence(candidate, variants, context, text_surabaya, total_hits=50)
	# 50 (nama) + 0 (konteks tidak cocok) + 0 (hits >= 20) = 50
	assert conf_surabaya == 50

	# Artikel 2: Kandidat asli di Pekanbaru
	text_pekanbaru = "Muhammad Rizky software engineer PT Solusi Digital Pekanbaru merilis aplikasi."
	conf_pekanbaru, _ = calculate_match_confidence(candidate, variants, context, text_pekanbaru, total_hits=5)
	# 50 (nama) + 30 (2 konteks cocok) + 10 (hits < 20) = 90
	assert conf_pekanbaru == 90

	# Skor kandidat asli harus jauh lebih tinggi
	assert conf_pekanbaru > conf_surabaya


def test_calculate_account_identity_match_full_score():
	score, reasons = calculate_account_identity_match(
		candidate_name="Ronald Richard",
		candidate_variants=["ronald richard", "ronald"],
		candidate_city="Jakarta Selatan",
		candidate_cv_terms=["PT Maju Bersama", "UI/UX Designer", "Universitas Indonesia"],
		display_name="Ronald Richard",
		bio="Lead UI/UX Designer at PT Maju Bersama, alumnus Universitas Indonesia",
		location="Jakarta Selatan, Indonesia",
		declared_by_candidate=True,
		is_forbidden=False,
	)
	# 50 (nama persis) + 20 (lokasi kota cocok) + 20 (bio cocok CV) + 10 (dinyatakan kandidat) = 100
	assert score == 100
	assert any("Nama tampilan persis cocok (+50)" in r for r in reasons)
	assert any("Lokasi profil cocok" in r for r in reasons)
	assert any("Bio menyebut entitas CV" in r for r in reasons)
	assert any("Akun dinyatakan sendiri oleh kandidat (+10)" in r for r in reasons)


def test_calculate_account_identity_match_similarity_levels():
	# Kemiripan tinggi (>=90): +40
	score_high, _ = calculate_account_identity_match(
		candidate_name="Ronald Richard",
		candidate_variants=[],
		candidate_city=None,
		candidate_cv_terms=[],
		display_name="Ronald Richards",
		bio=None,
		location=None,
		declared_by_candidate=False,
	)
	assert score_high == 40

	# Kemiripan sedang (>=80): +25
	score_med, _ = calculate_account_identity_match(
		candidate_name="Ronald Richard",
		candidate_variants=[],
		candidate_city=None,
		candidate_cv_terms=[],
		display_name="Ronald D Richardson",
		bio=None,
		location=None,
		declared_by_candidate=False,
	)
	assert score_med == 25

	# Kemiripan rendah (<80): 0
	score_low, _ = calculate_account_identity_match(
		candidate_name="Ronald Richard",
		candidate_variants=[],
		candidate_city=None,
		candidate_cv_terms=[],
		display_name="Budi Santoso",
		bio=None,
		location=None,
		declared_by_candidate=False,
	)
	assert score_low == 0


def test_calculate_account_identity_match_forbidden_platforms():
	score, reasons = calculate_account_identity_match(
		candidate_name="Ronald Richard",
		candidate_variants=[],
		candidate_city="Jakarta",
		candidate_cv_terms=["UI/UX"],
		display_name="Ronald Richard",
		bio="UI/UX Designer",
		location="Jakarta",
		declared_by_candidate=True,
		is_forbidden=True,
	)
	assert score is None
	assert reasons == []


def test_calculate_account_identity_match_undeclared_below_threshold():
	score, _ = calculate_account_identity_match(
		candidate_name="Ronald Richard",
		candidate_variants=[],
		candidate_city="Jakarta",
		candidate_cv_terms=[],
		display_name="Ronald D Richardson",  # +25
		bio="Just a developer",
		location="Surabaya",  # 0
		declared_by_candidate=False,  # 0
	)
	# 25 < 50
	assert score == 25


def test_evaluate_match_with_excerpt_cuplikan_capped_at_70():
	text = "Ronald Richard meraih medali emas UI/UX Jakarta."
	# Nama persis (+50) + 2 konteks (+30) + bonus unik (+10) = 90
	# Tapi text_source = "Cuplikan" wajib dibatasi maksimal 70
	conf, reasons, excerpt = evaluate_match_with_excerpt(
		candidate_name="Ronald Richard",
		candidate_variants=["ronald richard"],
		context_terms=["UI/UX", "Jakarta"],
		text=text,
		total_hits=5,
		text_source="Cuplikan",
	)
	assert conf == 70
	assert any("dibatasi maksimal 70" in r for r in reasons)


def test_evaluate_match_with_excerpt_pdf_source_uncapped():
	text = "Ronald Richard meraih medali emas UI/UX Jakarta."
	conf, _, _ = evaluate_match_with_excerpt(
		candidate_name="Ronald Richard",
		candidate_variants=["ronald richard"],
		context_terms=["UI/UX", "Jakarta"],
		text=text,
		total_hits=5,
		text_source="PDF putusan",
	)
	assert conf == 90


def test_evaluate_match_with_excerpt_nik_redaction():
	text = "Ronald Richard NIK 3171012345678901 telah terdaftar di Jakarta."
	_, _, excerpt = evaluate_match_with_excerpt(
		candidate_name="Ronald Richard",
		candidate_variants=["ronald richard"],
		context_terms=["Jakarta"],
		text=text,
		total_hits=5,
	)
	assert "3171012345678901" not in excerpt
	assert "[NIK DIREDAKSI]" in excerpt


def test_evaluate_match_with_excerpt_picks_best_context_occurrence():
	# Nama muncul dua kali: satu di awal tanpa konteks, satu di tengah dengan konteks lengkap
	text = (
		"Daftar hadir: Ronald Richard. "
		+ ("x " * 100)
		+ "Sidang perkara Ronald Richard pekerjaan Karyawan Swasta di Jakarta Selatan terkait sengketa."
	)
	conf, reasons, excerpt = evaluate_match_with_excerpt(
		candidate_name="Ronald Richard",
		candidate_variants=["ronald richard"],
		context_terms=["Jakarta Selatan", "Karyawan Swasta"],
		text=text,
		total_hits=5,
	)
	# Harus memilih kemunculan kedua sehingga cuplikan memuat konteks
	assert "Karyawan Swasta" in excerpt
	assert "Jakarta Selatan" in excerpt


# =====================================================================
# 2. Text Classification Tests
# =====================================================================

def test_classify_prestasi_and_profesional():
	res_prestasi = classify_text("Juara 1 Lomba Desain", "Meraih penghargaan medali emas")
	assert res_prestasi["category"] == "Prestasi"
	assert res_prestasi["severity"] == "Info"

	res_prof = classify_text("Narasumber Konferensi", "Menjadi pembicara dalam workshop teknologi")
	assert res_prof["category"] == "Profesional"
	assert res_prof["severity"] == "Info"


def test_classify_risk_lexicon_and_confidence_downgrade():
	lexicon = [
		{"term": "korupsi", "category": "Hukum-negatif", "severity": "Tinggi", "enabled": 1},
		{"term": "judi online", "category": "Judi online", "severity": "Tinggi", "enabled": 1},
	]

	# Match confidence tinggi (90): severity tetap Tinggi
	res_high_conf = classify_text("Kasus Korupsi Dana", "Terlibat dalam dugaan korupsi", lexicon, match_confidence=90)
	assert res_high_conf["category"] == "Berisiko"
	assert res_high_conf["severity"] == "Tinggi"

	# Match confidence rendah (< 80): severity diturunkan satu tingkat ke Sedang
	res_low_conf = classify_text("Kasus Korupsi Dana", "Terlibat dalam dugaan korupsi", lexicon, match_confidence=75)
	assert res_low_conf["category"] == "Berisiko"
	assert res_low_conf["severity"] == "Sedang"


# =====================================================================
# 3. Court Case Analysis Tests
# =====================================================================

def test_case_role_detection():
	text = "Menyatakan Terdakwa Ronald Richard terbukti bersalah..."
	role = detect_party_role(text, "Ronald Richard")
	assert role == "Terdakwa"

	text_pemohon = "Mengabulkan permohonan pemohon Ronald Richard untuk seluruhnya..."
	role_pemohon = detect_party_role(text_pemohon, "Ronald Richard")
	assert role_pemohon == "Pemohon"


def test_case_severity_mapping_perdata_permohonan_is_info():
	"""Permohonan perdata (seperti di layar 08 desain) wajib ber-severity 'Info', bukan risiko."""
	res_permohonan = evaluate_case_severity(case_type="Perdata", party_role="Pemohon")
	assert res_permohonan["severity"] == "Info"
	assert res_permohonan["category"] == "Netral"

	res_penggugat = evaluate_case_severity(case_type="Perdata", party_role="Penggugat")
	assert res_penggugat["severity"] == "Info"

	res_saksi = evaluate_case_severity(case_type="Pidana", party_role="Saksi")
	assert res_saksi["severity"] == "Info"


def test_case_severity_mapping_criminal_defendant_is_high():
	res_terdakwa = evaluate_case_severity(case_type="Pidana", party_role="Terdakwa")
	assert res_terdakwa["severity"] == "Tinggi"
	assert res_terdakwa["category"] == "Berisiko"

	res_tergugat = evaluate_case_severity(case_type="Perdata", party_role="Tergugat")
	assert res_tergugat["severity"] == "Sedang"
	assert res_tergugat["category"] == "Berisiko"


# =====================================================================
# 4. Social Media Post Analysis Tests
# =====================================================================

def test_analyze_posts_politeness_and_activity():
	lexicon = [
		{"term": "anjing", "category": "Kata kasar", "severity": "Rendah", "enabled": 1},
		{"term": "slot gacor", "category": "Judi online", "severity": "Tinggi", "enabled": 1},
	]

	posts = [
		{"text": "Refactoring code in TypeScript today.", "created_at": "2024-03-01T10:00:00Z"},
		{"text": "Dasar anjing bikin emosi aja.", "created_at": "2024-03-02T11:00:00Z"},
		{"text": "Ayo main slot gacor malam ini!", "created_at": "2024-03-03T12:00:00Z"},
		{"text": "Loving the new React hooks.", "created_at": "2024-03-04T13:00:00Z"},
	]

	res = analyze_posts(
		posts=posts,
		required_skills=["React", "TypeScript"],
		lexicon_items=lexicon,
	)

	assert res["total_posts"] == 4
	assert res["abusive_posts_count"] == 1
	assert res["politeness_score"] < 100
	assert len(res["risk_posts"]) == 1
	assert res["risk_posts"][0]["severity"] == "Tinggi"
	assert res["professional_relevance_pct"] == 50.0  # 2 dari 4 menyebut skill


# =====================================================================
# 5. Risk Level Auto Calculation Tests
# =====================================================================

def test_calculate_risk_level_unreviewed_high_is_needs_verification():
	findings = [
		{"severity": "Tinggi", "match_confidence": 85, "hr_verdict": "Belum ditinjau"},
	]
	risk = calculate_risk_level(findings, politeness_score=100)
	assert risk == "Perlu verifikasi"


def test_calculate_risk_level_relevant_high_is_high():
	findings = [
		{"severity": "Tinggi", "match_confidence": 85, "hr_verdict": "Relevan"},
	]
	risk = calculate_risk_level(findings, politeness_score=100)
	assert risk == "Tinggi"


def test_calculate_risk_level_medium_threshold():
	# Kurang dari 3 temuan Sedang -> Rendah
	findings_2 = [
		{"severity": "Sedang", "match_confidence": 80, "hr_verdict": "Relevan"},
		{"severity": "Sedang", "match_confidence": 80, "hr_verdict": "Relevan"},
	]
	assert calculate_risk_level(findings_2, politeness_score=90) == "Rendah"

	# >= 3 temuan Sedang yang Relevan -> Sedang
	findings_3 = findings_2 + [{"severity": "Sedang", "match_confidence": 80, "hr_verdict": "Relevan"}]
	assert calculate_risk_level(findings_3, politeness_score=90) == "Sedang"

	# Skor kesantunan < 60 -> Sedang
	assert calculate_risk_level([], politeness_score=50) == "Sedang"


# =====================================================================
# 6. Automated Summary Tests
# =====================================================================

def test_generate_automated_summary_omits_zero_clauses():
	summary = generate_automated_summary(
		candidate_name="Ronald Richard",
		job_title="UI/UX Designer",
		accounts=["GitHub", "LinkedIn"],
		article_count=2,
		achievement_count=1,
		case_count=0,  # Nilai nol harus dihilangkan dari teks
		posts_count=5,
		politeness_score=100,
		risk_posts_count=0,
	)

	assert "Ronald Richard melamar sebagai UI/UX Designer." in summary
	assert "Ditemukan 2 akun publik (GitHub, LinkedIn)." in summary
	assert "Ada 2 artikel yang kemungkinan besar terkait, 1 di antaranya tentang prestasi." in summary
	assert "catatan perkara" not in summary  # Klausa 0 perkara dihilangkan
	assert "kesantunan bahasa 100/100 tanpa post yang terindikasi berisiko." in summary


# =====================================================================
# 7. Mock Provider Tests
# =====================================================================

def test_mock_provider_runs_offline():
	provider = MockProvider()
	candidate = {
		"full_name": "Ronald Richard",
		"context_terms": "Jakarta, UI/UX",
		"name_variants": "Ronald Richard\nRonald",
	}
	findings = provider.run(candidate)
	assert len(findings) > 0

	types = {f.finding_type for f in findings}
	assert "Article" in types
	assert "File" in types
	assert "Case" in types


# =====================================================================
# 8. Platform Check Provider Integration Tests
# =====================================================================

def test_platform_check_provider_profile_matching_and_threshold():
	from unittest.mock import patch
	from hris_ats.bgc.fetch import FetchResult
	from hris_ats.bgc.providers.platform_check import PlatformCheckProvider
	from scrapling.parser import Adaptor

	provider = PlatformCheckProvider()

	html_matching = """
	<html><body>
		<h1 class="vcard-names"><span class="p-name">Ronald Richard</span></h1>
		<div class="user-profile-bio"><div>Senior UI/UX Designer at PT Maju Bersama</div></div>
		<span class="p-label">Jakarta Selatan, Indonesia</span>
	</body></html>
	"""

	html_different = """
	<html><body>
		<h1 class="vcard-names"><span class="p-name">Budi Santoso</span></h1>
		<div class="user-profile-bio"><div>Backend Engineer</div></div>
		<span class="p-label">Surabaya</span>
	</body></html>
	"""

	# 1. Akun yang cocok nama tampilan dan kotanya
	fake_res_match = FetchResult(
		url="https://github.com/ronaldrichard",
		status=200,
		body=html_matching,
		page=Adaptor(html_matching),
		mode_used="company+robots",
		from_cache=False,
	)
	with patch.object(provider, "fetch", return_value=fake_res_match):
		res = provider.check_single_account(
			platform_name="GitHub",
			username="ronaldrichard",
			url_template="https://github.com/{username}",
			check_method="Status code",
			check_value="200",
			candidate_name="Ronald Richard",
			candidate_variants=["ronald richard"],
			candidate_city="Jakarta Selatan",
			candidate_cv_terms=["PT Maju Bersama", "UI/UX Designer"],
			display_name_selector=".p-name",
			bio_selector=".user-profile-bio",
			location_selector=".p-label",
			declared_by="Candidate",
		)
		assert res["exists"] == 1
		assert res["display_name"] == "Ronald Richard"
		assert res["profile_location"] == "Jakarta Selatan, Indonesia"
		assert res["identity_match"] == 100

	# 2. Akun tidak cocok nama tampilan dan lokasinya
	fake_res_diff = FetchResult(
		url="https://github.com/anotheruser",
		status=200,
		body=html_different,
		page=Adaptor(html_different),
		mode_used="company+robots",
		from_cache=False,
	)
	with patch.object(provider, "fetch", return_value=fake_res_diff):
		# Jika akun dinyatakan oleh kandidat, tetap ditampilkan dengan skor rendah
		res_cand = provider.check_single_account(
			platform_name="GitHub",
			username="anotheruser",
			url_template="https://github.com/{username}",
			candidate_name="Ronald Richard",
			candidate_city="Jakarta Selatan",
			candidate_cv_terms=["PT Maju Bersama"],
			display_name_selector=".p-name",
			bio_selector=".user-profile-bio",
			location_selector=".p-label",
			declared_by="Candidate",
		)
		assert res_cand["exists"] == 1
		assert res_cand["identity_match"] == 10  # hanya poin declared_by

		# Jika BUKAN dinyatakan kandidat (declared_by != 'Candidate') dan identity_match < 50:
		# Wajib exists = 0 (tidak ditampilkan sebagai milik kandidat)
		res_hr = provider.check_single_account(
			platform_name="GitHub",
			username="anotheruser",
			url_template="https://github.com/{username}",
			candidate_name="Ronald Richard",
			candidate_city="Jakarta Selatan",
			candidate_cv_terms=["PT Maju Bersama"],
			display_name_selector=".p-name",
			bio_selector=".user-profile-bio",
			location_selector=".p-label",
			declared_by="HR",
		)
		assert res_hr["exists"] == 0
		assert res_hr["identity_match"] == 0

