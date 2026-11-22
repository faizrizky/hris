# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Pengujian unit murni untuk modul analisis Background Check (tanpa ketergantungan frappe)."""

from hris_ats.bgc.analysis.case import detect_party_role, evaluate_case_severity
from hris_ats.bgc.analysis.classify import classify_text
from hris_ats.bgc.analysis.identity import (
	calculate_account_identity_match,
	calculate_match_confidence,
	evaluate_match_with_excerpt,
	generate_name_variants,
	is_mononym,
	normalize_name,
)
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
	# 50 (exact name) + 30 (2 context match) + 10 (unique) = 90
	assert conf == 90
	assert any("Exact name match" in r for r in reasons)
	assert any("Context matched" in r for r in reasons)
	assert any("Unique name bonus" in r for r in reasons)


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
	# 50 (exact name) + 20 (city location match) + 20 (bio matches CV) + 10 (declared by candidate) = 100
	assert score == 100
	assert any("Exact display name match (+50)" in r for r in reasons)
	assert any("Profile location matches candidate city" in r for r in reasons)
	assert any("Bio mentions CV entity" in r for r in reasons)
	assert any("Account self-declared by candidate (+10)" in r for r in reasons)


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
	# Exact name (+50) + 2 context (+30) + unique bonus (+10) = 90
	# But text_source = "Cuplikan" / "Snippet" capped at 70
	conf, reasons, _excerpt = evaluate_match_with_excerpt(
		candidate_name="Ronald Richard",
		candidate_variants=["ronald richard"],
		context_terms=["UI/UX", "Jakarta"],
		text=text,
		total_hits=5,
		text_source="Cuplikan",
	)
	assert conf == 70
	assert any("capped at 70" in r.lower() for r in reasons)


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
	_conf, _reasons, excerpt = evaluate_match_with_excerpt(
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
	assert res_prestasi["category"] == "Achievement"
	assert res_prestasi["severity"] == "Info"

	res_prof = classify_text("Narasumber Konferensi", "Menjadi pembicara dalam workshop teknologi")
	assert res_prof["category"] == "Professional"
	assert res_prof["severity"] == "Info"


def test_classify_risk_lexicon_and_confidence_downgrade():
	lexicon = [
		{"term": "korupsi", "category": "Legal-negative", "severity": "High", "enabled": 1},
		{"term": "judi online", "category": "Online gambling", "severity": "High", "enabled": 1},
	]

	# Match confidence high (90): severity stays High
	res_high_conf = classify_text("Kasus Korupsi Dana", "Terlibat dalam dugaan korupsi", lexicon, match_confidence=90)
	assert res_high_conf["category"] == "Risky"
	assert res_high_conf["severity"] == "High"

	# Match confidence low (< 80): severity downgraded one level to Medium
	res_low_conf = classify_text("Kasus Korupsi Dana", "Terlibat dalam dugaan korupsi", lexicon, match_confidence=75)
	assert res_low_conf["category"] == "Risky"
	assert res_low_conf["severity"] == "Medium"


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
	assert res_permohonan["category"] == "Neutral"

	res_penggugat = evaluate_case_severity(case_type="Perdata", party_role="Penggugat")
	assert res_penggugat["severity"] == "Info"

	res_saksi = evaluate_case_severity(case_type="Pidana", party_role="Saksi")
	assert res_saksi["severity"] == "Info"


def test_case_severity_mapping_criminal_defendant_is_high():
	res_terdakwa = evaluate_case_severity(case_type="Pidana", party_role="Terdakwa")
	assert res_terdakwa["severity"] == "High"
	assert res_terdakwa["category"] == "Risky"

	res_tergugat = evaluate_case_severity(case_type="Perdata", party_role="Tergugat")
	assert res_tergugat["severity"] == "Medium"
	assert res_tergugat["category"] == "Risky"


# =====================================================================
# 4. Social Media Post Analysis Tests
# =====================================================================

def test_analyze_posts_politeness_and_activity():
	lexicon = [
		{"term": "anjing", "category": "Profanity", "severity": "Low", "enabled": 1},
		{"term": "slot gacor", "category": "Online gambling", "severity": "High", "enabled": 1},
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
	assert res["risk_posts"][0]["severity"] == "High"
	assert res["professional_relevance_pct"] == 50.0  # 2 dari 4 menyebut skill


# =====================================================================
# 5. Risk Level Auto Calculation Tests
# =====================================================================

def test_calculate_risk_level_unreviewed_high_is_needs_verification():
	findings = [
		{"severity": "High", "match_confidence": 85, "hr_verdict": "Not reviewed"},
	]
	risk = calculate_risk_level(findings, politeness_score=100)
	assert risk == "Needs verification"


def test_calculate_risk_level_relevant_high_is_high():
	findings = [
		{"severity": "High", "match_confidence": 85, "hr_verdict": "Relevant"},
	]
	risk = calculate_risk_level(findings, politeness_score=100)
	assert risk == "High"


def test_calculate_risk_level_medium_threshold():
	# Less than 3 Medium findings -> Low
	findings_2 = [
		{"severity": "Medium", "match_confidence": 80, "hr_verdict": "Relevant"},
		{"severity": "Medium", "match_confidence": 80, "hr_verdict": "Relevant"},
	]
	assert calculate_risk_level(findings_2, politeness_score=90) == "Low"

	# >= 3 Medium relevant findings -> Medium
	findings_3 = [*findings_2, {"severity": "Medium", "match_confidence": 80, "hr_verdict": "Relevant"}]
	assert calculate_risk_level(findings_3, politeness_score=90) == "Medium"

	# Politeness score < 60 -> Medium
	assert calculate_risk_level([], politeness_score=50) == "Medium"


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
		case_count=0,  # Zero count should be omitted from text
		posts_count=5,
		politeness_score=100,
		risk_posts_count=0,
	)

	assert "Ronald Richard applied for UI/UX Designer." in summary
	assert "2 public accounts were found (GitHub, LinkedIn)." in summary
	assert "2 articles are likely related, 1 of them about achievements." in summary
	assert "case record" not in summary  # Clause 0 case omitted
	assert "language politeness score of 100/100 with no posts flagged as risky." in summary


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

	from scrapling.parser import Adaptor

	from hris_ats.bgc.fetch import FetchResult
	from hris_ats.bgc.providers.platform_check import PlatformCheckProvider

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



def test_toxicity_matrix_per_post():
	lexicon = [
		{"term": "anjing", "category": "Profanity", "severity": "Low", "enabled": 1, "weight": 1.0},
		{"term": "bangsat", "category": "Profanity", "severity": "Low", "enabled": 1, "weight": 1.0},
		{"term": "keren", "category": "Positive sentiment", "enabled": 1, "weight": 1.0},
		{"term": "nyesel", "category": "Negative sentiment", "enabled": 1, "weight": 1.0},
	]
	posts = [
		{"text": "Bersyukur bisa belajar banyak dari tim proyek ini."},
		{"text": "Saya kecewa dengan kebijakan yang tidak adil."},
		{"text": "Gila anjing, UI/UX aplikasi ini keren banget!"},
		{"text": "Manajemen bangsat, nyesel kerja di sana!"},
		{"text": "anjing lah"},
	]
	res = analyze_posts(posts=posts, lexicon_items=lexicon)
	assert res["tone_counts"] == {"Safe": 1, "Warning": 1, "Slang": 1, "Red flag": 1, "Unclear": 1}
	# Only the attack becomes a finding, and it waits for HR (High = needs verification)
	assert len(res["risk_posts"]) == 1
	assert res["risk_posts"][0]["severity"] == "High"
	assert res["risk_posts"][0]["risk_flags"] == "Toxic language: bangsat"
	# Slang in a positive post does not lower the politeness score; the unclear one still does
	assert res["abusive_posts_count"] == 2
	assert res["toxicity_score"] < 0
	slang_only = analyze_posts(posts=[{"text": "Gila anjing, UI/UX aplikasi ini keren banget!"}], lexicon_items=lexicon)
	assert slang_only["toxicity_score"] == 0.0 and slang_only["abusive_posts_count"] == 0
	# Sentiment words are not risk terms
	assert not any("sentiment" in rp["risk_flags"] for rp in res["risk_posts"])


def test_toxicity_matrix_uses_model_labels_when_given():
	lexicon = [{"term": "anjing", "category": "Profanity", "severity": "Low", "enabled": 1, "weight": 1.0}]
	posts = [{"text": "anjing lah"}, {"text": "anjing lah kalian semua"}, {"text": "Tidak bagus sama sekali."}]
	# Word lists cannot read these: no sentiment word, and "tidak bagus" counts as positive
	words = analyze_posts(posts=posts, lexicon_items=lexicon)
	assert [t["cell"] for t in words["tones"]] == ["Unclear", "Unclear", "Safe"]
	model = analyze_posts(posts=posts, lexicon_items=lexicon, sentiment_labels=["neutral", "negative", "negative"])
	assert [t["cell"] for t in model["tones"]] == ["Slang", "Red flag", "Warning"]
	assert [t["tone"] for t in model["tones"]] == ["Neutral", "Negative", "Negative"]
	# Model says negative but the words are clearly positive: disagreement, not an attack
	praise = analyze_posts(
		posts=[{"text": "Gila anjing, aplikasi ini amazing banget!"}], lexicon_items=lexicon, sentiment_labels=["negative"]
	)
	assert praise["tones"][0]["cell"] == "Unclear" and not praise["risk_posts"]
	# A label list of the wrong length is ignored instead of being misaligned
	assert analyze_posts(posts=posts, lexicon_items=lexicon, sentiment_labels=["negative"])["tones"] == words["tones"]
